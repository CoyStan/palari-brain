import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  ACTIVE_MEMORY_MAX_ACTIONS,
  buildMemoryReductionRequest,
  createPalariBrain,
  ingestChatTurn,
  reducePendingTurns,
} from '../src/index.mjs'
import {
  LEAN_MEMORY_REDUCER_CONTRACT_VERSION,
  LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION,
  LEAN_MEMORY_REDUCER_MODEL,
  LEAN_MEMORY_REDUCER_RESPONSE_SCHEMA,
  buildLeanMemoryReducerGeminiBody,
  buildLeanMemoryReducerInput,
  createLeanMemoryReducer,
  normalizeLeanMemoryReducerProposal,
} from '../evals/arms/lean-memory-reducer-contract.mjs'

function reductionRequest({
  baseRevision = 7,
  evidence = [{
    id: 'opaque-evidence-user',
    observedAt: '2026-01-02T00:00:00.000Z',
    speaker: 'user',
    text: 'I now prefer almond milk.',
  }, {
    id: 'opaque-evidence-palari',
    observedAt: '2026-01-02T00:00:00.000Z',
    speaker: 'Palari',
    text: 'I will remember that update.',
  }],
  prior = [{
    epistemic: 'asserted',
    id: 'opaque-memory-oat',
    observedAt: '2026-01-01T00:00:00.000Z',
    speaker: 'user',
    statement: 'The user prefers oat milk.',
    timeBasis: null,
    topic: 'milk preference',
  }],
} = {}) {
  return buildMemoryReductionRequest({
    baseRevision,
    evidence,
    prior,
    utilization: {
      digestChars: 320,
      items: prior.length,
    },
  })
}

function proposal(overrides = {}) {
  return {
    actions: [{
      epistemic: 'asserted',
      evidenceQuotes: ['I now prefer almond milk.'],
      evidenceRefs: ['e0'],
      op: 'supersede',
      statement: 'The user currently prefers almond milk.',
      targets: ['m0'],
      timeEvidenceRef: '',
      timeQuote: '',
      topic: 'milk preference',
      ...overrides,
    }],
  }
}

function schemaKeywords(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found
  for (const [key, child] of Object.entries(value)) {
    found.add(key)
    schemaKeywords(child, found)
  }
  return found
}

test('lean provider schema uses only the documented shallow subset', () => {
  const keys = schemaKeywords(LEAN_MEMORY_REDUCER_RESPONSE_SCHEMA)
  for (const forbidden of [
    'allOf',
    'anyOf',
    'maximum',
    'maxItems',
    'minimum',
    'minItems',
    'not',
    'oneOf',
  ]) {
    assert.equal(keys.has(forbidden), false, forbidden)
  }
  assert.deepEqual(
    LEAN_MEMORY_REDUCER_RESPONSE_SCHEMA.required,
    ['actions'],
  )
  assert.deepEqual(
    LEAN_MEMORY_REDUCER_RESPONSE_SCHEMA
      .properties.actions.items.properties.op.enum,
    ['add', 'supersede'],
  )
  assert.match(
    LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION,
    /at most 8 actions and at most 16 combined evidenceRefs plus targets/,
  )
})

test('provider input uses aliases and hides host IDs, revisions, and times', () => {
  const input = buildLeanMemoryReducerInput(reductionRequest())
  assert.equal(
    input.contractVersion,
    LEAN_MEMORY_REDUCER_CONTRACT_VERSION,
  )
  assert.deepEqual(input.evidence.map((entry) => entry.ref), ['e0', 'e1'])
  assert.deepEqual(input.prior.map((entry) => entry.ref), ['m0'])
  assert.equal(JSON.stringify(input).includes('opaque-evidence-user'), false)
  assert.equal(JSON.stringify(input).includes('opaque-memory-oat'), false)
  assert.equal(JSON.stringify(input).includes('baseRevision'), false)
  assert.equal(JSON.stringify(input).includes('observedAt'), false)
  assert.equal(
    JSON.stringify(input).includes('2026-01-02T00:00:00.000Z'),
    false,
  )

  const body = buildLeanMemoryReducerGeminiBody(reductionRequest())
  assert.equal(body.store, false)
  assert.equal(
    body.generationConfig.responseMimeType,
    'application/json',
  )
  assert.deepEqual(
    JSON.parse(body.contents[0].parts[0].text),
    input,
  )
})

test('host expands one semantic supersession into authoritative provenance', () => {
  const normalized = normalizeLeanMemoryReducerProposal(
    proposal(),
    reductionRequest(),
  )
  assert.deepEqual(normalized, {
    actions: [{
      basis: [{
        id: 'opaque-evidence-user',
        kind: 'evidence',
        quote: 'I now prefer almond milk.',
      }, {
        id: 'opaque-memory-oat',
        kind: 'memory',
        quote: '',
      }],
      epistemic: 'asserted',
      op: 'replace',
      relation: 'supersedes',
      statement: 'The user currently prefers almond milk.',
      targetIds: ['opaque-memory-oat'],
      timeBasis: null,
      topic: 'milk preference',
    }],
    baseRevision: 7,
    dispositions: [{
      evidenceId: 'opaque-evidence-user',
      outcome: 'used',
    }, {
      evidenceId: 'opaque-evidence-palari',
      outcome: 'no_memory',
    }],
  })
  assert.equal(Object.isFrozen(normalized), true)
})

test('host derives no-memory dispositions without a model bookkeeping field', () => {
  const normalized = normalizeLeanMemoryReducerProposal(
    { actions: [] },
    reductionRequest(),
  )
  assert.deepEqual(normalized.actions, [])
  assert.deepEqual(
    normalized.dispositions.map((entry) => entry.outcome),
    ['no_memory', 'no_memory'],
  )
  assert.equal(normalized.baseRevision, 7)
})

test('host validates exact time evidence and derives its durable ID', () => {
  const normalized = normalizeLeanMemoryReducerProposal(
    proposal({
      timeEvidenceRef: 'e0',
      timeQuote: 'now',
    }),
    reductionRequest(),
  )
  assert.deepEqual(normalized.actions[0].timeBasis, {
    evidenceId: 'opaque-evidence-user',
    quote: 'now',
  })
  assert.equal(normalized.dispositions[0].outcome, 'used')
})

test('adapter gives transport only a body and returns host-normalized output', async () => {
  const calls = []
  const reducer = createLeanMemoryReducer({
    invoke: async (operation) => {
      calls.push(operation)
      return { text: JSON.stringify(proposal()) }
    },
  })
  const result = await reducer({
    request: reductionRequest(),
    unit: { sourceRevision: 9, unitOrder: 8 },
  })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].unit, {
    sourceRevision: 9,
    unitOrder: 8,
  })
  assert.equal(calls[0].model, LEAN_MEMORY_REDUCER_MODEL)
  assert.equal(result.baseRevision, 7)
  assert.equal(result.actions[0].targetIds[0], 'opaque-memory-oat')
})

test('host rejects authority, evidence, chronology, and atomicity violations', () => {
  const cases = [
    {
      name: 'invented host field',
      value: {
        ...proposal(),
        baseRevision: 99,
      },
    },
    {
      name: 'unknown evidence alias',
      value: proposal({ evidenceRefs: ['e99'] }),
    },
    {
      name: 'non-exact evidence quote',
      value: proposal({
        evidenceQuotes: ['The user prefers almond milk.'],
      }),
    },
    {
      name: 'cross-speaker replacement',
      value: proposal({
        evidenceQuotes: ['I will remember that update.'],
        evidenceRefs: ['e1'],
      }),
    },
    {
      name: 'different-topic supersession',
      value: proposal({ topic: 'home address' }),
    },
    {
      name: 'destructive summarization is outside lean v1',
      value: proposal({ op: 'summarize' }),
    },
    {
      name: 'unpaired time evidence',
      value: proposal({ timeEvidenceRef: 'e0' }),
    },
    {
      name: 'duplicate target in one transaction',
      value: {
        actions: [
          proposal().actions[0],
          {
            ...proposal().actions[0],
            evidenceQuotes: ['I now prefer almond milk.'],
          },
        ],
      },
    },
  ]
  for (const entry of cases) {
    assert.throws(
      () => normalizeLeanMemoryReducerProposal(
        entry.value,
        reductionRequest(),
      ),
      {
        code: 'LEAN_REDUCER_PROPOSAL_INVALID',
      },
      entry.name,
    )
  }

  assert.throws(
    () => normalizeLeanMemoryReducerProposal(
      proposal(),
      reductionRequest({
        evidence: [{
          id: 'old-evidence',
          observedAt: '2025-12-31T00:00:00.000Z',
          speaker: 'user',
          text: 'I now prefer almond milk.',
        }],
      }),
    ),
    {
      code: 'LEAN_REDUCER_PROPOSAL_INVALID',
    },
  )
})

test('host enforces action and basis limits omitted from provider schema', () => {
  assert.throws(
    () => normalizeLeanMemoryReducerProposal(
      {
        actions: Array.from(
          { length: ACTIVE_MEMORY_MAX_ACTIONS + 1 },
          () => ({
            epistemic: 'asserted',
            evidenceQuotes: ['I now prefer almond milk.'],
            evidenceRefs: ['e0'],
            op: 'add',
            statement: 'The user prefers almond milk.',
            targets: [],
            timeEvidenceRef: '',
            timeQuote: '',
            topic: 'milk preference',
          }),
        ),
      },
      reductionRequest(),
    ),
    {
      code: 'LEAN_REDUCER_PROPOSAL_INVALID',
    },
  )

  assert.throws(
    () => normalizeLeanMemoryReducerProposal(
      proposal({
        evidenceQuotes: [
          ...Array.from({ length: 16 }, () => 'I'),
        ],
        evidenceRefs: Array.from({ length: 16 }, (_, index) => `e${index}`),
      }),
      reductionRequest(),
    ),
    {
      code: 'LEAN_REDUCER_PROPOSAL_INVALID',
    },
  )
})

test('lean proposals pass through the real host transaction', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-lean-reducer-'))
  const scope = {
    palariId: 'palari-lean',
    userId: 'user-lean',
  }
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'lean-reducer-transaction',
  })
  try {
    const reducer = createLeanMemoryReducer({
      async invoke({ body }) {
        const input = JSON.parse(body.contents[0].parts[0].text)
        const current = input.evidence.find(
          ({ speaker }) => speaker === 'user',
        )
        const prior = input.prior[0]
        return {
          text: JSON.stringify({
            actions: [{
              epistemic: 'asserted',
              evidenceQuotes: [current.text],
              evidenceRefs: [current.ref],
              op: prior ? 'supersede' : 'add',
              statement: prior
                ? 'The user prefers almond milk.'
                : 'The user prefers oat milk.',
              targets: prior ? [prior.ref] : [],
              timeEvidenceRef: '',
              timeQuote: '',
              topic: 'milk preference',
            }],
          }),
        }
      },
    })
    for (const [index, userMessage] of [
      ['1', 'I prefer oat milk.'],
      ['2', 'I switched and now prefer almond milk.'],
    ]) {
      const result = await ingestChatTurn(brain, {
        assistantMessage: 'I will remember that.',
        eventAt: `2026-01-0${index}T00:00:00.000Z`,
        palariId: scope.palariId,
        retention: 'durable',
        sourceMessageId: `lean:${index}`,
        userId: scope.userId,
        userMessage,
      }, {
        reducer,
        reducerId: 'fixture:lean-memory/v1',
      })
      assert.equal(result.reductionStatus, 'completed')
    }
    const memories = brain.listActiveMemories(scope)
    assert.equal(memories.length, 1)
    assert.equal(memories[0].statement, 'The user prefers almond milk.')
    assert.equal(memories[0].speaker, 'user')
    assert.equal(memories[0].supports.length, 2)

    const beforeRejected = {
      digest: brain.digestStatus(scope),
      memories: structuredClone(memories),
    }
    const rejected = await ingestChatTurn(brain, {
      assistantMessage: 'Palari claims the user prefers soy milk.',
      eventAt: '2026-01-03T00:00:00.000Z',
      palariId: scope.palariId,
      retention: 'durable',
      sourceMessageId: 'lean:3',
      userId: scope.userId,
      userMessage: 'That is not what I said.',
    }, {
      reducer: createLeanMemoryReducer({
        async invoke({ body }) {
          const input = JSON.parse(body.contents[0].parts[0].text)
          const palariEvidence = input.evidence.find(
            ({ speaker }) => speaker === 'Palari',
          )
          return {
            text: JSON.stringify({
              actions: [{
                epistemic: 'asserted',
                evidenceQuotes: [palariEvidence.text],
                evidenceRefs: [palariEvidence.ref],
                op: 'supersede',
                statement: 'The user prefers soy milk.',
                targets: [input.prior[0].ref],
                timeEvidenceRef: '',
                timeQuote: '',
                topic: 'milk preference',
              }],
            }),
          }
        },
      }),
      reducerId: 'fixture:lean-memory/v1',
    })
    assert.equal(rejected.reductionStatus, 'failed')
    assert.deepEqual(
      brain.listActiveMemories(scope),
      beforeRejected.memories,
    )
    assert.equal(
      brain.digestStatus(scope).digestRevision,
      beforeRejected.digest.digestRevision,
    )
  } finally {
    brain.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('lean provider failures stop a batch without quarantine', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-lean-terminal-'))
  const scope = {
    palariId: 'palari-lean-terminal',
    userId: 'user-lean-terminal',
  }
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'lean-reducer-terminal',
  })
  try {
    for (let index = 1; index <= 3; index += 1) {
      await ingestChatTurn(brain, {
        assistantMessage: '',
        eventAt: `2026-01-0${index}T00:00:00.000Z`,
        palariId: scope.palariId,
        retention: 'durable',
        sourceMessageId: `lean-terminal:${index}`,
        userId: scope.userId,
        userMessage: `Statement ${index}.`,
      }, {
        reduceEvery: 10,
      })
    }
    const providerError = Object.assign(
      new Error('Provider rejected the schema.'),
      { code: 'HTTP_NON_RETRYABLE' },
    )
    let calls = 0
    const reducer = createLeanMemoryReducer({
      async invoke() {
        calls += 1
        throw providerError
      },
    })
    await assert.rejects(
      reducePendingTurns(brain, {
        ...scope,
        maxAttempts: 1,
        maxInteractionsPerCall: 20,
        maxTurns: 10,
        reducer,
        reducerId: 'fixture:lean-memory/v1',
      }),
      (error) => error === providerError,
    )
    assert.equal(calls, 1)
    assert.deepEqual(brain.listBlockedReductions(scope), [])
    assert.deepEqual(
      brain.listPendingReductions(scope).map(({ attempts }) => attempts),
      [0, 0, 0],
    )
  } finally {
    brain.close()
    await rm(root, { force: true, recursive: true })
  }
})
