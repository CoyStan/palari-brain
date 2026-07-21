import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
import { DatabaseSync } from 'node:sqlite'
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

const A2_RUNTIME_SOURCE_FILES = Object.freeze([
  'adapter.mjs',
  'eval-prompt-config.mjs',
  'gate.mjs',
  'gemini.mjs',
  'kernel-store-runtime.mjs',
  'legacy-mutation-router.mjs',
  'longmemeval.mjs',
  'memory-briefing.mjs',
  'memory-extraction.mjs',
  'mutation-coordinator.mjs',
  'recall.mjs',
  'routing-budgets.mjs',
  'slice.mjs',
  'store.mjs',
  'util.mjs',
])

const M2B_AUTHORITY_SOURCE_FILES = Object.freeze([
  'memory-authority-runtime.mjs',
  'memory-authority.mjs',
])

const M2B_DISPOSITION_SOURCE_FILES = Object.freeze([
  'governed-mutation-dispositions.mjs',
])

const M2B_B2_SOURCE_FILES = Object.freeze([
  'cdx-b2-journal.mjs',
  'cdx-b2-schema.mjs',
])

const DORMANT_SOURCE_FILES = Object.freeze([
  'memory-store.mjs',
])

const SEALED_PRODUCTION_MODULES = Object.freeze([
  ['scripts', 'run-live-slice.mjs'].join('/'),
  ...A2_RUNTIME_SOURCE_FILES.map((name) => `src/${name}`),
  ...M2B_AUTHORITY_SOURCE_FILES.map((name) => `src/${name}`),
  ...M2B_DISPOSITION_SOURCE_FILES.map((name) => `src/${name}`),
  ...M2B_B2_SOURCE_FILES.map((name) => `src/${name}`),
  ...BUNDLE_SOURCE_FILES.map((name) => `src/${name}`),
])

function compareBinary(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function recursiveModuleFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...recursiveModuleFiles(path))
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(path)
    }
  }
  return files
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
  let db
  let gated
  let store
  let handle
  try {
    store = await createKernelStore({
      clock: () => FIXED_CDX_NOW,
      memoryEnabled: true,
      statePath: join(directory, 'workspace-state.json'),
      workspaceId: 'm114-coexistence',
    })
    gated = createGatedStore(store)
    const dbPath = store.dbPath
    db = new DatabaseSync(dbPath)

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
      db.prepare(`
        SELECT from_memory_id, to_memory_id, relation
        FROM main.memory_links
      `).all(),
      [Object.assign(Object.create(null), {
        from_memory_id: second.memory.id,
        to_memory_id: first.memory.id,
        relation: 'supersedes',
      })],
    )

    const schemaBefore = readSchema(db)
    const cdxBefore = snapshotCdx(db)
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
      db,
      persistentPragmaNames,
    )
    assert.deepEqual(
      snapshotPragmas(db, Object.keys(EXPECTED_REQUIRED_PRAGMAS)),
      { ...EXPECTED_REQUIRED_PRAGMAS, recursive_triggers: 0 },
      'the independent connection starts with recursive triggers disabled',
    )

    assert.equal(applyModule.initializeMemoryBundle(db, {
      clock: () => new Date(BUNDLE_CREATED_AT),
      idFactory: () => BUNDLE_STREAM_UUID,
    }), undefined)

    const schemaAfter = readSchema(db)
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
    assert.deepEqual(snapshotCdx(db), cdxBefore)
    assert.deepEqual(
      snapshotPragmas(db, persistentPragmaNames),
      persistentPragmasBefore,
      'bundle initialization does not alter workspace-persistent pragmas',
    )
    assert.deepEqual(
      snapshotPragmas(db, Object.keys(EXPECTED_REQUIRED_PRAGMAS)),
      EXPECTED_REQUIRED_PRAGMAS,
      'the borrowed connection is left with the four contractual safety pragmas',
    )
    const initialized = snapshotBundle(db)
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
    assert.deepEqual(snapshotBundle(db), initialized)
    assert.deepEqual(
      gated.searchMemories('verdigris kestrel', { ...CDX_SCOPE, limit: 10 })
        .map(({ id }) => id),
      [ordinary.memory.id],
    )

    const cdxBeforeBundleApply = snapshotCdx(db)
    const gateBeforeBundleApply = gateProbe(gated, second.memory.id)
    db.exec('BEGIN IMMEDIATE')
    try {
      assert.equal(
        applyModule.applyResolvedDecisionInTransaction(
          db,
          makeM104ApplyEnvelope(),
        ),
        undefined,
      )
      db.exec('COMMIT')
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK')
      throw error
    }
    assert.deepEqual(snapshotCdx(db), cdxBeforeBundleApply)
    assert.deepEqual(gateProbe(gated, second.memory.id), gateBeforeBundleApply)
    const applied = snapshotBundle(db)
    assert.equal(applied.meta[0].head_sequence, 1)
    assert.equal(applied.events.length, 1)
    assert.equal(applied.atoms.length, 1)
    assert.deepEqual(readSchema(db), schemaAfter)
    assert.deepEqual(
      snapshotPragmas(db, persistentPragmaNames),
      persistentPragmasBefore,
    )
    assert.deepEqual(
      snapshotPragmas(db, Object.keys(EXPECTED_REQUIRED_PRAGMAS)),
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
    assert.deepEqual(snapshotBundle(db), applied)
    assert.deepEqual(readSchema(db), schemaAfter)
    assert.deepEqual(
      snapshotPragmas(db, persistentPragmaNames),
      persistentPragmasBefore,
    )
    assert.deepEqual(
      snapshotPragmas(db, Object.keys(EXPECTED_REQUIRED_PRAGMAS)),
      EXPECTED_REQUIRED_PRAGMAS,
    )

    gated.close()
    assert.equal(store.status().status, 'closed')
    db.close()
    db = undefined
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
        if (gated !== undefined) gated.close()
      } finally {
        try {
          if (store !== undefined) store.close()
        } finally {
          try {
            if (db?.isOpen) {
              if (db.isTransaction) db.exec('ROLLBACK')
              db.close()
            }
          } finally {
            rmSync(directory, { recursive: true, force: true })
          }
        }
      }
    }
  }
})

test('M1-14 A2 plus isolated M2-B modules keep B1 ownership isolated', () => {
  const sourceDirectory = join(REPO_ROOT, 'src')
  const actualSourceFiles = readdirSync(sourceDirectory)
    .filter((name) => name.endsWith('.mjs'))
    .toSorted(compareBinary)
  assert.equal(SEALED_PRODUCTION_MODULES.length, 28)
  assert.equal(new Set(SEALED_PRODUCTION_MODULES).size, 28)
  assert.deepEqual(
    actualSourceFiles,
    [
      ...A2_RUNTIME_SOURCE_FILES,
      ...M2B_AUTHORITY_SOURCE_FILES,
      ...M2B_DISPOSITION_SOURCE_FILES,
      ...M2B_B2_SOURCE_FILES,
      ...BUNDLE_SOURCE_FILES,
      ...DORMANT_SOURCE_FILES,
    ].toSorted(compareBinary),
  )

  const productionSet = new Set(SEALED_PRODUCTION_MODULES)
  for (const repoPath of SEALED_PRODUCTION_MODULES) {
    const path = join(REPO_ROOT, repoPath)
    const source = readFileSync(path, 'utf8')
    for (const specifier of literalImportSpecifiers(source)) {
      const importedPath = pathFromSpecifier(path, specifier)
      if (importedPath === null) continue
      const importedRepoPath = relative(REPO_ROOT, importedPath)
      assert.ok(
        productionSet.has(importedRepoPath),
        `${repoPath} imports a module outside the sealed graph: ${importedRepoPath}`,
      )
      assert.notEqual(
        importedRepoPath,
        'src/memory-store.mjs',
        `${repoPath} imports the dormant extracted raw store`,
      )
    }
  }

  for (const name of A2_RUNTIME_SOURCE_FILES) {
    const source = readFileSync(join(sourceDirectory, name), 'utf8')
    const bundleImports = literalImportSpecifiers(source).filter((specifier) => {
      const basename = specifier.split('?')[0].split('/').at(-1)
      return BUNDLE_SOURCE_FILES.includes(basename)
    })
    if (name === 'kernel-store-runtime.mjs') {
      assert.deepEqual(bundleImports, ['./memory-bundle-schema.mjs'])
      assert.match(
        source,
        new RegExp([
          'import\\s*\\{\\s*MEMORY_BUNDLE_OBJECTS,\\s*',
          'MEMORY_BUNDLE_TRIGGER_TARGETS,\\s*normalizeMemoryBundleSql,',
          "\\s*\\}\\s*fr",
          "om '\\.\\/memory-bundle-schema\\.mjs'",
        ].join('')),
        'runtime may import only the three immutable B1 schema allowlist values',
      )
    } else {
      assert.deepEqual(
        bundleImports,
        [],
        `${name} imports a B1 module`,
      )
    }
    assert.doesNotMatch(
      source,
      /\b(?:initializeMemoryBundle|applyResolvedDecisionInTransaction)\s*\(/,
    )
  }

  for (const name of M2B_AUTHORITY_SOURCE_FILES) {
    const source = readFileSync(join(sourceDirectory, name), 'utf8')
    const specifiers = literalImportSpecifiers(source)
    assert.deepEqual(
      specifiers,
      name === 'memory-authority-runtime.mjs'
        ? ['node:util']
        : ['./memory-authority-runtime.mjs'],
      `${name} gained an unreviewed dependency`,
    )
    assert.doesNotMatch(
      source,
      /\.\/memory-bundle(?:-[a-z]+)?\.mjs|\.\/memory-store\.mjs/,
      `${name} reaches B1 or the dormant raw store`,
    )
  }

  for (const name of M2B_DISPOSITION_SOURCE_FILES) {
    const source = readFileSync(join(sourceDirectory, name), 'utf8')
    assert.deepEqual(
      literalImportSpecifiers(source),
      ['node:util'],
      `${name} gained an unreviewed dependency`,
    )
    assert.doesNotMatch(
      source,
      /\.\/memory-bundle(?:-[a-z]+)?\.mjs|\.\/memory-store\.mjs/,
      `${name} reaches B1 or the dormant raw store`,
    )
  }

  for (const name of M2B_B2_SOURCE_FILES) {
    const source = readFileSync(join(sourceDirectory, name), 'utf8')
    const specifiers = literalImportSpecifiers(source)
    assert.deepEqual(
      specifiers,
      name === 'cdx-b2-schema.mjs'
        ? []
        : [
            'node:crypto',
            'node:sqlite',
            'node:util',
            './memory-bundle-schema.mjs',
            './mutation-coordinator.mjs',
            './cdx-b2-schema.mjs',
          ],
      `${name} gained an unreviewed dependency`,
    )
    assert.doesNotMatch(
      source,
      /\.\/memory-store\.mjs|\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:main\.)?memory_bundle_/i,
      `${name} reaches the dormant raw store or B1 DML`,
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

  const dormantSource = readFileSync(
    join(sourceDirectory, DORMANT_SOURCE_FILES[0]),
    'utf8',
  )
  assert.doesNotMatch(
    dormantSource,
    /\.\/memory-bundle(?:-[a-z]+)?\.mjs/,
  )
})

test('M2-A2-07 semantic mutation, transaction, capability, and plan graphs are closed', () => {
  const sources = new Map(SEALED_PRODUCTION_MODULES.map((repoPath) => [
    repoPath,
    readFileSync(join(REPO_ROOT, repoPath), 'utf8'),
  ]))
  const pathsMatching = (pattern) => [...sources]
    .filter(([, source]) => {
      pattern.lastIndex = 0
      return pattern.test(source)
    })
    .map(([repoPath]) => repoPath)
    .toSorted(compareBinary)
  const sourceSpan = (source, startMarker, endMarker) => {
    const start = source.indexOf(startMarker)
    assert.notEqual(start, -1, `missing source marker: ${startMarker}`)
    const end = source.indexOf(endMarker, start + startMarker.length)
    assert.notEqual(end, -1, `missing source marker: ${endMarker}`)
    return { end, source: source.slice(start, end), start }
  }
  const literalValues = (source, pattern) => [...source.matchAll(pattern)]
    .map((match) => match[1])

  const rawShortcut = /\.(?:addMemory|supersedeMemory|insertMemory|addMemoryLink|bumpImportance|touchMemory|initializeSchema)\s*\(/
  assert.deepEqual(pathsMatching(rawShortcut), [])

  const producerPaths = [
    ['scripts', 'run-live-slice.mjs'].join('/'),
    ['src', 'adapter.mjs'].join('/'),
    ['src', 'eval-prompt-config.mjs'].join('/'),
    'src/gate.mjs',
    ['src', 'gemini.mjs'].join('/'),
    ['src', 'longmemeval.mjs'].join('/'),
    'src/memory-briefing.mjs',
    'src/memory-extraction.mjs',
    'src/recall.mjs',
    'src/routing-budgets.mjs',
    ['src', 'slice.mjs'].join('/'),
    'src/store.mjs',
    'src/util.mjs',
  ]
  for (const repoPath of producerPaths) {
    assert.doesNotMatch(
      sources.get(repoPath),
      /\.db\b|\b(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b|\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM)?\b/,
      `${repoPath} reaches a raw connection, transaction, or SQL mutation`,
    )
  }

  const semanticCdxDml = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:main\.)?(?:memories|memory_links)\b/gi
  const semanticDmlFiles = []
  let semanticDmlCount = 0
  for (const [repoPath, source] of sources) {
    const matches = source.match(semanticCdxDml) ?? []
    if (matches.length > 0) semanticDmlFiles.push(repoPath)
    semanticDmlCount += matches.length
  }
  assert.deepEqual(semanticDmlFiles, ['src/legacy-mutation-router.mjs'])
  assert.equal(semanticDmlCount, 8, 'one exact SQL child for each A2 effect kind')

  const routerSource = sources.get('src/legacy-mutation-router.mjs')
  const childApplier = sourceSpan(
    routerSource,
    'export function applyLegacyMutationEffectInTransaction',
    'function captureRouterOptions',
  )
  for (const match of routerSource.matchAll(
    /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:main\.)?(?:memories|memory_links)\b/gi,
  )) {
    assert.ok(
      match.index >= childApplier.start && match.index < childApplier.end,
      `semantic DML escaped the lease-checked child applier: ${match[0]}`,
    )
  }

  const ftsDml = /\b(?:INSERT\s+INTO|DELETE\s+FROM)\s+(?:main\.)?memory_fts\b/gi
  assert.deepEqual(pathsMatching(ftsDml), [
    'src/cdx-b2-journal.mjs',
    'src/kernel-store-runtime.mjs',
  ])
  assert.equal(
    sources.get('src/cdx-b2-journal.mjs').match(ftsDml)?.length,
    8,
    'B2 journal mentions only the copied A2 FTS trigger manifest DML',
  )
  assert.equal(
    sources.get('src/kernel-store-runtime.mjs').match(ftsDml)?.length,
    9,
    'only the exact bootstrap trigger manifests and integrity command mention FTS DML',
  )

  const transactionToken = /\b(?:BEGIN(?:\s+IMMEDIATE)?|COMMIT|ROLLBACK(?:\s+TO)?|SAVEPOINT|RELEASE)\b/
  assert.deepEqual(pathsMatching(transactionToken), [
    'src/cdx-b2-journal.mjs',
    'src/cdx-b2-schema.mjs',
    'src/kernel-store-runtime.mjs',
    'src/memory-bundle-apply.mjs',
    'src/memory-bundle-schema.mjs',
    'src/memory-bundle.mjs',
    'src/mutation-coordinator.mjs',
  ])

  assert.deepEqual(pathsMatching(/\bexecuteLegacyStoreIntent\b/), [
    'src/gate.mjs',
    'src/kernel-store-runtime.mjs',
  ])
  assert.deepEqual(pathsMatching(/\bassertKernelStoreCapability\b/), [
    'src/gate.mjs',
    'src/kernel-store-runtime.mjs',
  ])
  assert.deepEqual(pathsMatching(/\bcreateLegacyMutationRouter\b/), [
    'src/kernel-store-runtime.mjs',
    'src/legacy-mutation-router.mjs',
  ])
  assert.deepEqual(pathsMatching(/\bcreateMutationCoordinator\b/), [
    'src/legacy-mutation-router.mjs',
    'src/mutation-coordinator.mjs',
  ])
  assert.deepEqual(pathsMatching(/\bimport\(/), [])
  assert.deepEqual(pathsMatching(/from\s*['"]node:sqlite['"]/), [
    'src/cdx-b2-journal.mjs',
    'src/kernel-store-runtime.mjs',
    'src/legacy-mutation-router.mjs',
    'src/memory-bundle-runtime.mjs',
    'src/mutation-coordinator.mjs',
  ])

  const gateSource = sources.get('src/gate.mjs')
  const routedIntents = [...gateSource.matchAll(/intentKind:\s*'([^']+)'/g)]
    .map((match) => match[1])
  assert.deepEqual([...new Set(routedIntents)].toSorted(compareBinary), [
    'legacy_delete_memory',
    'legacy_forget_topic',
    'legacy_proposal',
    'legacy_record_recall_inclusion',
    'legacy_run_lifecycle',
  ])
  const gatedIntentSections = [
    [
      'gate.propose',
      'function captureExplicitProposal',
      'export function createMemoryGate',
      'legacy_proposal',
    ],
    [
      'proposeExtractedMemoryCandidate',
      'export function proposeExtractedMemoryCandidate',
      'export function createGatedStore',
      'legacy_proposal',
    ],
    [
      'deleteMemory',
      '    deleteMemory(id, optionsValue) {',
      '    enabled,',
      'legacy_delete_memory',
    ],
    [
      'recordRecallInclusion',
      '    recordRecallInclusion(memoryIds, optionsValue) {',
      '    runLifecycleJobs(optionsValue) {',
      'legacy_record_recall_inclusion',
    ],
    [
      'runLifecycleJobs',
      '    runLifecycleJobs(optionsValue) {',
      '    searchMemories:',
      'legacy_run_lifecycle',
    ],
    [
      'topicForget',
      '    topicForget(query, scopeValue, optionsValue) {',
      '  })\n\n  weakSet(gatedStates',
      'legacy_forget_topic',
    ],
  ]
  for (const [name, start, end, expectedIntent] of gatedIntentSections) {
    const section = sourceSpan(gateSource, start, end).source
    assert.deepEqual(
      literalValues(section, /intentKind:\s*'([^']+)'/g),
      [expectedIntent],
      `${name} must map to exactly one sealed intent`,
    )
  }

  const plannedEffects = [...routerSource.matchAll(/\beffect\('([^']+)'/g)]
    .map((match) => match[1])
  assert.deepEqual([...new Set(plannedEffects)].toSorted(compareBinary), [
    'cdx_link_insert',
    'cdx_memory_decay',
    'cdx_memory_delete',
    'cdx_memory_end_validity',
    'cdx_memory_insert',
    'cdx_memory_set_importance',
    'cdx_memory_set_shared',
    'cdx_memory_touch',
  ])
  const plannerEffectSections = [
    [
      'supersedePlan',
      'function supersedePlan',
      'function resolveProposal',
      [
        'cdx_memory_end_validity',
        'cdx_memory_insert',
        'cdx_link_insert',
      ],
    ],
    [
      'resolveProposal direct branches',
      'function resolveProposal',
      'function resolveDelete',
      [
        'cdx_memory_delete',
        'cdx_memory_end_validity',
        'cdx_memory_set_shared',
        'cdx_memory_set_importance',
        'cdx_memory_insert',
      ],
    ],
    [
      'resolveDelete',
      'function resolveDelete',
      'function resolveTopic',
      ['cdx_memory_delete'],
    ],
    [
      'resolveTopic',
      'function resolveTopic',
      'function resolveRecall',
      ['cdx_memory_delete'],
    ],
    [
      'resolveRecall',
      'function resolveRecall',
      'function resolveLifecycle',
      ['cdx_memory_touch', 'cdx_memory_set_importance'],
    ],
    [
      'resolveLifecycle',
      'function resolveLifecycle',
      'function validateRow',
      ['cdx_memory_delete', 'cdx_memory_decay'],
    ],
  ]
  for (const [name, start, end, expectedEffects] of plannerEffectSections) {
    const section = sourceSpan(routerSource, start, end).source
    assert.deepEqual(
      literalValues(section, /\beffect\('([^']+)'/g),
      expectedEffects,
      `${name} lost or gained a sealed effect branch`,
    )
  }

  const directApplierImport = /import\s*\{[^}]*\bapplyLegacyMutationEffectInTransaction\b[^}]*\}\s*from\s*['"][^'"]*legacy-mutation-router\.mjs['"]/s
  const directApplierImporters = recursiveModuleFiles(join(REPO_ROOT, 'tests'))
    .filter((path) => directApplierImport.test(readFileSync(path, 'utf8')))
    .map((path) => relative(REPO_ROOT, path))
    .toSorted(compareBinary)
  assert.deepEqual(directApplierImporters, [
    'tests/legacy-mutation-router.contract.test.mjs',
    'tests/mutation-coordinator-composition.contract.test.mjs',
  ])
})

test('M2-A2-07 B2 obligation matrix retains every sealed dimension and branch family', () => {
  const source = readFileSync(
    join(REPO_ROOT, 'docs/LEGACY-MUTATION-B2-OBLIGATIONS.md'),
    'utf8',
  )
  const contractSource = readFileSync(
    join(REPO_ROOT, 'docs/LEGACY-MUTATION-ROUTING-CONTRACT.md'),
    'utf8',
  )
  const contractSection = contractSource.match(
    /## 11\. M2-B map-or-refuse obligation\n([\s\S]*?)(?=\n## 12\.)/,
  )
  assert.ok(contractSection, 'contract §11 must remain present')
  const contractKey = contractSection[1].match(/```text\n([\s\S]*?)\n```/)
  assert.ok(contractKey, 'contract §11 must retain its sealed dimension key')
  const normalizeDimension = (value) => value.replace(/\s+/g, ' ').trim()
  const contractDimensions = contractKey[1]
    .split('×')
    .map(normalizeDimension)
  assert.equal(contractDimensions.length, 22)

  const artifactKey = source.match(
    /## 1\. Exact branch-pattern key\n([\s\S]*?)(?=\n## 2\.)/,
  )
  assert.ok(artifactKey, 'obligation artifact must retain its dimension key')
  const numberedDimensions = [...artifactKey[1].matchAll(
    /^(\d+)\. (.+?)[;.]$/gm,
  )]
  assert.deepEqual(
    numberedDimensions.map((match) => Number(match[1])),
    contractDimensions.map((_, index) => index + 1),
  )
  assert.deepEqual(
    numberedDimensions.map((match) => normalizeDimension(match[2])),
    contractDimensions,
    'obligation dimensions must derive exactly from the normative §11 key',
  )

  const expectedIds = [
    'PRE-01','PRE-02','PRE-03','P-01','P-02','P-03','P-04','P-05',
    'PA-01','PA-02','PA-03','PA-04','PX-01','PX-02','PX-03',
    'PS-01','PS-02','PS-03','PD-01','PD-02','PD-03','PR-01',
    'D-01','D-02','D-03','T-01','T-02','T-03','R-01','R-02','R-03',
    'L-01','L-02','L-03','L-04','E-01','E-02','E-03','E-04','E-05',
    'S-01','S-02','S-03','F-01','F-02','F-03',
  ]
  const rows = source.split('\n').filter((line) => /^\| [A-Z]+-[0-9]+ \|/.test(line))
  assert.deepEqual(rows.map((line) => line.split('|')[1].trim()), expectedIds)
  for (const row of rows) {
    const id = row.split('|')[1].trim()
    assert.match(
      row,
      id.startsWith('F-')
        ? /\| M2-B MUST REFUSE \|$/
        : /\| M2-B MUST MAP OR REFUSE \|$/,
      `${id} lost its required pending disposition`,
    )
  }
  for (const token of [
    'cdx_memory_insert',
    'cdx_memory_end_validity',
    'cdx_memory_set_shared',
    'cdx_memory_set_importance',
    'cdx_memory_touch',
    'cdx_memory_decay',
    'cdx_memory_delete',
    'cdx_link_insert',
    'effect ordinal `0..n-1`',
    'FTS insert trigger',
    'FTS delete trigger + all link FK cascades',
    'empty Palari cross-Palari sweep',
    'remove main, `-wal`, `-shm`, `-journal`',
  ]) {
    assert.ok(source.includes(token), `obligation matrix omits ${token}`)
  }
})

test('M2-A2-07 extraction provenance and divergence ledger stay pinned', () => {
  const dormantPath = join(REPO_ROOT, 'src/memory-store.mjs')
  const dormant = readFileSync(dormantPath)
  const blobHash = createHash('sha1')
    .update(`blob ${dormant.byteLength}\0`)
    .update(dormant)
    .digest('hex')
  assert.equal(blobHash, '64e647232facc8682c86386cf9d98770193416e2')

  const requiredLedgerTokens = new Map([
    ['src/kernel-store-runtime.mjs', [
      '190a4ad2f8d5187f5f21222048dd11efb2ad9991',
      '4f67d0fe96dd',
      '64e647232facc8682c86386cf9d98770193416e2',
      'Copied regions are the CDX-M0',
      'Intentional A2 deltas:',
      'src/memory-store.mjs is never',
    ]],
    ['src/legacy-mutation-router.mjs', [
      '190a4ad2f8d5187f5f21222048dd11efb2ad9991',
      '4f67d0fe96dd',
      '64e647232facc8682c86386cf9d98770193416e2',
      'd8367ceb900c',
      'eb8336ca92d8add299a5b89e1dffe81b153a3f71',
      'Intentional deltas',
    ]],
    ['src/memory-extraction.mjs', [
      '190a4ad2f8d5187f5f21222048dd11efb2ad9991',
      'd8367ceb900c',
      'eb8336ca92d8add299a5b89e1dffe81b153a3f71',
      'A2 replaces the extraction/session-summary raw-store',
      'moves contradiction selection',
    ]],
  ])
  for (const [repoPath, tokens] of requiredLedgerTokens) {
    const source = readFileSync(join(REPO_ROOT, repoPath), 'utf8')
    for (const token of tokens) {
      assert.ok(source.includes(token), `${repoPath} lost provenance token ${token}`)
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
    'src/cdx-b2-schema.mjs',
    'src/gate.mjs',
    'src/kernel-store-runtime.mjs',
    'src/legacy-mutation-router.mjs',
    'src/mutation-coordinator.mjs',
    'src/store.mjs',
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
