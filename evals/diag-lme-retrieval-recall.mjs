// Provider-free retrieval diagnostic on LongMemEval_S: does Palari's simple
// memory_search put an answer-bearing session in its top results? Compares
// lexical-only, whole-message local embeddings, and chunked max-slice
// embeddings on the same questions. No model API is called.
// Usage: node --max-old-space-size=4000 evals/diag-lme-retrieval-recall.mjs
//   [--ids-file .palari-alpha/fresh-60.jsonl] [--configs lexical,whole,chunk800] [--shard 0/3]
import { readFile, mkdtemp, rm, appendFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPalariBrain, ingestLongMemEvalInstance } from '../src/memory-kernel.mjs'
import { loadLongMemEvalInstances } from '../src/longmemeval.mjs'
import { answerWithSingleSearch } from '../src/answers.mjs'
import { localEmbedder } from './jev-celeris-loop.mjs'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index > 0 ? process.argv[index + 1] : fallback
}
const IDS_FILE = arg('--ids-file', '.palari-alpha/fresh-60.jsonl')
const CONFIGS = arg('--configs', 'lexical,whole,chunk800').split(',')
const [SHARD, SHARDS] = arg('--shard', '0/1').split('/').map(Number)
const OUT = join('.palari-alpha', `recall-${new Date().toISOString().replace(/[:.]/g, '-')}-s${SHARD}of${SHARDS}.jsonl`)

const ids = (await readFile(IDS_FILE, 'utf8')).trim().split('\n').map((line) => JSON.parse(line).id)
  .filter((id) => !id.startsWith('1568498a') && !id.endsWith('_abs'))
  .filter((_, index) => index % SHARDS === SHARD)
const raw = JSON.parse(await readFile('data/longmemeval_s_cleaned.json', 'utf8'))
const byId = new Map(raw.map((row) => [row.question_id, row]))
const embedders = {}
for (const config of CONFIGS) {
  if (config === 'whole') embedders[config] = await localEmbedder()
  else if (config.startsWith('chunk')) embedders[config] = await localEmbedder({ chunkChars: Number(config.slice(5)) })
  else embedders[config] = {}
}
function dedupeSessionIds(instance) {
  const seen = new Map()
  return { ...instance, haystack_session_ids: instance.haystack_session_ids.map((id) => {
    const count = (seen.get(id) ?? 0) + 1
    seen.set(id, count)
    return count === 1 ? id : `${id}#${count}`
  }) }
}
await mkdir('.palari-alpha', { recursive: true })
console.log(`${ids.length} questions · configs ${CONFIGS.join(',')} · ${OUT}`)

for (const [n, id] of ids.entries()) {
  const [instance] = loadLongMemEvalInstances([dedupeSessionIds(byId.get(id))])
  // Answer-bearing messages as Palari source IDs: <session>:<turnIndex>:<role>,
  // where a user turn and its following assistant reply share the user's index.
  const answerTurns = []
  for (const session of instance.sessions) {
    for (let index = 0; index < session.turns.length;) {
      const turn = session.turns[index]
      if (turn.role === 'user' && session.turns[index + 1]?.role === 'assistant') {
        if (turn.hasAnswer) answerTurns.push(`${session.sessionId}:${index}:user`)
        if (session.turns[index + 1].hasAnswer) answerTurns.push(`${session.sessionId}:${index}:assistant`)
        index += 2
      } else {
        if (turn.hasAnswer) answerTurns.push(`${session.sessionId}:${index}:${turn.role}`)
        index += 1
      }
    }
  }
  const record = { id, type: instance.questionType, goldSessions: instance.answerSessionIds.length, answerTurns: answerTurns.length }
  for (const config of CONFIGS) {
    const root = await mkdtemp(join(tmpdir(), 'lme-recall-'))
    const brain = await createPalariBrain({ memoryEnabled: true, statePath: join(root, 'brain.json'),
      workspaceId: 'lme', digestMode: 'off', semanticAcceleration: 'exact', ...embedders[config] })
    const scope = { palariId: 'assistant', userId: 'lme-user' }
    try {
      await ingestLongMemEvalInstance(brain, instance, scope)
      let started = Date.now()
      if (config !== 'lexical') while (!(await brain.indexSemantic(scope, { batchSize: 64 })).complete) { /* next batch */ }
      const indexMs = Date.now() - started
      const ranks = {}
      for (const limit of [20, 50]) {
        let evidence = []
        started = Date.now()
        await answerWithSingleSearch(brain, { ...scope, question: instance.question, questionDate: instance.questionDate?.slice(0, 10),
          limit, evidenceMaxChars: 100_000, provider: (input) => { evidence = input.evidence; return { abstained: true, text: 'probe', bases: [] } } })
        const sessions = new Set(evidence.map((row) => row.session))
        const messages = new Set(evidence.map((row) => row.sourceMessageId))
        ranks[limit] = {
          any: instance.answerSessionIds.some((s) => sessions.has(s)),
          all: instance.answerSessionIds.every((s) => sessions.has(s)),
          // Stricter: the exact answer-bearing messages (LongMemEval has_answer).
          turnsFound: answerTurns.filter((t) => messages.has(t)).length,
          ms: Date.now() - started,
        }
      }
      record[config] = { indexMs, top20any: ranks[20].any, top20all: ranks[20].all, top50any: ranks[50].any, top50all: ranks[50].all,
        turns20: ranks[20].turnsFound, turns50: ranks[50].turnsFound, searchMs: ranks[20].ms }
    } finally {
      brain.close()
      await rm(root, { recursive: true, force: true })
    }
  }
  await appendFile(OUT, `${JSON.stringify(record)}\n`)
  console.log(`[${n + 1}/${ids.length}] ${record.type.padEnd(25)} turns=${answerTurns.length} ${CONFIGS.map((c) => `${c}:${record[c].top20any ? 'Y' : '-'}${record[c].top20all ? 'Y' : '-'} t${record[c].turns20}`).join(' ')} ${id}`)
}
