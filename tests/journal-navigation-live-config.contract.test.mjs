import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JOURNAL_NAVIGATION_LIVE_HARD_CAP,
  JOURNAL_NAVIGATION_LIVE_RUN_ID,
  assertJournalNavigationLiveEnvironment,
  loadJournalNavigationLiveContract,
} from '../evals/journal-navigation-live-config.mjs'
import {
  auditJournalNavigationTrackedArtifacts,
  verifyJournalNavigationPredecessor,
} from '../evals/run-journal-navigation-live.mjs'

const REPO_ROOT = new URL('..', import.meta.url).pathname

test('fresh contract pins its complete runtime and sealed predecessor',
  async () => {
    const loaded = await loadJournalNavigationLiveContract({
      repoRoot: REPO_ROOT,
    })
    assert.equal(loaded.config.runId, JOURNAL_NAVIGATION_LIVE_RUN_ID)
    assert.equal(loaded.predictions.status, 'FINAL')
    assert.equal(loaded.predictions.predictions.length, 12)
    assert.equal(loaded.config.artifacts.length, 39)
    assert.equal(loaded.authority.dispatchAuthorized, false)
    assert.equal(
      loaded.authority.exactCapConfirmationRequired,
      true,
    )

    const artifactAudit =
      await auditJournalNavigationTrackedArtifacts({
        config: loaded.config,
        repoRoot: REPO_ROOT,
      })
    assert.equal(artifactAudit.artifacts, 39)

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
        accountedUsd: 1.0120378,
        measuredUsd: 0.7736072,
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
    projectedCumulativeMaximumUsd: 2.6065054,
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

test('pending cap gate refuses before credential fields are read',
  async () => {
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
