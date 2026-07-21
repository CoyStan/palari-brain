import assert from 'node:assert/strict'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  dirname,
  join,
  relative,
  resolve,
} from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import * as applyModule from '../src/memory-bundle-apply.mjs'
import * as publicModule from '../src/memory-bundle.mjs'
import { createGatedStore } from '../src/gate.mjs'
import { createKernelStore } from '../src/store.mjs'
import {
  EXPECTED_AUTOINDEX_NAMES,
  EXPECTED_CAPABILITIES,
  EXPECTED_OBJECTS,
  EXPECTED_REQUIRED_PRAGMAS,
  M1_04_IDS,
  makeM104ApplyEnvelope,
  makeM104AtomRow,
  makeM104CanonicalAtom,
} from './helpers/memory-bundle-fixtures.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const FIXED_CDX_NOW = new Date('2026-07-20T14:00:00.000Z')
const BUNDLE_CREATED_AT = '2026-07-18T11:58:00.000Z'
const BUNDLE_STREAM_UUID = '00000000-0000-4000-8000-000000000001'
const CDX_SCOPE = { palariId: 'palari-a', userId: 'user-1' }

const BUNDLE_SOURCE_FILES = Object.freeze([
  'memory-bundle-apply.mjs',
  'memory-bundle-codec.mjs',
  'memory-bundle-errors.mjs',
  'memory-bundle-runtime.mjs',
  'memory-bundle-schema.mjs',
  'memory-bundle-verify.mjs',
  'memory-bundle.mjs',
])

const LEGACY_RUNTIME_FILES = Object.freeze([
  'adapter.mjs',
  'eval-prompt-config.mjs',
  'gate.mjs',
  'gemini.mjs',
  'longmemeval.mjs',
  'memory-briefing.mjs',
  'memory-extraction.mjs',
  'memory-store.mjs',
  'recall.mjs',
  'routing-budgets.mjs',
  'slice.mjs',
  'store.mjs',
  'util.mjs',
])

function compareBinary(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function schemaIdentity(row) {
  return JSON.stringify([row.type, row.name])
}

function sortSchemaIdentities(rows) {
  return rows.toSorted((left, right) =>
    compareBinary(schemaIdentity(left), schemaIdentity(right)))
}

function readSchema(db) {
  return db.prepare(`
    SELECT type, name, tbl_name, sql
    FROM main.sqlite_schema
    ORDER BY type COLLATE BINARY, name COLLATE BINARY
  `).all()
}

function snapshotCdx(db) {
  return {
    memories: db.prepare(`
      SELECT * FROM main.memories ORDER BY id COLLATE BINARY
    `).all(),
    fts: db.prepare(`
      SELECT rowid, memory_id, palari_id, content, keywords
      FROM main.memory_fts
      ORDER BY rowid
    `).all(),
    links: db.prepare(`
      SELECT * FROM main.memory_links ORDER BY id COLLATE BINARY
    `).all(),
    migrations: db.prepare(`
      SELECT * FROM main.memory_migrations ORDER BY id COLLATE BINARY
    `).all(),
  }
}

function snapshotBundle(db) {
  return {
    meta: db.prepare(`
      SELECT singleton, schema_version, stream_id, head_sequence, created_at
      FROM main.memory_bundle_meta
      ORDER BY singleton
    `).all(),
    events: db.prepare(`
      SELECT
        sequence, stream_id, decision_id, proposal_id, proposal_kind,
        operation, outcome, reason_code, palari_id, user_id,
        authority_kind, authority_id, evidence_kind, memory_id, memory_type,
        effective_at, observed_at
      FROM main.memory_bundle_events
      ORDER BY sequence
    `).all(),
    atoms: db.prepare(`
      SELECT
        memory_id, stream_id, created_sequence, palari_id, user_id, type,
        content, keywords_json, initial_importance, confidence,
        provenance_kind, source_message_id, valid_from, created_at, fictional,
        content_checksum
      FROM main.memory_bundle_atoms
      ORDER BY memory_id COLLATE BINARY
    `).all(),
  }
}

function readPragma(db, name) {
  const values = Object.values(db.prepare(`PRAGMA ${name}`).get())
  assert.equal(values.length, 1, `PRAGMA ${name} must return one scalar`)
  return values[0]
}

function snapshotPragmas(db, names) {
  return Object.fromEntries(names.map((name) => [name, readPragma(db, name)]))
}

function makeCdxProposal({
  content,
  id,
  keywords,
  kind = 'permanent',
  op = 'add',
  target,
  type = 'preference',
  confidence = 0.9,
}) {
  return {
    kind,
    op,
    provenance: {
      eventAt: FIXED_CDX_NOW.toISOString(),
      sourceKind: 'user_message',
      writer: 'explicit_user_action',
    },
    record: {
      confidence,
      content,
      id,
      keywords,
      palari_id: CDX_SCOPE.palariId,
      type,
      user_id: CDX_SCOPE.userId,
    },
    ...(target === undefined ? {} : { target }),
  }
}

function gateProbe(gated, memoryId) {
  return {
    memory: gated.getMemoryById(memoryId),
    search: gated.searchMemories('cobalt narwhal', {
      ...CDX_SCOPE,
      limit: 10,
    }),
    rejected: gated.propose(makeCdxProposal({
      confidence: 0.1,
      content: 'Below-threshold M1-14 probe must never be stored.',
      id: 'm114_cdx_rejected_probe',
      keywords: ['below', 'threshold'],
    })),
    status: gated.publicStatus(),
  }
}

function literalImportSpecifiers(source) {
  const specifiers = []
  const patterns = [
    /^\s*import\s*(['"`])([^'"`\r\n]+)\1\s*;?\s*$/gm,
    /\bfrom[ \t\r\n]+(['"`])([^'"`\r\n]+)\1/g,
    /\bimport\s*\(\s*(['"`])([^'"`\r\n]+)\1/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (!match[2].includes('${')) specifiers.push(match[2])
    }
  }
  return specifiers
}

function pathFromSpecifier(importer, specifier) {
  if (!specifier.startsWith('.')) return null
  return resolve(dirname(importer), specifier.split('?')[0])
}

function dynamicImportTails(source) {
  return [...source.matchAll(/\bimport\s*\(/g)]
    .map((match) => source.slice(match.index, match.index + 240))
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length
}

function countOccurrences(source, value) {
  return source.split(value).length - 1
}

test('M1-14 bundle coexists with the real gated CDX-M1 workspace without dual writes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'palari-m114-coexistence-'))
  let store
  let handle
  try {
    store = await createKernelStore({
      clock: () => FIXED_CDX_NOW,
      memoryEnabled: true,
      statePath: join(directory, 'workspace-state.json'),
      workspaceId: 'm114-coexistence',
    })
    const gated = createGatedStore(store)
    const dbPath = store.dbPath

    const first = gated.propose(makeCdxProposal({
      content: 'Auburn marmot was the original M1-14 preference.',
      id: 'm114_cdx_original',
      keywords: ['auburn', 'marmot'],
    }))
    assert.equal(first.outcome, 'inserted')
    const second = gated.propose(makeCdxProposal({
      content: 'Cobalt narwhal is now the M1-14 preference.',
      id: 'm114_cdx_successor',
      keywords: ['cobalt', 'narwhal'],
      op: 'supersede',
      target: first.memory.id,
    }))
    assert.equal(second.outcome, 'superseded')
    assert.deepEqual(
      gated.searchMemories('cobalt narwhal', { ...CDX_SCOPE, limit: 10 })
        .map(({ id }) => id),
      [second.memory.id],
    )
    assert.deepEqual(
      store.db.prepare(`
        SELECT from_memory_id, to_memory_id, relation
        FROM main.memory_links
      `).all(),
      [Object.assign(Object.create(null), {
        from_memory_id: second.memory.id,
        to_memory_id: first.memory.id,
        relation: 'supersedes',
      })],
    )

    const schemaBefore = readSchema(store.db)
    const cdxBefore = snapshotCdx(store.db)
    const persistentPragmaNames = [
      'application_id',
      'auto_vacuum',
      'encoding',
      'journal_mode',
      'page_size',
      'synchronous',
      'user_version',
    ]
    const persistentPragmasBefore = snapshotPragmas(
      store.db,
      persistentPragmaNames,
    )
    assert.deepEqual(
      snapshotPragmas(store.db, Object.keys(EXPECTED_REQUIRED_PRAGMAS)),
      { ...EXPECTED_REQUIRED_PRAGMAS, recursive_triggers: 0 },
      'CDX-M1 starts with recursive triggers disabled before bundle policy',
    )

    assert.equal(applyModule.initializeMemoryBundle(store.db, {
      clock: () => new Date(BUNDLE_CREATED_AT),
      idFactory: () => BUNDLE_STREAM_UUID,
    }), undefined)

    const schemaAfter = readSchema(store.db)
    const preexistingIdentities = new Set(schemaBefore.map(schemaIdentity))
    const addedSchema = schemaAfter.filter((row) =>
      !preexistingIdentities.has(schemaIdentity(row)))
    const expectedAddedSchema = [
      ...EXPECTED_OBJECTS.map(({ type, name }) => ({ type, name })),
      ...EXPECTED_AUTOINDEX_NAMES.map((name) => ({ type: 'index', name })),
    ]
    assert.deepEqual(
      sortSchemaIdentities(addedSchema.map(({ type, name }) => ({ type, name }))),
      sortSchemaIdentities(expectedAddedSchema),
      'the complete schema delta is exactly 13 M1 objects and five autoindexes',
    )
    const expectedAddedIdentities = new Set(
      expectedAddedSchema.map(schemaIdentity),
    )
    assert.deepEqual(
      schemaAfter.filter((row) =>
        !expectedAddedIdentities.has(schemaIdentity(row))),
      schemaBefore,
      'every pre-existing CDX-M1 schema object remains byte-for-byte identical',
    )
    assert.deepEqual(snapshotCdx(store.db), cdxBefore)
    assert.deepEqual(
      snapshotPragmas(store.db, persistentPragmaNames),
      persistentPragmasBefore,
      'bundle initialization does not alter workspace-persistent pragmas',
    )
    assert.deepEqual(
      snapshotPragmas(store.db, Object.keys(EXPECTED_REQUIRED_PRAGMAS)),
      EXPECTED_REQUIRED_PRAGMAS,
      'the borrowed connection is left with the four contractual safety pragmas',
    )
    const initialized = snapshotBundle(store.db)
    assert.equal(initialized.meta[0].schema_version, 'CDX-B1')
    assert.equal(initialized.meta[0].head_sequence, 0)
    assert.deepEqual(initialized.events, [])
    assert.deepEqual(initialized.atoms, [])

    const ordinary = gated.propose(makeCdxProposal({
      content: 'Verdigris kestrel is an ordinary post-init working note.',
      id: 'm114_cdx_post_init',
      keywords: ['verdigris', 'kestrel'],
      kind: 'promote',
      type: 'working',
    }))
    assert.equal(ordinary.outcome, 'inserted')
    assert.deepEqual(snapshotBundle(store.db), initialized)
    assert.deepEqual(
      gated.searchMemories('verdigris kestrel', { ...CDX_SCOPE, limit: 10 })
        .map(({ id }) => id),
      [ordinary.memory.id],
    )

    const cdxBeforeBundleApply = snapshotCdx(store.db)
    const gateBeforeBundleApply = gateProbe(gated, second.memory.id)
    store.db.exec('BEGIN IMMEDIATE')
    try {
      assert.equal(
        applyModule.applyResolvedDecisionInTransaction(
          store.db,
          makeM104ApplyEnvelope(),
        ),
        undefined,
      )
      store.db.exec('COMMIT')
    } catch (error) {
      if (store.db.isTransaction) store.db.exec('ROLLBACK')
      throw error
    }
    assert.deepEqual(snapshotCdx(store.db), cdxBeforeBundleApply)
    assert.deepEqual(gateProbe(gated, second.memory.id), gateBeforeBundleApply)
    const applied = snapshotBundle(store.db)
    assert.equal(applied.meta[0].head_sequence, 1)
    assert.equal(applied.events.length, 1)
    assert.equal(applied.atoms.length, 1)
    assert.deepEqual(readSchema(store.db), schemaAfter)
    assert.deepEqual(
      snapshotPragmas(store.db, persistentPragmaNames),
      persistentPragmasBefore,
    )
    assert.deepEqual(
      snapshotPragmas(store.db, Object.keys(EXPECTED_REQUIRED_PRAGMAS)),
      EXPECTED_REQUIRED_PRAGMAS,
    )

    const postApplyCdx = gated.propose(makeCdxProposal({
      content: 'Saffron osprey proves the CDX gate still writes after bundle apply.',
      id: 'm114_cdx_post_apply',
      keywords: ['saffron', 'osprey'],
      kind: 'promote',
      type: 'working',
    }))
    assert.equal(postApplyCdx.outcome, 'inserted')
    assert.deepEqual(
      gated.searchMemories('saffron osprey', { ...CDX_SCOPE, limit: 10 })
        .map(({ id }) => id),
      [postApplyCdx.memory.id],
    )
    assert.deepEqual(snapshotBundle(store.db), applied)
    assert.deepEqual(readSchema(store.db), schemaAfter)
    assert.deepEqual(
      snapshotPragmas(store.db, persistentPragmaNames),
      persistentPragmasBefore,
    )
    assert.deepEqual(
      snapshotPragmas(store.db, Object.keys(EXPECTED_REQUIRED_PRAGMAS)),
      EXPECTED_REQUIRED_PRAGMAS,
    )

    gated.close()
    assert.equal(store.db.isOpen, false)
    handle = publicModule.openMemoryBundle({ dbPath })
    assert.deepEqual(handle.verify(), {
      checkpoint: { streamId: M1_04_IDS.streamId, sequence: 1 },
      capabilities: EXPECTED_CAPABILITIES,
    })
    assert.deepEqual(handle.replay(), {
      checkpoint: { streamId: M1_04_IDS.streamId, sequence: 1 },
      memories: [{
        ...makeM104CanonicalAtom(),
        contentChecksum: makeM104AtomRow().content_checksum,
      }],
      capabilities: EXPECTED_CAPABILITIES,
    })
    assert.equal(handle.close(), undefined)
    handle = undefined
  } finally {
    try {
      if (handle !== undefined) handle.close()
    } finally {
      try {
        if (store?.db?.isOpen) store.close()
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    }
  }
})

test('M1-14 legacy runtime remains bundle-unaware and bundle dependencies stay isolated', () => {
  const sourceDirectory = join(REPO_ROOT, 'src')
  const actualLegacyFiles = readdirSync(sourceDirectory)
    .filter((name) => name.endsWith('.mjs'))
    .filter((name) => !BUNDLE_SOURCE_FILES.includes(name))
    .toSorted(compareBinary)
  assert.deepEqual(actualLegacyFiles, [...LEGACY_RUNTIME_FILES])

  for (const name of LEGACY_RUNTIME_FILES) {
    const source = readFileSync(join(sourceDirectory, name), 'utf8')
    for (const specifier of literalImportSpecifiers(source)) {
      const basename = specifier.split('?')[0].split('/').at(-1)
      assert.equal(
        BUNDLE_SOURCE_FILES.includes(basename),
        false,
        `${name} imports bundle module ${specifier}`,
      )
    }
    assert.doesNotMatch(
      source,
      /\b(?:initializeMemoryBundle|applyResolvedDecisionInTransaction)\s*\(/,
    )
  }

  for (const name of BUNDLE_SOURCE_FILES) {
    const source = readFileSync(join(sourceDirectory, name), 'utf8')
    for (const specifier of literalImportSpecifiers(source)) {
      assert.ok(
        specifier.startsWith('node:') ||
          /^\.\/memory-bundle(?:-[a-z]+)?\.mjs$/.test(specifier),
        `${name} has an out-of-scope production dependency: ${specifier}`,
      )
    }
  }
})

test('M1-14 dependency, namespace, schema, and provider-free boundaries remain closed', () => {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'),
  )
  assert.deepEqual(
    Object.keys(manifest).filter((key) => /dependencies$/i.test(key)),
    [],
  )
  assert.equal(manifest.scripts?.test, 'node --test')
  assert.equal(manifest.engines?.node, '>=22.22.2')

  assert.deepEqual(Object.keys(applyModule).sort(), [
    'MemoryBundleError',
    'applyResolvedDecisionInTransaction',
    'initializeMemoryBundle',
  ])
  assert.deepEqual(Object.keys(publicModule), ['openMemoryBundle'])
  const deferredApiPattern =
    /(?:projection|driver|provider|vector|graph|export|import|repair|histor(?:y|ical)?|signature|anchor)/i
  assert.doesNotMatch(
    [...Object.keys(applyModule), ...Object.keys(publicModule)].join(' '),
    deferredApiPattern,
  )

  const roots = [
    'tests/memory-bundle.contract.test.mjs',
    'tests/memory-bundle-verification.contract.test.mjs',
    'tests/memory-bundle-public.contract.test.mjs',
    'tests/memory-bundle-instrumentation.contract.test.mjs',
    'tests/memory-bundle-coexistence.contract.test.mjs',
    'tests/helpers/memory-bundle-fixtures.mjs',
    'tests/fixtures/memory-bundle-instrumentation-child.mjs',
    'tests/fixtures/memory-bundle-hot-journal-child.mjs',
  ]
  const expectedLocalGraph = new Set([
    ...roots,
    ...BUNDLE_SOURCE_FILES.map((name) => `src/${name}`),
    'src/gate.mjs',
    'src/memory-store.mjs',
    'src/store.mjs',
    'src/util.mjs',
  ])
  const forbiddenBuiltins = new Set([
    'node:dgram',
    'node:dns',
    'node:http',
    'node:http2',
    'node:https',
    'node:net',
    'node:tls',
  ])
  const forbiddenMarkers = [
    ['156849', '8a'].join(''),
    ['PALARI_CONFIRM', '_SPEND'].join(''),
    ['GEMINI_API', '_KEY'].join(''),
    ['ANTHROPIC_API', '_KEY'].join(''),
    ['evals', 'results'].join('/'),
    ['evals', 'predictions.md'].join('/'),
    ['data', ''].join('/'),
    ['scripts', 'run-live-slice.mjs'].join('/'),
    ['src', 'gemini.mjs'].join('/'),
    ['src', 'adapter.mjs'].join('/'),
    ['src', 'longmemeval.mjs'].join('/'),
    ['src', 'slice.mjs'].join('/'),
    ['src', 'eval-prompt-config.mjs'].join('/'),
    ['tests', 'slice.contract.test.mjs'].join('/'),
    ['docs', 'U8-PREP.md'].join('/'),
  ]
  const dynamicImportKeyword = 'import'
  const computedImportAllowlist = [
    [dynamicImportKeyword, '(${JSON.stringify(fixtureUrl)})'].join(''),
    [dynamicImportKeyword, '(${JSON.stringify(codecUrl)})'].join(''),
    [dynamicImportKeyword, '(${JSON.stringify(applyUrl)})'].join(''),
    [
      dynamicImportKeyword,
      '(${JSON.stringify(`${verifierUrl}?m106-instrumented`)})',
    ].join(''),
  ]
  const expectedSpawnCounts = {
    'tests/memory-bundle-instrumentation.contract.test.mjs': 1,
    'tests/memory-bundle-public.contract.test.mjs': 1,
    'tests/memory-bundle-verification.contract.test.mjs': 2,
  }
  const childProcessSpecifier = ['node:child', 'process'].join('_')
  const queue = roots.map((path) => join(REPO_ROOT, path))
  const visited = new Set()
  const observedComputedImports = []
  while (queue.length > 0) {
    const file = queue.shift()
    const repoPath = relative(REPO_ROOT, file)
    if (visited.has(repoPath)) continue
    assert.ok(expectedLocalGraph.has(repoPath), `unexpected local import: ${repoPath}`)
    visited.add(repoPath)
    const source = readFileSync(file, 'utf8')
    for (const marker of forbiddenMarkers) {
      assert.equal(
        source.includes(marker),
        false,
        `${repoPath} contains sealed/live marker ${marker}`,
      )
    }
    assert.doesNotMatch(
      source,
      /\b(?:fetch|WebSocket|EventSource)\s*\(/,
      `${repoPath} must not make provider/network calls`,
    )
    for (const specifier of literalImportSpecifiers(source)) {
      assert.equal(
        forbiddenBuiltins.has(specifier),
        false,
        `${repoPath} imports network builtin ${specifier}`,
      )
      assert.ok(
        specifier.startsWith('node:') || specifier.startsWith('.'),
        `${repoPath} imports a non-local dependency or URL: ${specifier}`,
      )
      const importedPath = pathFromSpecifier(file, specifier)
      if (importedPath !== null) {
        const importedRepoPath = relative(REPO_ROOT, importedPath)
        assert.ok(
          expectedLocalGraph.has(importedRepoPath),
          `${repoPath} imports out-of-scope path ${importedRepoPath}`,
        )
        queue.push(importedPath)
      }
    }

    for (const tail of dynamicImportTails(source)) {
      const quoted = tail.match(
        /^import\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/,
      )
      if (quoted !== null) continue

      const templated = tail.match(
        /^import\s*\(\s*`([^`\r\n]+)`\s*\)/,
      )
      if (templated !== null) {
        if (!templated[1].includes('${')) continue
        const allowedTarget = templated[1].match(
          /^((?:\.\.\/){1,2}src\/memory-bundle(?:-verify)?\.mjs)\?m1(?:06|10)-[a-z-]+=\$\{Date\.now\(\)\}$/,
        )
        assert.ok(
          allowedTarget,
          `${repoPath} has an unapproved computed import: ${templated[1]}`,
        )
        const importedPath = pathFromSpecifier(file, allowedTarget[1])
        const importedRepoPath = relative(REPO_ROOT, importedPath)
        assert.ok(expectedLocalGraph.has(importedRepoPath))
        queue.push(importedPath)
        continue
      }

      const computed = computedImportAllowlist.find((candidate) =>
        tail.startsWith(candidate))
      assert.equal(
        repoPath,
        'tests/memory-bundle-verification.contract.test.mjs',
        `${repoPath} has an unapproved non-literal dynamic import`,
      )
      assert.ok(computed, `${repoPath} has an unapproved computed import`)
      observedComputedImports.push(computed)
    }

    const spawnCount = countMatches(
      source,
      /\bspawn(?:Sync)?\s*\(/g,
    )
    assert.equal(spawnCount, expectedSpawnCounts[repoPath] ?? 0)
    assert.equal(
      countOccurrences(source, childProcessSpecifier),
      spawnCount > 0 ? 1 : 0,
      `${repoPath} may expose only its pinned child-process import`,
    )
    assert.equal(
      countMatches(
        source,
        /\bspawn(?:Sync)?\s*\(\s*process\.execPath/g,
      ),
      spawnCount,
      `${repoPath} may spawn only the pinned Node executable`,
    )
    if (repoPath === 'tests/memory-bundle-verification.contract.test.mjs') {
      assert.match(
        source,
        new RegExp(
          `^import \\{ spawnSync \\} from '${childProcessSpecifier}'$`,
          'm',
        ),
      )
      assert.match(
        source,
        /new URL\(\s*'\.\/fixtures\/memory-bundle-instrumentation-child\.mjs',\s*import\.meta\.url,?\s*\)/,
      )
      assert.ok(source.includes(
        ['spawnSync', '(process.execPath, [childPath, name]'].join(''),
      ))
      assert.match(
        source,
        /\['--input-type=module', '--eval', source\]/,
      )
      for (const binding of [
        /const fixtureUrl = new URL\(\s*'\.\/helpers\/memory-bundle-fixtures\.mjs',\s*import\.meta\.url,?\s*\)\.href/,
        /const codecUrl = new URL\('\.\.\/src\/memory-bundle-codec\.mjs', import\.meta\.url\)\.href/,
        /const applyUrl = new URL\('\.\.\/src\/memory-bundle-apply\.mjs', import\.meta\.url\)\.href/,
        /const verifierUrl = new URL\('\.\.\/src\/memory-bundle-verify\.mjs', import\.meta\.url\)\.href/,
      ]) {
        assert.match(source, binding)
      }
    } else if (
      repoPath === 'tests/memory-bundle-instrumentation.contract.test.mjs'
    ) {
      assert.match(
        source,
        new RegExp(
          `^import \\{ spawnSync \\} from '${childProcessSpecifier}'$`,
          'm',
        ),
      )
      assert.match(
        source,
        /new URL\('\.\/fixtures\/memory-bundle-instrumentation-child\.mjs', import\.meta\.url\)/,
      )
      assert.ok(source.includes(
        ['spawnSync', '(process.execPath, [CHILD_PATH, name]'].join(''),
      ))
    } else if (repoPath === 'tests/memory-bundle-public.contract.test.mjs') {
      assert.match(
        source,
        new RegExp(
          `^import \\{ spawn \\} from '${childProcessSpecifier}'$`,
          'm',
        ),
      )
      assert.match(
        source,
        /new URL\(\s*'\.\/fixtures\/memory-bundle-hot-journal-child\.mjs',\s*import\.meta\.url,?\s*\)/,
      )
      assert.ok(source.includes(
        ['spawn', '(process.execPath, [M1_13_CHILD_PATH, dbPath]'].join(''),
      ))
    }
  }
  assert.deepEqual(
    observedComputedImports.toSorted(compareBinary),
    computedImportAllowlist.toSorted(compareBinary),
    'every non-literal generated import is pinned to a safe URL binding',
  )
  assert.deepEqual(
    [...visited].toSorted(compareBinary),
    [...expectedLocalGraph].toSorted(compareBinary),
    'the complete M1 local import/execution graph is pinned and provider-free',
  )
})
