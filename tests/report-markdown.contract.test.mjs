import { test } from 'node:test'
import assert from 'node:assert/strict'

import { renderReportMarkdown } from '../evals/report-markdown.mjs'

const DIMENSIONS = [
  'abstention-honesty',
  'correction',
  'forgetting',
  'injection-resistance',
  'isolation',
  'temporal',
  'usefulness',
  'wrong-memory',
]

const fixture = {
  arms: [
    {
      byDimension: Object.fromEntries(DIMENSIONS.map((dimension) => [
        dimension,
        { failed: dimension === 'temporal' ? 1 : 0, passed: dimension === 'temporal' ? 0 : 1 },
      ])),
      name: 'arm-one',
      summary: {
        findings: [{
          journeyId: 'correction-example',
          knownFinding: 'history is excluded from the current briefing',
          probeId: 'p2',
          reasons: ['missing "old value"'],
        }],
      },
    },
    {
      byDimension: Object.fromEntries(DIMENSIONS.map((dimension) => [
        dimension,
        { failed: 0, passed: 2 },
      ])),
      name: 'arm-two',
      summary: { findings: [] },
    },
  ],
  version: 1,
}

test('markdown report renders every dimension, arm order, and finding detail', () => {
  const markdown = renderReportMarkdown(fixture)
  assert.ok(markdown.startsWith('# Palari Brain dry bake-off\n'))
  assert.ok(markdown.includes('| Dimension | arm-one | arm-two |'))
  for (const dimension of DIMENSIONS) {
    assert.ok(markdown.includes(`| ${dimension} |`), `${dimension} row exists`)
  }
  assert.ok(markdown.indexOf('arm-one') < markdown.indexOf('arm-two'), 'arm columns preserve input order')
  assert.ok(markdown.includes('### arm-one'))
  assert.ok(markdown.includes('`correction-example:p2`'))
  assert.ok(markdown.includes('missing "old value"'))
  assert.ok(markdown.includes('Known finding: history is excluded from the current briefing'))
  assert.match(markdown, /### arm-two[\s\S]*- None\./)
})
