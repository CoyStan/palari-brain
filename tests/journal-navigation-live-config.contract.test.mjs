import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

import {
  JOURNAL_NAVIGATION_LIVE_HARD_CAP,
  JOURNAL_NAVIGATION_LIVE_RUN_ID,
  assertJournalNavigationLiveEnvironment,
  journalNavigationLiveSha256,
  loadJournalNavigationLiveContract,
} from '../evals/journal-navigation-live-config.mjs'
import {
  auditJournalNavigationTrackedArtifacts,
  JOURNAL_NAVIGATION_TERMINAL_RUN_IDS,
  verifyJournalNavigationPredecessor,
} from '../evals/run-journal-navigation-live.mjs'

const REPO_ROOT = new URL('..', import.meta.url).pathname

test('fresh v2 contract pins its runtime and sealed v1 predecessor',
  async () => {
    const loaded = await loadJournalNavigationLiveContract({
      repoRoot: REPO_ROOT,
    })
    assert.equal(loaded.config.runId, JOURNAL_NAVIGATION_LIVE_RUN_ID)
    assert.equal(loaded.predictions.status, 'FINAL')
    assert.equal(loaded.predictions.predictions.length, 12)
    assert.equal(loaded.config.artifacts.length, 39)
    assert.equal(loaded.authority.dispatchAuthorized, true)
    assert.equal(
      loaded.authority.exactCapConfirmationRequired,
      false,
    )

    assert.deepEqual(
      JOURNAL_NAVIGATION_TERMINAL_RUN_IDS,
      ['j4-journal-navigation-longmemeval-q1-v1'],
    )
    const audit = await auditJournalNavigationTrackedArtifacts({
      config: loaded.config,
      repoRoot: REPO_ROOT,
    })
    assert.equal(audit.artifacts, 39)
    const drift = []
    for (const artifact of loaded.config.artifacts) {
      const current = journalNavigationLiveSha256(
        await readFile(join(REPO_ROOT, artifact.path)),
      )
      if (current !== artifact.sha256) drift.push(artifact.path)
    }
    assert.deepEqual(drift, [])

    const predecessor = await verifyJournalNavigationPredecessor({
      repoRoot: REPO_ROOT,
    })
    assert.deepEqual(
      {
        accountedUsd: predecessor.accountedUsd,
        measuredUsd: predecessor.measuredUsd,
        uncertainUsd: predecessor.uncertainUsd,
      },
      {
        accountedUsd: 1.0121192,
        measuredUsd: 0.7736886,
        uncertainUsd: 0.2384306,
      },
    )
  })

test('cap covers maximum validated responses plus a pending judge', () => {
  assert.deepEqual(JOURNAL_NAVIGATION_LIVE_HARD_CAP, {
    cumulativeCapUsd: 8,
    explorationSuccessMaximumUsd: 0.10496,
    freshSubcapUsd: 1.5944676,
    geminiPendingReservationUsd: 0.2359296,
    geminiSuccessfulMaximumUsd: 1.0502976,
    judgePendingReservationUsd: 0.54417,
    projectedCumulativeMaximumUsd: 2.6065868,
    smokeMeasuredPassExclusiveUsd: 0.01,
    smokePendingReservationsUsd: 0.7077888,
    smokeSuccessfulMaximumUsd: 0.3155776,
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

test('synthetic pending cap gate refuses before credential fields are read',
  async () => {
    const loaded = await loadJournalNavigationLiveContract({
      repoRoot: REPO_ROOT,
    })
    const pendingAuthority = {
      ...loaded.authority,
      dispatchAuthorized: false,
      exactCapConfirmationRequired: true,
    }
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
        pendingAuthority,
      ),
      { code: 'FOUNDER_CAP_CONFIRMATION_REQUIRED' },
    )
  })

test('activated cap gate accepts only the exact frozen environment',
  async () => {
    const loaded = await loadJournalNavigationLiveContract({
      repoRoot: REPO_ROOT,
    })
    const env = {
      GEMINI_API_KEY: 'fake-gemini-key',
      OPENAI_API_KEY: 'fake-openai-key',
      PALARI_JOURNAL_NAVIGATION_CONFIRM_SPEND: '1',
      PALARI_JOURNAL_NAVIGATION_CUMULATIVE_CAP_USD: '8',
      PALARI_JOURNAL_NAVIGATION_FRESH_SUBCAP_USD: '1.5944676',
      PALARI_JOURNAL_NAVIGATION_MODEL: 'gemini-2.5-flash-lite',
      PALARI_JOURNAL_NAVIGATION_RUN_ID:
        JOURNAL_NAVIGATION_LIVE_RUN_ID,
    }
    assert.deepEqual(
      assertJournalNavigationLiveEnvironment(
        env,
        loaded.config,
        loaded.authority,
      ),
      {
        cumulativeCapUsd: 8,
        freshSubcapUsd: 1.5944676,
        geminiApiKey: 'fake-gemini-key',
        openaiApiKey: 'fake-openai-key',
        runId: JOURNAL_NAVIGATION_LIVE_RUN_ID,
      },
    )
    assert.throws(
      () => assertJournalNavigationLiveEnvironment(
        {
          ...env,
          PALARI_JOURNAL_NAVIGATION_FRESH_SUBCAP_USD: '1.59',
        },
        loaded.config,
        loaded.authority,
      ),
      { code: 'LIVE_CONFIRMATION_MISSING' },
    )
  })
