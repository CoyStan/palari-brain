import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  access,
  readFile,
} from 'node:fs/promises'
import {
  dirname,
  relative,
  resolve,
} from 'node:path'
import test from 'node:test'

import {
  CANONICAL_EVIDENCE_SMOKE_AVAILABLE_USD,
  CANONICAL_EVIDENCE_SMOKE_CUMULATIVE_CAP_USD,
  CANONICAL_EVIDENCE_SMOKE_FRESH_SUBCAP_USD,
  CANONICAL_EVIDENCE_SMOKE_LIMITS,
  CANONICAL_EVIDENCE_SMOKE_OPENING_ACCOUNTED_USD,
  CANONICAL_EVIDENCE_SMOKE_OPENING_MEASURED_USD,
  CANONICAL_EVIDENCE_SMOKE_OPENING_UNCERTAIN_USD,
  CANONICAL_EVIDENCE_SMOKE_RUN_ID,
  loadCanonicalEvidenceSmokeAuthority,
  loadCanonicalEvidenceSmokeConfig,
} from '../evals/canonical-evidence-smoke-config.mjs'
import {
  CANONICAL_EVIDENCE_SMOKE_TERMINAL_RUN_IDS,
  assertCanonicalEvidenceSmokeOpen,
  auditCanonicalEvidenceTrackedArtifacts,
  canonicalEvidenceSmokeResultPaths,
  main,
  verifyCanonicalEvidenceSmokePredecessor,
} from '../evals/run-canonical-evidence-smoke.mjs'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)

test('canonical evidence smoke runner import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/run-canonical-evidence-smoke.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('fresh identity is smoke-only and has a tighter nested spend cap',
  async () => {
    const [{ config, predictions }, { authority }] =
      await Promise.all([
        loadCanonicalEvidenceSmokeConfig({ repoRoot }),
        loadCanonicalEvidenceSmokeAuthority({ repoRoot }),
      ])
    assert.equal(config.runId, CANONICAL_EVIDENCE_SMOKE_RUN_ID)
    assert.equal(config.scope.benchmarkQuestions, 0)
    assert.equal(config.scope.logicalOperations, 2)
    assert.equal(authority.benchmarkQuestions, 0)
    assert.equal(authority.logicalOperations, 2)
    assert.equal(predictions.status, 'FINAL')
    assert.equal(
      CANONICAL_EVIDENCE_SMOKE_OPENING_ACCOUNTED_USD,
      0.7724995,
    )
    assert.equal(
      CANONICAL_EVIDENCE_SMOKE_OPENING_MEASURED_USD,
      0.7699985,
    )
    assert.equal(
      CANONICAL_EVIDENCE_SMOKE_OPENING_UNCERTAIN_USD,
      0.002501,
    )
    assert.equal(
      CANONICAL_EVIDENCE_SMOKE_CUMULATIVE_CAP_USD -
        CANONICAL_EVIDENCE_SMOKE_OPENING_ACCOUNTED_USD,
      CANONICAL_EVIDENCE_SMOKE_AVAILABLE_USD,
    )
    assert.equal(CANONICAL_EVIDENCE_SMOKE_FRESH_SUBCAP_USD, 0.03)
    assert.deepEqual(
      CANONICAL_EVIDENCE_SMOKE_LIMITS.maxLogicalRequests,
      {
        answer: 1,
        judge: 1,
        writer: 1,
      },
    )
  })

test('result paths contain no question or dataset surface', () => {
  const paths = canonicalEvidenceSmokeResultPaths(
    '/tmp/palari-canonical-smoke-fixture',
  )
  assert.equal(
    paths.runDir,
    '/tmp/palari-canonical-smoke-fixture/evals/results/' +
      CANONICAL_EVIDENCE_SMOKE_RUN_ID,
  )
  assert.equal(Object.hasOwn(paths, 'datasetPath'), false)
  assert.equal(Object.hasOwn(paths, 'questionPath'), false)
})

test('terminal seal rejects both runner and successor-product drift',
  async () => {
    const { config } = await loadCanonicalEvidenceSmokeConfig({
      repoRoot,
    })
    for (const path of [
      'evals/run-canonical-evidence-smoke.mjs',
      'src/brain.mjs',
    ]) {
      const frozen = config.artifacts.find(
        (entry) => entry.path === path,
      )
      assert.ok(frozen)
      const current = await readFile(resolve(repoRoot, path))
      assert.notEqual(
        frozen.sha256,
        createHash('sha256').update(current).digest('hex'),
      )
      await assert.rejects(
        auditCanonicalEvidenceTrackedArtifacts({
          config: { artifacts: [frozen] },
          repoRoot,
        }),
        (error) => error?.code === 'SMOKE_ARTIFACT_CHANGED',
      )
    }
  })

test('frozen artifacts exclude the successor digest import graph',
  async () => {
    const { config } = await loadCanonicalEvidenceSmokeConfig({
      repoRoot,
    })
    const pending = ['evals/run-canonical-evidence-smoke.mjs']
    const reachable = new Set()
    while (pending.length) {
      const repositoryPath = pending.shift()
      if (reachable.has(repositoryPath)) continue
      reachable.add(repositoryPath)
      const source = await readFile(
        resolve(repoRoot, repositoryPath),
        'utf8',
      )
      const specifiers = []
      for (const pattern of [
        /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g,
        /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g,
      ]) {
        for (const match of source.matchAll(pattern)) {
          specifiers.push(match[1])
        }
      }
      for (const specifier of specifiers) {
        const absolute = resolve(
          repoRoot,
          dirname(repositoryPath),
          specifier,
        )
        if (!absolute.endsWith('.mjs')) continue
        const child = relative(repoRoot, absolute)
        if (!reachable.has(child)) pending.push(child)
      }
    }
    const pinned = new Set(
      config.artifacts.map((entry) => entry.path),
    )
    assert.deepEqual(
      [...reachable].filter((path) => !pinned.has(path)).sort(),
      [
        'src/memory-digest-store.mjs',
        'src/memory-reducer.mjs',
      ],
    )
  })

test('runner has no dataset, judge dispatch, or OpenAI environment read',
  async () => {
    const source = await readFile(
      new URL(
        '../evals/run-canonical-evidence-smoke.mjs',
        import.meta.url,
      ),
      'utf8',
    )
    for (const forbidden of [
      'longmemeval_s_cleaned',
      'prepareJ4PinnedS60',
      '.callJudge(',
      'env.OPENAI_API_KEY ??',
      'process.env.OPENAI_API_KEY',
    ]) {
      assert.equal(source.includes(forbidden), false)
    }
  })

test('real active-v1 predecessor evidence verifies exactly',
  async (context) => {
    try {
      await access(
        resolve(
          repoRoot,
          'evals/results/j4-active-brain-first5-v1/checkpoint.json',
        ),
      )
    } catch (error) {
      if (error?.code === 'ENOENT') {
        context.skip('private active-v1 evidence is absent')
        return
      }
      throw error
    }
    const { config } = await loadCanonicalEvidenceSmokeConfig({
      repoRoot,
    })
    const audit = await verifyCanonicalEvidenceSmokePredecessor({
      config,
      repoRoot,
    })
    assert.deepEqual(
      {
        accountedUsd: audit.accountedUsd,
        measuredUsd: audit.measuredUsd,
        runId: audit.runId,
        uncertainUsd: audit.uncertainUsd,
      },
      {
        accountedUsd: 0.7724995,
        measuredUsd: 0.7699985,
        runId: 'j4-active-brain-first5-v1',
        uncertainUsd: 0.002501,
      },
    )
  })

test('run identity is open only until its post-run seal', () => {
  if (CANONICAL_EVIDENCE_SMOKE_TERMINAL_RUN_IDS.includes(
    CANONICAL_EVIDENCE_SMOKE_RUN_ID,
  )) {
    assert.throws(
      () => assertCanonicalEvidenceSmokeOpen(
        CANONICAL_EVIDENCE_SMOKE_RUN_ID,
      ),
      (error) => error?.code === 'J4_RUN_TERMINAL',
    )
  } else {
    assert.equal(
      assertCanonicalEvidenceSmokeOpen(
        CANONICAL_EVIDENCE_SMOKE_RUN_ID,
      ),
      CANONICAL_EVIDENCE_SMOKE_RUN_ID,
    )
  }
})

test('terminal identity refuses before dependencies or environment are read',
  async () => {
    let dependencyRead = false
    let environmentRead = false
    const dependencies = new Proxy({}, {
      get() {
        dependencyRead = true
        throw new Error('dependency read after terminal seal')
      },
    })
    const env = new Proxy({}, {
      get() {
        environmentRead = true
        throw new Error('environment read after terminal seal')
      },
    })

    await assert.rejects(
      main({
        args: [
          '--run',
          CANONICAL_EVIDENCE_SMOKE_RUN_ID,
        ],
        dependencies,
        env,
      }),
      (error) => error?.code === 'J4_RUN_TERMINAL',
    )
    assert.equal(dependencyRead, false)
    assert.equal(environmentRead, false)
  })
