import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createPalariBrain,
  forgetMemories,
  ingestChatTurn,
  MEMORY_EXPLORATION_TOOLS,
} from '../src/index.mjs'
import {
  rankedDialogueQuery,
  rankedDialogueQueryTerms,
} from '../src/memory-search.mjs'

const SCOPE = Object.freeze({
  palariId: 'palari-search',
  userId: 'user-search',
})
const OTHER = Object.freeze({
  palariId: 'palari-search',
  userId: 'someone-else',
})

async function openBrain(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-search-'))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'search',
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
    user: 'I keep the spare key inside the blue ceramic pot on the balcony.',
  },
  { id: 'sess-a:1', user: 'My sister Ana visits every other weekend.' },
  {
    id: 'sess-b:0',
    user: 'The wifi password at the cabin is trout-river-42.',
  },
  { id: 'sess-b:1', user: 'I moved the ceramic pot indoors for the winter.' },
]

test('ranked find recovers a paraphrased question exact matching misses',
  async (t) => {
    // The Mira case: the user asks with words they never spoke. Exact
    // substring matching is correct to return nothing; ranked mode must
    // locate the canonical row anyway.
    const brain = await openBrain(t)
    await seed(brain, EXCHANGES)

    const phrase = 'where is the spare key hidden'
    const exact = brain.exploreFind(SCOPE, { phrase })
    assert.equal(exact.mode, 'exact')
    assert.deepEqual(exact.matches, [])

    const ranked = brain.exploreFind(SCOPE, { phrase, ranked: true })
    assert.equal(ranked.mode, 'ranked')
    assert.ok(ranked.matches.length >= 1)
    assert.match(ranked.matches[0].snippet, /blue ceramic pot/)
    // A ranked hit is still a canonical row: real speaker, real time, and an
    // evidence ID that memory_read resolves to the byte-exact text.
    assert.equal(ranked.matches[0].speaker, 'user')
    const read = brain.exploreRead(SCOPE, {
      evidenceIds: [ranked.matches[0].evidenceId],
    })
    assert.equal(
      read.messages[0].text,
      'I keep the spare key inside the blue ceramic pot on the balcony.',
    )
  })

test('ranked results are deterministic and chronology breaks ties',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, EXCHANGES)
    const first = brain.exploreFind(SCOPE, {
      phrase: 'ceramic pot',
      ranked: true,
    })
    const second = brain.exploreFind(SCOPE, {
      phrase: 'ceramic pot',
      ranked: true,
    })
    assert.deepEqual(first, second)
    assert.ok(first.matches.length >= 2)
  })

test('ranked search stays inside the caller scope', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, EXCHANGES)
  const other = brain.exploreFind(OTHER, {
    phrase: 'spare key ceramic pot',
    ranked: true,
  })
  assert.deepEqual(other.matches, [])
})

test('deleted evidence disappears from ranked search', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, EXCHANGES)
  const before = brain.exploreFind(SCOPE, {
    phrase: 'wifi password cabin',
    ranked: true,
  })
  assert.ok(before.matches.length >= 1)

  const target = before.matches.find((match) =>
    /trout-river-42/.test(match.snippet))
  await forgetMemories(brain, [target.evidenceId], SCOPE)
  const after = brain.exploreFind(SCOPE, {
    phrase: 'wifi password cabin',
    ranked: true,
  })
  assert.ok(!after.matches.some((match) =>
    /trout-river-42/.test(match.snippet)))
})

test('an all-stopword phrase falls back to exact matching', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, EXCHANGES)
  assert.deepEqual(rankedDialogueQueryTerms('is the of and'), [])
  const result = brain.exploreFind(SCOPE, {
    phrase: 'is the of and',
    ranked: true,
  })
  assert.equal(result.mode, 'exact')
})

test('exact mode result shape and defaults are unchanged', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, EXCHANGES)
  const result = brain.exploreFind(SCOPE, { phrase: 'ceramic pot' })
  assert.equal(result.mode, 'exact')
  assert.equal(result.operation, 'memory_find')
  assert.ok(result.matches.length >= 1)
  for (const match of result.matches) {
    assert.ok(match.matchOffset >= 0)
    assert.ok(match.evidenceId)
  }
})

test('the tool contract documents ranked mode as the fallback', () => {
  const find = MEMORY_EXPLORATION_TOOLS
    .find((tool) => tool.name === 'memory_find')
  assert.deepEqual(find.parameters.required, ['phrase'])
  assert.equal(find.parameters.properties.ranked.type, 'boolean')
  assert.match(find.description, /exact substring matching by default/)
  assert.match(find.description, /retry with ranked true/)
})

test('fts query terms are quoted so user text cannot inject syntax', () => {
  const terms = rankedDialogueQueryTerms(
    'NEAR("a" OR pot) AND ceramic -balcony',
  )
  const query = rankedDialogueQuery(terms)
  for (const clause of query.split(' OR ')) {
    assert.match(clause, /^".*"$/)
  }
  assert.ok(!query.includes('NEAR('))
})
