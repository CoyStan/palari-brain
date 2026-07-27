// The missing rung between a fake provider and a sealed benchmark identity.
//
// THE GAP THIS FILLS
//
// This repo has exactly two ways to exercise the reducer today:
//
//   1. Offline tests with fake providers. The fakes are cooperative — they
//      always return exactly the shape the host wants. They prove the host
//      handles correct input correctly and can never discover what a real
//      model does.
//   2. A sealed, founder-gated, one-shot benchmark identity: a frozen config,
//      a hash manifest over 39 artifacts, pre-registered predictions, a
//      terminal-on-failure runner, and a STATUS.md seal per attempt.
//
// Nine identities have now been spent discovering things like "the model put
// a timestamp in a quote-only field" and "the model returned an empty body".
// Those are wire-format facts. Paying a full governance ceremony to learn one
// is why the same class of defect keeps surfacing one attempt at a time.
//
// So: a probe. It talks to the real provider through the real metered
// transport and validates with the real host validators, but it
//
//   - produces NO score and touches NO benchmark dataset,
//   - has NO run identity, so nothing to seal, resume, re-roll or publish,
//   - writes nothing under `evals/results/`,
//   - is repeatable — running it twice is not a re-roll, because there is no
//     result to re-roll,
//   - costs fractions of a cent per attempt under its own hard cap.
//
// WHAT IS STILL GATED
//
// Spending money. The charter gates any live provider run, and this is one.
// The probe refuses to dispatch without an explicit founder confirmation in
// the environment. What it removes is the CEREMONY, not the gate: one
// confirmation authorizes an iteration loop rather than a single shot,
// because there is no artifact that a second iteration could corrupt.
//
// A finding here is not evidence of anything. It is a lead. Real findings
// come from live runs; the probe's job is to make sure a live run never dies
// on something a $0.0001 dispatch would have caught. When it does find a new
// deviation, the deviation belongs in `evals/provider-deviation-corpus.mjs`
// so it is caught offline from then on.

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import {
  createIncrementalLongMemEvalGeminiTransport,
} from './incremental-longmemeval-runtime.mjs'
import {
  LEAN_MEMORY_REDUCER_GENERATION,
} from './arms/lean-memory-reducer-contract.mjs'
import {
  buildClarifiedLeanMemoryReducerGeminiBody,
} from './arms/lean-memory-reducer-instructions.mjs'
import {
  createRepairingLeanMemoryReducer,
} from './arms/lean-memory-reducer-repair.mjs'

export const DEV_PROBE_DIRECTORY = '.palari-probe'
// One maximum validated writer response ($0.1056576), followed by one full
// pending reservation ($0.2359296) if the host rejects that proposal and the
// separately metered repair becomes uncertain.
export const DEV_PROBE_DEFAULT_CAP_USD = 0.3415872

export class DevProviderProbeError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.name = 'DevProviderProbeError'
  }
}

// A synthetic exchange, not benchmark data.
//
// The first version of this scenario contained a correction whose antecedent
// was in the SAME batch (`night shifts` -> `days`) and no prior memory that
// the batch legally superseded. That is unrepresentable in the lean grammar,
// so the probe asked the model for something it could not express and both
// dispatches were rejected. Useful finding, bad scenario.
//
// This version keeps the intra-batch correction, because a batched reducer
// meets that case constantly and the model must learn to handle it by adding
// only the final version. It also supplies `m1`, which the batch genuinely
// does supersede, so a correct response exercises both paths: one legal
// supersede against prior, one add-the-final-version, and one prior fact
// (`m0`) left untouched to confirm that omission is not deletion.
export const DEV_PROBE_SCENARIO = Object.freeze({
  evidence: Object.freeze([
    Object.freeze({
      id: 'probe-ev-1',
      observedAt: '2026-01-08T09:00:00.000Z',
      speaker: 'user',
      text: 'I work night shifts at the hospital in Porto, usually Tuesdays and Thursdays.',
    }),
    Object.freeze({
      id: 'probe-ev-2',
      observedAt: '2026-01-08T09:00:30.000Z',
      speaker: 'Palari',
      text: 'Noted: night shifts in Porto on Tuesdays and Thursdays.',
    }),
    Object.freeze({
      id: 'probe-ev-3',
      observedAt: '2026-04-21T18:30:00.000Z',
      speaker: 'user',
      text: 'Since last month I have been on days instead of nights, and I transferred to the Lisbon hospital.',
    }),
  ]),
  prior: Object.freeze([
    Object.freeze({
      epistemic: 'asserted',
      id: 'probe-mem-1',
      observedAt: '2025-09-14T11:00:00.000Z',
      speaker: 'user',
      statement: 'The user is a nurse.',
      topic: 'occupation',
    }),
    Object.freeze({
      epistemic: 'asserted',
      id: 'probe-mem-2',
      observedAt: '2025-09-14T11:00:00.000Z',
      speaker: 'user',
      statement: 'The user works at the hospital in Porto.',
      topic: 'workplace',
    }),
  ]),
})

export function devProbeRequest({
  baseRevision = 7,
  scenario = DEV_PROBE_SCENARIO,
} = {}) {
  return {
    input: {
      baseRevision,
      evidence: [...scenario.evidence],
      prior: [...scenario.prior],
      utilization: {
        digestCharsRemaining: 4_000,
        itemsRemaining: 20,
      },
    },
  }
}

export function assertDevProbeAuthorized(env = process.env) {
  if (env.PALARI_PROBE_CONFIRM_SPEND !== '1') {
    throw new DevProviderProbeError(
      'PROBE_CONFIRMATION_MISSING',
      'Set PALARI_PROBE_CONFIRM_SPEND=1 to authorize live provider spend.',
    )
  }
  const raw = env.PALARI_PROBE_CAP_USD
  const capUsd = raw === undefined || raw === ''
    ? DEV_PROBE_DEFAULT_CAP_USD
    : Number(raw)
  if (!Number.isFinite(capUsd) || capUsd <= 0 || capUsd > 1) {
    throw new DevProviderProbeError(
      'PROBE_CAP_INVALID',
      'PALARI_PROBE_CAP_USD must be a positive number of at most 1.',
    )
  }
  // Read the credential only after both gates pass, so a misconfigured probe
  // never touches the key.
  const geminiApiKey = env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY
  if (typeof geminiApiKey !== 'string' || !geminiApiKey.trim()) {
    throw new DevProviderProbeError(
      'PROBE_CREDENTIAL_MISSING',
      'GEMINI_API_KEY is required to dispatch a probe.',
    )
  }
  return { capUsd, geminiApiKey }
}

export async function runDevProviderProbe({
  attempts = 1,
  env = process.env,
  fetchImpl,
  log = console.log,
  maxRepairs = 1,
  probeRoot,
  repoRoot = new URL('..', import.meta.url).pathname,
} = {}) {
  const { capUsd, geminiApiKey } = assertDevProbeAuthorized(env)
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 20) {
    throw new DevProviderProbeError(
      'PROBE_ATTEMPTS_INVALID',
      'attempts must be a safe integer between 1 and 20.',
    )
  }

  const root = probeRoot ?? join(repoRoot, DEV_PROBE_DIRECTORY)
  await mkdir(root, { mode: 0o700, recursive: true })

  const transport = await createIncrementalLongMemEvalGeminiTransport({
    cumulativeCapUsd: capUsd,
    fetchImpl,
    freshSubcapUsd: capUsd,
    geminiApiKey,
    journalPath: join(root, 'gemini-journal.jsonl'),
    openingAccountedUsd: 0,
    transcriptDirectory: join(root, 'transcripts'),
    writerGeneration: LEAN_MEMORY_REDUCER_GENERATION,
  })

  const observations = []
  let operationInvocations = 0
  transport.installNetworkGuard()
  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const repairs = []
      const reduce = createRepairingLeanMemoryReducer({
        buildBody: buildClarifiedLeanMemoryReducerGeminiBody,
        invoke: async ({ attempt: repairAttempt, body }) => {
          operationInvocations += 1
          // A repair is a distinct logical operation, so it gets a distinct
          // operation identity. The meter still sees one dispatch per
          // operation; it is simply told the truth about how many there were.
          return transport.callGemini({
            body,
            cellId: `probe-${attempt}`,
            operationId: `probe-${attempt}-writer-${repairAttempt}`,
            purpose: 'writer',
          })
        },
        maxRepairs,
        onRepair: (event) => repairs.push(event.rejection),
      })

      try {
        const proposal = await reduce({
          request: devProbeRequest(),
          unit: { unitOrder: attempt },
        })
        observations.push({
          actions: proposal.actions.length,
          attempt,
          outcome: repairs.length ? 'repaired' : 'accepted',
          repairs,
        })
        log(`attempt ${attempt}: ${repairs.length ? 'repaired' : 'accepted'} ` +
          `(${proposal.actions.length} actions, ${repairs.length} repairs)`)
        for (const rejection of repairs) log(`  host said: ${rejection}`)
      } catch (error) {
        observations.push({
          attempt,
          code: error?.code ?? null,
          outcome: 'rejected',
          rejection: error?.message ?? String(error),
          repairs,
        })
        log(`attempt ${attempt}: rejected — ${error?.message ?? error}`)
        // A cap or transport fault ends the probe; a proposal the model could
        // not fix is a finding, and the next attempt may deviate differently.
        if (error?.code !== 'LEAN_REDUCER_PROPOSAL_INVALID' &&
          error?.code !== 'LEAN_REDUCER_EMPTY_RESPONSE') {
          break
        }
      }
    }
  } finally {
    transport.closeNetworkGuard()
  }

  const snapshot = await transport.snapshot()
  const dispatches = Number.isSafeInteger(snapshot?.attempts)
    ? snapshot.attempts
    : 0
  const summary = {
    accepted: observations.filter((entry) => entry.outcome === 'accepted')
      .length,
    capUsd,
    dispatches,
    observations,
    operationInvocations,
    rejected: observations.filter((entry) => entry.outcome === 'rejected')
      .length,
    repaired: observations.filter((entry) => entry.outcome === 'repaired')
      .length,
    spentUsd: snapshot?.accounted?.usd ?? null,
  }
  log(`${summary.accepted} accepted, ${summary.repaired} repaired, ` +
    `${summary.rejected} rejected across ${dispatches} physical dispatches ` +
    `(${operationInvocations} logical invocations; ` +
    `$${summary.spentUsd ?? '?'} of $${capUsd}).`)
  if (summary.rejected) {
    log('Add any new deviation to evals/provider-deviation-corpus.mjs so it ' +
      'is caught offline from now on.')
  }
  return summary
}
