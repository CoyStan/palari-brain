import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACTIVE_MEMORY_LIMITS,
  ACTIVE_MEMORY_MAX_ACTIONS,
  ACTIVE_MEMORY_MAX_BASIS,
  ACTIVE_MEMORY_MAX_DIGEST_CHARS,
  ACTIVE_MEMORY_MAX_ITEMS,
  ACTIVE_MEMORY_MAX_QUOTE_CHARS,
  ACTIVE_MEMORY_MAX_REQUEST_CHARS,
  ACTIVE_MEMORY_MAX_STATEMENT_CHARS,
  ACTIVE_MEMORY_MAX_TOPIC_CHARS,
  ACTIVE_MEMORY_REDUCER_VERSION,
  ACTIVE_MEMORY_SYSTEM_INSTRUCTIONS,
  buildMemoryReductionRequest,
  normalizeMemoryReductionPayload,
} from '../src/memory-reducer.mjs'

function prior(id = 'm1') {
  return {
    epistemic: 'asserted',
    id,
    observedAt: '2026-07-25T10:00:00.000Z',
    speaker: 'user',
    statement: 'The user drinks oat milk.',
    timeBasis: null,
    topic: 'preferred milk',
  }
}

function evidence(id = 'e1') {
  return {
    id,
    observedAt: '2026-07-25T11:00:00.000Z',
    speaker: 'user',
    text: 'I switched back to dairy milk today.',
  }
}

function disposition(evidenceId, outcome = 'used') {
  return { evidenceId, outcome }
}

function addAction(evidenceId = 'e1') {
  return {
    basis: [{
      id: evidenceId,
      kind: 'evidence',
      quote: 'I switched back to dairy milk today.',
    }],
    epistemic: 'asserted',
    op: 'add',
    relation: null,
    statement: 'The user switched back to dairy milk.',
    targetIds: [],
    timeBasis: {
      evidenceId,
      quote: 'today',
    },
    topic: 'preferred milk',
  }
}

function replaceAction() {
  return {
    basis: [
      {
        id: 'e1',
        kind: 'evidence',
        quote: 'switched back to dairy milk',
      },
      {
        id: 'm1',
        kind: 'memory',
        quote: '',
      },
    ],
    epistemic: 'asserted',
    op: 'replace',
    relation: 'supersedes',
    statement: 'The user now drinks dairy milk.',
    targetIds: ['m1'],
    timeBasis: {
      evidenceId: 'e2',
      quote: 'As of Friday',
    },
    topic: 'preferred milk',
  }
}

function normalize(payload, overrides = {}) {
  return normalizeMemoryReductionPayload(payload, {
    baseRevision: 7,
    currentEvidenceIds: ['e1', 'e2', 'e3'],
    priorMemoryIds: ['m1', 'm2'],
    ...overrides,
  })
}

test('request frames only bounded digest and current evidence with exact instructions', () => {
  const request = buildMemoryReductionRequest({
    baseRevision: 7,
    evidence: [{
      ...evidence(),
      palariId: 'scope-palari-secret',
      sourceTexts: ['source-poison-secret'],
      userId: 'scope-user-secret',
    }],
    prior: [{
      ...prior(),
      sourceMessageId: 'source-message-secret',
      userId: 'prior-scope-secret',
    }],
    sourceTexts: ['outer-source-secret'],
    userId: 'outer-scope-secret',
  })

  assert.equal(request.contractVersion, ACTIVE_MEMORY_REDUCER_VERSION)
  assert.equal(request.systemInstructions, ACTIVE_MEMORY_SYSTEM_INSTRUCTIONS)
  assert.deepEqual(request.input.limits, ACTIVE_MEMORY_LIMITS)
  assert.deepEqual(ACTIVE_MEMORY_LIMITS, {
    maxActions: ACTIVE_MEMORY_MAX_ACTIONS,
    maxBasisPerAction: ACTIVE_MEMORY_MAX_BASIS,
    maxDigestChars: ACTIVE_MEMORY_MAX_DIGEST_CHARS,
    maxItems: ACTIVE_MEMORY_MAX_ITEMS,
    maxQuoteChars: ACTIVE_MEMORY_MAX_QUOTE_CHARS,
    maxRequestChars: ACTIVE_MEMORY_MAX_REQUEST_CHARS,
    maxStatementChars: ACTIVE_MEMORY_MAX_STATEMENT_CHARS,
    maxTopicChars: ACTIVE_MEMORY_MAX_TOPIC_CHARS,
  })
  assert.deepEqual(request.input.prior, [prior()])
  assert.deepEqual(request.input.evidence, [evidence()])
  assert.ok(JSON.stringify(request).length <= ACTIVE_MEMORY_MAX_REQUEST_CHARS)
  assert.equal(Object.isFrozen(request), true)
  assert.equal(Object.isFrozen(request.input.prior[0]), true)

  const rendered = JSON.stringify(request)
  for (const forbidden of [
    'palariId',
    'userId',
    'sourceTexts',
    'sourceMessageId',
    'scope-palari-secret',
    'scope-user-secret',
    'source-poison-secret',
    'source-message-secret',
  ]) {
    assert.equal(rendered.includes(forbidden), false, forbidden)
  }
  assert.match(
    request.systemInstructions.responseRules.join(' '),
    /exactly baseRevision, dispositions, and actions/,
  )
  assert.match(
    request.systemInstructions.actionRules.join(' '),
    /current evidence/,
  )
})

test('request enforces item, identifier, text, and rendered-request bounds', () => {
  assert.throws(
    () => buildMemoryReductionRequest({
      baseRevision: 0,
      evidence: [evidence()],
      prior: Array.from(
        { length: ACTIVE_MEMORY_MAX_ITEMS + 1 },
        (_, index) => prior(`m${index}`),
      ),
    }),
    /prior exceeds 64 items/,
  )
  assert.throws(
    () => buildMemoryReductionRequest({
      baseRevision: 0,
      evidence: [evidence('same'), evidence('same')],
      prior: [],
    }),
    /duplicate ID/,
  )
  let acceptedChars = 0
  let lower = 0
  let upper = ACTIVE_MEMORY_MAX_REQUEST_CHARS
  while (lower <= upper) {
    const candidate = Math.floor((lower + upper) / 2)
    try {
      buildMemoryReductionRequest({
        baseRevision: 0,
        evidence: [{ ...evidence(), text: 'x'.repeat(candidate) }],
        prior: [],
      })
      acceptedChars = candidate
      lower = candidate + 1
    } catch (error) {
      assert.match(error.message, /Rendered memory-reduction request/)
      upper = candidate - 1
    }
  }
  const boundaryRequest = buildMemoryReductionRequest({
    baseRevision: 0,
    evidence: [{ ...evidence(), text: 'x'.repeat(acceptedChars) }],
    prior: [],
  })
  assert.ok(
    JSON.stringify(boundaryRequest).length <=
      ACTIVE_MEMORY_MAX_REQUEST_CHARS,
  )
  assert.throws(
    () => buildMemoryReductionRequest({
      baseRevision: 0,
      evidence: [{
        ...evidence(),
        text: 'x'.repeat(acceptedChars + 1),
      }],
      prior: [],
    }),
    (error) => {
      assert.equal(error.code, 'REDUCER_INPUT_CAPACITY')
      assert.match(
        error.message,
        /Rendered memory-reduction request exceeds 40000 characters/,
      )
      return true
    },
  )
  assert.throws(
    () => buildMemoryReductionRequest({
      baseRevision: 0,
      evidence: [{ ...evidence(), text: 'bad\u0000text' }],
      prior: [],
    }),
    /NUL-free/,
  )
  assert.throws(
    () => buildMemoryReductionRequest({
      baseRevision: 0,
      evidence: [evidence()],
      prior: [{ ...prior(), statement: 'x'.repeat(501) }],
    }),
    /statement exceeds 500 characters/,
  )
})

test('strict valid response normalizes adds, replacements, time basis, and dispositions', () => {
  const payload = {
    actions: [
      addAction('e1'),
      replaceAction(),
    ],
    baseRevision: 7,
    dispositions: [
      disposition('e3', 'no_memory'),
      disposition('e2'),
      disposition('e1'),
    ],
  }
  const result = normalize(JSON.stringify(payload))

  assert.deepEqual(result, {
    actions: payload.actions,
    baseRevision: 7,
    dispositions: [
      disposition('e1'),
      disposition('e2'),
      disposition('e3', 'no_memory'),
    ],
  })
})

test('response rejects omitted, duplicate, and foreign evidence dispositions', () => {
  const base = {
    actions: [addAction()],
    baseRevision: 7,
    dispositions: [
      disposition('e1'),
      disposition('e2', 'no_memory'),
      disposition('e3', 'no_memory'),
    ],
  }
  assert.throws(
    () => normalize({
      ...base,
      dispositions: base.dispositions.slice(0, 2),
    }),
    /exactly one item for every current evidence ID/,
  )
  assert.throws(
    () => normalize({
      ...base,
      dispositions: [
        disposition('e1'),
        disposition('e1'),
        disposition('e3', 'no_memory'),
      ],
    }),
    /duplicate evidence ID/,
  )
  assert.throws(
    () => normalize({
      ...base,
      dispositions: [
        disposition('e1'),
        disposition('e2', 'no_memory'),
        disposition('foreign', 'no_memory'),
      ],
    }),
    /not current evidence/,
  )
  assert.throws(
    () => normalize({
      ...base,
      dispositions: [
        disposition('e1', 'no_memory'),
        disposition('e2', 'no_memory'),
        disposition('e3', 'no_memory'),
      ],
    }),
    /Disposition for e1 must be used/,
  )
  assert.throws(
    () => normalize({
      ...base,
      dispositions: [
        disposition('e1'),
        disposition('e2', 'used'),
        disposition('e3', 'no_memory'),
      ],
    }),
    /Disposition for e2 must be no_memory/,
  )
})

test('response rejects foreign references and requires targets in memory basis', () => {
  const wrap = (action) => ({
    actions: [action],
    baseRevision: 7,
    dispositions: [
      disposition('e1'),
      disposition('e2', 'no_memory'),
      disposition('e3', 'no_memory'),
    ],
  })
  assert.throws(
    () => normalize(wrap({
      ...addAction(),
      basis: [{
        id: 'foreign-evidence',
        kind: 'evidence',
        quote: 'foreign',
      }],
    })),
    /not current evidence/,
  )
  assert.throws(
    () => normalize(wrap({
      ...addAction(),
      basis: [
        ...addAction().basis,
        { id: 'foreign-memory', kind: 'memory', quote: '' },
      ],
    })),
    /not prior memory/,
  )
  assert.throws(
    () => normalize(wrap({
      ...replaceAction(),
      targetIds: ['foreign-memory'],
    })),
    /non-prior memory/,
  )
  assert.throws(
    () => normalize(wrap({
      ...replaceAction(),
      basis: [replaceAction().basis[0]],
    })),
    /represented in memory basis/,
  )
  assert.throws(
    () => normalize(wrap({
      ...addAction(),
      timeBasis: {
        evidenceId: 'foreign-evidence',
        quote: 'today',
      },
    })),
    /not current evidence/,
  )
})

test('response strict objects reject role fields and invalid action shapes', () => {
  const valid = {
    actions: [addAction()],
    baseRevision: 7,
    dispositions: [
      disposition('e1'),
      disposition('e2', 'no_memory'),
      disposition('e3', 'no_memory'),
    ],
  }
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{ ...addAction(), speaker: 'user' }],
    }),
    /unsupported or missing fields/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{
        ...addAction(),
        basis: [{ ...addAction().basis[0], role: 'user' }],
      }],
    }),
    /unsupported or missing fields/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      dispositions: [{
        ...disposition('e1'),
        role: 'user',
      }, ...valid.dispositions.slice(1)],
    }),
    /unsupported or missing fields/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{ ...addAction(), relation: 'supersedes' }],
    }),
    /relation must be null for add/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{
        ...replaceAction(),
        relation: null,
      }],
    }),
    /relation must be a string/,
  )
})

test('response rejects oversize, malformed, NUL, and duplicate values', () => {
  const valid = {
    actions: [addAction()],
    baseRevision: 7,
    dispositions: [
      disposition('e1'),
      disposition('e2', 'no_memory'),
      disposition('e3', 'no_memory'),
    ],
  }
  for (const [field, length, message] of [
    ['topic', ACTIVE_MEMORY_MAX_TOPIC_CHARS + 1, /topic exceeds 120/],
    [
      'statement',
      ACTIVE_MEMORY_MAX_STATEMENT_CHARS + 1,
      /statement exceeds 500/,
    ],
  ]) {
    assert.throws(
      () => normalize({
        ...valid,
        actions: [{ ...addAction(), [field]: 'x'.repeat(length) }],
      }),
      message,
    )
  }
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{
        ...addAction(),
        basis: [{
          ...addAction().basis[0],
          quote: 'x'.repeat(ACTIVE_MEMORY_MAX_QUOTE_CHARS + 1),
        }],
      }],
    }),
    /quote exceeds 500/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{
        ...addAction(),
        statement: 'broken\ud800',
      }],
    }),
    /well-formed/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{
        ...addAction(),
        statement: 'visible\u0000hidden',
      }],
    }),
    /NUL-free/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{
        ...addAction(),
        basis: [
          addAction().basis[0],
          addAction().basis[0],
        ],
      }],
    }),
    /duplicate reference/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{
        ...replaceAction(),
        targetIds: ['m1', 'm1'],
      }],
    }),
    /duplicate ID/,
  )
  assert.throws(
    () => normalize({
      ...valid,
      actions: [{
        ...replaceAction(),
        basis: [
          replaceAction().basis[0],
          { id: 'm1', kind: 'memory', quote: 'must be empty' },
        ],
      }],
    }),
    /must be empty for memory basis/,
  )
})

test('response enforces action and basis ceilings and exact base revision', () => {
  const noEvidence = (index) => ({
    ...addAction(),
    statement: `Statement ${index}`,
  })
  assert.throws(
    () => normalize({
      actions: Array.from(
        { length: ACTIVE_MEMORY_MAX_ACTIONS + 1 },
        (_, index) => noEvidence(index),
      ),
      baseRevision: 7,
      dispositions: [
        disposition('e1'),
        disposition('e2', 'no_memory'),
        disposition('e3', 'no_memory'),
      ],
    }),
    /at most 8 items/,
  )
  assert.throws(
    () => normalize({
      actions: [{
        ...addAction(),
        basis: Array.from(
          { length: ACTIVE_MEMORY_MAX_BASIS + 1 },
          (_, index) => ({
            id: `e${index}`,
            kind: 'evidence',
            quote: `quote ${index}`,
          }),
        ),
      }],
      baseRevision: 7,
      dispositions: [
        disposition('e1'),
        disposition('e2', 'no_memory'),
        disposition('e3', 'no_memory'),
      ],
    }),
    /at most 16 items/,
  )
  assert.throws(
    () => normalize({
      actions: [],
      baseRevision: 8,
      dispositions: [
        disposition('e1', 'no_memory'),
        disposition('e2', 'no_memory'),
        disposition('e3', 'no_memory'),
      ],
    }),
    /baseRevision mismatch/,
  )
  assert.throws(
    () => normalize('{not json'),
    /valid JSON/,
  )
  assert.throws(
    () => normalize({
      actions: [],
      baseRevision: 7,
      dispositions: [
        disposition('e1', 'no_memory'),
        disposition('e2', 'no_memory'),
        disposition('e3', 'no_memory'),
      ],
      speaker: 'user',
    }),
    /unsupported or missing fields/,
  )
})
