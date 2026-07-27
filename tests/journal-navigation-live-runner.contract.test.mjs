import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  JOURNAL_NAVIGATION_GEMINI_GENERATION,
  JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE,
  JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN,
  JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION,
  JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG,
  JOURNAL_NAVIGATION_GEMINI_TOOLS,
} from '../evals/arms/journal-navigation-gemini-live-adapter.mjs'
import {
  LEAN_MEMORY_REDUCER_GENERATION,
} from '../evals/arms/lean-memory-reducer-contract.mjs'
import {
  createIncrementalLongMemEvalGeminiTransport,
} from '../evals/incremental-longmemeval-runtime.mjs'
import {
  JOURNAL_NAVIGATION_LIVE_RUN_ID,
  loadJournalNavigationLiveContract,
} from '../evals/journal-navigation-live-config.mjs'
import {
  assertJournalNavigationRunOpen,
  createJournalNavigationCallGate,
  JOURNAL_NAVIGATION_TERMINAL_RUN_IDS,
  journalNavigationLiveResultPaths,
  main,
  navigationFailureEvidence,
  parseJournalNavigationLiveArgs,
  runJournalNavigationCompatibilitySmoke,
} from '../evals/run-journal-navigation-live.mjs'
import {
  verifyJ4ArtifactManifest,
} from '../evals/run-longmemeval-live.mjs'

const MODEL = 'gemini-2.5-flash-lite'
const SOURCE_ROOT = new URL('..', import.meta.url).pathname

function functionCallResponse() {
  const functionCall = {
    args: { phrase: JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE },
    id: 'smoke-call-1',
    name: 'memory_find',
  }
  return {
    candidateContent: {
      parts: [{
        functionCall,
        thoughtSignature: 'opaque-smoke-signature',
      }],
      role: 'model',
    },
    finishReason: 'STOP',
    functionCalls: [functionCall],
    modelVersion: MODEL,
    responseType: 'function_calls',
    text: null,
    validated: true,
  }
}

function finalResponse() {
  return {
    candidateContent: {
      parts: [{ text: JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN }],
      role: 'model',
    },
    finishReason: 'STOP',
    functionCalls: [],
    modelVersion: MODEL,
    responseType: 'final_text',
    text: JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN,
    validated: true,
  }
}

function httpSuccess(content, {
  candidateTokens = 5,
  inputTokens = 30,
  toolTokens = 0,
} = {}) {
  const usageMetadata = {
    candidatesTokenCount: candidateTokens,
    promptTokenCount: inputTokens,
    serviceTier: 'standard',
    totalTokenCount: inputTokens + candidateTokens,
  }
  if (toolTokens > 0) {
    usageMetadata.toolUsePromptTokenCount = toolTokens
  }
  return new Response(JSON.stringify({
    candidates: [{
      content,
      finishReason: 'STOP',
    }],
    modelVersion: MODEL,
    usageMetadata,
  }), {
    headers: {
      'content-type': 'application/json',
      'x-gemini-service-tier': 'standard',
    },
    status: 200,
  })
}

test('runner import is inert and the exact identity is one-way sealed',
  async () => {
    assert.deepEqual(
      JOURNAL_NAVIGATION_TERMINAL_RUN_IDS,
      [JOURNAL_NAVIGATION_LIVE_RUN_ID],
    )
    assert.equal(
      parseJournalNavigationLiveArgs([
        '--run',
        JOURNAL_NAVIGATION_LIVE_RUN_ID,
      ]),
      JOURNAL_NAVIGATION_LIVE_RUN_ID,
    )
    assert.throws(
      () => assertJournalNavigationRunOpen(
        JOURNAL_NAVIGATION_LIVE_RUN_ID,
      ),
      { code: 'RUN_TERMINAL' },
    )
    assert.throws(
      () => parseJournalNavigationLiveArgs(['--run', 'sealed-v1']),
      { code: 'RUN_ID_REQUIRED' },
    )
    let reads = 0
    await assert.rejects(
      main({
        args: ['--run', JOURNAL_NAVIGATION_LIVE_RUN_ID],
        dependencies: new Proxy({}, {
          get() {
            reads += 1
            throw new Error('terminal runner read dependencies')
          },
        }),
        env: new Proxy({}, {
          get() {
            reads += 1
            throw new Error('terminal runner read environment')
          },
        }),
      }),
      { code: 'RUN_TERMINAL' },
    )
    assert.equal(reads, 0)
  })

test('private terminal smoke evidence verifies when present',
  async (context) => {
    const paths = journalNavigationLiveResultPaths(SOURCE_ROOT)
    let manifestBytes
    try {
      manifestBytes = await readFile(paths.artifactManifestPath)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        context.skip('gitignored terminal evidence is absent')
        return
      }
      throw error
    }
    await verifyJ4ArtifactManifest(paths.runDir)
    const [reportBytes, runStateBytes] = await Promise.all([
      readFile(paths.reportJsonPath),
      readFile(paths.runStatePath),
    ])
    const digest = (bytes) =>
      createHash('sha256').update(bytes).digest('hex')
    assert.equal(
      digest(manifestBytes),
      '7de7342a05eb309e34330043966334c8faee077271472062b2cb7f8090c46c35',
    )
    assert.equal(
      digest(reportBytes),
      '34149ecc8cafbe08ea22150734b81043905fa1187c9f5e27401bd748a6716b6f',
    )
    assert.equal(
      digest(runStateBytes),
      'd2c6575db2e47b3b246b439b19c1e69a320f55e62eaa4fff8b7e48035d6fc1d0',
    )
    const report = JSON.parse(reportBytes)
    const runState = JSON.parse(runStateBytes)
    assert.equal(runState.status, 'failed')
    assert.equal(
      runState.failure.code,
      'SMOKE_REDUCER_SEMANTICS_INVALID',
    )
    assert.equal(runState.smoke.datasetLoaded, false)
    assert.equal(runState.smoke.receiptFile, null)
    assert.equal(runState.question.question2Started, false)
    assert.equal(runState.meter.gemini.attempts, 1)
    assert.deepEqual(runState.meter.gemini.logicalRequests, {
      writer: 1,
    })
    assert.equal(runState.meter.judge.attempts, 0)
    assert.equal(report.spend.freshMeasuredUsd, 0.0000814)
    assert.equal(report.spend.freshAccountedUsd, 0.0000814)
    assert.deepEqual(report.computed.navigation.toolCalls, [])
  })

test('real product smoke completes one reducer and one native tool round trip',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-navigation-live-smoke-'),
    )
    const requests = []
    try {
      const gate = createJournalNavigationCallGate(
        async (request) => {
          requests.push(structuredClone(request))
          if (request.operationId === 'smoke:reducer:1') {
            const input = JSON.parse(
              request.body.contents[0].parts[0].text,
            )
            assert.equal(input.prior.length, 0)
            assert.equal(input.evidence.length, 1)
            const evidence = input.evidence[0]
            return {
              text: JSON.stringify({
                actions: [{
                  epistemic: 'asserted',
                  evidenceQuotes: [evidence.text],
                  evidenceRefs: [evidence.ref],
                  op: 'add',
                  statement:
                    `The user's compatibility token is ${JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN}.`,
                  targets: [],
                  timeEvidenceRef: '',
                  timeQuote: '',
                  topic: 'compatibility token',
                }],
              }),
            }
          }
          if (request.operationId === 'smoke:explore:1') {
            return functionCallResponse()
          }
          if (request.operationId === 'smoke:answer:1') {
            const history = request.body.contents
            assert.equal(history.length, 3)
            assert.equal(
              history[1].parts[0].thoughtSignature,
              'opaque-smoke-signature',
            )
            assert.equal(
              history[2].parts[0].functionResponse.id,
              'smoke-call-1',
            )
            assert.match(
              JSON.stringify(
                history[2].parts[0].functionResponse.response,
              ),
              /PALARI-COMPAT-7319/,
            )
            return finalResponse()
          }
          assert.fail(`Unexpected operation ${request.operationId}`)
        },
      )
      const result = await runJournalNavigationCompatibilitySmoke({
        callGate: gate,
        expectedModel: MODEL,
        workspacePaths: {
          smokeNavigationWorkspaceDir: join(root, 'navigation'),
          smokeReducerWorkspaceDir: join(root, 'reducer'),
        },
      })

      assert.equal(requests.length, 3)
      assert.deepEqual(
        requests.map(({ operationId, purpose }) => ({
          operationId,
          purpose,
        })),
        [
          { operationId: 'smoke:reducer:1', purpose: 'writer' },
          { operationId: 'smoke:explore:1', purpose: 'explore' },
          { operationId: 'smoke:answer:1', purpose: 'explore' },
        ],
      )
      assert.equal(result.reducer.digestItems, 1)
      assert.equal(result.reducer.digest.ready, true)
      assert.equal(result.reducer.digest.pending, 0)
      assert.equal(result.reducer.digest.blocked, 0)
      assert.equal(result.exploration.modelDispatches, 2)
      assert.equal(result.exploration.toolCalls.length, 1)
      assert.equal(
        result.exploration.answer,
        JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN,
      )
      assert.ok(result.exploration.expectedEvidenceId)
      assert.equal(
        JSON.stringify(result).includes('POISON-0000'),
        false,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

test('call gate refuses a fourth smoke call before transport', async () => {
  let dispatched = 0
  const gate = createJournalNavigationCallGate(async () => {
    dispatched += 1
    return {}
  })
  await gate.call({
    operationId: 'smoke:reducer:1',
    purpose: 'writer',
  })
  gate.enterSmokeNavigation()
  await gate.call({
    operationId: 'smoke:explore:1',
    purpose: 'explore',
  })
  await gate.call({
    operationId: 'smoke:answer:1',
    purpose: 'explore',
  })
  await assert.rejects(
    gate.call({
      operationId: 'smoke:answer:2',
      purpose: 'explore',
    }),
    { code: 'SMOKE_CALL_ORDER_INVALID' },
  )
  assert.equal(dispatched, 3)
})

test('navigation failures preserve the exact partial host-tool audit', () => {
  const secret = `secret-${randomUUID()}`
  const failure = Object.assign(
    new Error(`Provider failed after ${secret}.`),
    {
      providerToolTranscript: [{
        input: { phrase: 'first phrase' },
        operationId: 'question:q1:explore:1',
        outcome: 'success',
        result: { matches: [] },
        tool: 'memory_find',
      }, {
        error: {
          code: 'TRANSPORT_FAILED',
          message: `No response for ${secret}.`,
          name: 'Error',
        },
        input: {},
        operationId: 'question:q1:explore:2',
        outcome: 'error',
        tool: 'memory_timeline',
      }],
      toolAttemptBudget: 6,
      toolAttemptBudgetExhausted: false,
      toolAttemptBudgetExceeded: false,
      toolAttemptBudgetRemaining: 4,
      toolAttempts: 2,
    },
  )

  const evidence = navigationFailureEvidence(failure, [secret])
  assert.equal(evidence.status, 'failed')
  assert.equal(evidence.toolAttempts, 2)
  assert.equal(evidence.toolAttemptBudgetRemaining, 4)
  assert.deepEqual(
    evidence.providerToolTranscript.map(({ tool, outcome }) => ({
      outcome,
      tool,
    })),
    [
      { outcome: 'success', tool: 'memory_find' },
      { outcome: 'error', tool: 'memory_timeline' },
    ],
  )
  assert.equal(JSON.stringify(evidence).includes(secret), false)
})

test('the exact three-call smoke composes through the real hard-cap wire',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-navigation-real-meter-smoke-'),
    )
    const bodies = []
    const transport = await createIncrementalLongMemEvalGeminiTransport({
      cumulativeCapUsd: 2,
      explorationGeneration: JOURNAL_NAVIGATION_GEMINI_GENERATION,
      explorationSystemInstruction:
        JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION,
      explorationToolConfig: JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG,
      explorationTools: JOURNAL_NAVIGATION_GEMINI_TOOLS,
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body)
        bodies.push(body)
        if (bodies.length === 1) {
          const input = JSON.parse(
            body.contents[0].parts[0].text,
          )
          const evidence = input.evidence[0]
          return httpSuccess({
            parts: [{
              text: JSON.stringify({
                actions: [{
                  epistemic: 'asserted',
                  evidenceQuotes: [evidence.text],
                  evidenceRefs: [evidence.ref],
                  op: 'add',
                  statement:
                    `The user's compatibility token is ${JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN}.`,
                  targets: [],
                  timeEvidenceRef: '',
                  timeQuote: '',
                  topic: 'compatibility token',
                }],
              }),
            }],
            role: 'model',
          })
        }
        if (bodies.length === 2) {
          assert.equal(
            JSON.stringify(body)
              .includes(JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN),
            false,
          )
          return httpSuccess(
            functionCallResponse().candidateContent,
            { toolTokens: 9 },
          )
        }
        assert.equal(bodies.length, 3)
        assert.equal(
          body.contents[1].parts[0].thoughtSignature,
          'opaque-smoke-signature',
        )
        assert.equal(
          body.contents[2].parts[0].functionResponse.id,
          'smoke-call-1',
        )
        return httpSuccess(finalResponse().candidateContent, {
          toolTokens: 12,
        })
      },
      freshSubcapUsd: 1.5,
      geminiApiKey: 'fake-real-wire-gemini-key',
      journalPath: join(root, 'meter.jsonl'),
      openingAccountedUsd: 0,
      transcriptDirectory: join(root, 'transcripts'),
      writerGeneration: LEAN_MEMORY_REDUCER_GENERATION,
    })
    try {
      const gate = createJournalNavigationCallGate(
        transport.callGemini,
      )
      transport.installNetworkGuard()
      const result = await runJournalNavigationCompatibilitySmoke({
        callGate: gate,
        expectedModel: MODEL,
        workspacePaths: {
          smokeNavigationWorkspaceDir: join(root, 'navigation'),
          smokeReducerWorkspaceDir: join(root, 'reducer'),
        },
      })
      const verified = await transport.verify()
      assert.equal(result.reducer.digestItems, 1)
      assert.equal(result.exploration.modelDispatches, 2)
      assert.equal(bodies.length, 3)
      assert.equal(verified.meter.attempts, 3)
      assert.deepEqual(verified.meter.logicalRequests, {
        explore: 2,
        writer: 1,
      })
      assert.equal(verified.meter.terminal, false)
    } finally {
      transport.closeNetworkGuard()
      await rm(root, { recursive: true, force: true })
    }
  })

test('historical open path proves smoke gates replay, navigation, and judge',
  {
    skip: JOURNAL_NAVIGATION_TERMINAL_RUN_IDS.includes(
      JOURNAL_NAVIGATION_LIVE_RUN_ID,
    ) && 'the one-shot identity is terminal',
  },
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-navigation-main-composition-'),
    )
    await mkdir(join(root, 'data'), { recursive: true })
    await copyFile(
      join(SOURCE_ROOT, 'data/longmemeval_s_cleaned.json'),
      join(root, 'data/longmemeval_s_cleaned.json'),
    )
    const sourceContract =
      await loadJournalNavigationLiveContract({
        repoRoot: SOURCE_ROOT,
      })
    const loaded = {
      ...sourceContract,
      authority: {
        ...sourceContract.authority,
        dispatchAuthorized: true,
        exactCapConfirmationRequired: false,
      },
      authorityPath: join(
        root,
        'evals/live-runs/j4-journal-navigation-longmemeval-q1-v1.authority.json',
      ),
      configPath: join(
        root,
        'evals/live-runs/j4-journal-navigation-longmemeval-q1-v1.json',
      ),
      predictionsPath: join(
        root,
        'evals/predictions/j4-journal-navigation-longmemeval-q1-v1.json',
      ),
    }
    const geminiKey = `gemini-${randomUUID()}`
    const openaiKey = `openai-${randomUUID()}`
    let geminiCalls = 0
    let judgeCalls = 0

    const functionContent = (name, args, id) => ({
      parts: [{
        functionCall: { args, id, name },
        thoughtSignature: `signature-${id}`,
      }],
      role: 'model',
    })
    try {
      const result = await main({
        args: ['--run', JOURNAL_NAVIGATION_LIVE_RUN_ID],
        dependencies: {
          async auditArtifacts() {
            return {
              artifacts: 39,
              artifactSetSha256: 'a'.repeat(64),
            }
          },
          async auditTrackedFiles() {
            return {
              files: 1,
              trackedPathsSha256: 'b'.repeat(64),
            }
          },
          assertEnvironment() {
            return {
              cumulativeCapUsd: 8,
              freshSubcapUsd: 1.5944676,
              geminiApiKey: geminiKey,
              openaiApiKey: openaiKey,
              runId: JOURNAL_NAVIGATION_LIVE_RUN_ID,
            }
          },
          async fetchImpl(url, init) {
            if (String(url).includes('generativelanguage.googleapis.com')) {
              geminiCalls += 1
              const body = JSON.parse(init.body)
              if (geminiCalls === 1) {
                const input = JSON.parse(
                  body.contents[0].parts[0].text,
                )
                const evidence = input.evidence[0]
                return httpSuccess({
                  parts: [{
                    text: JSON.stringify({
                      actions: [{
                        epistemic: 'asserted',
                        evidenceQuotes: [evidence.text],
                        evidenceRefs: [evidence.ref],
                        op: 'add',
                        statement:
                          `The user's compatibility token is ${JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN}.`,
                        targets: [],
                        timeEvidenceRef: '',
                        timeQuote: '',
                        topic: 'compatibility token',
                      }],
                    }),
                  }],
                  role: 'model',
                })
              }
              if (geminiCalls === 2) {
                return httpSuccess(
                  functionCallResponse().candidateContent,
                  { toolTokens: 8 },
                )
              }
              if (geminiCalls === 3) {
                return httpSuccess(
                  finalResponse().candidateContent,
                  { toolTokens: 9 },
                )
              }
              if (geminiCalls === 4) {
                assert.equal(
                  JSON.stringify(body).includes('answer_session'),
                  false,
                )
                return httpSuccess(functionContent(
                  'memory_find',
                  { phrase: 'definitely absent phrase' },
                  'main-find',
                ), { toolTokens: 10 })
              }
              if (geminiCalls === 5) {
                return httpSuccess(functionContent(
                  'memory_timeline',
                  {},
                  'main-timeline',
                ), { toolTokens: 11 })
              }
              if (geminiCalls === 6) {
                return httpSuccess(functionContent(
                  'memory_read',
                  { kind: 'session', ref: 'session-001' },
                  'main-read',
                ), { toolTokens: 12 })
              }
              assert.equal(geminiCalls, 7)
              return httpSuccess({
                parts: [{
                  text: 'I found a relevant stored conversation.',
                }],
                role: 'model',
              }, { toolTokens: 13 })
            }

            judgeCalls += 1
            assert.equal(judgeCalls, 1)
            return new Response(JSON.stringify({
              choices: [{
                finish_reason: 'stop',
                index: 0,
                message: {
                  content: 'yes',
                  role: 'assistant',
                },
              }],
              model: 'gpt-4o-2024-08-06',
              object: 'chat.completion',
              service_tier: 'default',
              usage: {
                completion_tokens: 1,
                prompt_tokens: 125,
                total_tokens: 126,
              },
            }), {
              headers: {
                'content-type': 'application/json',
                'x-request-id': 'fake-main-judge-request',
              },
              status: 200,
            })
          },
          async inspectGitCutPoint() {
            return { administrativeHead: 'fake-pushed-head' }
          },
          async loadContract() {
            return loaded
          },
          log() {},
          async verifyPredecessor() {
            return {
              accountedUsd: 1.0120378,
              measuredUsd: 0.7736072,
              runId: 'sealed-predecessor',
              uncertainUsd: 0.2384306,
            }
          },
        },
        env: {},
        repoRoot: root,
      })

      assert.equal(result.runState.status, 'complete')
      assert.equal(result.runState.question.question2Started, false)
      assert.equal(result.runState.invocations[0].completedQuestions, 1)
      assert.equal(geminiCalls, 7)
      assert.equal(judgeCalls, 1)
      assert.deepEqual(
        result.result.navigation.providerToolTranscript
          .map(({ tool }) => tool),
        ['memory_find', 'memory_timeline', 'memory_read'],
      )
      assert.equal(
        result.grade.grades.every(({ outcome }) => outcome === 'hit'),
        true,
      )
      assert.ok(
        result.report.spend.freshMeasuredUsd > 0,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
