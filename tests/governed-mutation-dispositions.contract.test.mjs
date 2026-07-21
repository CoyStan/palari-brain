import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { types as utilTypes } from 'node:util'
import { createContext, runInContext } from 'node:vm'
import { test } from 'node:test'

import * as dispositionModule from '../src/governed-mutation-dispositions.mjs'
import {
  legacyMutationEffectKinds,
  legacyMutationIntentKinds,
} from '../src/legacy-mutation-router.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY_DOCUMENT = join(
  REPO_ROOT,
  'docs/GOVERNED-MUTATION-DISPOSITION-REGISTRY.md',
)
const A2_OBLIGATIONS_DOCUMENT = join(
  REPO_ROOT,
  'docs/LEGACY-MUTATION-B2-OBLIGATIONS.md',
)
const A2_ROUTING_CONTRACT = join(
  REPO_ROOT,
  'docs/LEGACY-MUTATION-ROUTING-CONTRACT.md',
)
const B2_SCHEMA_DOCUMENT = join(REPO_ROOT, 'docs/CDX-B2-SCHEMA-CONTRACT.md')
const A2_ROUTER_TEST = join(
  REPO_ROOT,
  'tests/legacy-mutation-router.contract.test.mjs',
)
const MODULE_PATH = join(
  REPO_ROOT,
  'src/governed-mutation-dispositions.mjs',
)

const EXPECTED_EXPORTS = [
  'GOVERNED_MUTATION_DISPOSITION_VERSION',
  'evaluateGovernedMutationDisposition',
  'governedMutationDispositionRegistry',
  'verifyGovernedMutationDispositionRegistry',
]

const EXPECTED_IDS = [
  'PRE-01', 'PRE-02', 'PRE-03',
  'P-01', 'P-02', 'P-03', 'P-04', 'P-05',
  'PA-01', 'PA-02', 'PA-03', 'PA-04',
  'PX-01', 'PX-02', 'PX-03',
  'PS-01', 'PS-02', 'PS-03',
  'PD-01', 'PD-02', 'PD-03', 'PR-01',
  'D-01', 'D-02', 'D-03',
  'T-01', 'T-02', 'T-03',
  'R-01', 'R-02', 'R-03',
  'L-01', 'L-02', 'L-03', 'L-04',
  'E-01', 'E-02', 'E-03', 'E-04', 'E-05',
  'S-01', 'S-02', 'S-03',
  'F-01', 'F-02', 'F-03',
]

const EXPECTED_DIMENSIONS = [
  'route_kind',
  'proposal_kind_op',
  'legacy_type_partition',
  'actor_writer_class',
  'producer_discriminator',
  'source_evidence_acquisition_class',
  'scope_relation',
  'source_message_keyword_branch',
  'shared_input_flag',
  'id_class',
  'content_hash_class',
  'capture_validation_class',
  'confidence_threshold_relation',
  'time_class',
  'historical_metadata_class',
  'access_count_class',
  'lifecycle_scope_branch',
  'target_duplicate_branch',
  'legacy_outcome',
  'explicit_effects',
  'implicit_consequences',
  'compatibility_defect_flags',
]

function extractNormativeArtifact() {
  const markdown = readFileSync(REGISTRY_DOCUMENT, 'utf8')
  const fence = String.fromCharCode(96).repeat(3)
  const opening = fence + 'js'
  const start = markdown.indexOf(opening)
  assert.notEqual(start, -1, 'normative JavaScript artifact is missing')
  const bodyStart = start + opening.length
  const end = markdown.indexOf(fence, bodyStart)
  assert.notEqual(end, -1, 'normative JavaScript artifact is unterminated')
  return markdown.slice(bodyStart, end)
}

function loadNormativeArtifact() {
  const context = createContext({
    console: Object.freeze({ log() {} }),
    utilTypes,
  })
  const expose = [
    '',
    'globalThis.__artifact = {',
    '  REGISTRY, EXPECTED_IDS, SETS, ERASURE_IDS, TERMINAL_STORAGE_IDS,',
    '  TARGET_VALIDITY_CLASSES, MEMORY_AUTHORITY_ERRORS,',
    '  AUTHORITY_PREFLIGHT_OUTCOMES, AUTHORITY_USE_OUTCOMES,',
    '  ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES,',
    '  evaluateFinal, validateRegistry, deriveEraseTargetClass,',
    '};',
  ].join('\n')
  runInContext(
    extractNormativeArtifact() + expose,
    context,
    { filename: REGISTRY_DOCUMENT + '#test-oracle' },
  )
  return context.__artifact
}

const artifact = loadNormativeArtifact()
const registry = dispositionModule.governedMutationDispositionRegistry
const evaluate = dispositionModule.evaluateGovernedMutationDisposition
const verify = dispositionModule.verifyGovernedMutationDispositionRegistry

function jsonData(value) {
  return JSON.parse(JSON.stringify(value))
}

function gitBlobHash(path) {
  const bytes = readFileSync(path)
  const header = Buffer.from(`blob ${bytes.length}\0`)
  return createHash('sha1').update(header).update(bytes).digest('hex')
}

function assertRecursivelyFrozenData(value, label = 'value') {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertRecursivelyFrozenData(value[index], `${label}[${index}]`)
    }
    return
  }
  assert.equal(
    Object.getPrototypeOf(value),
    null,
    `${label} must have a null prototype`,
  )
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    assert.ok(descriptor && Object.hasOwn(descriptor, 'value'))
    assert.equal(descriptor.get, undefined)
    assert.equal(descriptor.set, undefined)
    assertRecursivelyFrozenData(descriptor.value, `${label}.${String(key)}`)
  }
}

function assertOracleEqual(obligationId, input) {
  let expected
  let expectedError
  let oracleInput = input
  if (input !== null && typeof input === 'object' &&
      !Array.isArray(input) && !utilTypes.isProxy(input) &&
      Object.getPrototypeOf(input) === Object.prototype) {
    oracleInput = Object.create(null)
    Object.defineProperties(
      oracleInput,
      Object.getOwnPropertyDescriptors(input),
    )
  }
  try {
    expected = artifact.evaluateFinal(obligationId, oracleInput)
  } catch (error) {
    expectedError = error
  }

  if (expectedError !== undefined) {
    assert.throws(
      () => evaluate(obligationId, input),
      (error) => error?.name === 'Error' &&
        error.message === expectedError.message,
    )
    return
  }

  const actual = evaluate(obligationId, input)
  assert.deepEqual(jsonData(actual), jsonData(expected))
  assertRecursivelyFrozenData(actual, `result ${obligationId}`)
}

function cleanErasure(overrides = {}) {
  const value = {
    syntaxValid: true,
    authorityPreflightOutcome: 'ready',
    authorityUseOutcome: 'valid',
    projectionVerified: true,
    idClass: 'normalized_target_id',
    targetMatchesGrant: true,
    actorClass: 'actor_explicit_user',
    targetExists: true,
    legacyType: 'relationship',
    validityClass: 'current',
    scopeClass: 'same_palari_same_user_private',
    sharedFlag: 'shared_0',
    incidentLinkCount: 0,
    targetBranch: 'target_private_same_scope_zero_links',
    ...overrides,
  }
  return value
}

function deriveTargetBranch(scopeClass, incidentLinkCount) {
  let family
  if (scopeClass === 'same_palari_same_user_private') {
    family = 'private_same_scope'
  } else if (scopeClass === 'same_palari_same_user_shared') {
    family = 'shared'
  } else if (scopeClass.includes('general')) {
    family = 'general'
  } else if (scopeClass.startsWith('same_palari_cross_user_')) {
    family = 'cross_user'
  } else if (scopeClass.startsWith('cross_palari_')) {
    family = 'cross_palari'
  } else {
    throw new Error('unknown test scope')
  }
  return `target_${family}_${incidentLinkCount === 0 ? 'zero_links' : 'with_links'}`
}

function expandRegistryCell(cell) {
  const variants = Array.isArray(cell) ? cell : [cell]
  return variants.flatMap((variant) => (
    variant.startsWith('@') ? registry.sets[variant.slice(1)] : [variant]
  ))
}

test('M2-B-02 namespace and version are exact', () => {
  assert.deepEqual(Object.keys(dispositionModule).sort(), EXPECTED_EXPORTS)
  assert.equal(
    dispositionModule.GOVERNED_MUTATION_DISPOSITION_VERSION,
    'CDX-M1-legacy-disposition@5',
  )
  assert.equal(registry.version, dispositionModule.GOVERNED_MUTATION_DISPOSITION_VERSION)
})

test('M2-B-02 registry is mechanically equal to the normative artifact', () => {
  assert.deepEqual(jsonData(registry), jsonData(artifact.REGISTRY))
  assertRecursivelyFrozenData(registry, 'registry')
  assert.deepEqual(Reflect.ownKeys(registry), Reflect.ownKeys(artifact.REGISTRY))
})

test('M2-B-02 normative registry, A2 blobs, and B2 MAP pins are exact', () => {
  assert.equal(
    createHash('sha256')
      .update(readFileSync(REGISTRY_DOCUMENT))
      .digest('hex'),
    '70d1d966cb8e5550c26b4ccac2b7b4193a564b0d8d7c01dfc4c92fb8b5a0df74',
  )
  assert.equal(
    gitBlobHash(A2_OBLIGATIONS_DOCUMENT),
    '33d8fa3b89e5348d3e5d624315fcd1c870ed095c',
  )
  assert.equal(
    gitBlobHash(A2_ROUTING_CONTRACT),
    'a3ad75dc78644de2329af2feb680aef559068774',
  )

  const schemaContract = readFileSync(B2_SCHEMA_DOCUMENT, 'utf8')
  const configMatch = schemaContract.match(
    /KERNEL_CONFIG_JSON_BEGIN -->\n```json\n([^\n]+)\n```/,
  )
  assert.ok(configMatch)
  const configBytes = configMatch[1]
  assert.equal(Buffer.byteLength(configBytes, 'ascii'), 5704)
  assert.equal(
    createHash('sha256').update(configBytes, 'ascii').digest('hex'),
    'e1ded27e33516d73c60da1f4a4c9cb0767b1bb0b1482e78b429449ec7c0b07f4',
  )
  const config = JSON.parse(configBytes)
  assert.deepEqual(config.specialization.mappedObligations, registry.mapAllowlist)
  assert.equal(
    config.pins.a2ObligationsBlob,
    registry.productionFixtureCrosscheck.sourceObligationsBlob,
  )
  assert.equal(
    config.pins.a2RoutingContractBlob,
    registry.productionFixtureCrosscheck.sourceRoutingContractBlob,
  )
})

test('M2-B-02 documented standalone verifier executes the normative fence', () => {
  const markdown = readFileSync(REGISTRY_DOCUMENT, 'utf8')
  const fence = String.fromCharCode(96).repeat(3)
  const opening = fence + 'js'
  const firstStart = markdown.indexOf(opening)
  const firstEnd = markdown.indexOf(fence, firstStart + opening.length)
  const secondStart = markdown.indexOf(opening, firstEnd + fence.length)
  assert.notEqual(secondStart, -1, 'standalone verifier block is missing')
  const secondBodyStart = secondStart + opening.length
  const secondEnd = markdown.indexOf(fence, secondBodyStart)
  assert.notEqual(secondEnd, -1, 'standalone verifier block is unterminated')
  const child = spawnSync(
    process.execPath,
    ['--eval', markdown.slice(secondBodyStart, secondEnd)],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30_000 },
  )
  assert.equal(
    child.status,
    0,
    `standalone verifier failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  const result = JSON.parse(child.stdout)
  assert.deepEqual(
    {
      dimensionCount: result.dimensionCount,
      erasureMatrixCaseCount: result.erasureMatrixCaseCount,
      obligationCount: result.obligationCount,
      ok: result.ok,
      stagedAuthorityCaseCount: result.stagedAuthorityCaseCount,
    },
    {
      dimensionCount: 22,
      erasureMatrixCaseCount: 1728,
      obligationCount: 46,
      ok: true,
      stagedAuthorityCaseCount: 72,
    },
  )
})

test('M2-B-02 A2 obligations, row order, and 22 coordinates remain exact', () => {
  const obligations = readFileSync(A2_OBLIGATIONS_DOCUMENT, 'utf8')
  const obligationIds = obligations
    .split('\n')
    .filter((line) => /^\| [A-Z]+-[0-9]+ \|/.test(line))
    .map((line) => line.split('|')[1].trim())
  assert.deepEqual(obligationIds, EXPECTED_IDS)
  assert.deepEqual(registry.rows.map((row) => row.id), obligationIds)
  assert.deepEqual(registry.dimensionOrder, EXPECTED_DIMENSIONS)
  assert.equal(registry.rows.length, 46)
  for (const row of registry.rows) {
    assert.equal(row.v.length, 22, `${row.id} lost a coordinate`)
    assert.equal(new Set(row.next).size, row.next.length)
    assert.equal(new Set(row.continueOutcomes).size, row.continueOutcomes.length)
  }
})

test('M2-B-02 finite sets and graph are closed, resolved, unique, and acyclic', () => {
  const ids = new Set(registry.rows.map((row) => row.id))
  const byId = new Map(registry.rows.map((row) => [row.id, row]))
  for (const [name, values] of Object.entries(registry.sets)) {
    assert.ok(values.length > 0, `${name} is empty`)
    assert.equal(new Set(values).size, values.length, `${name} has duplicates`)
    for (const value of values) {
      assert.equal(typeof value, 'string')
      assert.notEqual(value, '*')
      assert.equal(value.startsWith('@'), false)
    }
  }
  for (const row of registry.rows) {
    for (const cell of row.v) {
      const variants = Array.isArray(cell) ? cell : [cell]
      assert.ok(variants.length > 0)
      const expanded = []
      for (const variant of variants) {
        assert.equal(typeof variant, 'string')
        assert.notEqual(variant, '*')
        if (variant.startsWith('@')) {
          const setName = variant.slice(1)
          assert.equal(Object.hasOwn(registry.sets, setName), true)
          expanded.push(...registry.sets[setName])
        } else {
          expanded.push(variant)
        }
      }
      assert.equal(new Set(expanded).size, expanded.length)
    }
    for (const nextId of row.next) assert.equal(ids.has(nextId), true)
  }

  const colors = new Map()
  function visit(id) {
    const color = colors.get(id) ?? 0
    assert.notEqual(color, 1, `cycle at ${id}`)
    if (color === 2) return
    colors.set(id, 1)
    for (const nextId of byId.get(id).next) visit(nextId)
    colors.set(id, 2)
  }
  for (const id of EXPECTED_IDS) visit(id)
})

test('M2-B-02 all 496 terminal-leaf pairs are coordinate-disjoint', () => {
  const terminalRows = registry.rows.filter((row) => row.next.length === 0)
  assert.equal(terminalRows.length, 32)
  let comparisons = 0
  for (let leftIndex = 0; leftIndex < terminalRows.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < terminalRows.length;
      rightIndex += 1
    ) {
      comparisons += 1
      const left = terminalRows[leftIndex]
      const right = terminalRows[rightIndex]
      const overlaps = EXPECTED_DIMENSIONS.every((_, dimensionIndex) => {
        const leftValues = new Set(expandRegistryCell(left.v[dimensionIndex]))
        return expandRegistryCell(right.v[dimensionIndex])
          .some((value) => leftValues.has(value))
      })
      assert.equal(
        overlaps,
        false,
        `${left.id} overlaps terminal leaf ${right.id}`,
      )
    }
  }
  assert.equal(comparisons, 496)
})

test('M2-B-02 verifier reruns the complete matrix and returns detached data', () => {
  const first = verify()
  const second = verify()
  const expected = jsonData(artifact.validateRegistry())
  assert.deepEqual(jsonData(first), expected)
  assert.deepEqual(jsonData(second), expected)
  assert.notEqual(first, second)
  assert.notEqual(first.authorityActionCounts, registry.authorityActionCounts)
  assert.notEqual(first.mapAllowlist, registry.mapAllowlist)
  assertRecursivelyFrozenData(first, 'verification')
  assert.deepEqual(jsonData(first), {
    obligationCount: 46,
    dimensionCount: 22,
    reachableObligationCount: 46,
    authorityErrorCount: 13,
    authorityPreflightOutcomeCount: 6,
    authorityUseOutcomeCount: 10,
    authorityActionCounts: {
      preflightReturn: 1,
      preflightThrow: 4,
      preflightContinue: 1,
      useThrow: 9,
      useContinue: 1,
    },
    stagedAuthorityCaseCount: 72,
    erasureMatrixCaseCount: 1728,
    mapAllowlist: ['D-02', 'D-03'],
    terminalStorageGroup: ['F-01', 'F-02', 'F-03'],
    fixtureCrosscheckRequired: true,
    globalDomainSizes: [
      9, 15, 12, 14, 6, 19, 12, 9, 4, 17, 5,
      27, 6, 16, 6, 3, 3, 77, 48, 14, 9, 18,
    ],
  })
})

test('M2-B-02 closed vocabularies and MAP allowlist are exact', () => {
  assert.deepEqual(registry.dispositions, ['MAP', 'REFUSE'])
  assert.deepEqual(
    registry.actions,
    ['CONTINUE', 'RETURN', 'RETHROW', 'THROW', 'TERMINAL'],
  )
  assert.deepEqual(
    registry.recordingModes,
    ['pre_gate_no_journal', 'decision_only', 'decision_and_effects'],
  )
  assert.deepEqual(registry.mapAllowlist, ['D-02', 'D-03'])
  assert.deepEqual(registry.terminalStorageIds, ['F-01', 'F-02', 'F-03'])
  assert.equal(
    registry.rows.find((row) => row.id === 'PD-02').rule,
    'STOP_DEMOTION_UNSEALED',
  )
  assertOracleEqual('PD-02', {
    authorityPreflightOutcome: 'not_applicable',
    authorityUseOutcome: 'not_applicable',
  })
  assert.equal(evaluate('PD-02', {}).disposition, 'REFUSE')
})

test('M2-B-02 every static and continuing row matches the exact evaluator', () => {
  for (const row of registry.rows) {
    if (!row.id.startsWith('D-')) {
      assertOracleEqual(row.id, {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
      })
    }
    if (row.next.length > 0 && !row.id.startsWith('D-')) {
      const input = {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
        compatibilityOutcome: row.continueOutcomes[0],
      }
      if (row.id === 'PRE-03') input.routeKind = 'legacy_proposal'
      assertOracleEqual(row.id, input)
    }
  }
  assert.throws(() => evaluate('UNKNOWN', {}), {
    name: 'Error',
    message: 'unknown obligation id',
  })
})

test('M2-B-02 all 64 generic outcomes are closed and structural faults fail', () => {
  const genericRows = registry.rows.filter((row) => (
    !row.id.startsWith('D-') && !row.id.startsWith('F-')
  ))
  assert.equal(genericRows.length, 40)
  let validOutcomeCases = 0
  for (const row of genericRows) {
    const outcomes = [...new Set([
      ...expandRegistryCell(row.v[18]),
      ...row.continueOutcomes,
    ])]
    for (const compatibilityOutcome of outcomes) {
      const input = {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
        compatibilityOutcome,
      }
      if (row.id === 'PRE-03' && compatibilityOutcome === 'captured_intent') {
        input.routeKind = 'legacy_proposal'
      }
      assertOracleEqual(row.id, input)
      validOutcomeCases += 1
    }

    assertOracleEqual(row.id, { compatibilityOutcome: undefined })
    assertOracleEqual(row.id, { compatibilityOutcome: 'unknown_outcome' })

    let accessorObservations = 0
    const accessorInput = {}
    Object.defineProperty(accessorInput, 'compatibilityOutcome', {
      get() {
        accessorObservations += 1
        throw new Error('compatibility accessor must not run')
      },
    })
    assert.throws(
      () => evaluate(row.id, accessorInput),
      { name: 'Error', message: 'unknown compatibility outcome' },
    )
    assert.equal(accessorObservations, 0)

    let inheritedObservations = 0
    const inheritedInput = Object.create(Object.defineProperty(
      {},
      'compatibilityOutcome',
      {
        get() {
          inheritedObservations += 1
          throw new Error('inherited compatibility outcome was observed')
        },
      },
    ))
    inheritedInput.authorityPreflightOutcome = 'not_applicable'
    inheritedInput.authorityUseOutcome = 'not_applicable'
    assert.throws(
      () => evaluate(row.id, inheritedInput),
      {
        name: 'Error',
        message: 'disposition input must have an ordinary or null prototype',
      },
    )
    assert.equal(inheritedObservations, 0)
  }
  assert.equal(validOutcomeCases, 64)

  for (const invalid of [null, 'record', [], 1, true]) {
    assert.throws(
      () => evaluate('PRE-01', invalid),
      (error) => error instanceof Error,
    )
  }

  const genericBase = {
    authorityPreflightOutcome: 'not_applicable',
    authorityUseOutcome: 'not_applicable',
  }
  const genericWithSymbol = {...genericBase}
  genericWithSymbol[Symbol('extra')] = true
  for (const invalid of [
    Object.assign(Object.create({marker: true}), genericBase),
    {...genericBase, extra: true},
    genericWithSymbol,
  ]) {
    assertOracleEqual('PRE-01', invalid)
    assert.throws(() => evaluate('PRE-01', invalid), (error) =>
      error instanceof Error)
  }
})

test('M2-B-02 five captured A2 intent fixtures bind to exact route entries', () => {
  const intentFixtures = [
    {
      kind: 'legacy_proposal',
      keys: [
        'intentKind', 'nativeWallTime', 'op', 'policy', 'producer',
        'proposalKind', 'provenance', 'record', 'scope', 'storeTime', 'target',
      ],
      entry: ['P-01', 'P-02'],
    },
    {
      kind: 'legacy_delete_memory',
      keys: ['intentKind', 'actor', 'id'],
      entry: ['D-01'],
    },
    {
      kind: 'legacy_forget_topic',
      keys: ['intentKind', 'actor', 'palariId', 'query', 'userId'],
      entry: ['T-01'],
    },
    {
      kind: 'legacy_record_recall_inclusion',
      keys: ['intentKind', 'actor', 'bumpAmount', 'memoryIds', 'storeTime'],
      entry: ['R-01'],
    },
    {
      kind: 'legacy_run_lifecycle',
      keys: ['intentKind', 'now', 'palariId'],
      entry: ['L-01'],
    },
  ]
  assert.deepEqual(intentFixtures.map((fixture) => fixture.kind), [
    ...legacyMutationIntentKinds,
  ])
  assert.deepEqual(
    registry.sets.PUBLIC_MUTATION_ROUTES.slice(0, 5),
    legacyMutationIntentKinds,
  )

  const a2TestSource = readFileSync(A2_ROUTER_TEST, 'utf8')
    .replace(/\s+/g, '')
  for (const fixture of intentFixtures) {
    assert.deepEqual(registry.routeEntryRows[fixture.kind], fixture.entry)
    for (const entryId of fixture.entry) {
      const entry = registry.rows.find((row) => row.id === entryId)
      assert.deepEqual(expandRegistryCell(entry.v[0]), [fixture.kind])
    }
    const keyFixture = fixture.keys.map((key) => `'${key}'`).join(',')
    const exactFixture = a2TestSource.includes(`[${keyFixture}]`)
      || a2TestSource.includes(`[${keyFixture},]`)
    assert.equal(
      exactFixture,
      true,
      `${fixture.kind} lost its certified capture fixture`,
    )
  }
})

test('M2-B-02 17 A2 outcome/effect/consequence correlations are exact', () => {
  const correlations = {
    'PA-01': [['inserted'], ['cdx_memory_insert'], ['fts_insert_trigger']],
    'PA-02': [['duplicate_bumped'], ['cdx_memory_set_importance'], ['consequences_none']],
    'PA-03': [['duplicate_bumped'], ['cdx_memory_set_importance'], ['consequences_none']],
    'PX-01': [['superseded'], ['cdx_memory_end_validity_then_insert_then_link'], ['fts_insert_trigger']],
    'PX-02': [['duplicate_bumped'], ['cdx_memory_set_importance'], ['consequences_none']],
    'PX-03': [['inserted'], ['cdx_memory_insert'], ['fts_insert_trigger']],
    'PS-03': [['superseded'], ['cdx_memory_end_validity_then_insert_then_link'], ['fts_insert_trigger']],
    'PD-02': [['demoted'], ['cdx_memory_end_validity'], ['consequences_none']],
    'PD-03': [
      ['missing_target', 'not_transient', 'demoted'],
      ['effects_none', 'cdx_memory_delete'],
      [
        'consequences_none',
        'fts_delete_zero_incident_links',
        'fts_delete_one_or_more_incident_links',
      ],
    ],
    'PR-01': [
      ['missing_target', 'ratified'],
      ['effects_none', 'cdx_memory_set_shared'],
      ['consequences_none'],
    ],
    'D-02': [
      ['deleted', 'permanent_type_protected'],
      ['cdx_memory_delete', 'effects_none'],
      [
        'fts_delete_zero_incident_links',
        'fts_delete_one_or_more_incident_links',
        'consequences_none',
      ],
    ],
    'D-03': [
      ['deleted'],
      ['cdx_memory_delete'],
      ['fts_delete_zero_incident_links', 'fts_delete_one_or_more_incident_links'],
    ],
    'T-03': [
      ['topic_forgotten'],
      ['zero_or_more_ordered_cdx_memory_delete'],
      [
        'consequences_none',
        'per_delete_fts_delete_zero_incident_links',
        'per_delete_fts_delete_one_or_more_incident_links',
      ],
    ],
    'R-02': [
      ['recall_recorded'],
      ['per_present_touch_then_set_importance'],
      ['consequences_none'],
    ],
    'L-01': [
      ['lifecycle_ran'],
      ['per_selected_row_effects'],
      ['consequences_none'],
    ],
    'L-03': [['decayed'], ['cdx_memory_decay'], ['consequences_none']],
    'L-04': [
      ['deleted'],
      ['cdx_memory_delete'],
      ['fts_delete_zero_incident_links', 'fts_delete_one_or_more_incident_links'],
    ],
  }
  const decomposition = {
    effects_none: [],
    cdx_memory_insert: ['cdx_memory_insert'],
    cdx_memory_end_validity: ['cdx_memory_end_validity'],
    cdx_memory_set_shared: ['cdx_memory_set_shared'],
    cdx_memory_set_importance: ['cdx_memory_set_importance'],
    cdx_memory_decay: ['cdx_memory_decay'],
    cdx_memory_delete: ['cdx_memory_delete'],
    cdx_memory_end_validity_then_insert_then_link: [
      'cdx_memory_end_validity',
      'cdx_memory_insert',
      'cdx_link_insert',
    ],
    per_present_touch_then_set_importance: [
      'cdx_memory_touch',
      'cdx_memory_set_importance',
    ],
    zero_or_more_ordered_cdx_memory_delete: ['cdx_memory_delete'],
    per_selected_row_effects: ['cdx_memory_decay', 'cdx_memory_delete'],
  }
  const decomposedEffects = new Set()
  for (const [id, expected] of Object.entries(correlations)) {
    const row = registry.rows.find((candidate) => candidate.id === id)
    const actual = [18, 19, 20].map((index) => expandRegistryCell(row.v[index]))
    assert.deepEqual(actual, expected, `${id} lost an A2 correlation`)
    for (const symbol of actual[1]) {
      assert.equal(Object.hasOwn(decomposition, symbol), true, `${id}: ${symbol}`)
      for (const effect of decomposition[symbol]) decomposedEffects.add(effect)
    }
  }
  assert.deepEqual(
    [...decomposedEffects].sort(),
    [...legacyMutationEffectKinds].sort(),
  )
})

test('M2-B-02 all eight producer-result projections retain exact A2 shapes', () => {
  const producers = {
    'E-01': {
      next: [], continueOutcomes: [],
      projection: [
        'legacy_extraction_pass', 'extraction_producer',
        '@EXTRACTION_SKIP_SOURCE_CLASSES', 'extractor_skip_or_drop',
        'exact_three_key_skip_or_drop', 'effects_none', 'consequences_none',
        'producer_receipt_incomplete',
      ],
    },
    'E-02': {
      next: [], continueOutcomes: [],
      projection: [
        'legacy_extraction_pass', 'extraction_candidate',
        '@VALID_EXTRACTION_SOURCE_CLASSES',
        'transient_detail_or_source_boundary_drop',
        'completed_no_write_count', 'effects_none', 'consequences_none',
        'producer_receipt_incomplete',
      ],
    },
    'E-03': {
      next: ['P-03'], continueOutcomes: ['candidate_routed'],
      projection: [
        'legacy_extraction_pass', 'extraction_candidate', '@SOURCE_CLASSES',
        'candidate_admission_rejection',
        'rejected_outcome_reasons_discarded_later_continue',
        'effects_none', 'consequences_none', 'producer_receipt_incomplete',
      ],
    },
    'E-04': {
      next: ['PA-01', 'PA-02', 'PX-01', 'PX-02', 'PX-03'],
      continueOutcomes: ['candidate_routed'],
      projection: [
        'legacy_extraction_pass', 'extraction_candidate',
        '@VALID_EXTRACTION_SOURCE_CLASSES',
        ['candidate_insert', 'candidate_duplicate', 'candidate_supersede'],
        ['inserted', 'duplicate_bumped', 'superseded'],
        [
          'cdx_memory_insert',
          'cdx_memory_set_importance',
          'cdx_memory_end_validity_then_insert_then_link',
        ],
        ['fts_insert_trigger', 'consequences_none'],
        'producer_receipt_incomplete',
      ],
    },
    'E-05': {
      next: [], continueOutcomes: [],
      projection: [
        'legacy_extraction_pass', 'extraction_candidate',
        '@VALID_EXTRACTION_SOURCE_CLASSES', 'candidate_capture_or_apply_throw',
        'pass_rejects_after_earlier_candidate_commits',
        'zero_or_more_previously_committed_candidate_effects',
        'zero_or_more_previously_committed_trigger_fk_consequences',
        'producer_receipt_incomplete',
      ],
    },
    'S-01': {
      next: [], continueOutcomes: [],
      projection: [
        'legacy_summary_pass', 'session_summary', '@SUMMARY_SKIP_SOURCE_CLASSES',
        'summary_skip', 'exact_reason_source_boundary_status', 'effects_none',
        'consequences_none', 'summary_lineage_incomplete',
      ],
    },
    'S-02': {
      next: ['P-03', 'PA-01', 'PA-02'],
      continueOutcomes: ['summary_routed'],
      projection: [
        'legacy_summary_pass', 'session_summary', 'summary_summarized',
        ['summary_insert', 'summary_duplicate', 'summary_rejected'],
        ['inserted', 'duplicate_bumped', 'rejected'],
        ['effects_none', 'cdx_memory_insert', 'cdx_memory_set_importance'],
        ['consequences_none', 'fts_insert_trigger'],
        'summary_lineage_incomplete',
      ],
    },
    'S-03': {
      next: [], continueOutcomes: [],
      projection: [
        'legacy_scheduler_turn', 'scheduler_summary', 'not_applicable',
        'session_summary_disabled', 'synthetic_session_summary_disabled_skip',
        'effects_none', 'consequences_none', 'summary_lineage_incomplete',
      ],
    },
  }
  assert.deepEqual(Object.keys(producers), [
    'E-01', 'E-02', 'E-03', 'E-04', 'E-05', 'S-01', 'S-02', 'S-03',
  ])
  const indices = [0, 4, 5, 17, 18, 19, 20, 21]
  for (const [id, expected] of Object.entries(producers)) {
    const row = registry.rows.find((candidate) => candidate.id === id)
    assert.deepEqual(row.next, expected.next)
    assert.deepEqual(row.continueOutcomes, expected.continueOutcomes)
    assert.deepEqual(indices.map((index) => row.v[index]), expected.projection)
  }

  const obligationLines = new Map(
    readFileSync(A2_OBLIGATIONS_DOCUMENT, 'utf8')
      .split('\n')
      .filter((line) => /^\| [ES]-[0-9]+ \|/.test(line))
      .map((line) => [line.split('|')[1].trim(), line]),
  )
  const proseMarkers = {
    'E-01': ['exact three-key skip/drop'],
    'E-02': ['completed outcome entry; no write count'],
    'E-03': ['reasons discarded; later candidates continue'],
    'E-04': ['insert/duplicate/supersede', 'insert/supersede count only'],
    'E-05': ['pass rejects after earlier candidate commits'],
    'S-01': ['{reason,sourceBoundary,status}'],
    'S-02': ['{outcome,sourceBoundary,status}', 'reasons not surfaced'],
    'S-03': ["session_summary_disabled',status:'skipped"],
  }
  for (const [id, markers] of Object.entries(proseMarkers)) {
    for (const marker of markers) {
      assert.equal(obligationLines.get(id).includes(marker), true, `${id}: ${marker}`)
    }
  }
})

test('M2-B-02 authority preflight, capture, and use precedence is exact', () => {
  let stagedCases = 0
  let observedLater = 0
  const absent = { authorityPreflightOutcome: 'absent' }
  for (const key of [
    'compatibilityOutcome',
    'syntaxValid',
    'authorityUseOutcome',
    'projectionVerified',
  ]) {
    Object.defineProperty(absent, key, {
      get() {
        observedLater += 1
        throw new Error('later phase observed')
      },
    })
  }
  for (const rowId of ['D-01', 'D-02', 'D-03']) {
    assertOracleEqual(rowId, absent)
    stagedCases += 1
  }
  assert.equal(observedLater, 0)

  const preflightThrows = [
    'authority_grant_invalid',
    'authority_grant_unavailable',
    'authority_grant_expired',
    'authority_scope_mismatch',
  ]
  for (const outcome of preflightThrows) {
    for (const rowId of ['D-01', 'D-02', 'D-03']) {
      assertOracleEqual(rowId, {
        authorityPreflightOutcome: outcome,
        syntaxValid: false,
        authorityUseOutcome: 'valid',
        projectionVerified: false,
      })
      stagedCases += 1
    }
  }

  for (const outcome of registry.authorityUseOutcomes) {
    for (const rowId of ['D-01', 'D-02', 'D-03']) {
      assertOracleEqual(rowId, {
        authorityPreflightOutcome: 'ready',
        syntaxValid: false,
        authorityUseOutcome: outcome,
        projectionVerified: false,
      })
      stagedCases += 1
    }
  }

  for (const outcome of registry.authorityUseOutcomes.filter(
    (candidate) => candidate !== 'valid',
  )) {
    for (const rowId of ['D-01', 'D-02', 'D-03']) {
      assertOracleEqual(rowId, {
        authorityPreflightOutcome: 'ready',
        syntaxValid: true,
        authorityUseOutcome: outcome,
        projectionVerified: false,
      })
      stagedCases += 1
    }
  }
  assert.equal(stagedCases, 72)
})

test('M2-B-02 impossible cross-phase authority combinations are rejected', () => {
  const rowIds = ['D-01', 'D-02', 'D-03']
  const wrongPreflight = [
    'legacy_store_closed',
    'authority_root_revoked',
    'authority_grant_mismatch',
    'authority_ledger_unavailable',
    'authority_ledger_protocol',
    'authority_clock_invalid',
    'valid',
    ...registry.rootOrIssuanceOnlyAuthorityCodes,
  ]
  const wrongUse = [
    'absent',
    'ready',
    'authority_grant_invalid',
    ...registry.rootOrIssuanceOnlyAuthorityCodes,
  ]
  let impossibleCases = 0
  for (const rowId of rowIds) {
    for (const outcome of wrongPreflight) {
      assertOracleEqual(rowId, { authorityPreflightOutcome: outcome })
      impossibleCases += 1
    }
    for (const outcome of wrongUse) {
      assertOracleEqual(rowId, {
        authorityPreflightOutcome: 'ready',
        syntaxValid: true,
        authorityUseOutcome: outcome,
      })
      impossibleCases += 1
    }
    for (const input of [
      { authorityPreflightOutcome: 'not_applicable' },
      {
        authorityPreflightOutcome: 'ready',
        syntaxValid: true,
        authorityUseOutcome: 'not_applicable',
      },
      {},
      {
        authorityPreflightOutcome: 'ready',
        syntaxValid: true,
      },
      { authorityPreflightOutcome: 'unknown_authority_phase' },
      {
        authorityPreflightOutcome: 'ready',
        syntaxValid: true,
        authorityUseOutcome: 'unknown_authority_phase',
      },
    ]) {
      assertOracleEqual(rowId, input)
      impossibleCases += 1
    }
  }
  assert.equal(impossibleCases, 72)

  for (const rowId of ['PRE-01', 'P-03', 'E-04', 'S-02']) {
    assertOracleEqual(rowId, { authorityPreflightOutcome: 'ready' })
    assertOracleEqual(rowId, { authorityUseOutcome: 'valid' })
  }
})

test('M2-B-02 target erasure matrix is exhaustive and only clean D-02/D-03 map', () => {
  const families = [
    ['D-02', registry.sets.PERMANENT_TYPES],
    ['D-03', registry.sets.TRANSIENT_TYPES],
  ]
  let cases = 0
  for (const [rowId, legacyTypes] of families) {
    for (const legacyType of legacyTypes) {
      for (const actorClass of registry.sets.VALID_ACTORS) {
        for (const scopeClass of registry.sets.TARGET_SCOPE_CLASSES) {
          let sharedFlags = ['shared_0', 'shared_1']
          if (scopeClass.endsWith('_private')) sharedFlags = ['shared_0']
          if (scopeClass.endsWith('_shared')) sharedFlags = ['shared_1']
          for (const sharedFlag of sharedFlags) {
            for (const incidentLinkCount of [0, 1]) {
              for (const validityClass of ['current', 'ended']) {
                const input = cleanErasure({
                  actorClass,
                  legacyType,
                  scopeClass,
                  sharedFlag,
                  incidentLinkCount,
                  validityClass,
                  targetBranch: deriveTargetBranch(
                    scopeClass,
                    incidentLinkCount,
                  ),
                })
                assertOracleEqual(rowId, input)
                const result = evaluate(rowId, input)
                const maps = scopeClass ===
                  'same_palari_same_user_private' && incidentLinkCount === 0
                assert.equal(result.disposition, maps ? 'MAP' : 'REFUSE')
                cases += 1
              }
            }
          }
        }
      }
    }
  }
  assert.equal(cases, 1728)
})

test('M2-B-02 projection integrity precedes missing, scope, shared, and links', () => {
  for (const [rowId, input] of [
    ['D-01', cleanErasure({
      targetExists: false,
      projectionVerified: false,
    })],
    ['D-02', cleanErasure({
      projectionVerified: false,
      scopeClass: 'same_palari_cross_user_private',
      targetBranch: 'target_cross_user_zero_links',
    })],
    ['D-03', cleanErasure({
      legacyType: 'working',
      projectionVerified: false,
      incidentLinkCount: 1,
      targetBranch: 'target_private_same_scope_with_links',
    })],
  ]) {
    assertOracleEqual(rowId, input)
  }

  assertOracleEqual('D-01', cleanErasure({ targetExists: false }))
  assertOracleEqual('D-01', cleanErasure())
  assertOracleEqual('D-01', cleanErasure({ legacyType: 'working' }))
  assertOracleEqual('D-02', cleanErasure({
    scopeClass: 'same_palari_same_user_shared',
    sharedFlag: 'shared_1',
    targetBranch: 'target_shared_zero_links',
  }))
  assertOracleEqual('D-02', cleanErasure({
    scopeClass: 'same_palari_cross_user_private',
    targetBranch: 'target_cross_user_zero_links',
  }))
  assertOracleEqual('D-02', cleanErasure({
    incidentLinkCount: 1,
    targetBranch: 'target_private_same_scope_with_links',
  }))
})

test('M2-B-02 malformed erasure coordinates can never become policy results', () => {
  const malformed = [
    ['D-01', cleanErasure({
      idClass: 'target_id_empty',
      targetExists: false,
    })],
    ['D-01', cleanErasure({ targetMatchesGrant: false })],
    ['D-01', cleanErasure({ actorClass: 'actor_missing' })],
    ['D-01', cleanErasure({ targetExists: null })],
    ['D-01', cleanErasure({ legacyType: 'unknown_type' })],
    ['D-02', cleanErasure({ targetExists: false })],
    ['D-02', cleanErasure({ legacyType: 'working' })],
    ['D-03', cleanErasure({ legacyType: 'relationship' })],
    ['D-02', cleanErasure({ validityClass: 'future' })],
    ['D-02', cleanErasure({
      scopeClass: 'unknown_scope',
      targetBranch: 'target_unknown_zero_links',
    })],
    ['D-02', cleanErasure({ sharedFlag: 'shared_1' })],
    ['D-02', cleanErasure({
      scopeClass: 'same_palari_same_user_shared',
      sharedFlag: 'shared_0',
      targetBranch: 'target_shared_zero_links',
    })],
    ['D-02', cleanErasure({ sharedFlag: 'shared_unknown' })],
    ['D-02', cleanErasure({ incidentLinkCount: -1 })],
    ['D-02', cleanErasure({ incidentLinkCount: 0.5 })],
    ['D-02', cleanErasure({ incidentLinkCount: Number.MAX_SAFE_INTEGER + 1 })],
    ['D-02', cleanErasure({ incidentLinkCount: '0' })],
    ['D-02', cleanErasure({ targetBranch: 'target_cross_user_zero_links' })],
  ]
  for (const [rowId, input] of malformed) {
    assertOracleEqual(rowId, input)
    assert.throws(() => evaluate(rowId, input), (error) => error instanceof Error)
  }

  const missingSyntax = cleanErasure()
  delete missingSyntax.syntaxValid
  for (const syntaxValid of [undefined, null, 0, 'false', {}]) {
    const input = cleanErasure({syntaxValid})
    assertOracleEqual('D-02', input)
    assert.throws(() => evaluate('D-02', input), (error) =>
      error instanceof Error)
  }
  assertOracleEqual('D-02', missingSyntax)
  assert.throws(() => evaluate('D-02', missingSyntax), (error) =>
    error instanceof Error)

  const clean = cleanErasure()
  const withSymbol = {...clean}
  withSymbol[Symbol('extra')] = true
  for (const invalid of [
    Object.assign(Object.create({marker: true}), clean),
    {...clean, extra: true},
    withSymbol,
  ]) {
    assertOracleEqual('D-02', invalid)
    assert.throws(() => evaluate('D-02', invalid), (error) =>
      error instanceof Error)
  }
})

test('M2-B-02 terminal storage and producer route groups are exact', () => {
  let observations = 0
  const hostile = new Proxy({}, {
    get() {
      observations += 1
      throw new Error('terminal input observed')
    },
    ownKeys() {
      observations += 1
      throw new Error('terminal keys observed')
    },
  })
  for (const id of ['F-01', 'F-02', 'F-03']) {
    const result = evaluate(id, hostile)
    assert.equal(result.errorCode, 'legacy_terminal_storage_refused')
    assert.deepEqual(result.coveredObligationIds, ['F-01', 'F-02', 'F-03'])
  }
  assert.equal(observations, 0)

  for (const routeKind of registry.sets.PUBLIC_MUTATION_ROUTES) {
    const result = evaluate('PRE-03', {
      authorityPreflightOutcome: 'not_applicable',
      authorityUseOutcome: 'not_applicable',
      compatibilityOutcome: 'captured_intent',
      routeKind,
    })
    if (routeKind === 'legacy_delete_kernel_store_file') {
      assert.equal(result.errorCode, 'legacy_terminal_storage_refused')
    } else {
      assert.deepEqual(result.next, registry.routeEntryRows[routeKind])
    }
  }
  assert.deepEqual(
    evaluate('PRE-03', {
      authorityPreflightOutcome: 'not_applicable',
      authorityUseOutcome: 'not_applicable',
      compatibilityOutcome: 'captured_intent',
      routeKind: 'legacy_extraction_pass',
    }).next,
    ['E-01', 'E-02', 'E-03', 'E-04', 'E-05'],
  )

  let routeCoercions = 0
  const coerciveRoute = {
    [Symbol.toPrimitive]() {
      routeCoercions += 1
      return 'legacy_extraction_pass'
    },
  }
  const coerciveInput = {
    authorityPreflightOutcome: 'not_applicable',
    authorityUseOutcome: 'not_applicable',
    compatibilityOutcome: 'captured_intent',
    routeKind: coerciveRoute,
  }
  assertOracleEqual('PRE-03', coerciveInput)
  assert.throws(() => evaluate('PRE-03', coerciveInput), (error) =>
    error instanceof Error)
  assert.equal(routeCoercions, 0)
})

test('M2-B-02 post-import primordial poisoning cannot mint MAP or corrupt proof', () => {
  const moduleUrl = new URL(
    '../src/governed-mutation-dispositions.mjs',
    import.meta.url,
  ).href
  const source = `
    const dispositionModule = await import(${JSON.stringify(moduleUrl)})
    const evaluate = dispositionModule.evaluateGovernedMutationDisposition
    const verify = dispositionModule.verifyGovernedMutationDispositionRegistry

    const NativeArray = Array
    const NativeError = Error
    const NativeJSON = JSON
    const NativeMap = Map
    const NativeNumber = Number
    const NativeObject = Object
    const NativeReflect = Reflect
    const NativeSet = Set
    const NativeString = String
    const NativeSymbol = Symbol
    const defineProperty = Object.defineProperty
    const deleteProperty = Reflect.deleteProperty
    const objectIsFrozen = Object.isFrozen
    const objectGetPrototypeOf = Object.getPrototypeOf
    const writeOut = process.stdout.write.bind(process.stdout)
    const writeError = process.stderr.write.bind(process.stderr)

    const clean = {
      syntaxValid: true,
      authorityPreflightOutcome: 'ready',
      authorityUseOutcome: 'valid',
      projectionVerified: true,
      idClass: 'normalized_target_id',
      targetMatchesGrant: true,
      actorClass: 'actor_explicit_user',
      targetExists: true,
      legacyType: 'relationship',
      validityClass: 'current',
      scopeClass: 'same_palari_same_user_private',
      sharedFlag: 'shared_0',
      incidentLinkCount: 0,
      targetBranch: 'target_private_same_scope_zero_links',
    }
    const invalidActor = {...clean, actorClass: 'actor_attacker'}
    const invalidType = {...clean, legacyType: 'unknown_type'}
    const invalidValidity = {...clean, validityClass: 'unknown_validity'}
    const invalidLinks = {
      ...clean,
      incidentLinkCount: Number.NaN,
      targetBranch: 'target_private_same_scope_with_links',
    }
    const shared = {
      ...clean,
      scopeClass: 'same_palari_same_user_shared',
      sharedFlag: 'shared_1',
      targetBranch: 'target_shared_zero_links',
    }
    const crossScope = {
      ...clean,
      scopeClass: 'same_palari_cross_user_private',
      targetBranch: 'target_cross_user_zero_links',
    }
    const coordinateKeys = [
      'syntaxValid', 'authorityPreflightOutcome', 'authorityUseOutcome',
      'projectionVerified', 'idClass', 'targetMatchesGrant', 'actorClass',
      'targetExists', 'legacyType', 'validityClass', 'scopeClass',
      'sharedFlag', 'incidentLinkCount', 'targetBranch',
    ]
    const missingOwnCoordinates = []
    for (let index = 0; index < coordinateKeys.length; index += 1) {
      const draft = {...clean}
      delete draft[coordinateKeys[index]]
      missingOwnCoordinates.push(draft)
    }
    const inheritedCoordinates = {}
    let proxyObservations = 0
    const proxyCoordinates = new Proxy({}, {
      get(_target, key) {
        proxyObservations += 1
        return clean[key]
      },
      getOwnPropertyDescriptor(_target, key) {
        proxyObservations += 1
        return {
          configurable: true,
          enumerable: true,
          value: clean[key],
          writable: true,
        }
      },
      has() { proxyObservations += 1; return true },
      ownKeys() { proxyObservations += 1; return coordinateKeys },
    })
    const inheritedRouteInput = {
      authorityPreflightOutcome: 'not_applicable',
      authorityUseOutcome: 'not_applicable',
      compatibilityOutcome: 'captured_intent',
    }
    let terminalObservations = 0
    const hostileTerminal = new Proxy({}, {
      get() { terminalObservations += 1; throw new NativeError('observed get') },
      ownKeys() { terminalObservations += 1; throw new NativeError('observed keys') },
    })
    let accessorObservations = 0
    const accessorInput = {
      authorityPreflightOutcome: 'not_applicable',
      authorityUseOutcome: 'not_applicable',
    }
    defineProperty(accessorInput, 'compatibilityOutcome', {
      get() {
        accessorObservations += 1
        return 'proposal_structurally_valid'
      },
    })
    let authorityAccessorObservations = 0
    const authorityAccessorInput = {}
    defineProperty(authorityAccessorInput, 'authorityPreflightOutcome', {
      get() {
        authorityAccessorObservations += 1
        return 'not_applicable'
      },
    })

    let poisonCalls = 0
    const poison = function poison() {
      poisonCalls += 1
      throw new NativeError('poisoned primordial dispatch')
    }
    for (let index = 0; index < coordinateKeys.length; index += 1) {
      const key = coordinateKeys[index]
      defineProperty(NativeObject.prototype, key, {
        configurable: true,
        enumerable: false,
        value: clean[key],
        writable: true,
      })
    }
    defineProperty(NativeObject.prototype, 'routeKind', {
      configurable: true,
      enumerable: false,
      value: 'legacy_extraction_pass',
      writable: true,
    })
    let numericPrototypeCalls = 0
    defineProperty(NativeArray.prototype, '0', {
      configurable: true,
      get() {
        numericPrototypeCalls += 1
        return '__inherited_array_zero__'
      },
      set(value) {
        numericPrototypeCalls += 1
        defineProperty(this, '0', {
          configurable: true,
          enumerable: true,
          value,
          writable: true,
        })
      },
    })
    defineProperty(NativeObject.prototype, 'toJSON', {
      configurable: true,
      value: poison,
    })
    defineProperty(NativeObject.prototype, 'return', {
      configurable: true,
      value: poison,
    })
    defineProperty(NativeArray.prototype, 'toJSON', {
      configurable: true,
      value: poison,
    })
    const arrayMethods = [
      'every', 'filter', 'find', 'flatMap', 'forEach', 'includes', 'map',
      'pop', 'push', 'some',
    ]
    for (let index = 0; index < arrayMethods.length; index += 1) {
      NativeArray.prototype[arrayMethods[index]] = poison
    }
    NativeArray.prototype[NativeSymbol.iterator] = poison
    NativeArray.prototype.constructor = {[NativeSymbol.species]: poison}
    const stringMethods = ['endsWith', 'includes', 'slice', 'startsWith']
    for (let index = 0; index < stringMethods.length; index += 1) {
      NativeString.prototype[stringMethods[index]] = poison
    }
    NativeSet.prototype.add = poison
    NativeSet.prototype.has = poison
    defineProperty(NativeSet.prototype, 'size', {
      configurable: true,
      get: poison,
    })
    NativeMap.prototype.get = poison
    NativeMap.prototype.set = poison
    NativeNumber.isSafeInteger = poison
    NativeArray.isArray = poison
    NativeObject.create = poison
    NativeObject.entries = poison
    NativeObject.freeze = poison
    NativeObject.getOwnPropertyDescriptor = poison
    NativeObject.getPrototypeOf = poison
    NativeObject.hasOwn = poison
    NativeObject.keys = poison
    NativeObject.values = poison
    NativeReflect.apply = poison
    NativeReflect.defineProperty = poison
    NativeReflect.getOwnPropertyDescriptor = poison
    NativeReflect.getPrototypeOf = poison
    NativeReflect.ownKeys = poison
    NativeJSON.stringify = poison
    defineProperty(NativeError, NativeSymbol.hasInstance, {
      configurable: true,
      value: poison,
    })
    NativeObject.defineProperty = poison
    globalThis.Array = poison
    globalThis.Error = poison
    globalThis.Map = poison
    globalThis.Number = poison
    globalThis.Object = poison
    globalThis.Proxy = poison
    globalThis.Set = poison
    globalThis.String = poison
    globalThis.Symbol = poison

    function rejects(callback) {
      try {
        callback()
        return false
      } catch {
        return true
      }
    }

    function maps(callback) {
      try {
        return callback().disposition === 'MAP'
      } catch {
        return false
      }
    }

    let mapResult
    let sharedResult
    let crossResult
    let staticResult
    let continueResult
    let routeResult
    let terminalResult
    let verificationA
    let verificationB
    let invalidActorRejected
    let invalidTypeRejected
    let invalidValidityRejected
    let invalidLinksRejected
    let unknownOutcomeRejected
    let accessorRejected
    let authorityAccessorRejected
    let inheritedCoordinatesRejected
    let missingOwnCoordinateMapped
    let proxyCoordinatesRejected
    let genericProxyRejected
    let inheritedRouteRejected
    let fatal = false
    let stage = 'clean map'
    try {
      mapResult = evaluate('D-02', clean)
      stage = 'invalid erasures'
      invalidActorRejected = rejects(() => evaluate('D-02', invalidActor))
      invalidTypeRejected = rejects(() => evaluate('D-02', invalidType))
      invalidValidityRejected = rejects(() => evaluate('D-02', invalidValidity))
      invalidLinksRejected = rejects(() => evaluate('D-02', invalidLinks))
      stage = 'record integrity'
      inheritedCoordinatesRejected = rejects(() =>
        evaluate('D-02', inheritedCoordinates))
      missingOwnCoordinateMapped = false
      for (let index = 0; index < missingOwnCoordinates.length; index += 1) {
        if (maps(() => evaluate('D-02', missingOwnCoordinates[index]))) {
          missingOwnCoordinateMapped = true
        }
      }
      proxyCoordinatesRejected = rejects(() =>
        evaluate('D-02', proxyCoordinates))
      genericProxyRejected = rejects(() => evaluate('P-01', proxyCoordinates))
      inheritedRouteRejected = rejects(() =>
        evaluate('PRE-03', inheritedRouteInput))
      stage = 'policy refusals'
      sharedResult = evaluate('D-02', shared)
      crossResult = evaluate('D-02', crossScope)
      stage = 'generic static'
      staticResult = evaluate('P-01', {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
      })
      stage = 'generic continue'
      continueResult = evaluate('P-02', {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
        compatibilityOutcome: 'accepted_op',
      })
      stage = 'generic rejection'
      unknownOutcomeRejected = rejects(() => evaluate('P-01', {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
        compatibilityOutcome: '__unknown_compatibility__',
      }))
      accessorRejected = rejects(() => evaluate('P-01', accessorInput))
      authorityAccessorRejected = rejects(() =>
        evaluate('P-01', authorityAccessorInput))
      stage = 'route continue'
      routeResult = evaluate('PRE-03', {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
        compatibilityOutcome: 'captured_intent',
        routeKind: 'legacy_extraction_pass',
      })
      stage = 'terminal'
      terminalResult = evaluate('F-01', hostileTerminal)
      stage = 'verification A'
      verificationA = verify()
      stage = 'verification B'
      verificationB = verify()
    } catch {
      fatal = true
    }

    let failure = fatal ? 'valid poisoned-dispatch evaluation threw at ' + stage +
      ' after ' + poisonCalls + ' poison calls' : ''
    function check(condition, message) {
      if (!condition && failure === '') failure = message
    }
    if (!fatal) {
      check(poisonCalls === 0 && numericPrototypeCalls === 0,
        'poison dispatch observed')
      check(mapResult.disposition === 'MAP' && mapResult.outcome === 'applied',
        'clean D-02 no longer maps')
      check(invalidActorRejected && invalidTypeRejected &&
        invalidValidityRejected && invalidLinksRejected,
      'malformed erasure input escaped')
      check(inheritedCoordinatesRejected && !missingOwnCoordinateMapped,
        'inherited erasure coordinates minted MAP')
      check(proxyCoordinatesRejected && genericProxyRejected &&
        proxyObservations === 0, 'Proxy input was observed or accepted')
      check(inheritedRouteRejected, 'inherited route tag was accepted')
      check(sharedResult.reason === 'shared_scope_unsealed',
        'shared refusal changed')
      check(crossResult.reason === 'scope_mismatch', 'scope refusal changed')
      check(staticResult.disposition === 'REFUSE', 'static refusal changed')
      check(continueResult.action === 'CONTINUE' && continueResult.next[0] === 'P-03',
        'generic continuation changed')
      check(unknownOutcomeRejected && accessorRejected && accessorObservations === 0,
        'generic outcome closure changed')
      check(authorityAccessorRejected && authorityAccessorObservations === 0,
        'authority accessor or inherited iterator close was observed')
      check(routeResult.next.length === 5 && routeResult.next[0] === 'E-01' &&
        routeResult.next[4] === 'E-05', 'route dispatch changed')
      check(terminalResult.errorCode === 'legacy_terminal_storage_refused' &&
        terminalObservations === 0, 'terminal refusal observed input')
      const normalized = [
        mapResult, sharedResult, crossResult, staticResult, continueResult,
        routeResult, terminalResult, verificationA, verificationB,
      ]
      for (let index = 0; index < normalized.length; index += 1) {
        check(objectIsFrozen(normalized[index]) &&
          objectGetPrototypeOf(normalized[index]) === null,
        'result normalization changed')
      }
      check(verificationA !== verificationB &&
        verificationA.mapAllowlist !== verificationB.mapAllowlist,
      'verification results alias')
      check(verificationA.obligationCount === 46 &&
        verificationA.dimensionCount === 22 &&
        verificationA.stagedAuthorityCaseCount === 72 &&
        verificationA.erasureMatrixCaseCount === 1728,
      'verification totals changed')
    }
    deleteProperty(NativeArray.prototype, '0')
    deleteProperty(NativeArray.prototype, 'toJSON')
    deleteProperty(NativeObject.prototype, 'toJSON')
    deleteProperty(NativeObject.prototype, 'return')
    deleteProperty(NativeObject.prototype, 'routeKind')
    for (let index = 0; index < coordinateKeys.length; index += 1) {
      deleteProperty(NativeObject.prototype, coordinateKeys[index])
    }
    if (failure === '') writeOut('PASS')
    else {
      writeError(failure)
      process.exitCode = 1
    }
  `
  const child = spawnSync(
    process.execPath,
    ['--no-warnings', '--input-type=module', '--eval', source],
    { encoding: 'utf8', timeout: 30_000 },
  )
  assert.equal(
    child.status,
    0,
    `poisoning child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  assert.equal(child.stdout, 'PASS')
})

test('M2-B-02 source is data-only, isolated, and free of runtime shortcuts', () => {
  const source = readFileSync(MODULE_PATH, 'utf8')
  const normativePrefix = extractNormativeArtifact()
    .slice(1)
    .split('\nconst verification = validateRegistry();')[0]
  const productionArtifact = source.slice(source.indexOf("'use strict';"))
  const productionPrefix = productionArtifact.split('\nvalidateRegistry();')[0]
  assert.equal(
    productionPrefix,
    normativePrefix,
    'production registry must mechanically copy the normative artifact',
  )
  assert.deepEqual(
    [...source.matchAll(
      /^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"];?\s*$/gm,
    )]
      .map((match) => match[1]),
    ['node:util'],
  )
  for (const forbidden of [
    'memory-store.mjs',
    'memory-bundle',
    'mutation-coordinator',
    'kernel-store-runtime',
    'node:fs',
    'node:sqlite',
    'Date.now',
    'Math.random',
  ]) {
    assert.equal(source.includes(forbidden), false, `source reaches ${forbidden}`)
  }
  assert.doesNotMatch(
    source,
    /\.(?:every|filter|find|flatMap|forEach|includes|map|some|startsWith|endsWith|slice)\(/,
    'source uses live prototype dispatch',
  )
  assert.doesNotMatch(
    source,
    /\b(?:Array|JSON|Number|Object|Reflect|String)\.[A-Za-z]+\(/,
    'source uses a live static primordial',
  )
  assert.doesNotMatch(
    source,
    /\bnew (?:Error|Map|Proxy|Set)\b/,
    'source uses a live global constructor',
  )
  for (const match of source.matchAll(/for \(const [^\n]+ of ([^\n]+)\)/g)) {
    assert.equal(
      match[1].startsWith('safeArrayIterable('),
      true,
      `source uses live iteration: ${match[0]}`,
    )
  }

  const productionFiles = readFileSync(
    join(REPO_ROOT, 'tests/memory-bundle-coexistence.contract.test.mjs'),
    'utf8',
  )
  assert.equal(
    productionFiles.includes("'governed-mutation-dispositions.mjs'"),
    true,
    'coexistence inventory must classify the exact Task 2 module',
  )
})
