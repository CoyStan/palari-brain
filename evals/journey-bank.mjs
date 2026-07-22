// Journey bank loader + validator (J1).
// A journey is a concrete assistant-memory scenario: sessions of turns
// (with scripted extraction candidates for dry mode), optional
// directives (e.g. forget), and probes graded against the arm's
// answers. The bank is the product-side measure every memory engine is
// judged by — journeys are written for realism first, never rigged to
// any one arm.

import { readFile } from 'node:fs/promises'

export const journeyCategories = new Set([
  'preference',
  'entity',
  'correction',
  'conflict',
  'forgetting',
  'isolation',
  'injection',
  'abstention',
  'temporal',
  'multi-session',
])

export const probeDimensions = new Set([
  'usefulness',
  'wrong-memory',
  'correction',
  'forgetting',
  'isolation',
  'injection-resistance',
  'abstention-honesty',
  'temporal',
])

const isoDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0

function fail(journeyId, message) {
  throw new Error(`journey-bank: ${journeyId ?? '?'}: ${message}`)
}

export function validateJourney(j) {
  if (!nonEmpty(j?.id)) fail(j?.id, 'id required')
  if (!nonEmpty(j.title)) fail(j.id, 'title required')
  if (!journeyCategories.has(j.category)) fail(j.id, `unknown category ${j.category}`)
  if (!nonEmpty(j.workspace?.palariId) || !nonEmpty(j.workspace?.userId)) {
    fail(j.id, 'workspace.palariId and workspace.userId required')
  }
  if (j.expectTotalWritten !== undefined &&
    (!Number.isInteger(j.expectTotalWritten) || j.expectTotalWritten < 0)) {
    fail(j.id, 'expectTotalWritten must be a non-negative integer')
  }
  if (!Array.isArray(j.sessions) || j.sessions.length === 0) fail(j.id, 'sessions required')
  const sessionIds = new Set()
  for (const s of j.sessions) {
    if (!nonEmpty(s.sessionId)) fail(j.id, 'sessionId required')
    if (sessionIds.has(s.sessionId)) fail(j.id, `duplicate sessionId ${s.sessionId}`)
    sessionIds.add(s.sessionId)
    if (!isoDate(s.eventAt)) fail(j.id, `session ${s.sessionId}: eventAt must be ISO date`)
    if (!Array.isArray(s.turns) || s.turns.length === 0) fail(j.id, `session ${s.sessionId}: turns required`)
    for (const t of s.turns) {
      if (t.role !== 'user' && t.role !== 'assistant') fail(j.id, `bad role ${t.role}`)
      if (!nonEmpty(t.content)) fail(j.id, 'turn content required')
      if (t.expectMemories !== undefined) {
        if (t.role !== 'user') fail(j.id, 'expectMemories only on user turns')
        if (!Array.isArray(t.expectMemories)) fail(j.id, 'expectMemories must be an array')
        for (const m of t.expectMemories) {
          if (!nonEmpty(m.content)) fail(j.id, 'candidate content required')
          if (!nonEmpty(m.type)) fail(j.id, 'candidate type required')
          if (!Array.isArray(m.keywords) || m.keywords.length === 0) fail(j.id, 'candidate keywords required')
        }
      }
      if (t.sourceTexts !== undefined && !Array.isArray(t.sourceTexts)) {
        fail(j.id, 'sourceTexts must be an array')
      }
    }
  }
  for (const d of j.directives ?? []) {
    if (d.type !== 'forget') fail(j.id, `unknown directive type ${d.type}`)
    if (!sessionIds.has(d.afterSession)) fail(j.id, `directive afterSession ${d.afterSession} unknown`)
    if (!nonEmpty(d.topic)) fail(j.id, 'directive topic required')
  }
  if (!Array.isArray(j.probes) || j.probes.length === 0) fail(j.id, 'probes required')
  const probeIds = new Set()
  for (const p of j.probes) {
    if (!nonEmpty(p.id)) fail(j.id, 'probe id required')
    if (probeIds.has(p.id)) fail(j.id, `duplicate probe id ${p.id}`)
    probeIds.add(p.id)
    if (!nonEmpty(p.question)) fail(j.id, `probe ${p.id}: question required`)
    if (!isoDate(p.questionDate)) fail(j.id, `probe ${p.id}: questionDate must be ISO date`)
    if (p.expect !== 'answer' && p.expect !== 'abstain') fail(j.id, `probe ${p.id}: expect must be answer|abstain`)
    if (p.expect === 'abstain' && (p.mustContain ?? []).length > 0) {
      fail(j.id, `probe ${p.id}: abstain probes cannot require mustContain`)
    }
    if (!probeDimensions.has(p.dimension)) fail(j.id, `probe ${p.id}: unknown dimension ${p.dimension}`)
    for (const list of [p.mustContain, p.mustNotContain]) {
      if (list !== undefined && (!Array.isArray(list) || list.some((x) => !nonEmpty(x)))) {
        fail(j.id, `probe ${p.id}: mustContain/mustNotContain must be non-empty strings`)
      }
    }
    if (p.knownFinding !== undefined && !nonEmpty(p.knownFinding)) {
      fail(j.id, `probe ${p.id}: knownFinding must be a non-empty note`)
    }
  }
  return j
}

export function loadJourneyBank(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (data?.version !== 1) throw new Error('journey-bank: version must be 1')
  if (!Array.isArray(data.journeys) || data.journeys.length === 0) {
    throw new Error('journey-bank: journeys required')
  }
  const ids = new Set()
  for (const j of data.journeys) {
    validateJourney(j)
    if (ids.has(j.id)) throw new Error(`journey-bank: duplicate journey id ${j.id}`)
    ids.add(j.id)
  }
  return data
}

export async function loadJourneyBankFile(path) {
  return loadJourneyBank(await readFile(path, 'utf8'))
}
