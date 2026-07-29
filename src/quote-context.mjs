// Context analysis for host-verified quotes.
//
// THE HOLE THIS CLOSES
//
// The gate verifies that a quote is an exact contiguous substring of the
// canonical record. It did not verify that the quote MEANS what the reducer
// claims. Three mechanical ways an exact quote can lie:
//
//   1. Negated or conditional context. From "If the board approves, then I
//      authorize the payment", the substring "I authorize the payment" is
//      exact — and inverted. Same for "I'm not saying I hate my boss".
//   2. Quoted speech. From "My boss said \"the project is cancelled\"", the
//      substring inside the quotation marks is someone else's words.
//   3. Third-party text pasted into a user message. Chat products without
//      file intake teach users to paste emails and documents into the
//      message box; that text arrives stamped as the user's own speech, and
//      a reducer can then quote a colleague's words as the user's.
//
// This module makes those three contexts DETECTABLE with plain string
// analysis — no model, no network, deterministic. The digest gate uses it
// to enforce one rule: an `asserted` memory may not rest on a quote in any
// of these contexts; the reducer must downgrade to `uncertain`/`unknown`
// or quote a span that includes the qualifying words. Deliberately
// conservative: a false positive costs one epistemic downgrade; a false
// negative mints a confident distortion with a verified citation.
//
// This is a guard, not comprehension. Sarcasm, irony, and long-range
// context are out of mechanical reach and stay the reader's job — which is
// why the digest renders the quote alongside every statement.

const NEGATION_MARKERS = Object.freeze([
  "aren't", "can't", 'cannot', "didn't", "doesn't", "don't", "isn't",
  'never', 'no longer', 'not', "wasn't", "won't", "wouldn't",
])

const CONDITIONAL_MARKERS = Object.freeze([
  'hypothetically', 'if', 'imagine', 'in case', 'pretend', 'suppose',
  'supposing', 'unless', 'wish',
])

const HEADER_LINE = /^(from|to|cc|bcc|sent|subject|date)\s*:/i
const FORWARD_LINE =
  /^(-{2,}\s*(original message|forwarded message)|begin forwarded message)/i

function normalized(value) {
  return String(value ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”„]/g, '"')
}

function hasMarker(window, markers) {
  const padded = ` ${window.toLowerCase().replace(/[,;:()]/g, ' ')} `
  return markers.filter((marker) => padded.includes(` ${marker} `))
}

// Spans of a message that mechanically look like pasted third-party
// material: forwarded/original-message blocks, email header clusters, and
// quoted-reply blocks. Spans run to the end of the message because pasted
// mail overwhelmingly trails the user's own words.
export function detectThirdPartySpans(text) {
  const source = normalized(text)
  const spans = []
  let offset = 0
  let headerLines = 0
  let firstHeaderStart = -1
  let quotedRun = 0
  let quotedStart = -1
  for (const line of source.split('\n')) {
    if (FORWARD_LINE.test(line.trim())) {
      spans.push([offset, source.length])
      break
    }
    if (HEADER_LINE.test(line.trim())) {
      if (firstHeaderStart < 0) firstHeaderStart = offset
      headerLines += 1
    }
    if (line.trimStart().startsWith('>')) {
      if (quotedStart < 0) quotedStart = offset
      quotedRun += 1
    } else {
      if (quotedRun >= 3) spans.push([quotedStart, offset])
      quotedRun = 0
      quotedStart = -1
    }
    offset += line.length + 1
  }
  if (quotedRun >= 3) spans.push([quotedStart, source.length])
  if (headerLines >= 2) spans.push([firstHeaderStart, source.length])
  return spans
}

function overlaps(spans, start, end) {
  return spans.some(([from, to]) => start < to && end > from)
}

export function analyzeQuoteContext(evidenceText, quote) {
  const source = normalized(evidenceText)
  const needle = normalized(quote)
  const at = source.indexOf(needle)
  // A quote that is not present at all is the exact-substring check's
  // problem, not this guard's.
  if (at < 0 || !needle) return Object.freeze({ clean: true, reasons: [] })

  const reasons = []

  // The window from the start of the quote's sentence to the quote itself:
  // the words that can invert or hypothesize what follows.
  const sentenceStart = Math.max(
    source.lastIndexOf('.', at - 1),
    source.lastIndexOf('!', at - 1),
    source.lastIndexOf('?', at - 1),
    source.lastIndexOf('\n', at - 1),
  ) + 1
  const window = source.slice(sentenceStart, at)
  if (hasMarker(window, NEGATION_MARKERS).length) reasons.push('negated')
  if (hasMarker(window, CONDITIONAL_MARKERS).length) {
    reasons.push('conditional')
  }

  // Inside quotation marks: an odd number of double quotes before the quote
  // starts means the span sits within reported speech.
  const quoteMarksBefore = (source.slice(0, at).match(/"/g) ?? []).length
  if (quoteMarksBefore % 2 === 1) reasons.push('quoted-speech')

  if (overlaps(detectThirdPartySpans(source), at, at + needle.length)) {
    reasons.push('third-party-text')
  }

  return Object.freeze({ clean: reasons.length === 0, reasons })
}
