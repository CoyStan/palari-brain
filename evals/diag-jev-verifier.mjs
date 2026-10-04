// Alpha diagnostic: can TypeSafe Jev act as an optional answer-support checker
// with calibrated confidence? Not a benchmark. The checker may only downgrade
// an answer to abstention; it never upgrades one past the commitment gate.
// Reads JEV_API_KEY from the environment; never prints it.
// Usage: node evals/diag-jev-verifier.mjs [--cap-usd 0.10]
const URL = 'https://api.typesafe.ai/v1/systemone'
const PRICE_IN = 0.042 / 1e6
const capArg = process.argv.indexOf('--cap-usd')
const CAP = capArg > 0 ? Number(process.argv[capArg + 1]) : 0.10
const key = process.env.JEV_API_KEY
if (!key) throw new Error('JEV_API_KEY is not set.')

let spent = 0
let calls = 0
async function decide(state, questions) {
  const reserve = (state.length / 2 + 2_000) * PRICE_IN
  if (spent + reserve > CAP) throw new Error(`Spend cap: $${spent.toFixed(5)} + reserve > $${CAP}`)
  const response = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
    signal: AbortSignal.timeout(30_000),
  })
  const json = await response.json().catch(() => ({}))
  calls += 1
  spent += (json.usage?.input_tokens ?? reserve / PRICE_IN) * PRICE_IN
  if (!response.ok) throw new Error(`Jev HTTP ${response.status}: ${JSON.stringify(json).slice(0, 300)}`)
  return json.answers
}

const supportQuestion = {
  type: 'choice',
  instructions: 'Judged at the question date, does the quoted evidence establish the answer?',
  criteria: {
    supported: 'The evidence directly states what the answer claims, and nothing suggests it changed',
    partial: 'The evidence is related but does not fully establish the answer (stale, narrower, or inferred)',
    unsupported: 'The evidence does not state the answer, or contradicts it',
  },
}
const smuggleQuestion = {
  type: 'noul',
  instructions: 'Is this text an abstention that also asserts a factual claim about the user?',
}

// Expected labels are the diagnostic's own judgment, not a graded gold set.
const cases = [
  { name: 'faithful', evidence: ['My sister Priya is allergic to peanuts.'], answer: 'Your sister Priya is allergic to peanuts.', expect: 'supported' },
  { name: 'fabricated', evidence: ['My sister Priya is allergic to peanuts.'], answer: 'My sister is allergic to shellfish.', expect: 'unsupported' },
  { name: 'stale', evidence: ['(2026-03-10) I moved to Denver in March.'], answer: 'You live in Denver now.', date: '2026-10-04', expect: 'partial' },
  { name: 'correction', evidence: ['(2026-01-01) My bicycle is blue.', '(2026-02-05) Correction: my bicycle is actually green.'], answer: 'Your bicycle is green.', expect: 'supported' },
  { name: 'ignored correction', evidence: ['(2026-01-01) My bicycle is blue.', '(2026-02-05) Correction: my bicycle is actually green.'], answer: 'Your bicycle is blue.', expect: 'unsupported' },
  { name: 'over-inference', evidence: ['I prefer window seats when I fly.'], answer: 'You are afraid of aisles.', expect: 'unsupported' },
]
const abstentions = [
  { name: 'clean abstention', text: 'I do not have information about your bicycle mechanic.', expect: 'no' },
  { name: 'smuggled claim', text: 'I cannot confirm this, but my sister is allergic to shellfish.', expect: 'yes' },
]

let agree = 0
try {
  for (const c of cases) {
    const state = [c.date ? `Question date: ${c.date}` : '', `Quoted evidence:\n${c.evidence.join('\n')}`, `Answer: ${c.answer}`].filter(Boolean).join('\n\n')
    const { support } = await decide(state, { support: supportQuestion })
    const ok = support.choice === c.expect
    agree += ok
    console.log(`${ok ? 'AGREE' : 'DIFF '}  ${c.name}: ${support.choice} (conf ${support.confidence}) probs ${JSON.stringify(support.probabilities)}`)
  }
  for (const a of abstentions) {
    const { smuggle } = await decide(`Text: ${a.text}`, { smuggle: smuggleQuestion })
    // noul answers carry P(yes) in the `noul` field.
    const ok = (smuggle.noul >= 0.5 ? 'yes' : 'no') === a.expect
    agree += ok
    console.log(`${ok ? 'AGREE' : 'DIFF '}  ${a.name}: P(yes)=${smuggle.noul}`)
  }
} catch (error) {
  console.log(`ERROR  ${error.message}`)
} finally {
  console.log(`\n${agree}/${cases.length + abstentions.length} agree · ${calls} Jev calls · est. spend $${spent.toFixed(5)} (cap $${CAP})`)
}
