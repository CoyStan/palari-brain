import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JOURNAL_NAVIGATION_LIVE_HARD_CAP,
  JOURNAL_NAVIGATION_LIVE_RUN_ID,
  JOURNAL_NAVIGATION_LIVE_SCOPE,
  assertJournalNavigationLiveEnvironment,
  loadJournalNavigationLiveContract,
} from '../evals/journal-navigation-live-v3-config.mjs'

const REPO_ROOT = new URL('..', import.meta.url).pathname

test('fresh v3 freezes one repair and remains founder-gated', async () => {
  const loaded = await loadJournalNavigationLiveContract({
    repoRoot: REPO_ROOT,
  })
  assert.equal(
    loaded.config.runId,
    'j4-journal-navigation-longmemeval-q1-v3',
  )
  assert.equal(loaded.config.runId, JOURNAL_NAVIGATION_LIVE_RUN_ID)
  assert.equal(loaded.config.artifacts.length, 41)
  assert.equal(loaded.predictions.status, 'FINAL')
  assert.equal(loaded.predictions.predictions.length, 12)
  assert.equal(loaded.authority.dispatchAuthorized, false)
  assert.equal(
    loaded.authority.exactCapConfirmationRequired,
    true,
  )
  assert.deepEqual(JOURNAL_NAVIGATION_LIVE_SCOPE, {
    benchmarkQuestions: 1,
    comparisonOperations: 0,
    judgeOperations: 1,
    mainMaximumGeminiDispatches: 7,
    mainMaximumToolCalls: 6,
    mainProviderReducerDispatches: 0,
    maximumPhysicalProviderDispatches: 12,
    question2Allowed: false,
    questionIds: ['08e075c7'],
    smokeLocalToolExecutions: 1,
    smokeMaximumGeminiDispatches: 4,
    smokeMaximumReducerDispatches: 2,
    smokeMinimumGeminiDispatches: 3,
    smokeReducerMaxRepairs: 1,
    transportRetryDispatches: 0,
  })
})

test('v3 cap adds exactly one maximum writer response', () => {
  assert.deepEqual(JOURNAL_NAVIGATION_LIVE_HARD_CAP, {
    cumulativeCapUsd: 8,
    explorationSuccessMaximumUsd: 0.10496,
    freshSubcapUsd: 1.7001252,
    geminiPendingReservationUsd: 0.2359296,
    geminiSuccessfulMaximumUsd: 1.1559552,
    judgePendingReservationUsd: 0.54417,
    projectedCumulativeMaximumUsd: 2.9482959,
    smokeMeasuredPassExclusiveUsd: 0.01,
    smokePendingReservationsUsd: 0.9437184,
    smokeSuccessfulMaximumUsd: 0.4212352,
    writerSuccessMaximumUsd: 0.1056576,
  })
  assert.equal(
    Number((
      JOURNAL_NAVIGATION_LIVE_HARD_CAP
        .geminiSuccessfulMaximumUsd +
      JOURNAL_NAVIGATION_LIVE_HARD_CAP
        .judgePendingReservationUsd
    ).toFixed(12)),
    JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd,
  )
})

test('pending v3 refuses before credential fields are read', async () => {
  const loaded = await loadJournalNavigationLiveContract({
    repoRoot: REPO_ROOT,
  })
  const env = new Proxy({}, {
    get(_target, property) {
      if (['GEMINI_API_KEY', 'OPENAI_API_KEY'].includes(property)) {
        assert.fail(`credential ${property} was read`)
      }
      return undefined
    },
  })
  assert.throws(
    () => assertJournalNavigationLiveEnvironment(
      env,
      loaded.config,
      loaded.authority,
    ),
    { code: 'FOUNDER_CAP_CONFIRMATION_REQUIRED' },
  )
})

test('activated v3 accepts only its exact frozen environment', async () => {
  const loaded = await loadJournalNavigationLiveContract({
    repoRoot: REPO_ROOT,
  })
  const authority = {
    ...loaded.authority,
    dispatchAuthorized: true,
    exactCapConfirmationRequired: false,
  }
  assert.deepEqual(
    assertJournalNavigationLiveEnvironment({
      GEMINI_API_KEY: 'fake-gemini-key',
      OPENAI_API_KEY: 'fake-openai-key',
      PALARI_JOURNAL_NAVIGATION_CONFIRM_SPEND: '1',
      PALARI_JOURNAL_NAVIGATION_CUMULATIVE_CAP_USD: '8',
      PALARI_JOURNAL_NAVIGATION_FRESH_SUBCAP_USD: '1.7001252',
      PALARI_JOURNAL_NAVIGATION_MODEL: 'gemini-2.5-flash-lite',
      PALARI_JOURNAL_NAVIGATION_RUN_ID:
        JOURNAL_NAVIGATION_LIVE_RUN_ID,
    }, loaded.config, authority),
    {
      cumulativeCapUsd: 8,
      freshSubcapUsd: 1.7001252,
      geminiApiKey: 'fake-gemini-key',
      openaiApiKey: 'fake-openai-key',
      runId: JOURNAL_NAVIGATION_LIVE_RUN_ID,
    },
  )
})
