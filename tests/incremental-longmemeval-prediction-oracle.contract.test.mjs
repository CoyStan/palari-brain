import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { before, test } from 'node:test'

import {
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_ANSWER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_GENERATION,
  runIncrementalLongMemEvalQuestionForScoring,
} from '../evals/arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  createIncrementalLongMemEvalCheckpointJournal,
  incrementalCheckpointReceiptFilename,
  INCREMENTAL_CHECKPOINT_AGGREGATE_SCHEMA,
  INCREMENTAL_CHECKPOINT_RECEIPT_SCHEMA,
} from '../evals/incremental-longmemeval-checkpoint-journal.mjs'
import {
  createIncrementalLongMemEvalHardCapGeminiTransport,
} from '../evals/incremental-longmemeval-hard-cap-gemini.mjs'
import {
  buildIncrementalLongMemEvalJudgeBody,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
} from '../evals/incremental-longmemeval-judge.mjs'
import {
  createIncrementalLongMemEvalJudgeTransport,
} from '../evals/incremental-longmemeval-judge-transport.mjs'
import {
  renderActiveMemoryDigest,
} from '../src/memory-reducer.mjs'
import {
  auditIncrementalLongMemEvalPredictionEvidence,
  gradeIncrementalLongMemEvalPredictionsFromEvidence,
  INCREMENTAL_LONGMEMEVAL_ORACLE_PREDICTIONS,
} from '../evals/incremental-longmemeval-prediction-oracle.mjs'

const RUN_DIRECTORY =
  'evals/results/synthetic-real-successor-evidence'
const RUN_ID = 'synthetic-real-successor'
const QUESTION_ID = 'synthetic-real-question'
const OPENING_ACCOUNTED_USD = 0.009
const GEMINI_CAP_USD = 0.709
const FRESH_CAP_USD = 0.7
const CUMULATIVE_CAP_USD = 0.8
const GEMINI_KEY = 'offline-oracle-fake-gemini-key'
const OPENAI_KEY = 'offline-oracle-fake-openai-key'

function sha256(bytes) {
  return createHash('sha256').update(String(bytes)).digest('hex')
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function eventSha256(event) {
  const copy = { ...event }
  delete copy.eventSha256
  return sha256(JSON.stringify(copy))
}

function instance() {
  return {
    answer: 'mint tea',
    answerSessionIds: ['later-session'],
    isAbstention: false,
    question: 'Which tea does the user prefer now?',
    questionDate: '2026-01-03T00:00:00.000Z',
    questionId: QUESTION_ID,
    questionType: 'knowledge-update',
    sessions: [
      {
        eventAt: '2026-01-02T00:00:00.000Z',
        sessionId: 'later-session',
        turns: [
          { content: 'I now prefer mint tea.', role: 'user' },
          {
            content: 'I will use your updated preference.',
            role: 'assistant',
          },
        ],
      },
      {
        eventAt: '2026-01-01T00:00:00.000Z',
        sessionId: 'earlier-session',
        turns: [
          { content: 'I prefer black tea.', role: 'user' },
          {
            content: 'I will remember your tea preference.',
            role: 'assistant',
          },
        ],
      },
    ],
  }
}

function reducerCompletion(body) {
  const providerInput = JSON.parse(body.contents[0].parts[0].text)
  const { baseRevision, evidence, prior } = providerInput.input
  const user = evidence.find((entry) => entry.speaker === 'user')
  const assistant = evidence.find((entry) => entry.speaker === 'Palari')
  const correction = prior.length > 0
  return {
    actions: [{
      basis: [
        {
          id: user.id,
          kind: 'evidence',
          quote: user.text,
        },
        ...(correction
          ? [{
              id: prior[0].id,
              kind: 'memory',
              quote: '',
            }]
          : []),
      ],
      epistemic: 'asserted',
      op: correction ? 'replace' : 'add',
      relation: correction ? 'supersedes' : null,
      statement: correction
        ? 'The user currently prefers mint tea.'
        : 'The user prefers black tea.',
      targetIds: correction ? [prior[0].id] : [],
      timeBasis: null,
      topic: correction ? prior[0].topic : 'tea preference',
    }],
    baseRevision,
    dispositions: [
      {
        evidenceId: user.id,
        outcome: 'used',
      },
      {
        evidenceId: assistant.id,
        outcome: 'no_memory',
      },
    ],
  }
}

function geminiResponse(text) {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{ text }],
        role: 'model',
      },
      finishReason: 'STOP',
    }],
    modelVersion: INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
    usageMetadata: {
      candidatesTokenCount: 5,
      promptTokenCount: 20,
      serviceTier: 'standard',
      thoughtsTokenCount: 0,
      totalTokenCount: 25,
    },
  }), {
    headers: {
      'content-type': 'application/json',
      'x-gemini-service-tier': 'standard',
    },
    status: 200,
  })
}

function judgeResponse() {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      index: 0,
      message: {
        content: 'yes',
        role: 'assistant',
      },
    }],
    model: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
    object: 'chat.completion',
    service_tier: 'default',
    usage: {
      completion_tokens: 1,
      prompt_tokens: 125,
      prompt_tokens_details: {
        cached_tokens: 0,
      },
      total_tokens: 126,
    },
  }), {
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'offline-oracle-request',
    },
    status: 200,
  })
}

async function addDirectoryFiles({
  actualDirectory,
  files,
  repositoryDirectory,
}) {
  for (const filename of await readdir(actualDirectory)) {
    files[`${repositoryDirectory}/${filename}`] =
      await readFile(join(actualDirectory, filename), 'utf8')
  }
}

function refreshManifest(graph) {
  const manifestPath = graph.paths.manifest
  graph.files[manifestPath] = json({
    artifacts: Object.keys(graph.files)
      .filter((path) => path !== manifestPath)
      .sort()
      .map((path) => ({
        bytes: Buffer.byteLength(graph.files[path]),
        path,
        sha256: sha256(graph.files[path]),
      })),
    runId: graph.expectations.runId,
    schemaVersion: 1,
  })
  graph.repository.gitCheckIgnoreBytes =
    `${Object.keys(graph.files).sort().join('\n')}\n`
}

async function buildRealEvidenceGraph() {
  const root = await mkdtemp(join(
    tmpdir(),
    'palari-successor-oracle-',
  ))
  const actual = {
    checkpointDirectory: join(root, 'private', 'checkpoint-journal'),
    geminiJournal: join(root, 'private', 'gemini-journal.ndjson'),
    geminiTranscriptDirectory:
      join(root, 'private', 'gemini-transcripts'),
    judgeMeter: join(root, 'private', 'judge-meter.json'),
    judgeTranscriptDirectory:
      join(root, 'private', 'judge-transcripts'),
    workspace: join(root, 'private', 'workspace'),
  }
  try {
    const checkpointJournal =
      await createIncrementalLongMemEvalCheckpointJournal({
        directory: actual.checkpointDirectory,
        questionId: QUESTION_ID,
        runId: RUN_ID,
      })
    const gemini =
      await createIncrementalLongMemEvalHardCapGeminiTransport({
        answerGeneration:
          INCREMENTAL_LONGMEMEVAL_HARD_CAP_ANSWER_GENERATION,
        capUsd: GEMINI_CAP_USD,
        async fetchImpl(_url, init) {
          const body = JSON.parse(init.body)
          return geminiResponse(
            body.systemInstruction
              ? JSON.stringify(reducerCompletion(body))
              : 'The user currently prefers mint tea.',
          )
        },
        geminiApiKey: GEMINI_KEY,
        journalPath: actual.geminiJournal,
        openingAccountedUsd: OPENING_ACCOUNTED_USD,
        transcriptDirectory: actual.geminiTranscriptDirectory,
        writerGeneration:
          INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_GENERATION,
      })
    const armResult =
      await runIncrementalLongMemEvalQuestionForScoring({
        callGemini: gemini.callGemini,
        instance: instance(),
        onCheckpoint: checkpointJournal.onCheckpoint,
        workspaceDir: actual.workspace,
      })
    await gemini.verify()
    const geminiSnapshot = await gemini.snapshot()

    const judge =
      await createIncrementalLongMemEvalJudgeTransport({
        cumulativeCapUsd: CUMULATIVE_CAP_USD,
        fetchImpl: async () => judgeResponse(),
        freshSubcapUsd: FRESH_CAP_USD,
        getFreshAccountedUsd: async () =>
          geminiSnapshot.accounted.usd -
            OPENING_ACCOUNTED_USD,
        meterPath: actual.judgeMeter,
        openaiApiKey: OPENAI_KEY,
        openingAccountedUsd: OPENING_ACCOUNTED_USD,
        transcriptDirectory: actual.judgeTranscriptDirectory,
      })
    const judgeOperationId = `question:${QUESTION_ID}:judge`
    const judged = await judge.callJudge({
      body: buildIncrementalLongMemEvalJudgeBody(
        instance(),
        armResult.answer,
      ),
      cellId: QUESTION_ID,
      operationId: judgeOperationId,
    })
    const judgeEvidence = await judge.verify()

    const paths = {
      answerResult: `${RUN_DIRECTORY}/answer-result.json`,
      checkpointAggregate:
        `${RUN_DIRECTORY}/checkpoint-journal/checkpoint.json`,
      checkpointDirectory:
        `${RUN_DIRECTORY}/checkpoint-journal`,
      geminiJournal: `${RUN_DIRECTORY}/gemini-journal.ndjson`,
      geminiTranscriptDirectory:
        `${RUN_DIRECTORY}/gemini-transcripts`,
      instance: `${RUN_DIRECTORY}/benchmark-instance.json`,
      judgeMeter: `${RUN_DIRECTORY}/judge-meter.json`,
      judgeTranscriptDirectory:
        `${RUN_DIRECTORY}/judge-transcripts`,
      manifest: `${RUN_DIRECTORY}/artifact-manifest.json`,
      questionResult: `${RUN_DIRECTORY}/question-result.json`,
      runDirectory: RUN_DIRECTORY,
      runState: `${RUN_DIRECTORY}/run-state.json`,
    }
    const files = {}
    files[paths.checkpointAggregate] =
      await readFile(checkpointJournal.aggregatePath, 'utf8')
    for (let ordinal = 1; ordinal <= 2; ordinal += 1) {
      const filename = incrementalCheckpointReceiptFilename(ordinal)
      files[`${paths.checkpointDirectory}/${filename}`] =
        await readFile(
          join(actual.checkpointDirectory, filename),
          'utf8',
        )
    }
    files[paths.geminiJournal] =
      await readFile(actual.geminiJournal, 'utf8')
    await addDirectoryFiles({
      actualDirectory: actual.geminiTranscriptDirectory,
      files,
      repositoryDirectory: paths.geminiTranscriptDirectory,
    })
    files[paths.judgeMeter] =
      await readFile(actual.judgeMeter, 'utf8')
    await addDirectoryFiles({
      actualDirectory: actual.judgeTranscriptDirectory,
      files,
      repositoryDirectory: paths.judgeTranscriptDirectory,
    })
    files[paths.answerResult] = json(armResult)
    files[paths.instance] = json(instance())
    files[paths.questionResult] = json({
      correct: judged.text.toLowerCase().includes('yes'),
      judge: {
        operationId: judgeOperationId,
        text: judged.text,
      },
    })
    const geminiFreshAccountedUsd = Number((
      geminiSnapshot.accounted.usd - OPENING_ACCOUNTED_USD
    ).toFixed(12))
    const freshAccountedUsd = Number((
      geminiFreshAccountedUsd +
        judgeEvidence.snapshot.accountedUsd
    ).toFixed(12))
    files[paths.runState] = json({
      answer: {
        resultFile: paths.answerResult,
        resultSha256: sha256(files[paths.answerResult]),
        status: 'completed',
      },
      identity: {
        questionId: QUESTION_ID,
        runId: RUN_ID,
      },
      invocations: [{
        completedQuestions: 1,
        question2Started: false,
        questionIds: [QUESTION_ID],
      }],
      judge: {
        correct: true,
        status: 'completed',
        text: judged.text,
      },
      question: {
        questionId: QUESTION_ID,
        resultFile: paths.questionResult,
        resultSha256: sha256(files[paths.questionResult]),
        status: 'completed',
      },
      spend: {
        cumulativeAccountedUsd: Number((
          OPENING_ACCOUNTED_USD + freshAccountedUsd
        ).toFixed(12)),
        freshAccountedUsd,
        openingAccountedUsd: OPENING_ACCOUNTED_USD,
      },
      status: 'complete',
    })
    files[paths.manifest] = ''
    const graph = {
      expectations: {
        answerOperations: 1,
        cumulativeCapUsd: CUMULATIVE_CAP_USD,
        freshCapUsd: FRESH_CAP_USD,
        geminiCapUsd: GEMINI_CAP_USD,
        geminiContractSha256: gemini.contractSha256,
        instanceSha256: sha256(files[paths.instance]),
        interactions: 2,
        judgeOperationId,
        judgeOperations: 1,
        openingAccountedUsd: OPENING_ACCOUNTED_USD,
        questionId: QUESTION_ID,
        runId: RUN_ID,
        writerOperations: 2,
      },
      files,
      paths,
      repository: {
        gitCheckIgnoreBytes: '',
        gitLsFilesBytes: 'src/index.mjs\n',
      },
    }
    refreshManifest(graph)
    return graph
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

function rebuildCheckpointJournal(graph, checkpoints) {
  let previousReceiptSha256 = null
  const receiptManifest = []
  for (let index = 0; index < checkpoints.length; index += 1) {
    const ordinal = index + 1
    const checkpoint = checkpoints[index]
    const filename = incrementalCheckpointReceiptFilename(ordinal)
    const payload = {
      checkpoint,
      checkpointSha256: sha256(JSON.stringify(checkpoint)),
      ordinal,
      previousReceiptSha256,
      questionId: graph.expectations.questionId,
      runId: graph.expectations.runId,
      schemaVersion: INCREMENTAL_CHECKPOINT_RECEIPT_SCHEMA,
    }
    const record = {
      payload,
      payloadSha256: sha256(JSON.stringify(payload)),
    }
    const text = json(record)
    const receiptSha256 = sha256(text)
    graph.files[
      `${graph.paths.checkpointDirectory}/${filename}`
    ] = text
    receiptManifest.push({
      checkpointSha256: payload.checkpointSha256,
      filename,
      ordinal,
      receiptSha256,
    })
    previousReceiptSha256 = receiptSha256
  }
  graph.files[graph.paths.checkpointAggregate] = json({
    checkpoints,
    completedInteraction: checkpoints.length,
    lastReceiptSha256: previousReceiptSha256,
    questionId: graph.expectations.questionId,
    receiptManifest,
    runId: graph.expectations.runId,
    schemaVersion: INCREMENTAL_CHECKPOINT_AGGREGATE_SCHEMA,
  })
  refreshManifest(graph)
}

function mutateRunState(graph, mutate) {
  const state = JSON.parse(graph.files[graph.paths.runState])
  mutate(state)
  graph.files[graph.paths.runState] = json(state)
  refreshManifest(graph)
}

function rehashGeminiJournal(events) {
  let previousEventSha256 = null
  return events.map((event, index) => {
    const next = {
      ...event,
      previousEventSha256,
      sequence: index + 1,
    }
    next.eventSha256 = eventSha256(next)
    previousEventSha256 = next.eventSha256
    return next
  })
}

function transcriptStartedText(record) {
  return `${JSON.stringify({
    attempt: record.attempt,
    request: record.request,
    schemaVersion: record.schemaVersion,
    startedAt: record.startedAt,
    state: 'started',
  }, null, 2)}\n`
}

function judgeStartedMeterText(meter) {
  const started = { ...meter }
  delete started.completedAt
  delete started.startedStateSha256
  delete started.terminal
  started.state = 'attempt_started'
  return json(started)
}

function replaceJudgeBody(graph, body) {
  const meter = JSON.parse(graph.files[graph.paths.judgeMeter])
  const transcriptPath =
    `${graph.paths.judgeTranscriptDirectory}/` +
    meter.terminal.transcript.file
  const transcript = JSON.parse(graph.files[transcriptPath])
  const normalizedBody = JSON.stringify(body)
  transcript.request.bodyBytes = Buffer.byteLength(normalizedBody)
  transcript.request.bodySha256 = sha256(normalizedBody)
  transcript.request.normalizedBody = normalizedBody
  transcript.startedRecordSha256 =
    sha256(transcriptStartedText(transcript))
  const transcriptText = json(transcript)

  meter.request.bytes = Buffer.byteLength(normalizedBody)
  meter.request.sha256 = sha256(normalizedBody)
  meter.transcript.startedSha256 =
    transcript.startedRecordSha256
  meter.terminal.transcript.sha256 = sha256(transcriptText)
  meter.startedStateSha256 = sha256(judgeStartedMeterText(meter))

  graph.files[transcriptPath] = transcriptText
  graph.files[graph.paths.judgeMeter] = json(meter)
  refreshManifest(graph)
}

function replaceAnswerCheckpointCopies(graph, checkpoints) {
  const answerResult =
    JSON.parse(graph.files[graph.paths.answerResult])
  answerResult.interactionCheckpoints =
    structuredClone(checkpoints)
  graph.files[graph.paths.answerResult] = json(answerResult)
  const runState = JSON.parse(graph.files[graph.paths.runState])
  runState.answer.resultSha256 =
    sha256(graph.files[graph.paths.answerResult])
  graph.files[graph.paths.runState] = json(runState)
  refreshManifest(graph)
}

function mutateGeminiAttempt(graph, purpose, mutate) {
  let events = graph.files[graph.paths.geminiJournal]
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  const start = events.find((event) =>
    event.type === 'attempt_started' &&
    event.purpose === purpose)
  const terminal = events.find((event) =>
    event.type === 'attempt_terminal' &&
    event.attemptId === start?.attemptId)
  assert.ok(start)
  assert.ok(terminal)
  const transcriptPath =
    `${graph.paths.geminiTranscriptDirectory}/` +
    start.transcriptFile
  const transcript = JSON.parse(graph.files[transcriptPath])
  mutate({ start, terminal, transcript })
  const transcriptText = json(transcript)
  terminal.transcriptSha256 = sha256(transcriptText)
  graph.files[transcriptPath] = transcriptText
  events = rehashGeminiJournal(events)
  graph.files[graph.paths.geminiJournal] =
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
  refreshManifest(graph)
}

function replaceGeminiPrompt(graph, purpose, prompt) {
  mutateGeminiAttempt(
    graph,
    purpose,
    ({ start, terminal, transcript }) => {
      const body = JSON.parse(transcript.request.normalizedBody)
      body.contents[0].parts[0].text = prompt
      const normalizedBody = JSON.stringify(body)
      transcript.request.bodyBytes = Buffer.byteLength(normalizedBody)
      transcript.request.bodySha256 = sha256(normalizedBody)
      transcript.request.normalizedBody = normalizedBody
      transcript.startedRecordSha256 =
        sha256(transcriptStartedText(transcript))
      start.requestSha256 = transcript.request.bodySha256
      start.transcriptStartedSha256 =
        transcript.startedRecordSha256
      terminal.requestSha256 = transcript.request.bodySha256
    },
  )
}

function mutateJudgeEvidence(graph, mutate) {
  const meter = JSON.parse(graph.files[graph.paths.judgeMeter])
  const transcriptPath =
    `${graph.paths.judgeTranscriptDirectory}/` +
    meter.terminal.transcript.file
  const transcript = JSON.parse(graph.files[transcriptPath])
  mutate({ meter, transcript })
  const transcriptText = json(transcript)
  meter.terminal.transcript.sha256 = sha256(transcriptText)
  meter.startedStateSha256 = sha256(judgeStartedMeterText(meter))
  graph.files[transcriptPath] = transcriptText
  graph.files[graph.paths.judgeMeter] = json(meter)
  refreshManifest(graph)
}

function outcome(result, id) {
  return result.grades.find((grade) => grade.id === id)?.outcome
}

let realGraph

before(async () => {
  realGraph = await buildRealEvidenceGraph()
})

test('successor oracle import is inert and contains no transport', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'const m=await import("./evals/incremental-longmemeval-prediction-oracle.mjs")',
      'if(Object.values(m).some(v=>typeof v==="function" && String(v).includes("fetch(")))throw new Error("transport")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('actual successor artifacts confirm all nine predictions', () => {
  const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: structuredClone(realGraph),
  })
  assert.equal(
    result.grades.length,
    INCREMENTAL_LONGMEMEVAL_ORACLE_PREDICTIONS.length,
  )
  assert.deepEqual(
    result.grades.map(({ outcome: value }) => value),
    Array(9).fill('hit'),
    JSON.stringify(result.observations),
  )
  assert.equal(result.computed.freshAccountedUsd > 0, true)
  assert.equal(
    result.computed.cumulativeAccountedUsd,
    Number((
      OPENING_ACCOUNTED_USD +
        result.computed.freshAccountedUsd
    ).toFixed(12)),
  )
})

test('answer claims require one successful exact provider completion',
  () => {
    const failed = structuredClone(realGraph)
    mutateGeminiAttempt(
      failed,
      'answer',
      ({ terminal, transcript }) => {
        terminal.outcome = 'http_error'
        transcript.terminal.outcome = 'http_error'
      },
    )
    let result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: failed,
    })
    assert.equal(outcome(result, 'ONE_DIGEST_ANSWER'), 'miss')
    assert.equal(outcome(result, 'DIGEST_READY_AND_BOUNDED'), 'miss')
    assert.equal(outcome(result, 'OFFICIAL_JUDGE_CORRECT'), 'miss')

    const substituted = structuredClone(realGraph)
    mutateGeminiAttempt(
      substituted,
      'answer',
      ({ transcript }) => {
        const raw = JSON.parse(
          transcript.terminal.response.rawBody,
        )
        raw.candidates[0].content.parts[0].text =
          'A substituted provider completion.'
        const rawBody = JSON.stringify(raw)
        transcript.terminal.response.rawBody = rawBody
        transcript.terminal.response.bodyBytes =
          Buffer.byteLength(rawBody)
        transcript.terminal.response.bodySha256 = sha256(rawBody)
      },
    )
    result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: substituted,
    })
    assert.equal(outcome(result, 'ONE_DIGEST_ANSWER'), 'miss')
    assert.equal(outcome(result, 'DIGEST_READY_AND_BOUNDED'), 'miss')
    assert.equal(outcome(result, 'OFFICIAL_JUDGE_CORRECT'), 'miss')
  })

test('answer prompt must be the production prompt for the final digest',
  () => {
    const graph = structuredClone(realGraph)
    const prompt = 'Use an arbitrary unrelated answer prompt.'
    replaceGeminiPrompt(graph, 'answer', prompt)
    const answerResult =
      JSON.parse(graph.files[graph.paths.answerResult])
    const events = graph.files[graph.paths.geminiJournal]
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    const answerStart = events.find((event) =>
      event.type === 'attempt_started' &&
      event.purpose === 'answer')
    answerResult.answerRequestSha256 = answerStart.requestSha256
    answerResult.promptSha256 = sha256(prompt)
    graph.files[graph.paths.answerResult] = json(answerResult)
    const runState = JSON.parse(graph.files[graph.paths.runState])
    runState.answer.resultSha256 =
      sha256(graph.files[graph.paths.answerResult])
    graph.files[graph.paths.runState] = json(runState)
    refreshManifest(graph)
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'ONE_DIGEST_ANSWER'), 'miss')
    assert.equal(outcome(result, 'DIGEST_READY_AND_BOUNDED'), 'miss')
  })

test('pre-dispatch reservations must fit every provider cap',
  () => {
    const geminiGraph = structuredClone(realGraph)
    let events = geminiGraph.files[geminiGraph.paths.geminiJournal]
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    const firstStart = events.find(({ type }) =>
      type === 'attempt_started')
    const impossibleCap = Number((
      OPENING_ACCOUNTED_USD +
        firstStart.reservation.usd -
        0.000000000001
    ).toFixed(12))
    geminiGraph.expectations.geminiCapUsd = impossibleCap
    events = events.map((event) => ({
      ...event,
      capUsd: impossibleCap,
    }))
    events = rehashGeminiJournal(events)
    geminiGraph.files[geminiGraph.paths.geminiJournal] =
      `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
    refreshManifest(geminiGraph)
    let result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: geminiGraph,
    })
    assert.equal(outcome(result, 'SPEND_WITHIN_ENVELOPE'), 'miss')

    const looseGeminiGraph = structuredClone(realGraph)
    events = looseGeminiGraph.files[
      looseGeminiGraph.paths.geminiJournal
    ]
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .map((event) => ({
        ...event,
        capUsd: CUMULATIVE_CAP_USD,
      }))
    looseGeminiGraph.expectations.geminiCapUsd =
      CUMULATIVE_CAP_USD
    events = rehashGeminiJournal(events)
    looseGeminiGraph.files[
      looseGeminiGraph.paths.geminiJournal
    ] = `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
    refreshManifest(looseGeminiGraph)
    result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: looseGeminiGraph,
    })
    assert.equal(outcome(result, 'SPEND_WITHIN_ENVELOPE'), 'miss')

    const judgeGraph = structuredClone(realGraph)
    const runState =
      JSON.parse(judgeGraph.files[judgeGraph.paths.runState])
    mutateJudgeEvidence(
      judgeGraph,
      ({ meter }) => {
        const freshCap = Number(((
          runState.spend.freshAccountedUsd +
            meter.capContext.projectedFreshUsd
        ) / 2).toFixed(12))
        const cumulativeCap = Number(((
          runState.spend.cumulativeAccountedUsd +
            meter.capContext.projectedCumulativeUsd
        ) / 2).toFixed(12))
        judgeGraph.expectations.freshCapUsd = freshCap
        judgeGraph.expectations.cumulativeCapUsd = cumulativeCap
        meter.capContext.freshCapUsd = freshCap
        meter.capContext.cumulativeCapUsd = cumulativeCap
      },
    )
    result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: judgeGraph,
    })
    assert.equal(outcome(result, 'SPEND_WITHIN_ENVELOPE'), 'miss')
  })

test('orphan provider artifacts anywhere lose retry and privacy claims',
  () => {
    const graph = structuredClone(realGraph)
    const source = Object.keys(graph.files).find((path) =>
      path.startsWith(
        `${graph.paths.geminiTranscriptDirectory}/`,
      ))
    graph.files[
      `${graph.paths.runDirectory}/orphan-provider-attempt.json`
    ] = graph.files[source]
    refreshManifest(graph)
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'NO_RETRY'), 'miss')
    assert.equal(outcome(result, 'PRIVATE_AND_TERMINAL'), 'miss')
  })

test('reducer output must pass the production normalization contract',
  () => {
    const graph = structuredClone(realGraph)
    const malformed = '{"broken"'
    mutateGeminiAttempt(
      graph,
      'writer',
      ({ transcript }) => {
        const raw = JSON.parse(
          transcript.terminal.response.rawBody,
        )
        raw.candidates[0].content.parts[0].text = malformed
        const rawBody = JSON.stringify(raw)
        transcript.terminal.response.rawBody = rawBody
        transcript.terminal.response.bodyBytes =
          Buffer.byteLength(rawBody)
        transcript.terminal.response.bodySha256 = sha256(rawBody)
      },
    )
    const aggregate =
      JSON.parse(graph.files[graph.paths.checkpointAggregate])
    aggregate.checkpoints[0].reducerResponseSha256 =
      sha256(malformed)
    rebuildCheckpointJournal(graph, aggregate.checkpoints)
    replaceAnswerCheckpointCopies(graph, aggregate.checkpoints)
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'ALL_INTERACTIONS_REDUCED'), 'miss')
    assert.equal(outcome(result, 'DIGEST_READY_AND_BOUNDED'), 'miss')
  })

test('judge success requires HTTP 200 and exact parsed metadata',
  () => {
    const statusGraph = structuredClone(realGraph)
    mutateJudgeEvidence(
      statusGraph,
      ({ meter, transcript }) => {
        meter.terminal.status = 500
        transcript.terminal.response.status = 500
      },
    )
    let result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: statusGraph,
    })
    assert.equal(outcome(result, 'OFFICIAL_JUDGE_CORRECT'), 'miss')

    const usageGraph = structuredClone(realGraph)
    mutateJudgeEvidence(
      usageGraph,
      ({ transcript }) => {
        transcript.terminal.response.usage.prompt_tokens += 1
      },
    )
    result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: usageGraph,
    })
    assert.equal(outcome(result, 'OFFICIAL_JUDGE_CORRECT'), 'miss')
  })

test('private benchmark instance bytes cannot be rewritten',
  () => {
    const graph = structuredClone(realGraph)
    const benchmark = JSON.parse(graph.files[graph.paths.instance])
    benchmark.unconsumedRewriteMarker = true
    graph.files[graph.paths.instance] = json(benchmark)
    refreshManifest(graph)
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'EXACT_Q1_ONLY'), 'miss')
    assert.equal(outcome(result, 'ONE_DIGEST_ANSWER'), 'miss')
  })

test('receipt request-hash mismatch loses the boundary prediction', () => {
  const graph = structuredClone(realGraph)
  const aggregate =
    JSON.parse(graph.files[graph.paths.checkpointAggregate])
  aggregate.checkpoints[0].reducerRequestSha256 = 'f'.repeat(64)
  rebuildCheckpointJournal(graph, aggregate.checkpoints)
  const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: graph,
  })
  assert.equal(outcome(result, 'INCREMENTAL_BOUNDARY_HELD'), 'miss')
  assert.equal(result.grades[0].id, 'INCREMENTAL_BOUNDARY_HELD')
})

test('private benchmark instance binds each current reducer interaction',
  () => {
    const graph = structuredClone(realGraph)
    const benchmark = JSON.parse(graph.files[graph.paths.instance])
    benchmark.sessions[1].turns[0].content =
      'I prefer a substituted tea.'
    graph.files[graph.paths.instance] = json(benchmark)
    refreshManifest(graph)
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'INCREMENTAL_BOUNDARY_HELD'), 'miss')
  })

test('ordinal N prior must equal ordinal N-1 active-memory snapshot',
  () => {
    const graph = structuredClone(realGraph)
    const aggregate =
      JSON.parse(graph.files[graph.paths.checkpointAggregate])
    aggregate.checkpoints[0].activeMemories[0].statement =
      'A substituted prior memory.'
    aggregate.checkpoints[0].activeMemoriesSha256 = sha256(
      JSON.stringify(aggregate.checkpoints[0].activeMemories),
    )
    aggregate.checkpoints[0].digestChars =
      renderActiveMemoryDigest(
        aggregate.checkpoints[0].activeMemories,
      ).text.length
    rebuildCheckpointJournal(graph, aggregate.checkpoints)
    replaceAnswerCheckpointCopies(graph, aggregate.checkpoints)
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'INCREMENTAL_BOUNDARY_HELD'), 'miss')
  })

test('checkpoint provider model and response hashes bind to transcript',
  () => {
    const graph = structuredClone(realGraph)
    const aggregate =
      JSON.parse(graph.files[graph.paths.checkpointAggregate])
    aggregate.checkpoints[0].modelVersion = 'forged-model'
    aggregate.checkpoints[0].reducerResponseSha256 = 'e'.repeat(64)
    rebuildCheckpointJournal(graph, aggregate.checkpoints)
    replaceAnswerCheckpointCopies(graph, aggregate.checkpoints)
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'ALL_INTERACTIONS_REDUCED'), 'miss')
    assert.equal(outcome(result, 'DIGEST_READY_AND_BOUNDED'), 'miss')
  })

test('a question-2 start loses exact-one-question evidence', () => {
  const graph = structuredClone(realGraph)
  mutateRunState(graph, (state) => {
    state.invocations[0].question2Started = true
  })
  const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: graph,
  })
  assert.equal(outcome(result, 'EXACT_Q1_ONLY'), 'miss')
})

test('a retry-shaped physical dispatch loses no-retry evidence', () => {
  const graph = structuredClone(realGraph)
  const events = graph.files[graph.paths.geminiJournal]
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  events[0].attempt = 2
  const rehashed = rehashGeminiJournal(events)
  graph.files[graph.paths.geminiJournal] =
    `${rehashed.map((event) => JSON.stringify(event)).join('\n')}\n`
  refreshManifest(graph)
  const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: graph,
  })
  assert.equal(outcome(result, 'NO_RETRY'), 'miss')
})

test('unlinked manifested attempt files lose retry and privacy claims',
  () => {
    const graph = structuredClone(realGraph)
    const geminiSource = Object.keys(graph.files).find((path) =>
      path.startsWith(
        `${graph.paths.geminiTranscriptDirectory}/`,
      ))
    const judgeSource = Object.keys(graph.files).find((path) =>
      path.startsWith(
        `${graph.paths.judgeTranscriptDirectory}/`,
      ))
    graph.files[
      `${graph.paths.geminiTranscriptDirectory}/unlinked-attempt.json`
    ] = graph.files[geminiSource]
    graph.files[
      `${graph.paths.judgeTranscriptDirectory}/unlinked-attempt.json`
    ] = graph.files[judgeSource]
    refreshManifest(graph)
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'NO_RETRY'), 'miss')
    assert.equal(outcome(result, 'PRIVATE_AND_TERMINAL'), 'miss')
  })

test('schema-valid unrelated judge prompt cannot inherit correctness',
  () => {
    const graph = structuredClone(realGraph)
    const answerResult =
      JSON.parse(graph.files[graph.paths.answerResult])
    const unrelated = instance()
    unrelated.question =
      'Was an unrelated synthetic condition satisfied?'
    unrelated.answer = 'yes'
    replaceJudgeBody(
      graph,
      buildIncrementalLongMemEvalJudgeBody(
        unrelated,
        answerResult.answer,
      ),
    )
    const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
      evidenceGraph: graph,
    })
    assert.equal(outcome(result, 'OFFICIAL_JUDGE_CORRECT'), 'miss')
  })

test('tracked or non-ignored result bytes lose private evidence', () => {
  const tracked = structuredClone(realGraph)
  tracked.repository.gitLsFilesBytes +=
    `${tracked.paths.questionResult}\n`
  let result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: tracked,
  })
  assert.equal(outcome(result, 'PRIVATE_AND_TERMINAL'), 'miss')

  const visible = structuredClone(realGraph)
  visible.repository.gitCheckIgnoreBytes = visible.repository
    .gitCheckIgnoreBytes
    .split('\n')
    .filter((path) => path !== visible.paths.questionResult)
    .join('\n')
  result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: visible,
  })
  assert.equal(outcome(result, 'PRIVATE_AND_TERMINAL'), 'miss')
})

test('post-manifest result mutation cannot retain a valid score', () => {
  const graph = structuredClone(realGraph)
  graph.files[graph.paths.questionResult] += ' '
  const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: graph,
  })
  assert.equal(outcome(result, 'OFFICIAL_JUDGE_CORRECT'), 'miss')
  assert.equal(outcome(result, 'PRIVATE_AND_TERMINAL'), 'miss')
})

test('checkpoint spend mismatch loses despite remaining under caps', () => {
  const graph = structuredClone(realGraph)
  mutateRunState(graph, (state) => {
    state.spend.freshAccountedUsd += 0.001
    state.spend.cumulativeAccountedUsd += 0.001
  })
  const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: graph,
  })
  assert.equal(outcome(result, 'SPEND_WITHIN_ENVELOPE'), 'miss')
})

test('rehashed ledger usage cannot override exact transcript usage', () => {
  const graph = structuredClone(realGraph)
  const events = graph.files[graph.paths.geminiJournal]
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  const terminal = events.find((event) =>
    event.type === 'attempt_terminal' &&
    event.outcome === 'success')
  terminal.usage.inputTokens += 1
  terminal.usage.usd = Number((
    terminal.usage.usd + 0.0000001
  ).toFixed(12))
  const rehashed = rehashGeminiJournal(events)
  graph.files[graph.paths.geminiJournal] =
    `${rehashed.map((event) => JSON.stringify(event)).join('\n')}\n`
  refreshManifest(graph)
  const result = gradeIncrementalLongMemEvalPredictionsFromEvidence({
    evidenceGraph: graph,
  })
  assert.equal(outcome(result, 'SPEND_WITHIN_ENVELOPE'), 'miss')
  assert.equal(outcome(result, 'NO_RETRY'), 'miss')
})

test('malformed durable bytes fail closed', () => {
  const graph = structuredClone(realGraph)
  graph.files[graph.paths.geminiJournal] = '{broken\n'
  assert.throws(
    () => auditIncrementalLongMemEvalPredictionEvidence(graph),
    {
      code: 'EVIDENCE_JSON_INVALID',
      name: 'IncrementalLongMemEvalPredictionOracleError',
    },
  )
})
