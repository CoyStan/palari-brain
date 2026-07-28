import assert from 'node:assert/strict'
import { test } from 'node:test'

const ENV_KEYS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'PALARI_TRUST_ARTIFACT_DIR',
]

async function withEnvironment(callback) {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  )
  process.env.GEMINI_API_KEY = 'test-gemini'
  process.env.OPENAI_API_KEY = 'test-openai'
  process.env.PALARI_TRUST_ARTIFACT_DIR = '/tmp/test-trust-artifacts'
  try {
    return await callback()
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

test('jcode external adapter maps every benchmark operation mechanically', async () => {
  await withEnvironment(async () => {
    const { createTrustAdapter } = await import(
      '../evals/arms/jcode-trust-adapter.mjs'
    )
    const commands = []
    const adapter = createTrustAdapter({
      async invoke(command) {
        commands.push(command)
        return command.action === 'retrieve'
          ? {
              items: [{
                observedAt: '2026-01-01T00:00:00.000Z',
                origin: 'memory',
                text: 'remembered',
              }],
            }
          : {}
      },
    })
    const session = await adapter.open()
    try {
      await adapter.ingest(session, {
        eventAt: '2026-01-01T00:00:00.000Z',
        scope: 'A',
        turn: { id: 'one', user: 'hello' },
      })
      await adapter.forget(session, {
        containing: 'hello',
        scope: 'A',
      })
      assert.deepEqual(
        await adapter.retrieve(session, {
          question: 'what was said',
          scope: 'A',
        }),
        [{
          observedAt: '2026-01-01T00:00:00.000Z',
          origin: 'memory',
          text: 'remembered',
        }],
      )
    } finally {
      await adapter.close(session)
    }
    assert.deepEqual(
      commands.map((command) => command.action),
      ['ingest', 'forget', 'retrieve'],
    )
    assert.equal(commands[0].scope, 'A')
    assert.equal(commands[1].containing, 'hello')
    assert.equal(commands[2].question, 'what was said')
  })
})

test('Mem0 external adapter preserves framework scope and transcript surfaces', async () => {
  await withEnvironment(async () => {
    const { createTrustAdapter } = await import(
      '../evals/arms/mem0-trust-adapter.mjs'
    )
    const calls = []
    const memories = [{
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'm1',
      memory: 'The spare key is in the ceramic pot.',
      metadata: { observedAt: '2026-01-01T00:00:00.000Z' },
    }]
    const adapter = createTrustAdapter({
      async memoryFactory() {
        return {
          memory: {
            async add(messages, options) {
              calls.push(['add', messages, options])
              return { results: [] }
            },
            async delete(id) {
              calls.push(['delete', id])
            },
            async getAll(options) {
              calls.push(['getAll', options])
              return { results: memories }
            },
            async search(question, options) {
              calls.push(['search', question, options])
              return { results: memories }
            },
          },
          restoreFetch() {},
        }
      },
    })
    const session = await adapter.open()
    try {
      await adapter.ingest(session, {
        eventAt: '2026-01-01T00:00:00.000Z',
        scope: 'A',
        turn: {
          id: 'one',
          sourceTexts: ['untrusted source'],
          user: 'hello',
        },
      })
      await adapter.forget(session, {
        containing: 'ceramic',
        scope: 'A',
      })
      const observed = await adapter.retrieve(session, {
        question: 'spare key ceramic pot',
        scope: 'A',
      })
      assert.equal(observed[0].origin, 'memory')
    } finally {
      await adapter.close(session)
    }
    assert.deepEqual(calls[0][1].map(({ role }) => role), ['tool', 'user'])
    assert.equal(calls[0][2].userId, 'A')
    assert.deepEqual(calls[1][1], { filters: { user_id: 'A' }, topK: 100 })
    assert.deepEqual(calls[3][2].filters, { user_id: 'A' })
  })
})
