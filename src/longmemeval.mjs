// LongMemEval intake (U6) — Fable 5, 2026-07-18.
// Parses LongMemEval instances (Wu et al., ICLR 2025, MIT — verdict
// recorded in docs/DECISIONS.md 2026-07-18) into the kernel session
// shape. Format pinned from the canonical repo README and generator
// (data/custom_history/sample_haystack_and_timestamp.py):
//   timestamps are "%Y/%m/%d (%a) %H:%M" (e.g. "2023/05/20 (Sat)
//   02:21") or bare "%Y/%m/%d"; no timezone is specified — treated
//   as UTC (recorded assumption; symmetric for all sessions, so
//   relative ordering — what temporal reasoning needs — is exact).
// Session timestamps become `eventAt` so U7 ingestion satisfies the
// gate's evidence-time discipline (GAP-4): replayed history is
// stamped when it happened, never when we ran it.
// The real dataset lives under data/ (gitignored); only synthetic
// mini-fixtures are committed.

export const longMemEvalQuestionTypes = new Set([
  'single-session-user',
  'single-session-assistant',
  'single-session-preference',
  'temporal-reasoning',
  'knowledge-update',
  'multi-session',
])

const timestampPattern = /^(\d{4})\/(\d{2})\/(\d{2})(?:\s+\([A-Za-z]{3}\)\s+(\d{2}):(\d{2}))?$/

export function parseLongMemEvalTimestamp(value) {
  const match = timestampPattern.exec(String(value ?? '').trim())
  if (!match) return null
  const [, year, month, day, hour = '00', minute = '00'] = match
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00.000Z`
  return Number.isNaN(Date.parse(iso)) ? null : iso
}

const turnRoles = new Set(['user', 'assistant'])

function parseTurn(turn, where) {
  const role = String(turn?.role ?? '')
  if (!turnRoles.has(role)) {
    throw new Error(`Unknown turn role "${role}" at ${where}.`)
  }
  return {
    content: String(turn?.content ?? ''),
    hasAnswer: turn?.has_answer === true,
    role,
  }
}

function parseInstance(instance, index) {
  const questionId = String(instance?.question_id ?? '').trim()
  const where = `instance ${index} (${questionId || 'missing question_id'})`
  if (!questionId) throw new Error(`Missing question_id at ${where}.`)
  const questionType = String(instance?.question_type ?? '')
  if (!longMemEvalQuestionTypes.has(questionType)) {
    throw new Error(`Unknown question_type "${questionType}" at ${where}.`)
  }
  const sessionIds = instance?.haystack_session_ids
  const sessionDates = instance?.haystack_dates
  const sessions = instance?.haystack_sessions
  if (
    !Array.isArray(sessionIds) || !Array.isArray(sessionDates) || !Array.isArray(sessions) ||
    sessionIds.length !== sessionDates.length || sessionIds.length !== sessions.length
  ) {
    throw new Error(`haystack_session_ids/haystack_dates/haystack_sessions must be aligned arrays at ${where}.`)
  }
  const parsedSessions = sessions.map((turns, sessionIndex) => {
    const eventAt = parseLongMemEvalTimestamp(sessionDates[sessionIndex])
    if (!eventAt) {
      throw new Error(`Unparseable haystack date "${sessionDates[sessionIndex]}" at ${where}, session ${sessionIndex}.`)
    }
    if (!Array.isArray(turns)) throw new Error(`Session ${sessionIndex} is not a turn list at ${where}.`)
    return {
      eventAt,
      sessionId: String(sessionIds[sessionIndex] ?? '').trim(),
      turns: turns.map((turn, turnIndex) => parseTurn(turn, `${where}, session ${sessionIndex}, turn ${turnIndex}`)),
    }
  })
  return {
    answer: String(instance?.answer ?? ''),
    answerSessionIds: Array.isArray(instance?.answer_session_ids)
      ? instance.answer_session_ids.map((id) => String(id ?? '').trim()).filter(Boolean)
      : [],
    isAbstention: questionId.endsWith('_abs'),
    question: String(instance?.question ?? ''),
    questionDate: parseLongMemEvalTimestamp(instance?.question_date),
    questionId,
    questionType,
    sessions: parsedSessions,
  }
}

export function loadLongMemEvalInstances(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input
  if (!Array.isArray(data)) throw new Error('LongMemEval input must be a JSON array of instances.')
  return data.map((instance, index) => parseInstance(instance, index))
}
