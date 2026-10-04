// Diagnostic transport: lets Palari's OpenAI Responses adapter (memory
// numbers, memory_bridge, confirmation reviewer) run on Celeris-1. Celeris's
// own /v1/responses completes with an empty output array when tools are
// offered, so this translates each Responses body to chat/completions and the
// reply back to Responses output items. Stateless and replay-safe: reasoning
// items are dropped because Celeris returns none. Never prints the key.
const CELERIS_CHAT_URL = 'https://inference.celeris.ai/celeris-1/v1/chat/completions'
const PRICE_IN = 0.20 / 1e6
const PRICE_OUT = 0.70 / 1e6

const textOf = (content) => (typeof content === 'string'
  ? content
  : Array.isArray(content) ? content.map((part) => part?.text ?? '').join('') : '')

export function responsesBodyToChat(body) {
  const messages = []
  if (body.instructions) messages.push({ role: 'system', content: body.instructions })
  for (const item of body.input ?? []) {
    if (item.type === 'reasoning') continue
    if (item.type === 'function_call') {
      const last = messages.at(-1)
      const call = { id: item.call_id, type: 'function', function: { name: item.name, arguments: item.arguments } }
      if (last?.role === 'assistant' && !last.closed) (last.tool_calls ??= []).push(call)
      else messages.push({ role: 'assistant', content: '', tool_calls: [call] })
      continue
    }
    if (item.type === 'function_call_output') {
      messages.push({ role: 'tool', tool_call_id: item.call_id, content: String(item.output ?? '') })
      continue
    }
    const role = item.role === 'developer' ? 'system' : item.role ?? 'user'
    messages.push({ role, content: textOf(item.content) })
  }
  for (const message of messages) delete message.closed
  const chat = {
    model: 'celeris-1',
    messages,
    temperature: 0,
    max_tokens: body.max_output_tokens ?? 1024,
  }
  if (body.tools?.length) {
    chat.tools = body.tools.map((tool) => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }))
    chat.parallel_tool_calls = body.parallel_tool_calls ?? false
  }
  if (typeof body.tool_choice === 'string') chat.tool_choice = body.tool_choice
  else if (body.tool_choice?.name) chat.tool_choice = { type: 'function', function: { name: body.tool_choice.name } }
  if (!chat.tools) delete chat.tool_choice
  if (body.text?.format?.type === 'json_schema') {
    const { name, schema, strict } = body.text.format
    chat.response_format = { type: 'json_schema', json_schema: { name, schema, strict } }
  }
  return chat
}

export function chatReplyToResponses(json) {
  const choice = json.choices?.[0] ?? {}
  const message = choice.message ?? {}
  const output = []
  const text = textOf(message.content).trim()
  if (text) output.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] })
  for (const call of message.tool_calls ?? []) {
    output.push({ type: 'function_call', call_id: call.id, name: call.function?.name, arguments: call.function?.arguments ?? '{}' })
  }
  const truncated = choice.finish_reason === 'length'
  return {
    object: 'response',
    status: truncated ? 'incomplete' : 'completed',
    ...(truncated ? { incomplete_details: { reason: 'max_output_tokens' } } : {}),
    output,
    usage: { input_tokens: json.usage?.prompt_tokens, output_tokens: json.usage?.completion_tokens },
  }
}

// spend: shared mutable { usd, calls }. Reserves a conservative worst case
// before each dispatch and refuses any call that could cross capUsd.
export function createCelerisResponsesInvoke({ apiKey, capUsd, spend, timeoutMs = 60_000 }) {
  if (!apiKey) throw new Error('Celeris API key is required.')
  return async function invokeCeleris({ body } = {}) {
    const chat = responsesBodyToChat(body)
    const reserve = (JSON.stringify(chat).length / 2) * PRICE_IN + chat.max_tokens * PRICE_OUT
    if (spend.usd + reserve > capUsd) {
      const error = new Error(`Celeris spend cap: $${spend.usd.toFixed(4)} + reserve $${reserve.toFixed(4)} > $${capUsd}`)
      error.code = 'CELERIS_SPEND_CAP'
      throw error
    }
    const response = await fetch(CELERIS_CHAT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(chat),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = await response.json().catch(() => ({}))
    spend.calls += 1
    spend.usd += json.usage
      ? json.usage.prompt_tokens * PRICE_IN + json.usage.completion_tokens * PRICE_OUT
      : reserve
    if (!response.ok) {
      const error = new Error(`Celeris HTTP ${response.status}: ${JSON.stringify(json.error ?? json).slice(0, 200)}`)
      error.code = 'CELERIS_HTTP_ERROR'
      throw error
    }
    const translated = chatReplyToResponses(json)
    if (process.env.CELERIS_DEBUG && !translated.output.length) console.log(`  [debug empty] ${JSON.stringify(json.choices?.[0]).slice(0, 700)}`)
    return translated
  }
}
