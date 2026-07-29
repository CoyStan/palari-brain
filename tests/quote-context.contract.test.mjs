import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createPalariBrain,
  ingestChatTurn,
  memoryFreshness,
} from '../src/index.mjs'
import {
  analyzeQuoteContext,
  detectThirdPartySpans,
} from '../src/quote-context.mjs'

test('a clean assertion is clean', () => {
  const text = 'I keep the spare key inside the blue ceramic pot.'
  assert.deepEqual(analyzeQuoteContext(text, text), {
    clean: true,
    reasons: [],
  })
  assert.deepEqual(
    analyzeQuoteContext(text, 'spare key inside the blue ceramic pot'),
    { clean: true, reasons: [] },
  )
})

test('a conditional prefix blocks the bare consequence', () => {
  const text = 'If the board approves, then I authorize the payment.'
  const clipped = analyzeQuoteContext(text, 'I authorize the payment')
  assert.equal(clipped.clean, false)
  assert.deepEqual(clipped.reasons, ['conditional'])
  // Widening the quote to include the qualifier is the honest remedy, and
  // it passes: the window before a sentence-initial quote is empty.
  assert.equal(analyzeQuoteContext(text, text).clean, true)
})

test('negation in the same sentence blocks the clipped claim', () => {
  const text = "I'm not saying I hate my boss, the tone was fine."
  const clipped = analyzeQuoteContext(text, 'I hate my boss')
  assert.equal(clipped.clean, false)
  assert.deepEqual(clipped.reasons, ['negated'])
  // A previous sentence's negation does not leak forward.
  const two = "I did not sleep well. I hate my boss's schedule."
  assert.equal(
    analyzeQuoteContext(two, "I hate my boss's schedule").clean,
    true,
  )
})

test('reported speech is not the speaker’s own assertion', () => {
  const straight = 'My boss said "the project is cancelled" this morning.'
  const curly = 'My boss said “the project is cancelled” this morning.'
  for (const text of [straight, curly]) {
    const inside = analyzeQuoteContext(text, 'the project is cancelled')
    assert.equal(inside.clean, false)
    assert.ok(inside.reasons.includes('quoted-speech'))
  }
})

test('pasted email text is not the user’s own speech', () => {
  const pasted = [
    'Here is what Robert sent, thoughts?',
    'From: Robert Miller',
    'Sent: Tuesday 4:12 PM',
    'Subject: Flagging update',
    'No Construction Flaggers are currently available at Chambers Street.',
  ].join('\n')
  const spans = detectThirdPartySpans(pasted)
  assert.equal(spans.length, 1)
  const inPaste = analyzeQuoteContext(
    pasted,
    'No Construction Flaggers are currently available',
  )
  assert.equal(inPaste.clean, false)
  assert.deepEqual(inPaste.reasons, ['third-party-text'])
  // The user's own framing line stays quotable.
  assert.equal(
    analyzeQuoteContext(pasted, 'Here is what Robert sent').clean,
    true,
  )
})

test('forwarded blocks and quoted replies are third-party spans', () => {
  const forwarded = 'see below\n----- Original Message -----\nsecret text'
  assert.equal(detectThirdPartySpans(forwarded).length, 1)
  const reply = 'agree\n> line one\n> line two\n> line three\nthanks'
  assert.equal(detectThirdPartySpans(reply).length, 1)
  // One stray header line is not an email.
  assert.deepEqual(detectThirdPartySpans('Subject: dinner plans?'), [])
})

// --- gate integration -------------------------------------------------

const SCOPE = Object.freeze({ palariId: 'palari-ctx', userId: 'user-ctx' })

async function openBrain(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-ctx-'))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'ctx',
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

function reducerQuoting(quote, epistemic) {
  return ({ request }) => {
    const evidence = request.input.evidence
      .find((entry) => entry.text.includes(quote))
    return {
      actions: [{
        basis: [{ id: evidence.id, kind: 'evidence', quote }],
        epistemic,
        op: 'add',
        relation: null,
        statement: 'The user authorized the payment.',
        targetIds: [],
        timeBasis: null,
        topic: 'authorization',
      }],
      baseRevision: request.input.baseRevision,
      dispositions: request.input.evidence.map((entry) => ({
        evidenceId: entry.id,
        outcome: entry.id === evidence.id ? 'used' : 'no_memory',
      })),
    }
  }
}

const CONDITIONAL_TURN = Object.freeze({
  assistantMessage: 'Understood.',
  eventAt: '2026-03-01T10:00:00.000Z',
  palariId: SCOPE.palariId,
  retention: 'durable',
  sourceMessageId: 'ctx:0',
  userId: SCOPE.userId,
  userMessage: 'If the board approves, then I authorize the payment.',
})

test('the gate refuses an asserted memory on a conditional-context quote',
  async (t) => {
    const brain = await openBrain(t)
    await ingestChatTurn(brain, { ...CONDITIONAL_TURN }, {
      reducer: reducerQuoting('I authorize the payment', 'asserted'),
      reducerId: 'ctx-test/v1',
    })
    // Nothing admitted; the unit is parked, not silently accepted.
    assert.deepEqual(brain.listActiveMemories(SCOPE), [])
    const freshness = memoryFreshness(brain, SCOPE)
    assert.equal(freshness.stale, true)
    assert.ok(freshness.pending >= 1)
  })

test('the same quote downgraded to uncertain is admitted', async (t) => {
  const brain = await openBrain(t)
  await ingestChatTurn(brain, { ...CONDITIONAL_TURN }, {
    reducer: reducerQuoting('I authorize the payment', 'uncertain'),
    reducerId: 'ctx-test/v1',
  })
  const memories = brain.listActiveMemories(SCOPE)
  assert.equal(memories.length, 1)
  assert.equal(memories[0].epistemic, 'uncertain')
  assert.equal(memoryFreshness(brain, SCOPE).stale, false)
})

test('the widened quote carrying its qualifier is admitted as asserted',
  async (t) => {
    const brain = await openBrain(t)
    await ingestChatTurn(brain, { ...CONDITIONAL_TURN }, {
      reducer: reducerQuoting(
        'If the board approves, then I authorize the payment.',
        'asserted',
      ),
      reducerId: 'ctx-test/v1',
    })
    assert.equal(brain.listActiveMemories(SCOPE).length, 1)
  })

// --- freshness --------------------------------------------------------

test('freshness reports current-through and staleness honestly', async (t) => {
  const brain = await openBrain(t)

  const empty = memoryFreshness(brain, SCOPE)
  assert.deepEqual(
    { pending: empty.pending, stale: empty.stale },
    { pending: 0, stale: false },
  )

  await ingestChatTurn(brain, { ...CONDITIONAL_TURN }, {
    reducer: reducerQuoting('I authorize the payment', 'uncertain'),
    reducerId: 'ctx-test/v1',
  })
  const current = memoryFreshness(brain, SCOPE)
  assert.equal(current.stale, false)
  assert.equal(current.currentThrough, '2026-03-01T10:00:00.000Z')
  assert.equal(current.latestEvidenceAt, '2026-03-01T10:00:00.000Z')

  // A turn whose reduction keeps failing leaves memory visibly behind.
  await ingestChatTurn(brain, {
    ...CONDITIONAL_TURN,
    eventAt: '2026-03-02T10:00:00.000Z',
    sourceMessageId: 'ctx:1',
    userMessage: 'The vendor meeting moved to Friday.',
  }, {
    reducer: () => { throw new Error('reducer offline') },
    reducerId: 'ctx-test/v1',
  }).catch(() => {})
  const behind = memoryFreshness(brain, SCOPE)
  assert.equal(behind.stale, true)
  assert.ok(behind.pending >= 1)
  assert.equal(behind.currentThrough, '2026-03-01T10:00:00.000Z')
  assert.equal(behind.latestEvidenceAt, '2026-03-02T10:00:00.000Z')
})
