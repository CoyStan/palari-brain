// Unit tests — memory briefing formatter (src/memory-briefing.mjs).
//
// briefing v0 is pure: it takes a recall result and renders the bounded,
// tiered briefing text a product injects as untrusted evidence. Nothing here
// touches a store, a model, or the network, so these deterministic tests fix
// the whole surface — tier assignment, transient-detail redaction, the
// per-tier byte budget, and the token-share diagnostics — without any live
// gate. Added for coverage: the module had no dedicated test.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMemoryBriefing,
  estimateBriefingTokens,
  memoryBriefingPromptDiagnostics,
} from '../src/memory-briefing.mjs'

const NOW = new Date('2026-02-01T00:00:00Z')

function daysAgo(days, now = NOW) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

test('estimateBriefingTokens rounds up at four characters per token', () => {
  assert.equal(estimateBriefingTokens(''), 0)
  assert.equal(estimateBriefingTokens('abcd'), 1)
  assert.equal(estimateBriefingTokens('abcde'), 2)
  assert.equal(estimateBriefingTokens(null), 0)
  assert.equal(estimateBriefingTokens(undefined), 0)
})

test('empty or all-blank recall yields an empty briefing', () => {
  for (const recall of [undefined, {}, { memories: [] }, { memories: 'nope' }]) {
    const result = buildMemoryBriefing({ recall, now: NOW })
    assert.deepEqual(result, { chars: 0, estimatedTokens: 0, included: [], text: '' })
  }
  const blank = buildMemoryBriefing({ recall: { memories: [{ content: '   ' }] }, now: NOW })
  assert.equal(blank.text, '')
  assert.equal(blank.included.length, 0)
})

test('memories are grouped and ordered by tier', () => {
  const result = buildMemoryBriefing({
    now: NOW,
    recall: {
      memories: [
        // Background: unparseable timestamp defaults to 365 days old, no rpath.
        { id: 'bg', content: 'Background item', rpath: 'link' },
        // Associative: link_walk always wins regardless of importance/age.
        { id: 'assoc', content: 'Linked item', rpath: 'link_walk', importance: 0.99, access_count: 9 },
        // Active: recent within 14 days.
        { id: 'act', content: 'Recent item', created_at: daysAgo(3) },
        // Primary: high importance and repeatedly accessed.
        { id: 'pri', content: 'Primary item', importance: 0.9, access_count: 2, created_at: daysAgo(3) },
      ],
    },
  })

  assert.deepEqual(result.included.map((entry) => entry.id), ['pri', 'act', 'assoc', 'bg'])
  assert.deepEqual(result.included.map((entry) => entry.tier), [
    'Primary',
    'Active',
    'Associative',
    'Background',
  ])
  // The section headers appear in canonical order.
  const order = ['Primary:', 'Active:', 'Associative:', 'Background:']
    .map((heading) => result.text.indexOf(heading))
  assert.ok(order.every((index) => index >= 0))
  assert.deepEqual([...order].sort((a, b) => a - b), order)
  assert.equal(result.chars, result.text.length)
  assert.equal(result.estimatedTokens, estimateBriefingTokens(result.text))
})

test('rpath summary or recent lands in Active even when undated', () => {
  for (const rpath of ['summary', 'recent']) {
    const result = buildMemoryBriefing({
      now: NOW,
      recall: { memories: [{ id: rpath, content: `via ${rpath}`, rpath }] },
    })
    assert.equal(result.included[0].tier, 'Active')
  }
})

test('high importance without repeated access is not Primary', () => {
  const result = buildMemoryBriefing({
    now: NOW,
    recall: { memories: [{ id: 'x', content: 'Important once', importance: 0.95, access_count: 1, created_at: daysAgo(3) }] },
  })
  assert.equal(result.included[0].tier, 'Active')
})

test('transient details are dropped from the briefing', () => {
  const result = buildMemoryBriefing({
    now: NOW,
    recall: {
      memories: [
        { id: 'keep', content: 'User prefers window seats', created_at: daysAgo(1) },
        { id: 'drop', content: 'The door code is 4821', created_at: daysAgo(1) },
      ],
    },
  })
  assert.deepEqual(result.included.map((entry) => entry.id), ['keep'])
  assert.ok(!result.text.includes('4821'))
})

test('trust annotation renders type, route, clamped confidence, and link provenance', () => {
  const result = buildMemoryBriefing({
    now: NOW,
    recall: {
      memories: [
        {
          id: 'link',
          content: 'Linked fact',
          rpath: 'link_walk',
          type: 'asserted',
          confidence: 1.7,
          via_relation: 'colleague of',
          via_memory_id: 'mem-source',
        },
      ],
    },
  })
  const line = result.text.split('\n').find((row) => row.startsWith('- Linked fact'))
  assert.ok(line.includes('type asserted'))
  assert.ok(line.includes('route link_walk'))
  // confidence is clamped into [0, 1] and shown to two decimals.
  assert.ok(line.includes('confidence 1.00'))
  assert.ok(line.includes('via colleague of from mem-source'))
})

test('long content is clamped to a bounded, ellipsised line', () => {
  const long = 'x'.repeat(400)
  const result = buildMemoryBriefing({
    now: NOW,
    recall: { memories: [{ id: 'long', content: long, created_at: daysAgo(1) }] },
  })
  assert.ok(result.included[0].content.length <= 220)
  assert.ok(result.included[0].content.endsWith('...'))
})

test('the byte budget stops inclusion without truncating a kept line', () => {
  const memories = Array.from({ length: 6 }, (_, index) => ({
    id: `m${index}`,
    content: `Memory number ${index} with enough words to matter`,
    created_at: daysAgo(1),
  }))
  const full = buildMemoryBriefing({ now: NOW, recall: { memories } })
  const tight = buildMemoryBriefing({ now: NOW, recall: { memories }, maxChars: 300 })

  assert.ok(tight.included.length > 0)
  assert.ok(tight.included.length < full.included.length)
  assert.ok(tight.text.length <= 300)
  // Every kept line survives verbatim — the budget never cuts mid-line.
  for (const entry of tight.included) {
    assert.ok(tight.text.includes(`- ${entry.content} (`))
  }
})

test('a maxChars too small for any memory yields an empty briefing', () => {
  const result = buildMemoryBriefing({
    now: NOW,
    maxChars: 5,
    recall: { memories: [{ id: 'x', content: 'Anything at all', created_at: daysAgo(1) }] },
  })
  assert.deepEqual(result, { chars: 0, estimatedTokens: 0, included: [], text: '' })
})

test('memoryBriefingPromptDiagnostics reports chars, tokens, and share', () => {
  const briefingText = 'abcd'.repeat(4) // 16 chars -> 4 tokens
  const promptText = 'z'.repeat(64) // 64 chars -> 16 tokens
  const diagnostics = memoryBriefingPromptDiagnostics({ briefingText, promptText })
  assert.equal(diagnostics.memoryBriefingChars, 16)
  assert.equal(diagnostics.memoryBriefingEstimatedTokens, 4)
  assert.equal(diagnostics.promptEstimatedTokens, 16)
  assert.equal(diagnostics.memoryBriefingTokenShare, 4 / 16)

  const empty = memoryBriefingPromptDiagnostics({})
  assert.equal(empty.memoryBriefingChars, 0)
  assert.equal(empty.promptEstimatedTokens, 0)
  // No prompt means the share is defined as zero rather than NaN/Infinity.
  assert.equal(empty.memoryBriefingTokenShare, 0)
})
