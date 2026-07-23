import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  liveRunConfigHash,
  loadLiveRunConfig,
  validateLiveRunConfig,
} from '../evals/live-run-config.mjs'
import { LIVE_ANSWER_SYSTEM_V3 } from '../evals/live-runtime.mjs'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function writeConfig(fixture, mutate = () => {}) {
  const config = structuredClone(fixture.config)
  mutate(config)
  const configText = `${JSON.stringify(config, null, 2)}\n`
  await writeFile(fixture.configPath, configText)
  return { config, configText }
}

async function makeFixture(t) {
  const repoRoot = await mkdtemp(join(tmpdir(), 'palari-live-run-config-'))
  t.after(async () => {
    await rm(repoRoot, { recursive: true, force: true })
  })

  const bankPath = 'evals/journeys.json'
  const predictionsPath = 'evals/predictions-bakeoff-j3-live-v2.md'
  const meterPath = 'evals/results/j3-live-v1/meter.jsonl'
  const configPath = join(repoRoot, 'evals', 'live-runs', 'j3-live-v2.json')
  const bankText = await readFile(
    new URL('../evals/journeys.json', import.meta.url),
    'utf8',
  )
  const predictionsText = '# FINAL predictions\n'
  const meterText = [
    '{"sequence":1,"type":"attempt_started","attemptId":"v1:attempt:1","reservation":{"chatInputTokens":152276,"chatOutputTokens":28367,"embeddingInputTokens":671,"usd":0.01897402}}',
    '{"sequence":2,"type":"attempt_terminal","attemptId":"v1:attempt:1","outcome":"succeeded","usage":{"chatInputTokens":152276,"chatOutputTokens":28367,"embeddingInputTokens":671,"usd":0.01897402}}',
    '',
  ].join('\n')

  await mkdir(join(repoRoot, 'evals', 'live-runs'), { recursive: true })
  await mkdir(join(repoRoot, 'evals', 'results', 'j3-live-v1'), {
    recursive: true,
  })
  await writeFile(join(repoRoot, ...bankPath.split('/')), bankText)
  await writeFile(join(repoRoot, ...predictionsPath.split('/')), predictionsText)
  await writeFile(join(repoRoot, ...meterPath.split('/')), meterText)

  const fixture = {
    bankFilePath: join(repoRoot, ...bankPath.split('/')),
    configPath,
    meterFilePath: join(repoRoot, ...meterPath.split('/')),
    predictionsFilePath: join(repoRoot, ...predictionsPath.split('/')),
    repoRoot,
    config: {
      version: 2,
      runId: 'j3-live-v2',
      runDate: '2026-07-23',
      bank: {
        path: bankPath,
        sha256: sha256(bankText),
        journeys: 17,
        turns: 22,
        probes: 27,
        directives: 2,
      },
      predictions: {
        path: predictionsPath,
        sha256: sha256(predictionsText),
      },
      kernelPromptHash: '3147ad22edc76d12',
      model: {
        chat: 'gpt-5-nano-2025-08-07',
        embedding: 'text-embedding-3-small',
        embeddingDimensions: 1536,
      },
      completion: {
        memory: {
          maxTokens: 16384,
          reasoningEffort: 'minimal',
        },
        answer: {
          maxTokens: 2048,
          reasoningEffort: 'minimal',
        },
      },
      pricesUsdPerMillion: {
        chatInput: 0.05,
        chatOutput: 0.4,
        embeddingInput: 0.02,
      },
      limits: {
        maxAttemptsPerLogicalRequest: 4,
        maxChatInputTokens: 500000,
        maxChatLogicalRequests: 100,
        maxChatOutputTokens: 1000000,
        maxEmbeddingInputTokens: 100000,
        maxEmbeddingLogicalRequests: 100,
        maxRequestBytes: 1000000,
        maxTotalAttempts: 300,
        upstreamTimeoutMs: 120000,
      },
      budget: {
        cumulativeCapUsd: 5,
        openingAccountedUsd: 0.01897402,
        predecessors: [
          {
            runId: 'j3-live-v1',
            meterPath,
            meterSha256: sha256(meterText),
            accountedUsd: 0.01897402,
          },
        ],
      },
      manifest: {
        endpoint: 'chat.completions',
        stream: false,
        temperature: null,
        topP: null,
        kernelExtraction:
          'mechanical OpenAI translation of buildMemoryExtractionRequest JSON response contract',
        mem0Extraction: 'native mem0ai/oss prompt',
        answerSystem:
          'Answer the user\'s question using only the provided memory briefing. ' +
          'If the briefing says no stored memories are relevant, reply exactly ' +
          '"I have no stored memories relevant to this question." Do not use outside ' +
          'knowledge or infer unstored facts. Keep the answer concise.',
        answerUser: 'buildAnswerPrompt output',
        mem0Scope:
          'userId->userId;palariId->agentId;conjunctive;no shared fallback',
        mem0SourceSerialization:
          'userMessage + each sourceText in original order as \\n\\nAttached source:\\n + text; assistantMessage second',
        mem0CustomInstructions: null,
        mem0Telemetry: false,
      },
    },
  }

  const { configText } = await writeConfig(fixture)
  return { ...fixture, configText }
}

async function makeV3Fixture(t) {
  const fixture = await makeFixture(t)
  const predictionsPath = 'evals/predictions/j3-live-v3.md'
  const predictionsText = '# FINAL v3 predictions\n'
  const meterPath = 'evals/results/j3-live-v2/meter.jsonl'
  const meterText = ''
  const configPath = join(
    fixture.repoRoot,
    'evals',
    'live-runs',
    'j3-live-v3.json',
  )
  await mkdir(join(fixture.repoRoot, 'evals', 'predictions'), {
    recursive: true,
  })
  await mkdir(join(fixture.repoRoot, 'evals', 'results', 'j3-live-v2'), {
    recursive: true,
  })
  await writeFile(
    join(fixture.repoRoot, ...predictionsPath.split('/')),
    predictionsText,
  )
  await writeFile(
    join(fixture.repoRoot, ...meterPath.split('/')),
    meterText,
  )

  const config = structuredClone(fixture.config)
  config.runId = 'j3-live-v3'
  config.predictions = {
    path: predictionsPath,
    sha256: sha256(predictionsText),
  }
  config.kernelPromptHash = '5ba10ded111524e2'
  config.manifest.answerSystem = LIVE_ANSWER_SYSTEM_V3
  config.budget.predecessors.push({
    runId: 'j3-live-v2',
    meterPath,
    meterSha256: sha256(meterText),
    accountedUsd: 0,
  })
  const configText = `${JSON.stringify(config, null, 2)}\n`
  await writeFile(configPath, configText)
  return {
    ...fixture,
    config,
    configPath,
    configText,
  }
}

test('loads a valid v2 config, hashes exact source text, and deeply freezes it', async (t) => {
  const fixture = await makeFixture(t)

  const loaded = await loadLiveRunConfig({
    repoRoot: fixture.repoRoot,
    runId: 'j3-live-v2',
  })

  assert.deepEqual(loaded.config, fixture.config)
  assert.equal(loaded.configPath, fixture.configPath)
  assert.equal(loaded.configHash, sha256(fixture.configText))
  assert.equal(liveRunConfigHash(fixture.configText), sha256(fixture.configText))
  assert.notEqual(
    liveRunConfigHash(fixture.configText),
    liveRunConfigHash(fixture.configText.trimEnd()),
  )
  assert.equal(Object.isFrozen(loaded), true)
  assert.equal(Object.isFrozen(loaded.config), true)
  assert.equal(Object.isFrozen(loaded.config.bank), true)
  assert.equal(Object.isFrozen(loaded.config.budget.predecessors), true)
  assert.equal(Object.isFrozen(loaded.config.budget.predecessors[0]), true)
  assert.throws(() => {
    loaded.config.bank.journeys = 99
  }, TypeError)

  const directlyValidated = await validateLiveRunConfig({
    config: fixture.config,
    configPath: fixture.configPath,
    configText: fixture.configText,
    repoRoot: fixture.repoRoot,
  })
  assert.deepEqual(directlyValidated, loaded)
})

test('loads the reviewed v3 extraction and answer revision without relaxing v2 pins', async (t) => {
  const fixture = await makeV3Fixture(t)
  const loaded = await loadLiveRunConfig({
    repoRoot: fixture.repoRoot,
    runId: 'j3-live-v3',
  })
  assert.equal(loaded.config.kernelPromptHash, '5ba10ded111524e2')
  assert.equal(loaded.config.manifest.answerSystem, LIVE_ANSWER_SYSTEM_V3)

  const changed = structuredClone(fixture.config)
  changed.manifest.answerSystem += ' unreviewed'
  const changedText = `${JSON.stringify(changed, null, 2)}\n`
  await writeFile(fixture.configPath, changedText)
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v3',
    }),
    { code: 'SERIES_PIN_MISMATCH' },
  )
})

test('rejects sealed v1 before attempting to read a config', async (t) => {
  const fixture = await makeFixture(t)

  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v1',
    }),
    { code: 'SEALED_RUN_ID' },
  )
})

test('rejects traversal in run IDs and referenced paths', async (t) => {
  const fixture = await makeFixture(t)

  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: '../../j3-live-v2',
    }),
    { code: 'INVALID_RUN_ID' },
  )

  await writeConfig(fixture, (config) => {
    config.bank.path = '../outside.json'
  })
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'UNSAFE_PATH' },
  )
})

test('rejects extra and missing keys at every exact-schema boundary', async (t) => {
  const fixture = await makeFixture(t)

  await writeConfig(fixture, (config) => {
    config.unregistered = true
  })
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'INVALID_KEYS' },
  )

  await writeConfig(fixture, (config) => {
    delete config.limits.maxRequestBytes
  })
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'INVALID_KEYS' },
  )
})

test('rejects a referenced-file hash mismatch', async (t) => {
  const fixture = await makeFixture(t)

  await writeConfig(fixture, (config) => {
    config.predictions.sha256 = '0'.repeat(64)
  })
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'HASH_MISMATCH' },
  )
})

test('rejects a predecessor sum that does not match opening spend', async (t) => {
  const fixture = await makeFixture(t)

  await writeConfig(fixture, (config) => {
    config.budget.openingAccountedUsd += 0.000001
  })
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'INVALID_BUDGET' },
  )
})

test('rejects predecessor spend understated against an unchanged valid ledger', async (t) => {
  const fixture = await makeFixture(t)

  await writeConfig(fixture, (config) => {
    config.budget.predecessors[0].accountedUsd = 0
    config.budget.openingAccountedUsd = 0
  })
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'INVALID_BUDGET' },
  )
})

test('accepts an empty zero-attempt predecessor ledger at zero spend', async (t) => {
  const fixture = await makeFixture(t)
  const meterText = ''
  await writeFile(fixture.meterFilePath, meterText)
  await writeConfig(fixture, (config) => {
    config.budget.predecessors[0].meterSha256 = sha256(meterText)
    config.budget.predecessors[0].accountedUsd = 0
    config.budget.openingAccountedUsd = 0
  })

  const loaded = await loadLiveRunConfig({
    repoRoot: fixture.repoRoot,
    runId: 'j3-live-v2',
  })
  assert.equal(loaded.config.budget.openingAccountedUsd, 0)
})

test('charges a start-only predecessor ledger at its full reservation', async (t) => {
  const fixture = await makeFixture(t)
  const meterText =
    '{"sequence":1,"type":"attempt_started","attemptId":"v1:attempt:1",' +
    '"reservation":{"chatInputTokens":152276,"chatOutputTokens":28367,' +
    '"embeddingInputTokens":671,"usd":0.01897402}}\n'
  await writeFile(fixture.meterFilePath, meterText)
  await writeConfig(fixture, (config) => {
    config.budget.predecessors[0].meterSha256 = sha256(meterText)
  })

  const loaded = await loadLiveRunConfig({
    repoRoot: fixture.repoRoot,
    runId: 'j3-live-v2',
  })
  assert.equal(
    loaded.config.budget.predecessors[0].accountedUsd,
    0.01897402,
  )
})

test('rejects an omitted predecessor even when the opening sum is self-consistent', async (t) => {
  const fixture = await makeFixture(t)

  await writeConfig(fixture, (config) => {
    config.budget.predecessors = []
    config.budget.openingAccountedUsd = 0
  })
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'INVALID_PREDECESSOR' },
  )
})

test('rejects changes to the paired-series model, prices, manifest, or retry count', async (t) => {
  const fixture = await makeFixture(t)
  const mutations = [
    (config) => {
      config.model.chat = 'gpt-5-nano'
    },
    (config) => {
      config.pricesUsdPerMillion.chatOutput = 0.01
    },
    (config) => {
      config.manifest.mem0Telemetry = true
    },
    (config) => {
      config.limits.maxAttemptsPerLogicalRequest = 3
    },
  ]

  for (const mutate of mutations) {
    await writeConfig(fixture, mutate)
    await assert.rejects(
      loadLiveRunConfig({
        repoRoot: fixture.repoRoot,
        runId: 'j3-live-v2',
      }),
      { code: 'SERIES_PIN_MISMATCH' },
    )
  }
})

test('rejects the researched-but-not-adopted conditional $15 ceiling', async (t) => {
  const fixture = await makeFixture(t)

  await writeConfig(fixture, (config) => {
    config.budget.cumulativeCapUsd = 15
  })
  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'INVALID_RANGE' },
  )
})

test('detects a predecessor meter changed after its hash was pinned', async (t) => {
  const fixture = await makeFixture(t)
  await writeFile(
    fixture.meterFilePath,
    '{"event":"run_totals","accountedUsd":999,"terminal":true}\n',
  )

  await assert.rejects(
    loadLiveRunConfig({
      repoRoot: fixture.repoRoot,
      runId: 'j3-live-v2',
    }),
    { code: 'HASH_MISMATCH' },
  )
})
