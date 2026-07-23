// Deterministic Markdown renderer for dry bake-off reports.

const cell = (value) => String(value ?? '')
  .replaceAll('\\', '\\\\')
  .replaceAll('|', '\\|')
  .replaceAll('\r\n', '<br>')
  .replaceAll('\n', '<br>')

export function renderReportMarkdown(report) {
  const arms = report.arms ?? []
  const dimensions = [...new Set(
    arms.flatMap((arm) => Object.keys(arm.byDimension ?? {})),
  )].sort()
  const lines = [
    '# Palari Brain dry bake-off',
    '',
    '| Dimension | ' + arms.map((arm) => cell(arm.name)).join(' | ') + ' |',
    '| --- | ' + arms.map(() => '---:').join(' | ') + ' |',
  ]

  for (const dimension of dimensions) {
    const scores = arms.map((arm) => {
      const score = arm.byDimension?.[dimension] ?? { failed: 0, passed: 0 }
      return `${score.passed}/${score.passed + score.failed}`
    })
    lines.push(`| ${cell(dimension)} | ${scores.join(' | ')} |`)
  }

  lines.push('', '## Findings')
  for (const arm of arms) {
    lines.push('', `### ${cell(arm.name)}`)
    const findings = arm.summary?.findings ?? []
    if (findings.length === 0) {
      lines.push('', '- None.')
      continue
    }
    for (const finding of findings) {
      const id = `${finding.journeyId}:${finding.probeId}`
      const reasons = (finding.reasons ?? []).map(cell).join('; ') || 'unspecified failure'
      lines.push('', `- \`${cell(id)}\` — ${reasons}`)
      if (finding.knownFinding) {
        lines.push(`  > Known finding: ${cell(finding.knownFinding)}`)
      }
    }
  }

  return `${lines.join('\n')}\n`
}
