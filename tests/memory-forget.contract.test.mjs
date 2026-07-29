import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createPalariBrain,
  forgetWithReport,
  ingestChatTurn,
} from '../src/index.mjs'

const SCOPE = Object.freeze({
  palariId: 'palari-forget',
  userId: 'user-forget',
})
const OTHER = Object.freeze({
  palariId: 'palari-forget',
  userId: 'someone-else',
})

async function openBrain(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-forget-'))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'forget',
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seed(brain, exchanges, scope = SCOPE) {
  for (const [index, exchange] of exchanges.entries()) {
    await ingestChatTurn(brain, {
      assistantMessage: exchange.assistant ?? 'Noted.',
      eventAt: new Date(Date.UTC(2025, 0, 1) + index * 86_400_000)
        .toISOString(),
      palariId: scope.palariId,
      retention: 'durable',
      sourceMessageId: exchange.id,
      userId: scope.userId,
      userMessage: exchange.user,
    })
  }
}

const EXCHANGES = [
  {
    id: 'sess-a:0',
    user: 'My doctor started me on Lexapro for my anxiety last month.',
    assistant:
      'Understood — I will remember that you take Lexapro for anxiety.',
  },
  {
    id: 'sess-a:1',
    // A paraphrase that never says "Lexapro" but shares "anxiety" with the
    // deleted rows. It must SURVIVE deletion and be REPORTED as residual.
    user: 'The little white pill really helps with my anxiety.',
  },
  {
    id: 'sess-b:0',
    user: 'My sister Ana visits every other weekend.',
  },
]

test('a phrase deletion removes the whole turn, echo included', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, EXCHANGES)

  const report = forgetWithReport(brain, SCOPE, { phrase: 'Lexapro' })
  assert.equal(report.operation, 'memory_forget_request')
  // Both rows of the turn go: the user statement and the assistant echo —
  // an echo left standing would mean the deletion did not delete.
  assert.equal(report.deletedCount, 2)
  assert.equal(report.candidates, 2)

  const exact = brain.exploreFind(SCOPE, { phrase: 'Lexapro' })
  assert.deepEqual(exact.matches, [])
  const ranked = brain.exploreFind(SCOPE, { phrase: 'Lexapro', ranked: true })
  assert.ok(!ranked.matches.some((match) => /Lexapro/i.test(match.snippet)))
})

test('a surviving paraphrase is reported, never silently kept', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, EXCHANGES)

  const report = forgetWithReport(brain, SCOPE, { phrase: 'Lexapro' })
  // "The little white pill" shares no term with the REQUEST — only with
  // the deleted rows' own text ("anxiety"). The re-probe uses that
  // vocabulary, so the paraphrase shows up as residual.
  const residual = report.residual.find((row) =>
    /little white pill/.test(row.snippet))
  assert.ok(residual, JSON.stringify(report.residual))
  assert.equal(residual.matchedVia, 'deleted_content_terms')
  assert.equal(residual.speaker, 'user')
  // Residual entries are references to canonical rows, readable in full.
  const read = brain.exploreRead(SCOPE, {
    evidenceIds: [residual.evidenceId],
  })
  assert.match(read.messages[0].text, /little white pill/)
  // Unrelated rows are not dragged into the report.
  assert.ok(!report.residual.some((row) => /sister Ana/.test(row.snippet)))
})

test('deletion by phrase stays inside the caller scope', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, EXCHANGES)
  await seed(brain, [{
    id: 'sess-o:0',
    user: 'I also take Lexapro every morning.',
  }], OTHER)

  const report = forgetWithReport(brain, SCOPE, { phrase: 'Lexapro' })
  assert.ok(report.deletedCount >= 2)
  const other = brain.exploreFind(OTHER, { phrase: 'Lexapro' })
  assert.equal(other.matches.length, 1)
})

test('deleted turns are tombstoned: re-ingest cannot resurrect', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, EXCHANGES)
  forgetWithReport(brain, SCOPE, { phrase: 'Lexapro' })

  await seed(brain, [EXCHANGES[0]])
  const found = brain.exploreFind(SCOPE, { phrase: 'Lexapro' })
  assert.deepEqual(found.matches, [])
})

test('a phrase that reaches nothing deletes nothing and says so',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, EXCHANGES)
    const report = forgetWithReport(brain, SCOPE, {
      phrase: 'quetzalcoatlus',
    })
    assert.equal(report.candidates, 0)
    assert.equal(report.deletedCount, 0)
    assert.deepEqual(report.residual, [])
    // Both rows of the Lexapro turn are still present: the user statement
    // and the assistant echo.
    const untouched = brain.exploreFind(SCOPE, { phrase: 'Lexapro' })
    assert.equal(untouched.matches.length, 2)
  })

test('the report is deterministic for the same journal', async (t) => {
  const first = await openBrain(t)
  const second = await openBrain(t)
  await seed(first, EXCHANGES)
  await seed(second, EXCHANGES)
  assert.deepEqual(
    forgetWithReport(first, SCOPE, { phrase: 'Lexapro' }),
    forgetWithReport(second, SCOPE, { phrase: 'Lexapro' }),
  )
})

test('phrase validation refuses empty and oversized requests', async (t) => {
  const brain = await openBrain(t)
  assert.throws(() => forgetWithReport(brain, SCOPE, { phrase: '   ' }))
  assert.throws(() =>
    forgetWithReport(brain, SCOPE, { phrase: 'x'.repeat(201) }))
})

test('a disabled store skips without inventing a deletion', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'palari-forget-off-'))
  const brain = await createPalariBrain({
    memoryEnabled: false,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'forget-off',
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  const report = forgetWithReport(brain, SCOPE, { phrase: 'Lexapro' })
  assert.equal(report.deletedCount, 0)
  assert.deepEqual(report.residual, [])
})
