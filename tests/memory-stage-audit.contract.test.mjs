import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_STAGE_CLASSIFICATIONS,
  buildMemoryStageAudit,
} from '../evals/memory-stage-audit.mjs'

function trace({ returned = [], selected = [] } = {}) {
  return {
    answerCommitted: selected.length > 0,
    retrievalTranscript: [{
      result: {
        messages: returned.map((evidenceId) => ({
          evidenceId,
          session: `session-${evidenceId}`,
          text: `Evidence ${evidenceId}`,
        })),
      },
      tool: 'memory_read',
    }],
    selectedEvidenceIds: selected,
  }
}

function judgment(field, value, rationale = '') {
  return {
    [field]: value,
    labelAuthority: 'deterministic-test',
    rationale,
  }
}

function sessionTrace(returnedSessions = []) {
  return {
    answerCommitted: false,
    retrievalTranscript: [{
      result: {
        messages: returnedSessions.map((session) => ({
          evidenceId: `evidence-${session}`,
          session,
          text: `Evidence from ${session}`,
        })),
      },
      tool: 'memory_read',
    }],
    selectedEvidenceIds: [],
  }
}

function auditCase({
  ambiguity = false,
  answerCorrect = true,
  canonical = ['e1', 'e2'],
  id,
  material = { e1: true, e2: true },
  required = ['e1', 'e2'],
  returned = ['e1', 'e2'],
  selected = ['e1', 'e2'],
} = {}) {
  return {
    ambiguityJudgment: judgment('ambiguous', ambiguity),
    answerJudgment: judgment('correct', answerCorrect),
    canonicalEvidenceIds: canonical,
    id,
    materialUseJudgments: Object.entries(material).map(
      ([evidenceId, materiallyUsed]) => ({
        evidenceId,
        materiallyUsed,
        rationale: 'Synthetic stage label.',
      }),
    ),
    requiredEvidenceIds: required,
    trace: trace({ returned, selected }),
  }
}

function sixStageCases() {
  return [
    auditCase({
      canonical: [],
      id: 'write',
      material: { e1: false, e2: false },
      returned: [],
      selected: [],
    }),
    auditCase({
      id: 'retrieval',
      material: { e1: false, e2: false },
      returned: [],
      selected: [],
    }),
    auditCase({
      id: 'composition',
      material: { e1: true, e2: false },
      selected: ['e1'],
    }),
    auditCase({
      answerCorrect: false,
      id: 'utilization',
      material: { e1: true, e2: false },
    }),
    auditCase({ ambiguity: true, answerCorrect: false, id: 'ambiguity' }),
    auditCase({ id: 'success' }),
  ]
}

test('stage audit classifies the earliest observed failure without a model', () => {
  const report = buildMemoryStageAudit(sixStageCases())
  assert.deepEqual(
    report.cases.map(({ stage }) => stage),
    ['write', 'retrieval', 'composition', 'utilization', 'ambiguity', 'success'],
  )
  assert.deepEqual(report.counts, {
    write: 1,
    retrieval: 1,
    composition: 1,
    utilization: 1,
    ambiguity: 1,
    success: 1,
    ungraded: 0,
  })
  assert.equal(report.mode, 'provider-free-diagnostic-not-a-benchmark')
  assert.equal(report.networkCalls, 0)
  assert.equal(report.providerCalls, 0)
  assert.deepEqual(
    MEMORY_STAGE_CLASSIFICATIONS,
    ['write', 'retrieval', 'composition', 'utilization', 'ambiguity', 'success', 'ungraded'],
  )
})

test('missing semantic judgments remain ungraded after evidence composition', () => {
  const entry = auditCase({ id: 'ungraded' })
  delete entry.answerJudgment
  const report = buildMemoryStageAudit([entry])
  assert.equal(report.cases[0].stage, 'ungraded')
  assert.match(report.cases[0].reason, /correctness has not been judged/)
})

test('stage audit separates session-level admission from retrieval failure', () => {
  const report = buildMemoryStageAudit([
    {
      canonicalEvidenceIds: [],
      canonicalSessionIds: ['s2'],
      expectedSessionIds: ['s1', 's2'],
      id: 'session-write',
      requiredEvidenceIds: [],
      trace: sessionTrace(['s2']),
    },
    {
      canonicalEvidenceIds: [],
      canonicalSessionIds: ['s1', 's2'],
      expectedSessionIds: ['s1', 's2'],
      id: 'session-retrieval',
      requiredEvidenceIds: [],
      trace: sessionTrace(['s2']),
    },
  ])
  assert.deepEqual(
    report.cases.map(({ stage }) => stage),
    ['write', 'retrieval'],
  )
  assert.deepEqual(report.cases[0].missingCanonicalSessionIds, ['s1'])
  assert.deepEqual(report.cases[0].missingReturnedSessionIds, ['s1'])
  assert.deepEqual(report.cases[1].missingCanonicalSessionIds, [])
  assert.deepEqual(report.cases[1].missingReturnedSessionIds, ['s1'])
})

test('required sessions without a canonical-presence observation stay ungraded', () => {
  const report = buildMemoryStageAudit([{
    canonicalEvidenceIds: [],
    expectedSessionIds: ['s1'],
    id: 'session-canonical-unobserved',
    requiredEvidenceIds: [],
    trace: sessionTrace(['s1']),
  }])
  assert.equal(report.cases[0].stage, 'ungraded')
  assert.equal(report.cases[0].canonicalSessionPresenceJudged, false)
  assert.match(report.cases[0].reason, /Canonical presence has not been observed/)
})

test('retrieval telemetry rejects selected evidence that was never returned', () => {
  const entry = auditCase({ id: 'invalid', returned: ['e1'] })
  assert.throws(
    () => buildMemoryStageAudit([entry]),
    /Selected evidence was not returned/,
  )
})

test('CLI reads explicit local input and optionally writes a private report',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'palari-memory-stage-audit-'))
    try {
      const inputPath = join(root, 'input.json')
      const reportPath = join(root, 'report.json')
      await writeFile(inputPath, JSON.stringify({ cases: sixStageCases() }))
      const runner = new URL(
        '../evals/run-memory-stage-audit.mjs',
        import.meta.url,
      ).pathname
      const result = spawnSync(process.execPath, [
        runner,
        '--input', inputPath,
        '--report', reportPath,
      ], { encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
      const summary = JSON.parse(result.stdout)
      assert.equal(summary.caseCount, 6)
      assert.equal(summary.counts.success, 1)
      assert.equal(summary.mode, 'provider-free-diagnostic-not-a-benchmark')
      const persisted = JSON.parse(await readFile(reportPath, 'utf8'))
      assert.equal(persisted.caseCount, 6)
      assert.deepEqual(persisted.counts, summary.counts)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('CLI refuses to imply an audit without explicit observations', () => {
  const runner = new URL(
    '../evals/run-memory-stage-audit.mjs',
    import.meta.url,
  ).pathname
  const result = spawnSync(process.execPath, [runner], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--input requires a path/)
})
