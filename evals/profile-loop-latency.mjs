// Latency profile of the Jev + Celeris loop on a few LongMemEval_S questions.
// Times every provider call, Palari retrieval call and the one-off embedding
// catch-up separately, plus bare network round trips. Diagnostic only.
// Usage: node --max-old-space-size=6000 evals/profile-loop-latency.mjs [--n 8] [--seed 11]
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPalariBrain, ingestLongMemEvalInstance } from '../src/memory-kernel.mjs'
import { loadLongMemEvalInstances } from '../src/longmemeval.mjs'
import { answerWithRetrieval } from '../src/answers.mjs'
import { createClients, createLoopProvider, localEmbedder } from './jev-celeris-loop.mjs'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index > 0 ? process.argv[index + 1] : fallback
}
const N = Number(arg('--n', 8))
const SEED = Number(arg('--seed', 11))
const base = createClients({ celerisCapUsd: 0.05, jevCapUsd: 0.02 })
let events = []
const timed = (kind, fn, size) => async (...args) => {
  const started = performance.now()
  try { return await fn(...args) } finally {
    events.push({ kind, ms: performance.now() - started, chars: size(...args) })
  }
}
const clients = {
  ...base,
  celerisJson: timed('celeris', base.celerisJson, (system, user) => system.length + user.length),
  jevDecide: timed('jev', base.jevDecide, (state, questions) => state.length + JSON.stringify(questions).length),
}

// Bare round trips: the smallest possible request to each provider.
const floor = { celeris: [], jev: [] }
for (let i = 0; i < 3; i += 1) {
  let t = performance.now()
  await base.celerisChat([{ role: 'user', content: 'Reply with exactly: ok' }], { maxTokens: 5 })
  floor.celeris.push(performance.now() - t)
  t = performance.now()
  await base.jevDecide('The sky is blue.', { q: { type: 'noul', instructions: 'Is the sky blue?' } })
  floor.jev.push(performance.now() - t)
}

let state = SEED >>> 0
const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const raw = JSON.parse(await readFile('data/longmemeval_s_cleaned.json', 'utf8'))
  .filter((row) => !String(row.question_id).startsWith('1568498a') && !row.question_id.endsWith('_abs'))
const sample = Array.from({ length: N }, () => raw.splice(Math.floor(random() * raw.length), 1)[0])
const embedding = await localEmbedder()
const scope = { palariId: 'assistant', userId: 'lme-user' }
const perQuestion = []

for (const rawInstance of sample) {
  const [instance] = loadLongMemEvalInstances([rawInstance])
  const questionDate = instance.questionDate?.slice(0, 10)
  const root = await mkdtemp(join(tmpdir(), 'lme-prof-'))
  const brain = await createPalariBrain({ memoryEnabled: true, statePath: join(root, 'brain.json'),
    workspaceId: 'lme', digestMode: 'off', semanticAcceleration: 'exact', ...embedding })
  try {
    let t = performance.now()
    await ingestLongMemEvalInstance(brain, instance, scope)
    const ingestMs = performance.now() - t
    t = performance.now()
    // Index fully up front, as a deployed host would during idle time.
    while (!(await brain.indexSemantic(scope, { batchSize: 200 })).complete) { /* next batch */ }
    const embedMs = performance.now() - t

    events = []
    const trace = { question: instance.question }
    const inner = createLoopProvider({ clients, trace, questionDate, speakers: 'all' })
    const provider = async (session) => inner({ ...session, retrieve: timed('retrieve', session.retrieve, (r) => r.tool.length) })
    provider.requiresEvidenceCommitment = true
    t = performance.now()
    const answer = await answerWithRetrieval(brain, { ...scope, question: instance.question, questionDate, provider,
      maxRetrievalCalls: 4, allowEmptyAbstention: true, iterativeRetrieval: true, briefingPolicy: 'digest', retrievalProfile: 'simple' })
    const totalMs = performance.now() - t
    const sum = (kind) => events.filter((e) => e.kind === kind).reduce((s, e) => s + e.ms, 0)
    const row = { id: instance.questionId, type: instance.questionType, ingestMs, embedMs, totalMs,
      celerisMs: sum('celeris'), jevMs: sum('jev'), retrieveMs: sum('retrieve'),
      calls: events.map((e) => `${e.kind}:${Math.round(e.ms)}ms/${Math.round(e.chars / 1000)}k`).join(' '),
      abstained: answer.abstained }
    row.otherMs = totalMs - row.celerisMs - row.jevMs - row.retrieveMs
    perQuestion.push(row)
    console.log(`${row.type.padEnd(25)} total ${Math.round(totalMs)}ms | ${row.calls}`)
  } finally {
    brain.close()
    await rm(root, { recursive: true, force: true })
  }
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
const col = (k) => perQuestion.map((r) => r[k])
console.log(`\nBare round trip median: Celeris ${Math.round(median(floor.celeris))}ms · Jev ${Math.round(median(floor.jev))}ms`)
console.log(`One-off per history: ingest ${Math.round(mean(col('ingestMs')))}ms · embedding catch-up ${Math.round(mean(col('embedMs')))}ms`)
console.log(`Per answer (mean): total ${Math.round(mean(col('totalMs')))}ms = Celeris ${Math.round(mean(col('celerisMs')))} + Jev ${Math.round(mean(col('jevMs')))} + Palari retrieval ${Math.round(mean(col('retrieveMs')))} + other ${Math.round(mean(col('otherMs')))}`)
const all = (kind) => perQuestion.flatMap((r) => r.calls.split(' ').filter((c) => c.startsWith(kind)).map((c) => Number(c.split(':')[1].split('ms')[0])))
for (const kind of ['celeris', 'jev', 'retrieve']) {
  const xs = all(kind)
  if (xs.length) console.log(`${kind}: ${xs.length} calls · median ${median(xs)}ms · max ${Math.max(...xs)}ms`)
}
const s = base.spend
console.log(`Spend: Celeris ${s.celerisCalls} calls $${s.celeris.toFixed(4)} · Jev ${s.jevCalls} calls $${s.jev.toFixed(4)}`)
