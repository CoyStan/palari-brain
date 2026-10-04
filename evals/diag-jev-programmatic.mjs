// Alpha diagnostic: a host-driven answer loop where code owns the protocol,
// Jev makes typed decisions (relevance, support, instruction-following) and
// Celeris only writes short text (search keywords, final answer). Runs inside
// answerWithRetrieval so Palari's commitment gate still checks every basis.
// Jev can only block: a flagged answer becomes a fixed host abstention before
// commitment. Not a benchmark. Reads API_KEY_CELERI and JEV_API_KEY.
// Usage: node evals/diag-jev-programmatic.mjs [--rounds 2] [--embed] [--no-expand]
//   [--no-bridge] [--no-change-probe] [--no-verify] [--only ids] [--show-blocked]
// --embed uses a local all-MiniLM-L6-v2 embedder (optional @huggingface/transformers,
// installed with --no-save); no provider call.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPalariBrain, ingestChatTurn, forgetMemories } from '../src/core.mjs'
import { answerWithRetrieval } from '../src/answers.mjs'
import { turns, questions, afterForget, grade } from './hard-memory-fixture.mjs'
import { createClients, createLoopProvider, localEmbedder } from './jev-celeris-loop.mjs'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index > 0 ? process.argv[index + 1] : fallback
}
const ROUNDS = Number(arg('--rounds', 1))
const EXPAND = !process.argv.includes('--no-expand')
const VERIFY = !process.argv.includes('--no-verify')
const BRIDGE = !process.argv.includes('--no-bridge')
const EMBED = process.argv.includes('--embed')
const CHANGE = !process.argv.includes('--no-change-probe')
const UNSUPPORTED_MAX = Number(arg('--unsupported-max', 0.2))
const ONLY = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null
const SHOW_BLOCKED = process.argv.includes('--show-blocked')
const RELEVANCE_MIN = Number(arg('--relevance-min', 0.3))
const CELERIS_CAP = Number(arg('--celeris-cap-usd', 0.20))
const JEV_CAP = Number(arg('--jev-cap-usd', 0.05))
const QUESTION_DATE = '2026-10-04'

const clients = createClients({ celerisCapUsd: CELERIS_CAP, jevCapUsd: JEV_CAP })
const { spend } = clients
const embedding = EMBED ? await localEmbedder() : {}
const showBlocked = ({ verifyState, support, obey }) => console.log(`  ┌ Jev saw:\n${verifyState.split('\n').map((l) => `  │ ${l}`).join('\n')}\n  └ probabilities ${JSON.stringify(support.probabilities)}, P(obeys instruction) ${obey.noul}`)

const scope = { palariId: 'assistant', userId: 'dana' }
const records = []

async function askOne(brain, item, round) {
  const trace = { question: item.q }
  let answer
  try {
    answer = await answerWithRetrieval(brain, { ...scope, question: item.q, questionDate: QUESTION_DATE,
      provider: createLoopProvider({ clients, trace, questionDate: QUESTION_DATE, expand: EXPAND, bridge: BRIDGE,
        change: CHANGE, verify: VERIFY, relevanceMin: RELEVANCE_MIN, unsupportedMax: UNSUPPORTED_MAX,
        onBlocked: SHOW_BLOCKED ? showBlocked : null }), maxRetrievalCalls: 4, allowEmptyAbstention: true, iterativeRetrieval: BRIDGE,
      briefingPolicy: 'digest', retrievalProfile: 'simple' })
  } catch (error) {
    answer = { error: error.message, abstained: null, answer: `ERROR: ${error.message}` }
  }
  const has = (rows) => (item.gold ? (rows ?? []).some((row) => row.text.toLowerCase().includes(item.gold.toLowerCase())) : null)
  const ok = grade(item, answer)
  records.push({ round, id: item.id, ok, found: has(trace.candidates), kept: has(trace.relevant), blocked: !!trace.blocked, hedged: !!trace.hedged })
  const parts = [
    `found=${has(trace.candidates) ?? '-'}`, trace.bridged !== undefined ? `bridge+${trace.bridged}` : '', `kept=${has(trace.relevant) ?? '-'} (${trace.relevant?.length ?? 0}/${trace.candidates?.length ?? 0})`,
    trace.pSupported !== undefined ? `P(sup) ${trace.pSupported} P(unsup) ${trace.pUnsupported} P(obey) ${trace.pObey}` : '',
    trace.hedged ? 'HEDGED' : '',
    trace.blocked ? `BLOCKED draft: "${trace.draft}"` : '',
    trace.bridgeError ? `bridge-probe error: ${trace.bridgeError}` : '',
    trace.composeError ? `compose error: ${trace.composeError}` : '',
  ].filter(Boolean)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${item.id.padEnd(14)} ${parts.join('  ')}\n      ${answer.abstained ? '[abstain] ' : ''}${String(answer.answer).slice(0, 160)}`)
}

try {
  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`-- round ${round} (embed=${EMBED}, expand=${EXPAND}, bridge=${BRIDGE}, change-probe=${CHANGE}, verify=${VERIFY}, relevance>=${RELEVANCE_MIN}, unsupported<${UNSUPPORTED_MAX})`)
    const root = await mkdtemp(join(tmpdir(), 'palari-prog-'))
    const brain = await createPalariBrain({ memoryEnabled: true, statePath: join(root, 'brain.json'),
      workspaceId: 'prog-diag', digestMode: 'off', semanticAcceleration: 'exact', ...embedding })
    try {
      for (const [index, [day, text]] of turns.entries()) {
        await ingestChatTurn(brain, { ...scope, userMessage: text, assistantMessage: 'Noted.', retention: 'durable',
          sourceMessageId: `turn-${index}`, eventAt: `2026-${day}T12:00:00Z` })
      }
      for (const item of questions) if (!ONLY || ONLY.has(item.id)) await askOne(brain, item, round)
      const allergy = brain.listEvidence(scope).filter((row) => /allergic to peanuts/.test(row.content)).map((row) => row.id)
      forgetMemories(brain, allergy, scope)
      console.log(`   (forgot ${allergy.length} allergy row)`)
      for (const item of afterForget) if (!ONLY || ONLY.has(item.id)) await askOne(brain, item, round)
    } finally {
      brain.close()
      await rm(root, { recursive: true, force: true })
    }
  }
} catch (error) {
  console.log(`ERROR  ${error.message}`)
} finally {
  const pass = records.filter((r) => r.ok).length
  const missed = [...new Set(records.filter((r) => r.found === false).map((r) => r.id))]
  const dropped = [...new Set(records.filter((r) => r.found && r.kept === false).map((r) => r.id))]
  console.log(`\n${pass}/${records.length} pass · search missed: ${missed.join(', ') || 'none'} · Jev dropped needed memory: ${dropped.join(', ') || 'none'} · blocked: ${records.filter((r) => r.blocked).length} · hedged: ${records.filter((r) => r.hedged).length}`)
  console.log(`Spend: Celeris ${spend.celerisCalls} calls $${spend.celeris.toFixed(4)} · Jev ${spend.jevCalls} calls $${spend.jev.toFixed(5)}`)
}
