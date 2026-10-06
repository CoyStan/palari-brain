// Local OpenAI-compatible proxy for running tau2-bench on Celeris-1, with an
// aggregate dollar cap persisted across runs and an optional Jev action guard.
// Routes: /agent/v1/chat/completions and /user/v1/chat/completions (separate
// accounting). Never logs credentials. Diagnostic only.
// Usage: node evals/tau2-celeris-proxy.mjs --port 8787 --cap-usd 2.00
//   --spend-file <path> [--guard jev] [--guard-threshold 0.5]
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index > 0 ? process.argv[index + 1] : fallback
}
const PORT = Number(arg('--port', 8787))
const CAP = Number(arg('--cap-usd', 2))
const SPEND_FILE = arg('--spend-file', '.palari-alpha/tau2-spend.json')
const GUARD = arg('--guard', 'none')
const GUARD_THRESHOLD = Number(arg('--guard-threshold', 0.5))
// advise: flagged calls go back to Celeris once with the concern and its reply
// is returned as is. block: the flagged action is withheld and Celeris must
// answer the user without tools this turn.
const GUARD_MODE = arg('--guard-mode', 'advise')
const CELERIS = 'https://inference.celeris.ai/celeris-1/v1/chat/completions'
const celerisKey = process.env.API_KEY_CELERI
const jevKey = process.env.JEV_API_KEY
if (!celerisKey) throw new Error('API_KEY_CELERI is not set.')
if (GUARD === 'jev' && !jevKey) throw new Error('JEV_API_KEY is required for --guard jev.')

const spend = existsSync(SPEND_FILE)
  ? JSON.parse(readFileSync(SPEND_FILE, 'utf8'))
  : { usd: 0, celerisCalls: 0, jevCalls: 0, byRole: {}, guard: { checked: 0, flagged: 0, revised: 0 } }
const save = () => writeFileSync(SPEND_FILE, JSON.stringify(spend, null, 1))
const add = (role, usd) => {
  spend.usd += usd
  spend.byRole[role] = (spend.byRole[role] ?? 0) + usd
}
const celerisCost = (usage = {}) => {
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0
  const fresh = (usage.prompt_tokens ?? 0) - cached
  return fresh * 0.20e-6 + cached * 0.02e-6 + (usage.completion_tokens ?? 0) * 0.70e-6
}

async function celeris(body, role) {
  const reserve = (JSON.stringify(body.messages ?? []).length / 3) * 0.20e-6 + (body.max_tokens ?? 1024) * 0.70e-6
  if (spend.usd + reserve > CAP) {
    const error = new Error(`spend cap reached: $${spend.usd.toFixed(4)} of $${CAP}`)
    error.status = 429
    throw error
  }
  const response = await fetch(CELERIS, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${celerisKey}` },
    body: JSON.stringify({ ...body, model: 'celeris-1' }),
    signal: AbortSignal.timeout(120_000),
  })
  const json = await response.json().catch(() => ({}))
  spend.celerisCalls += 1
  add(role, json.usage ? celerisCost(json.usage) : reserve)
  // Prompt-cache accounting per role: how much input Celeris billed as cached.
  const tokens = (spend.tokens ??= {})
  const t = (tokens[role] ??= { prompt: 0, cached: 0, calls: 0, callsWithHit: 0 })
  const cachedNow = json.usage?.prompt_tokens_details?.cached_tokens ?? 0
  t.prompt += json.usage?.prompt_tokens ?? 0
  t.cached += cachedNow
  t.calls += 1
  if (cachedNow > 0) t.callsWithHit += 1
  save()
  if (!response.ok) {
    const error = new Error(`Celeris HTTP ${response.status}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`)
    error.status = response.status
    throw error
  }
  return json
}

// Celeris occasionally returns neither text nor a tool call; retry once.
const isEmpty = (reply) => {
  const message = reply.choices?.[0]?.message ?? {}
  return !message.tool_calls?.length && !String(message.content ?? '').trim()
}
async function celerisNonEmpty(body, role) {
  const reply = await celeris(body, role)
  if (!isEmpty(reply)) return reply
  spend.emptyRetries = (spend.emptyRetries ?? 0) + 1
  return celeris(body, role)
}

async function jev(state, questions) {
  const reserve = (state.length / 3 + 500 * Object.keys(questions).length) * 0.042e-6
  if (spend.usd + reserve > CAP) throw Object.assign(new Error('spend cap reached'), { status: 429 })
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jevKey}` },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
    signal: AbortSignal.timeout(60_000),
  })
  const json = await response.json().catch(() => ({}))
  spend.jevCalls += 1
  add('jev', (json.usage?.input_tokens ?? reserve / 0.042e-6) * 0.042e-6)
  save()
  if (!response.ok) throw new Error(`Jev HTTP ${response.status}`)
  return json.answers
}

// Jev action guard: before a state-changing tool call reaches the
// environment, Jev checks it against the policy and the conversation. A
// flagged call is sent back to Celeris once with the concern; the revised
// reply is returned whatever it is (the guard never invents actions).
const READ_ONLY = /^(get_|find_|list_|search_|calculate|think|check_|lookup|read_)/
function textOf(message) {
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) return message.content.map((part) => part.text ?? '').join('')
  return ''
}
async function guard(body, reply) {
  const message = reply.choices?.[0]?.message
  const calls = (message?.tool_calls ?? []).filter((call) => !READ_ONLY.test(call.function?.name ?? ''))
  if (!calls.length) return reply
  spend.guard.checked += 1
  const policy = textOf(body.messages.find((m) => m.role === 'system') ?? { content: '' }).slice(0, 12_000)
  const recent = body.messages.filter((m) => m.role !== 'system').slice(-14).map((m) => {
    if (m.role === 'tool') return `TOOL RESULT: ${textOf(m).slice(0, 800)}`
    if (m.tool_calls?.length) return `AGENT CALLED: ${m.tool_calls.map((c) => `${c.function.name}(${c.function.arguments})`).join('; ')}`
    return `${m.role.toUpperCase()}: ${textOf(m).slice(0, 800)}`
  }).join('\n')
  const proposed = calls.map((c) => `${c.function.name}(${c.function.arguments})`).join('; ')
  const answers = await jev(
    `AGENT POLICY (excerpt):\n${policy}\n\nRECENT CONVERSATION:\n${recent}\n\nPROPOSED ACTION: ${proposed}`,
    {
      compliant: { type: 'noul', instructions: 'Does the proposed action follow the agent policy, with arguments consistent with the conversation and tool results?' },
      confirmed: { type: 'noul', instructions: 'If the policy requires explicit user confirmation before this kind of action, has the user explicitly confirmed this exact action? (Answer yes if no confirmation is required.)' },
    })
  const pCompliant = answers.compliant?.noul ?? 1
  const pConfirmed = answers.confirmed?.noul ?? 1
  if (pCompliant >= GUARD_THRESHOLD && pConfirmed >= GUARD_THRESHOLD) return reply
  spend.guard.flagged += 1
  const concern = [
    pCompliant < GUARD_THRESHOLD ? 'it may not follow the policy or may use arguments not supported by the conversation and tool results' : '',
    pConfirmed < GUARD_THRESHOLD ? 'the policy may require explicit user confirmation that has not been given' : '',
  ].filter(Boolean).join(', and ')
  const revised = GUARD_MODE === 'block'
    ? await celerisNonEmpty({
      ...body,
      tool_choice: 'none',
      messages: [...body.messages, { role: 'system', content: `A policy reviewer blocked your planned action ${proposed}: ${concern}. Do not perform it now. Reply to the user instead: explain what the policy allows, or ask for the explicit confirmation or details that are missing.` }],
    }, 'agent')
    : await celerisNonEmpty({
      ...body,
      messages: [...body.messages, { role: 'system', content: `A reviewer flagged your planned action ${proposed}: ${concern}. Re-check the policy and the conversation. If the action is correct and allowed, issue it again; otherwise respond to the user instead (for example, ask for confirmation or missing details).` }],
    }, 'agent')
  spend.guard.revised += 1
  save()
  return revised
}

createServer(async (request, response) => {
  const send = (status, payload) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(payload))
  }
  try {
    if (request.method === 'GET' && request.url.endsWith('/spend')) return send(200, spend)
    if (request.method === 'GET' && request.url.endsWith('/models')) return send(200, { object: 'list', data: [{ id: 'celeris-1', object: 'model' }] })
    const role = request.url.startsWith('/agent/') ? 'agent' : request.url.startsWith('/user/') ? 'user' : null
    if (request.method !== 'POST' || !role || !request.url.endsWith('/chat/completions')) return send(404, { error: { message: 'not found' } })
    let raw = ''
    for await (const chunk of request) raw += chunk
    const body = JSON.parse(raw)
    delete body.stream
    let reply = await celerisNonEmpty(body, role)
    if (role === 'agent' && GUARD === 'jev') reply = await guard(body, reply)
    send(200, reply)
  } catch (error) {
    send(error.status ?? 500, { error: { message: error.message, type: 'proxy_error' } })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`proxy on 127.0.0.1:${PORT} cap $${CAP} guard ${GUARD}/${GUARD_MODE} spend $${spend.usd.toFixed(4)}`))
