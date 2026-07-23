// Bake-off harness (J2 seam, J1-runnable).
// Runs every journey against every arm and grades probes. Arms share
// ONE interface so dry mode feeds identical scripted candidates to
// each arm: dry mode measures memory-system behavior (governance,
// recall, correction, isolation), never extractor quality — extractor
// quality is a live (J3, founder-gated) measurement.
//
// Arm interface (all async unless noted):
//   arm.name                       string, unique per arm
//   arm.open({ palariId, userId }) fresh, empty workspace per journey
//   arm.ingestTurn(turn)           turn: { userMessage, assistantMessage,
//                                  eventAt, sourceMessageId, sourceTexts,
//                                  candidates, palariId, userId }
//   arm.forget(topic, { userId })  user-initiated topic deletion
//   arm.answer({ question, questionDate, palariId, userId })
//                                  -> { answer: string, abstained: bool }
//   arm.close()

export function gradeProbe(probe, result) {
  const answer = String(result?.answer ?? '')
  const lower = answer.toLowerCase()
  const reasons = []
  if (probe.expect === 'abstain' && result?.abstained !== true) reasons.push('expected abstain')
  if (probe.expect === 'answer' && result?.abstained !== false) reasons.push('expected an answer')
  for (const needle of probe.mustContain ?? []) {
    if (!lower.includes(needle.toLowerCase())) reasons.push(`missing "${needle}"`)
  }
  for (const needle of probe.mustNotContain ?? []) {
    if (lower.includes(needle.toLowerCase())) reasons.push(`leaked "${needle}"`)
  }
  return { pass: reasons.length === 0, reasons, answer }
}

export async function runJourney(arm, journey) {
  const { palariId, userId } = journey.workspace
  await arm.open({ palariId, userId })
  const probeResults = []
  let totalWritten = 0
  try {
    const directives = journey.directives ?? []
    for (const session of journey.sessions) {
      const turns = session.turns
      for (let i = 0; i < turns.length; i += 1) {
        if (turns[i].role !== 'user') continue
        const assistant = turns[i + 1]?.role === 'assistant' ? turns[i + 1].content : ''
        const ingest = await arm.ingestTurn({
          assistantMessage: assistant,
          candidates: turns[i].expectMemories ?? [],
          eventAt: session.eventAt,
          palariId: turns[i].asPalariId ?? palariId,
          sourceMessageId: `${session.sessionId}:${i}`,
          sourceTexts: turns[i].sourceTexts ?? [],
          userId: turns[i].asUserId ?? userId,
          userMessage: turns[i].content,
        })
        totalWritten += Number(ingest?.memoriesWritten ?? 0)
      }
      for (const d of directives.filter((x) => x.afterSession === session.sessionId)) {
        await arm.forget(d.topic, { userId: d.asUserId ?? userId })
      }
    }
    if (journey.expectTotalWritten !== undefined) {
      const pass = totalWritten === journey.expectTotalWritten
      probeResults.push({
        answer: `written=${totalWritten}`,
        dimension: 'wrong-memory',
        knownFinding: undefined,
        pass,
        probeId: '_written',
        reasons: pass ? [] : [`expected ${journey.expectTotalWritten} written, got ${totalWritten}`],
      })
    }
    for (const probe of journey.probes) {
      const result = await arm.answer({
        palariId: probe.asPalariId ?? palariId,
        question: probe.question,
        questionDate: probe.questionDate,
        userId: probe.asUserId ?? userId,
      })
      const grade = gradeProbe(probe, result)
      probeResults.push({
        answer: grade.answer,
        dimension: probe.dimension,
        knownFinding: probe.knownFinding,
        pass: grade.pass,
        probeId: probe.id,
        reasons: grade.reasons,
      })
    }
  } finally {
    await arm.close()
  }
  return { category: journey.category, journeyId: journey.id, probes: probeResults }
}

export async function runBank(arms, bank) {
  const report = { arms: [], version: 1 }
  for (const arm of arms) {
    const journeys = []
    for (const journey of bank.journeys) {
      journeys.push(await runJourney(arm, journey))
    }
    const all = journeys.flatMap((j) => j.probes)
    const byDimension = {}
    for (const p of all) {
      const d = (byDimension[p.dimension] ??= { failed: 0, passed: 0 })
      if (p.pass) d.passed += 1
      else d.failed += 1
    }
    report.arms.push({
      byDimension,
      journeys,
      name: arm.name,
      summary: {
        failedProbes: all.filter((p) => !p.pass).length,
        findings: all.filter((p) => !p.pass).map((p) => ({
          journeyId: journeys.find((j) => j.probes.includes(p)).journeyId,
          knownFinding: p.knownFinding ?? null,
          probeId: p.probeId,
          reasons: p.reasons,
        })),
        passedProbes: all.filter((p) => p.pass).length,
        totalProbes: all.length,
      },
    })
  }
  return report
}

export function renderReportLines(report) {
  const lines = []
  for (const arm of report.arms) {
    lines.push(`arm: ${arm.name} — ${arm.summary.passedProbes}/${arm.summary.totalProbes} probes pass`)
    for (const [dim, d] of Object.entries(arm.byDimension).sort()) {
      lines.push(`  ${dim}: ${d.passed}/${d.passed + d.failed}`)
    }
    for (const f of arm.summary.findings) {
      const tag = f.knownFinding ? ` [known finding: ${f.knownFinding}]` : ''
      lines.push(`  FAIL ${f.journeyId}:${f.probeId} — ${f.reasons.join('; ')}${tag}`)
    }
  }
  return lines
}
