import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  link,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
} from '../evals/arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  createIncrementalLongMemEvalHardCapGeminiTransport,
  INCREMENTAL_HARD_CAP_GEMINI_LIMITS,
  INCREMENTAL_HARD_CAP_GEMINI_MODEL,
  INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
} from '../evals/incremental-longmemeval-hard-cap-gemini.mjs'

const API_KEY = 'hard-cap-fake-gemini-key'
const WRITER_GENERATION = Object.freeze({
  candidateCount: 1,
  maxOutputTokens: 2_000,
  responseJsonSchema: {
    properties: {
      actions: {
        items: { type: 'object' },
        type: 'array',
      },
    },
    required: ['actions'],
    type: 'object',
  },
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingBudget: 0 },
})
const ANSWER_GENERATION = Object.freeze({
  candidateCount: 1,
  maxOutputTokens: 256,
  thinkingConfig: { thinkingBudget: 0 },
})

function bodyFor(purpose) {
  const body = {
    contents: [{
      parts: [{ text: purpose === 'writer' ? '{"evidence":[]}' : 'answer' }],
      role: 'user',
    }],
    generationConfig: purpose === 'writer'
      ? WRITER_GENERATION
      : ANSWER_GENERATION,
    store: false,
  }
  if (purpose === 'writer') {
    body.systemInstruction = {
      parts: [{ text: 'Reduce the interaction.' }],
    }
  }
  return body
}

function eventSha256(event) {
  const copy = { ...event }
  delete copy.eventSha256
  return createHash('sha256')
    .update(JSON.stringify(copy))
    .digest('hex')
}

function successResponse({
  cachedTokens,
  candidateTokens = 5,
  inputTokens = 20,
  serviceTier = 'standard',
  serviceTierHeader = 'standard',
  status = 200,
  thoughtTokens,
  text = 'ok',
} = {}) {
  const usageMetadata = {
    candidatesTokenCount: candidateTokens,
    promptTokenCount: inputTokens,
    serviceTier,
    totalTokenCount: inputTokens + candidateTokens + (thoughtTokens ?? 0),
  }
  if (thoughtTokens !== undefined) {
    usageMetadata.thoughtsTokenCount = thoughtTokens
  }
  if (cachedTokens !== undefined) {
    usageMetadata.cachedContentTokenCount = cachedTokens
  }
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{ text }],
        role: 'model',
      },
      finishReason: 'STOP',
    }],
    modelVersion: INCREMENTAL_HARD_CAP_GEMINI_MODEL,
    usageMetadata,
  }), {
    headers: {
      'content-type': 'application/json',
      'x-gemini-service-tier': serviceTierHeader,
    },
    status,
  })
}

async function fixture(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-hard-cap-gemini-'))
  const paths = {
    journalPath: join(root, 'private', 'meter.jsonl'),
    transcriptDirectory: join(root, 'private', 'transcripts'),
  }
  const transport =
    await createIncrementalLongMemEvalHardCapGeminiTransport({
      answerGeneration: ANSWER_GENERATION,
      capUsd: 0.5,
      fetchImpl: async () => successResponse(),
      geminiApiKey: API_KEY,
      requestTimeoutMs: 1_000,
      writerGeneration: WRITER_GENERATION,
      ...paths,
      ...options,
    })
  return { paths, root, transport }
}

test('pending reservation is the full documented model window at Priority prices',
  () => {
    assert.equal(
      INCREMENTAL_HARD_CAP_GEMINI_MODEL,
      INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
    )
    assert.equal(INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens, 1_048_576)
    assert.equal(INCREMENTAL_HARD_CAP_GEMINI_LIMITS.outputTokens, 65_536)
    assert.equal(
      INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
      0.2359296,
    )
  })

test('cap refusal happens before transcript, journal event, or fetch',
  async () => {
    let calls = 0
    const { paths, root, transport } = await fixture({
      capUsd: INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD -
        0.0000001,
      fetchImpl: async () => {
        calls += 1
        return successResponse()
      },
    })
    try {
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('writer'),
          cellId: 'cap-cell',
          operationId: 'cap-cell:writer:1',
          purpose: 'writer',
        }),
        (error) => error?.code === 'CAP_REFUSED',
      )
      assert.equal(calls, 0)
      assert.equal(await readFile(paths.journalPath, 'utf8'), '')
      assert.deepEqual(await readdir(paths.transcriptDirectory), [])
      assert.equal((await transport.snapshot()).attempts, 0)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('exact decimal cap boundary dispatches while a lower cap refuses',
  async () => {
    const exact = await fixture({
      capUsd: 7.1,
      openingAccountedUsd: 6.8640704,
    })
    const below = await fixture({
      capUsd: 7.09,
      openingAccountedUsd: 6.8640704,
    })
    try {
      const result = await exact.transport.callGemini({
        body: bodyFor('answer'),
        cellId: 'exact-cap',
        operationId: 'exact-cap:answer:1',
        purpose: 'answer',
      })
      assert.equal(result.validated, true)
      await assert.rejects(
        below.transport.callGemini({
          body: bodyFor('answer'),
          cellId: 'below-cap',
          operationId: 'below-cap:answer:1',
          purpose: 'answer',
        }),
        (error) => error?.code === 'CAP_REFUSED',
      )
      assert.equal((await below.transport.snapshot()).attempts, 0)
    } finally {
      await rm(exact.root, { force: true, recursive: true })
      await rm(below.root, { force: true, recursive: true })
    }
  })

test('writer and answer release sequential reservations to exact Standard usage',
  async () => {
    const requests = []
    const { root, transport } = await fixture({
      async fetchImpl(url, init) {
        requests.push({
          body: JSON.parse(init.body),
          headers: { ...init.headers },
          url: String(url),
        })
        return requests.length === 1
          ? successResponse({
              candidateTokens: 40,
              inputTokens: 1_000,
              text: '{"actions":[]}',
            })
          : successResponse({
              candidateTokens: 10,
              inputTokens: 500,
              text: 'No stored memory answers it.',
            })
      },
    })
    try {
      const writer = await transport.callGemini({
        body: bodyFor('writer'),
        cellId: 'success-cell',
        operationId: 'success-cell:writer:1',
        purpose: 'writer',
      })
      const afterWriter = await transport.snapshot()
      const answer = await transport.callGemini({
        body: bodyFor('answer'),
        cellId: 'success-cell',
        operationId: 'success-cell:answer:1',
        purpose: 'answer',
      })
      const verified = await transport.verify()

      assert.equal(writer.validated, true)
      assert.equal(answer.validated, true)
      assert.equal(requests.length, 2)
      for (const request of requests) {
        assert.equal(
          request.url,
          `https://generativelanguage.googleapis.com/v1beta/models/${INCREMENTAL_HARD_CAP_GEMINI_MODEL}:generateContent`,
        )
        assert.deepEqual(
          Object.keys(request.headers).sort(),
          ['content-type', 'x-goog-api-key'],
        )
        assert.equal(request.headers['x-goog-api-key'], API_KEY)
        assert.equal(Object.hasOwn(request.body, 'serviceTier'), false)
        assert.equal(request.body.store, false)
        assert.equal(
          request.body.generationConfig.thinkingConfig.thinkingBudget,
          0,
        )
      }
      assert.equal(afterWriter.accounted.usd, 0.000116)
      assert.deepEqual(afterWriter.uncertain, {
        inputTokens: 0,
        outputTokens: 0,
        usd: 0,
      })
      assert.deepEqual(verified.meter.measured, {
        inputTokens: 1_500,
        outputTokens: 50,
        usd: 0.00017,
      })
      assert.equal(verified.meter.accounted.usd, 0.00017)
      assert.equal(verified.meter.terminal, false)
      assert.equal(verified.transcripts.attempts, 2)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('only HTTP 200 releases a reservation; another 2xx is terminal uncertainty',
  async () => {
    let calls = 0
    const { root, transport } = await fixture({
      fetchImpl: async () => {
        calls += 1
        return successResponse({ status: 201 })
      },
    })
    try {
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('writer'),
          cellId: 'unexpected-2xx',
          operationId: 'unexpected-2xx:writer:1',
          purpose: 'writer',
        }),
        (error) => error?.code === 'GEMINI_HTTP_201',
      )
      const snapshot = await transport.snapshot()
      assert.equal(calls, 1)
      assert.equal(snapshot.terminal, true)
      assert.equal(
        snapshot.uncertain.usd,
        INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
      )
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('answer'),
          cellId: 'unexpected-2xx',
          operationId: 'unexpected-2xx:answer:1',
          purpose: 'answer',
        }),
        (error) => error?.code === 'METER_TERMINAL',
      )
      assert.equal(calls, 1)
      await transport.verify()
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('implicit cache hits are accepted and priced at the documented rate',
  async () => {
    const { root, transport } = await fixture({
      fetchImpl: async () => successResponse({
        cachedTokens: 400,
        candidateTokens: 10,
        inputTokens: 1_000,
      }),
    })
    try {
      const result = await transport.callGemini({
        body: bodyFor('answer'),
        cellId: 'cache-cell',
        operationId: 'cache-cell:answer:1',
        purpose: 'answer',
      })
      const verified = await transport.verify()
      assert.equal(result.usageDetails.cachedInputTokens, 400)
      assert.equal(result.usage.usd, 0.000068)
      assert.deepEqual(verified.meter.measured, {
        inputTokens: 1_000,
        outputTokens: 10,
        usd: 0.000068,
      })
      assert.equal(verified.meter.uncertain.usd, 0)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

for (const [label, response, code] of [
  [
    'wrong service tier',
    () => successResponse({
      serviceTier: 'priority',
    }),
    'GEMINI_SERVICE_TIER_MISMATCH',
  ],
  [
    'wrong service-tier response header',
    () => successResponse({ serviceTierHeader: 'priority' }),
    'GEMINI_SERVICE_TIER_MISMATCH',
  ],
  [
    'nonzero thought usage',
    () => successResponse({ thoughtTokens: 3 }),
    'GEMINI_USAGE_INVALID',
  ],
  [
    'cached tokens exceed prompt tokens',
    () => successResponse({ cachedTokens: 21, inputTokens: 20 }),
    'GEMINI_USAGE_INVALID',
  ],
]) {
  test(`${label} retains the full reservation and closes without retry`,
    async () => {
      let calls = 0
      const { root, transport } = await fixture({
        fetchImpl: async () => {
          calls += 1
          return response()
        },
      })
      try {
        const request = {
          body: bodyFor('writer'),
          cellId: `failure-${label}`,
          operationId: `failure-${label}:writer:1`,
          purpose: 'writer',
        }
        await assert.rejects(
          transport.callGemini(request),
          (error) => error?.code === code,
        )
        const snapshot = await transport.snapshot()
        assert.equal(calls, 1)
        assert.equal(snapshot.terminal, true)
        assert.equal(
          snapshot.accounted.usd,
          INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
        )
        assert.equal(
          snapshot.uncertain.usd,
          INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
        )
        assert.deepEqual(snapshot.measured, {
          inputTokens: 0,
          outputTokens: 0,
          usd: 0,
        })
        await assert.rejects(
          transport.callGemini({
            ...request,
            operationId: `${request.operationId}:another`,
          }),
          (error) => error?.code === 'METER_TERMINAL',
        )
        assert.equal(calls, 1)
        assert.equal((await transport.verify()).transcripts.attempts, 1)
      } finally {
        await rm(root, { force: true, recursive: true })
      }
    })
}

test('transport uncertainty retains the full reservation and never retries',
  async () => {
    let calls = 0
    const { paths, root, transport } = await fixture({
      fetchImpl: async () => {
        calls += 1
        throw Object.assign(new Error('offline transport failure'), {
          code: 'ECONNRESET',
        })
      },
    })
    try {
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('answer'),
          cellId: 'transport-cell',
          operationId: 'transport-cell:answer:1',
          purpose: 'answer',
        }),
        (error) => error?.code === 'ECONNRESET',
      )
      const snapshot = await transport.snapshot()
      assert.equal(calls, 1)
      assert.equal(snapshot.terminal, true)
      assert.equal(
        snapshot.accounted.usd,
        INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
      )
      assert.equal(
        snapshot.uncertain.usd,
        INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
      )
      assert.equal((await transport.verify()).transcripts.attempts, 1)
      const reopened =
        await createIncrementalLongMemEvalHardCapGeminiTransport({
          answerGeneration: ANSWER_GENERATION,
          capUsd: 0.5,
          fetchImpl: async () => {
            calls += 1
            return successResponse()
          },
          geminiApiKey: API_KEY,
          writerGeneration: WRITER_GENERATION,
          ...paths,
        })
      assert.equal((await reopened.snapshot()).terminal, true)
      await assert.rejects(
        reopened.callGemini({
          body: bodyFor('answer'),
          cellId: 'transport-cell',
          operationId: 'transport-cell:answer:2',
          purpose: 'answer',
        }),
        (error) => error?.code === 'METER_TERMINAL',
      )
      assert.equal(calls, 1)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('timeout is one terminal dispatch with the complete reservation',
  async () => {
    let calls = 0
    const { root, transport } = await fixture({
      fetchImpl: async () => {
        calls += 1
        return new Promise(() => {})
      },
      requestTimeoutMs: 10,
    })
    try {
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('answer'),
          cellId: 'timeout-cell',
          operationId: 'timeout-cell:answer:1',
          purpose: 'answer',
        }),
        (error) => error?.code === 'GEMINI_TIMEOUT',
      )
      const snapshot = await transport.snapshot()
      assert.equal(calls, 1)
      assert.equal(snapshot.terminal, true)
      assert.equal(
        snapshot.accounted.usd,
        INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('streaming ceiling cancels an oversized chunk and terminals uncertainty',
  async () => {
    let calls = 0
    let cancelled = false
    const { root, transport } = await fixture({
      fetchImpl: async () => {
        calls += 1
        return new Response(new ReadableStream({
          cancel() {
            cancelled = true
          },
          start(controller) {
            controller.enqueue(new Uint8Array(17))
          },
        }), {
          headers: {
            'content-type': 'application/json',
            'x-gemini-service-tier': 'standard',
          },
          status: 200,
        })
      },
      maxResponseBytes: 16,
    })
    try {
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('answer'),
          cellId: 'oversized-stream',
          operationId: 'oversized-stream:answer:1',
          purpose: 'answer',
        }),
        (error) => error?.code === 'GEMINI_RESPONSE_TOO_LARGE',
      )
      const snapshot = await transport.snapshot()
      assert.equal(calls, 1)
      assert.equal(cancelled, true)
      assert.equal(snapshot.attempts, 1)
      assert.equal(snapshot.terminal, true)
      assert.equal(
        snapshot.uncertain.usd,
        INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
      )
      assert.equal((await transport.verify()).transcripts.attempts, 1)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('one timeout covers received headers and a stalled response body',
  async () => {
    let calls = 0
    let cancelled = false
    const { root, transport } = await fixture({
      fetchImpl: async () => {
        calls += 1
        return new Response(new ReadableStream({
          cancel() {
            cancelled = true
          },
        }), {
          headers: {
            'content-type': 'application/json',
            'x-gemini-service-tier': 'standard',
          },
          status: 200,
        })
      },
      requestTimeoutMs: 10,
    })
    try {
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('answer'),
          cellId: 'stalled-body',
          operationId: 'stalled-body:answer:1',
          purpose: 'answer',
        }),
        (error) => error?.code === 'GEMINI_TIMEOUT',
      )
      const snapshot = await transport.snapshot()
      assert.equal(calls, 1)
      assert.equal(cancelled, true)
      assert.equal(snapshot.attempts, 1)
      assert.equal(snapshot.terminal, true)
      assert.equal(
        snapshot.uncertain.usd,
        INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
      )
      assert.equal((await transport.verify()).transcripts.attempts, 1)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('model and generation/body bindings fail before dispatch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-hard-cap-binding-'))
  let calls = 0
  let nestedRoot = null
  try {
    await assert.rejects(
      createIncrementalLongMemEvalHardCapGeminiTransport({
        answerGeneration: ANSWER_GENERATION,
        capUsd: 0.5,
        fetchImpl: async () => {
          calls += 1
          return successResponse()
        },
        geminiApiKey: API_KEY,
        journalPath: join(root, 'wrong-model.jsonl'),
        model: 'gemini-3.5-flash-lite',
        transcriptDirectory: join(root, 'wrong-model-transcripts'),
        writerGeneration: WRITER_GENERATION,
      }),
      (error) => error?.code === 'MODEL_FIXED',
    )
    await assert.rejects(
      createIncrementalLongMemEvalHardCapGeminiTransport({
        answerGeneration: {
          ...ANSWER_GENERATION,
          thinkingConfig: { thinkingBudget: 1 },
        },
        capUsd: 0.5,
        fetchImpl: async () => {
          calls += 1
          return successResponse()
        },
        geminiApiKey: API_KEY,
        journalPath: join(root, 'thinking.jsonl'),
        transcriptDirectory: join(root, 'thinking-transcripts'),
        writerGeneration: WRITER_GENERATION,
      }),
      (error) => error?.code === 'GENERATION_CONTRACT_INVALID',
    )
    await assert.rejects(
      createIncrementalLongMemEvalHardCapGeminiTransport({
        answerGeneration: {
          ...ANSWER_GENERATION,
          temperature: 0,
        },
        capUsd: 0.5,
        fetchImpl: async () => {
          calls += 1
          return successResponse()
        },
        geminiApiKey: API_KEY,
        journalPath: join(root, 'sampling.jsonl'),
        transcriptDirectory: join(root, 'sampling-transcripts'),
        writerGeneration: WRITER_GENERATION,
      }),
      (error) => error?.code === 'GENERATION_CONTRACT_INVALID',
    )
    await assert.rejects(
      createIncrementalLongMemEvalHardCapGeminiTransport({
        answerGeneration: {
          ...ANSWER_GENERATION,
          responseFormat: { type: 'json_schema' },
        },
        capUsd: 0.5,
        fetchImpl: async () => {
          calls += 1
          return successResponse()
        },
        geminiApiKey: API_KEY,
        journalPath: join(root, 'response-format.jsonl'),
        transcriptDirectory: join(root, 'response-format-transcripts'),
        writerGeneration: WRITER_GENERATION,
      }),
      (error) => error?.code === 'GENERATION_CONTRACT_INVALID',
    )
    await assert.rejects(
      createIncrementalLongMemEvalHardCapGeminiTransport({
        answerGeneration: ANSWER_GENERATION,
        capUsd: 0.5,
        fetchImpl: async () => {
          calls += 1
          return successResponse()
        },
        geminiApiKey: API_KEY,
        journalPath: join(root, 'oversized-response-limit.jsonl'),
        maxResponseBytes: 8 * 1024 * 1024 + 1,
        transcriptDirectory:
          join(root, 'oversized-response-limit-transcripts'),
        writerGeneration: WRITER_GENERATION,
      }),
      (error) =>
        error?.code === 'TRANSPORT_CONFIGURATION_INVALID',
    )
    const nested = await fixture({
      fetchImpl: async () => {
        calls += 1
        return successResponse()
      },
    })
    nestedRoot = nested.root
    const { transport } = nested
    await assert.rejects(
      transport.callGemini({
        body: {
          ...bodyFor('answer'),
          contents: [{
            parts: [{
              inlineData: {
                data: 'AAAA',
                mimeType: 'audio/wav',
              },
            }],
            role: 'user',
          }],
        },
        cellId: 'inline-audio',
        operationId: 'inline-audio:answer:1',
        purpose: 'answer',
      }),
      (error) => error?.code === 'REQUEST_SCHEMA_INVALID',
    )
    const mutatedBody = bodyFor('answer')
    mutatedBody.generationConfig = {
      ...mutatedBody.generationConfig,
      maxOutputTokens: 257,
    }
    await assert.rejects(
      transport.callGemini({
        body: mutatedBody,
        cellId: 'binding-cell',
        operationId: 'binding-cell:answer:1',
        purpose: 'answer',
      }),
      (error) => error?.code === 'REQUEST_BINDING_INVALID',
    )
    assert.equal(calls, 0)
  } finally {
    if (nestedRoot) {
      await rm(nestedRoot, { force: true, recursive: true })
    }
    await rm(root, { force: true, recursive: true })
  }
})

test('verification rejects transcript tampering after a validated response',
  async () => {
    const { paths, root, transport } = await fixture()
    try {
      await transport.callGemini({
        body: bodyFor('answer'),
        cellId: 'tamper-cell',
        operationId: 'tamper-cell:answer:1',
        purpose: 'answer',
      })
      const files = await readdir(paths.transcriptDirectory)
      assert.equal(files.length, 1)
      const path = join(paths.transcriptDirectory, files[0])
      const original = await readFile(path, 'utf8')
      await writeFile(path, `${original} `, { mode: 0o600 })
      await assert.rejects(
        transport.verify(),
        (error) => error?.code === 'TRANSCRIPT_HASH_MISMATCH',
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

for (const evidenceKind of ['journal', 'transcript']) {
  for (const replacementKind of ['symlink', 'hardlink']) {
    test(`verification rejects a ${replacementKind}ed ${evidenceKind} artifact`,
      async () => {
        const { paths, root, transport } = await fixture()
        try {
          await transport.callGemini({
            body: bodyFor('answer'),
            cellId: `${evidenceKind}-${replacementKind}`,
            operationId:
              `${evidenceKind}-${replacementKind}:answer:1`,
            purpose: 'answer',
          })
          const source = evidenceKind === 'journal'
            ? paths.journalPath
            : join(
                paths.transcriptDirectory,
                (await readdir(paths.transcriptDirectory))[0],
              )
          const outside = join(
            root,
            `${evidenceKind}-${replacementKind}-outside`,
          )
          await rename(source, outside)
          if (replacementKind === 'symlink') {
            await symlink(outside, source)
          } else {
            await link(outside, source)
          }
          await assert.rejects(
            transport.verify(),
            (error) => error?.code === (
              evidenceKind === 'journal'
                ? 'EVIDENCE_MODE_OR_SET_INVALID'
                : 'TRANSCRIPT_MODE_MISMATCH'
            ),
          )
        } finally {
          await rm(root, { force: true, recursive: true })
        }
      })
  }
}

test('verification replays transcript usage instead of trusting a rehashed ledger',
  async () => {
    const { paths, root, transport } = await fixture()
    try {
      await transport.callGemini({
        body: bodyFor('answer'),
        cellId: 'accounting-cell',
        operationId: 'accounting-cell:answer:1',
        purpose: 'answer',
      })
      const events = (await readFile(paths.journalPath, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      const terminal = events.at(-1)
      terminal.usage.inputTokens = 21
      terminal.usage.usd = 0.0000041
      delete terminal.eventSha256
      terminal.eventSha256 = createHash('sha256')
        .update(JSON.stringify(terminal))
        .digest('hex')
      await writeFile(
        paths.journalPath,
        `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
        { mode: 0o600 },
      )
      await assert.rejects(
        transport.verify(),
        (error) => error?.code === 'EVIDENCE_REPLAY_MISMATCH',
      )
      let restartCalls = 0
      await assert.rejects(
        createIncrementalLongMemEvalHardCapGeminiTransport({
          answerGeneration: ANSWER_GENERATION,
          capUsd: 0.5,
          fetchImpl: async () => {
            restartCalls += 1
            return successResponse()
          },
          geminiApiKey: API_KEY,
          writerGeneration: WRITER_GENERATION,
          ...paths,
        }),
        (error) => error?.code === 'EVIDENCE_REPLAY_MISMATCH',
      )
      assert.equal(restartCalls, 0)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('orphan evidence refuses the next dispatch before start or fetch',
  async () => {
    let calls = 0
    const { paths, root, transport } = await fixture({
      fetchImpl: async () => {
        calls += 1
        return successResponse()
      },
    })
    try {
      await transport.callGemini({
        body: bodyFor('writer'),
        cellId: 'orphan-evidence',
        operationId: 'orphan-evidence:writer:1',
        purpose: 'writer',
      })
      const journalBefore = await readFile(paths.journalPath, 'utf8')
      await writeFile(
        join(paths.transcriptDirectory, 'orphan.json'),
        '{}\n',
        { mode: 0o600 },
      )
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('answer'),
          cellId: 'orphan-evidence',
          operationId: 'orphan-evidence:answer:1',
          purpose: 'answer',
        }),
        (error) => error?.code === 'TRANSCRIPT_SET_MISMATCH',
      )
      assert.equal(calls, 1)
      assert.equal(
        await readFile(paths.journalPath, 'utf8'),
        journalBefore,
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('rehashed prior accounting refuses the next dispatch before fetch',
  async () => {
    let calls = 0
    const { paths, root, transport } = await fixture({
      fetchImpl: async () => {
        calls += 1
        return successResponse()
      },
    })
    try {
      await transport.callGemini({
        body: bodyFor('writer'),
        cellId: 'prior-accounting',
        operationId: 'prior-accounting:writer:1',
        purpose: 'writer',
      })
      const events = (await readFile(paths.journalPath, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      const terminal = events.at(-1)
      terminal.usage.inputTokens += 1
      terminal.usage.usd = 0.0000041
      terminal.eventSha256 = eventSha256(terminal)
      await writeFile(
        paths.journalPath,
        `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
        { mode: 0o600 },
      )
      const journalBefore = await readFile(paths.journalPath, 'utf8')
      await assert.rejects(
        transport.callGemini({
          body: bodyFor('answer'),
          cellId: 'prior-accounting',
          operationId: 'prior-accounting:answer:1',
          purpose: 'answer',
        }),
        (error) => error?.code === 'EVIDENCE_REPLAY_MISMATCH',
      )
      assert.equal(calls, 1)
      assert.equal(
        await readFile(paths.journalPath, 'utf8'),
        journalBefore,
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('coherently relabeled HTTP-200 success cannot verify as failure',
  async () => {
    const { paths, root, transport } = await fixture()
    try {
      await transport.callGemini({
        body: bodyFor('answer'),
        cellId: 'relabeled-success',
        operationId: 'relabeled-success:answer:1',
        purpose: 'answer',
      })
      const transcriptFile =
        (await readdir(paths.transcriptDirectory))[0]
      const transcriptPath =
        join(paths.transcriptDirectory, transcriptFile)
      const transcript =
        JSON.parse(await readFile(transcriptPath, 'utf8'))
      transcript.terminal.outcome = 'invalid_response'
      const transcriptText =
        `${JSON.stringify(transcript, null, 2)}\n`
      await writeFile(transcriptPath, transcriptText, { mode: 0o600 })

      const events = (await readFile(paths.journalPath, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      const terminal = events.at(-1)
      terminal.error = {
        code: 'FORGED_FAILURE',
        message: 'A valid success was relabeled as a failure.',
      }
      delete terminal.modelVersion
      terminal.outcome = 'invalid_response'
      terminal.transcriptSha256 = createHash('sha256')
        .update(transcriptText)
        .digest('hex')
      terminal.usage = null
      delete terminal.usageDetails
      terminal.eventSha256 = eventSha256(terminal)
      await writeFile(
        paths.journalPath,
        `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
        { mode: 0o600 },
      )
      await assert.rejects(
        transport.verify(),
        (error) => error?.code === 'EVIDENCE_REPLAY_MISMATCH',
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('network guard blocks non-loopback calls while captured transport remains usable',
  async () => {
    const originalGlobalFetch = globalThis.fetch
    let globalCalls = 0
    let providerCalls = 0
    const loopbackFetch = async () => {
      globalCalls += 1
      return new Response('loopback-ok', { status: 200 })
    }
    globalThis.fetch = loopbackFetch
    const root = await mkdtemp(join(tmpdir(), 'palari-hard-cap-guard-'))
    let transport
    try {
      transport =
        await createIncrementalLongMemEvalHardCapGeminiTransport({
          answerGeneration: ANSWER_GENERATION,
          capUsd: 0.5,
          fetchImpl: async () => {
            providerCalls += 1
            return successResponse()
          },
          geminiApiKey: API_KEY,
          journalPath: join(root, 'private', 'meter.jsonl'),
          transcriptDirectory: join(root, 'private', 'transcripts'),
          writerGeneration: WRITER_GENERATION,
      })
      transport.installNetworkGuard()
      assert.throws(
        () => transport.installNetworkGuard(),
        (error) => error?.code === 'NETWORK_GUARD_INSTALLED',
      )
      await assert.rejects(
        globalThis.fetch('https://example.com'),
        (error) => error?.code === 'UNMETERED_NETWORK_BLOCKED',
      )
      const loopback = await globalThis.fetch('http://127.0.0.1:1234')
      assert.equal(await loopback.text(), 'loopback-ok')
      const ipv6Loopback = await globalThis.fetch('http://[::1]:1234')
      assert.equal(await ipv6Loopback.text(), 'loopback-ok')
      await transport.callGemini({
        body: bodyFor('answer'),
        cellId: 'guard-cell',
        operationId: 'guard-cell:answer:1',
        purpose: 'answer',
      })
      assert.equal(globalCalls, 2)
      assert.equal(providerCalls, 1)
      transport.closeNetworkGuard()
      assert.strictEqual(globalThis.fetch, loopbackFetch)
    } finally {
      transport?.closeNetworkGuard()
      globalThis.fetch = originalGlobalFetch
      await rm(root, { force: true, recursive: true })
    }
  })
