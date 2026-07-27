// What real models actually returned, replayed offline.
//
// The charter says mocks are not gates: only a live run validates provider
// behavior. That is true, and it has cost this repo nine terminal run
// identities. Every one of them died at the host<->provider seam, and every
// one of them was a *shape* defect that a cooperative fake provider could
// never have produced, because the fakes in `tests/` always emit exactly what
// the host wants.
//
// This corpus is the other half of that law. A live run is still the only
// thing that can DISCOVER a deviation; this file is where a discovered
// deviation stops being a one-shot anecdote and becomes a permanent offline
// fixture. Nothing here replaces a live gate. It stops the same wire-format
// defect from costing a second sealed identity.
//
// Two rules for maintaining it:
//
//   1. Every terminal live failure caused by a model returning the wrong
//      shape gets an entry with `observed: true` and the unit that found it.
//   2. Entries with `observed: false` are anticipated deviations that no live
//      run has produced yet. They are cheap insurance, and they are labelled
//      honestly so nobody mistakes them for evidence.
//
// The corpus asserts more than "the host rejects this". It asserts the host's
// rejection NAMES THE OFFENDING FIELD, because that message is the input to a
// repair turn (see `evals/arms/lean-memory-reducer-repair.mjs`). A rejection
// the model cannot act on is a dead end; a rejection that says
// `actions[0].timeQuote is not an exact contiguous quote from its evidence`
// is a correction.

// A small, valid reduction request. Every deviation below is expressed as a
// payload against THIS request, so a fixture is exactly one variable: what
// the model sent back.
export const DEVIATION_REQUEST = Object.freeze({
  input: Object.freeze({
    baseRevision: 4,
    evidence: Object.freeze([
      Object.freeze({
        id: 'ev-8801',
        observedAt: '2026-03-04T10:00:00.000Z',
        speaker: 'user',
        text: 'I moved to Lisbon in March and I am still working as a paramedic.',
      }),
      Object.freeze({
        id: 'ev-8802',
        observedAt: '2026-03-04T10:01:00.000Z',
        speaker: 'Palari',
        text: 'Understood, Lisbon since March, still a paramedic.',
      }),
    ]),
    prior: Object.freeze([
      Object.freeze({
        epistemic: 'asserted',
        id: 'mem-4401',
        observedAt: '2025-11-02T09:00:00.000Z',
        speaker: 'user',
        statement: 'The user lives in Porto.',
        topic: 'residence',
      }),
    ]),
    utilization: Object.freeze({
      digestCharsRemaining: 4_000,
      itemsRemaining: 20,
    }),
  }),
})

function action(overrides = {}) {
  return {
    epistemic: 'asserted',
    evidenceQuotes: ['I moved to Lisbon in March'],
    evidenceRefs: ['e0'],
    op: 'add',
    statement: 'The user moved to Lisbon in March.',
    targets: [],
    timeEvidenceRef: '',
    timeQuote: '',
    topic: 'residence',
    ...overrides,
  }
}

function payload(...actions) {
  return JSON.stringify({ actions })
}

// The control. If this ever stops normalizing, the corpus is measuring the
// wrong thing and every rejection below becomes meaningless.
export const DEVIATION_CONTROL = Object.freeze({
  id: 'control-valid-add',
  payload: payload(action()),
  summary: 'A well-formed single add against current evidence.',
})

export const PROVIDER_DEVIATIONS = Object.freeze([
  Object.freeze({
    // J4.4K-L2-E. The model was shown a host `observedAt` alongside the
    // dialogue and used it as the time anchor. It is metadata, not something
    // anybody said, so it is not quotable. The repair in J4.4K-R2 removed the
    // timestamp from the prompt; this fixture keeps the boundary tested even
    // if a future prompt reintroduces one.
    expectedFragment: 'actions[0].timeQuote',
    id: 'host-timestamp-as-quote',
    observed: true,
    payload: payload(action({
      timeEvidenceRef: 'e0',
      timeQuote: '2026-03-04T10:00:00.000Z',
    })),
    repairable: true,
    summary:
      'Host metadata copied into a field that accepts only exact dialogue quotes.',
    unit: 'J4.4K-L2-E',
  }),
  Object.freeze({
    // J4.2 v1 and J4.2R v2, generalized. Both died because the model used a
    // vocabulary value the prompt had not enumerated. The lean contract makes
    // this a provider-enforced enum, but provider enforcement is advisory
    // until a live run proves it, so the host still has to catch it.
    expectedFragment: 'actions[0].epistemic',
    id: 'unenumerated-vocabulary-value',
    observed: true,
    payload: payload(action({ epistemic: 'probable' })),
    repairable: true,
    summary:
      'A closed-vocabulary field set to a plausible value outside the frozen enum.',
    unit: 'J4.2 / J4.2R',
  }),
  Object.freeze({
    // J4.4K-L3-E. HTTP 200, no content. Distinct from every other entry: the
    // model returned nothing to correct, so a repair turn is a retry, not a
    // correction. Classified separately for exactly that reason.
    expectedFragment: 'Lean memory proposal',
    id: 'empty-successful-response',
    observed: true,
    payload: '',
    repairable: false,
    summary: 'A successful HTTP response carrying an empty body.',
    unit: 'J4.4K-L3-E',
  }),
  Object.freeze({
    // J4.4K-P2-E, first proposal. The provider treated one semantic update as
    // three independently named dimensions even though `targets` is a list of
    // prior-memory aliases, not a list of fields being changed.
    expectedFragment: 'actions[0].targets',
    id: 'supersede-with-multiple-targets',
    observed: true,
    payload: payload(action({
      op: 'supersede',
      targets: ['residence', 'workplace', 'shift_type'],
    })),
    repairable: true,
    summary:
      'A supersede names several semantic dimensions instead of exactly one prior-memory alias.',
    unit: 'J4.4K-P2-E',
  }),
  Object.freeze({
    // J4.4K-P2-E, repair proposal. The first objection said only that one
    // target was required. The provider reduced the list to one item but used
    // the prior fact's topic ("occupation") rather than its supplied alias.
    // This proves that a field-only objection is not always repair-usable.
    expectedFragment: 'actions[0].targets[0]',
    id: 'supersede-target-is-topic-not-prior-ref',
    observed: true,
    payload: payload(action({
      op: 'supersede',
      targets: ['residence'],
    })),
    repairable: true,
    summary:
      'A supersede uses the prior fact topic instead of its supplied memory alias.',
    unit: 'J4.4K-P2-E',
  }),
  Object.freeze({
    expectedFragment: 'Lean memory proposal',
    id: 'markdown-fenced-json',
    observed: false,
    payload: '```json\n{"actions": []}\n```',
    repairable: true,
    summary: 'Structured output wrapped in a markdown code fence.',
    unit: 'anticipated',
  }),
  Object.freeze({
    expectedFragment: 'actions[0]',
    id: 'extra-field',
    observed: false,
    payload: payload(action({ confidence: 0.9 })),
    repairable: true,
    summary: 'An explanatory field the schema does not declare.',
    unit: 'anticipated',
  }),
  Object.freeze({
    expectedFragment: 'actions[0]',
    id: 'missing-required-field',
    observed: false,
    payload: (() => {
      const { timeQuote: _dropped, ...rest } = action()
      return JSON.stringify({ actions: [rest] })
    })(),
    repairable: true,
    summary: 'A required field omitted because it was empty anyway.',
    unit: 'anticipated',
  }),
  Object.freeze({
    // The single most likely deviation for any quote-checked system: the
    // model paraphrases by one character and the substring check fails.
    expectedFragment: 'actions[0].evidenceQuotes[0]',
    id: 'near-miss-quote',
    observed: false,
    payload: payload(action({
      evidenceQuotes: ['I moved to Lisbon in March.'],
    })),
    repairable: true,
    summary:
      'A quote that differs from the recorded text by one trailing character.',
    unit: 'anticipated',
  }),
  Object.freeze({
    expectedFragment: 'actions[0].targets',
    id: 'supersede-without-target',
    observed: false,
    payload: payload(action({ op: 'supersede', targets: [] })),
    repairable: true,
    summary: 'A supersede that names no prior memory to supersede.',
    unit: 'anticipated',
  }),
  Object.freeze({
    expectedFragment: 'actions[0]',
    id: 'mixed-speaker-authority',
    observed: false,
    payload: payload(action({
      evidenceQuotes: [
        'I moved to Lisbon in March',
        'Understood, Lisbon since March',
      ],
      evidenceRefs: ['e0', 'e1'],
    })),
    repairable: true,
    summary:
      'One action citing both the user and Palari as a single authority.',
    unit: 'anticipated',
  }),
  Object.freeze({
    expectedFragment: 'actions[0]',
    id: 'supersede-across-topics',
    observed: false,
    payload: payload(action({
      op: 'supersede',
      targets: ['m0'],
      topic: 'occupation',
    })),
    repairable: true,
    summary: 'A supersede pointed at a prior fact about something else.',
    unit: 'anticipated',
  }),
  Object.freeze({
    expectedFragment: 'actions[0].evidenceRefs[0]',
    id: 'invented-evidence-reference',
    observed: false,
    payload: payload(action({ evidenceRefs: ['e7'] })),
    repairable: true,
    summary: 'A citation to evidence that was never supplied.',
    unit: 'anticipated',
  }),
])

export const OBSERVED_PROVIDER_DEVIATIONS = Object.freeze(
  PROVIDER_DEVIATIONS.filter((entry) => entry.observed),
)

// A deviation the host cannot describe back to the model is a deviation the
// model cannot fix. This is the property a repair turn depends on.
export function deviationIsRepairUsable(deviation, message) {
  return typeof message === 'string' &&
    message.includes(deviation.expectedFragment)
}
