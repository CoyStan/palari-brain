import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { DatabaseSync, StatementSync } from 'node:sqlite'

import { createMutationCoordinator } from '../src/mutation-coordinator.mjs'
import * as routerModule from '../src/legacy-mutation-router.mjs'
import {
  LegacyMutationError,
  applyLegacyMutationEffectInTransaction,
  createLegacyMutationRouter,
  legacyMutationEffectKinds,
  legacyMutationIntentKinds,
} from '../src/legacy-mutation-router.mjs'

const instrumentationFixture = fileURLToPath(new URL(
  './fixtures/legacy-mutation-router-instrumentation-child.mjs',
  import.meta.url,
))

const fixedTime = '2026-01-15T00:00:00.000Z'
const laterTime = '2026-02-01T00:00:00.000Z'
const policy = Object.freeze({
  demote: 0,
  promote: 0.25,
  permanent: 0.6,
  ratify: 0.75,
})

const legacyErrors = Object.freeze({
  legacy_invalid_argument: 'A valid legacy mutation argument is required.',
  legacy_invalid_capability: 'A supported branded memory capability is required.',
  legacy_store_closed: 'The memory store is closed.',
  legacy_manager_closed: 'The workspace memory manager is closed.',
  legacy_plan_invalid: 'A router-issued legacy mutation plan is required.',
  legacy_plan_stale: 'The legacy mutation plan is stale for this transaction.',
  legacy_plan_applied: 'The legacy mutation plan has already been consumed.',
  legacy_effect_invalid: 'A valid legacy mutation effect is required.',
  legacy_effect_cardinality: 'A legacy mutation effect changed an unexpected number of rows.',
  legacy_schema_invalid: 'The CDX-M1 runtime schema does not match the required manifest.',
  legacy_store_open: 'The memory database has a supported live or blocked connection.',
  legacy_path_invalid: 'A valid memory database path is required.',
})

const memoryKeys = Object.freeze([
  'id','palari_id','user_id','type','content','keywords','importance',
  'valid_from','valid_until','access_count','last_accessed','created_at',
  'shared','confidence','acquisition_mode','created_by_pipeline','fictional',
  'last_decayed_at','source_message_id','content_hash','source_kind','extractor',
])

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor && Object.hasOwn(descriptor, 'value')) {
      assertDeepFrozen(descriptor.value)
    }
  }
}

function exactRows(db, table, orderBy = 'id') {
  return db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all()
}

function durableSnapshot(db) {
  return {
    fts: exactRows(db, 'memory_fts', 'memory_id'),
    links: exactRows(db, 'memory_links'),
    memories: exactRows(db, 'memories'),
  }
}

function createDatabase(path = ':memory:') {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE main.memories (
      id TEXT PRIMARY KEY,
      palari_id TEXT NOT NULL,
      user_id TEXT,
      type TEXT NOT NULL CHECK (type IN (
        'relationship','preference','opinion','entity','life_event',
        'working','project','recent_life','session_summary'
      )),
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      importance REAL NOT NULL DEFAULT 0.5,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed TEXT,
      created_at TEXT NOT NULL,
      shared INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0, 1)),
      confidence REAL NOT NULL DEFAULT 0.5,
      acquisition_mode TEXT NOT NULL DEFAULT 'direct' CHECK (
        acquisition_mode IN ('direct','told_to_me','extracted','summarized')
      ),
      created_by_pipeline INTEGER NOT NULL DEFAULT 0 CHECK (created_by_pipeline IN (0, 1)),
      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      last_decayed_at TEXT,
      source_message_id TEXT,
      content_hash TEXT NOT NULL,
      source_kind TEXT,
      extractor TEXT
    );
    CREATE TABLE main.memory_links (
      id TEXT PRIMARY KEY,
      from_memory_id TEXT NOT NULL,
      to_memory_id TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'associated',
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      CHECK (from_memory_id <> to_memory_id)
    );
    CREATE VIRTUAL TABLE main.memory_fts USING fts5(
      memory_id UNINDEXED,
      palari_id UNINDEXED,
      content,
      keywords
    );
    CREATE TRIGGER main.memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid,memory_id,palari_id,content,keywords)
      VALUES(new.rowid,new.id,new.palari_id,new.content,new.keywords);
    END;
    CREATE TRIGGER main.memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END;
  `)
  return db
}

function baseRecord(overrides = {}) {
  return {
    id: null,
    palari_id: 'palari-a',
    user_id: 'user-a',
    type: 'preference',
    content: 'User prefers tea',
    keywords: ['tea'],
    importance: 0.6,
    valid_from: null,
    valid_until: null,
    last_accessed: null,
    created_at: null,
    shared: false,
    confidence: 0.9,
    acquisition_mode: null,
    fictional: false,
    last_decayed_at: null,
    source_message_id: null,
    content_hash: null,
    ...overrides,
  }
}

function baseProvenance(overrides = {}) {
  return {
    actor: null,
    eventAt: null,
    extractor: null,
    sourceKind: 'user_message',
    sourceMessageId: 'msg-a',
    writer: 'explicit_user_action',
    ...overrides,
  }
}

function proposalEnvelope({
  kind = 'permanent',
  op = 'add',
  producer = 'explicit_proposal',
  provenance = baseProvenance(),
  record = baseRecord(),
  scope = { palariId: null, userId: null },
  target = null,
} = {}) {
  return {
    intentKind: 'legacy_proposal',
    op,
    policy,
    producer,
    proposalKind: kind,
    provenance,
    record,
    scope,
    target,
  }
}

function canonicalRow(values = {}) {
  return {
    id: 'seed',
    palari_id: 'palari-a',
    user_id: 'user-a',
    type: 'working',
    content: 'seed content',
    keywords: 'seed',
    importance: 0.5,
    valid_from: '2025-01-01T00:00:00.000Z',
    valid_until: null,
    access_count: 0,
    last_accessed: null,
    created_at: '2025-01-01T00:00:00.000Z',
    shared: 0,
    confidence: 0.8,
    acquisition_mode: 'direct',
    created_by_pipeline: 0,
    fictional: 0,
    last_decayed_at: null,
    source_message_id: null,
    content_hash: 'seed-hash',
    source_kind: 'user_message',
    extractor: null,
    ...values,
  }
}

function seed(db, values = {}) {
  const row = canonicalRow(values)
  db.prepare(`INSERT INTO main.memories (
    id,palari_id,user_id,type,content,keywords,importance,valid_from,
    valid_until,access_count,last_accessed,created_at,shared,confidence,
    acquisition_mode,created_by_pipeline,fictional,last_decayed_at,
    source_message_id,content_hash,source_kind,extractor
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...Object.values(row))
  return row
}

test('M2-A2-01 exact namespace vocabularies, errors, capture, and dispatch hardening', () => {
  assert.deepEqual(Object.keys(routerModule), [
    'LegacyMutationError',
    'applyLegacyMutationEffectInTransaction',
    'createLegacyMutationRouter',
    'legacyMutationEffectKinds',
    'legacyMutationIntentKinds',
  ])
  assert.deepEqual(legacyMutationIntentKinds, [
    'legacy_proposal',
    'legacy_delete_memory',
    'legacy_forget_topic',
    'legacy_record_recall_inclusion',
    'legacy_run_lifecycle',
  ])
  assert.deepEqual(legacyMutationEffectKinds, [
    'cdx_memory_insert',
    'cdx_memory_end_validity',
    'cdx_memory_set_shared',
    'cdx_memory_set_importance',
    'cdx_memory_touch',
    'cdx_memory_decay',
    'cdx_memory_delete',
    'cdx_link_insert',
  ])
  assert.ok(Object.isFrozen(legacyMutationIntentKinds))
  assert.ok(Object.isFrozen(legacyMutationEffectKinds))
  assert.throws(
    () => new LegacyMutationError('unknown', 'x'),
    { name: 'TypeError', message: 'Unknown legacy mutation error code.' },
  )

  const db = createDatabase()
  let clockCalls = 0
  let idCalls = 0
  let keywordCalls = 0
  const router = createLegacyMutationRouter(db, {
    clock: () => {
      clockCalls += 1
      return fixedTime
    },
  })
  assert.deepEqual(Object.keys(router), ['apply', 'capture', 'execute', 'resolve'])
  assert.ok(Object.isFrozen(router))
  const record = baseRecord({
    id: { toString() { idCalls += 1; return ' captured-id ' } },
    keywords: [{ toString() { keywordCalls += 1; return ' source ' } }],
  })
  const captured = router.capture(proposalEnvelope({
    provenance: baseProvenance({
      eventAt: '2026-01-14T00:00:00.000Z',
      extractor: 'extractor-a',
      sourceKind: 'source_document',
      writer: 'background_extraction',
    }),
    record,
  }))
  assert.deepEqual(Object.keys(captured), [
    'intentKind', 'nativeWallTime', 'op', 'policy', 'producer',
    'proposalKind', 'provenance', 'record', 'scope', 'storeTime', 'target',
  ])
  assert.equal(captured.record.id, 'captured-id')
  assert.equal(captured.record.keywords, 'source source:source_document')
  assert.equal(idCalls, 1)
  assert.equal(keywordCalls, 1)
  assert.equal(clockCalls, 1)
  assert.ok(Object.isFrozen(captured.record))

  const originalSetHas = Set.prototype.has
  const originalPrepare = DatabaseSync.prototype.prepare
  const originalRun = StatementSync.prototype.run
  try {
    Set.prototype.has = () => { throw new Error('live Set dispatch') }
    DatabaseSync.prototype.prepare = () => { throw new Error('live prepare') }
    StatementSync.prototype.run = () => { throw new Error('live run') }
    assert.equal(router.execute(captured).outcome, 'inserted')
  } finally {
    Set.prototype.has = originalSetHas
    DatabaseSync.prototype.prepare = originalPrepare
    StatementSync.prototype.run = originalRun
    db.close()
  }
})

test('M2-A2-01 all twelve legacy errors have exact constructor and descriptor law', () => {
  const cause = Object.freeze({ marker: 'cause' })
  for (const [code, message] of Object.entries(legacyErrors)) {
    const error = new LegacyMutationError(code, message, cause)
    assert.ok(error instanceof Error)
    assert.ok(error instanceof LegacyMutationError)
    assert.equal(error.name, 'LegacyMutationError')
    assert.equal(error.code, code)
    assert.equal(error.message, message)
    assert.equal(error.cause, cause)
    assert.deepEqual(Object.keys(error), ['code'])
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'code'), {
      value: code,
      writable: false,
      enumerable: true,
      configurable: false,
    })
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'message'), {
      value: message,
      writable: true,
      enumerable: false,
      configurable: true,
    })
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'cause'), {
      value: cause,
      writable: true,
      enumerable: false,
      configurable: true,
    })
    assert.equal(Object.getOwnPropertyDescriptor(error, 'name').enumerable, false)
    assert.throws(() => { error.code = 'legacy_store_closed' }, TypeError)

    const withoutCause = new LegacyMutationError(code, message)
    assert.equal(Object.hasOwn(withoutCause, 'cause'), false)
  }
  for (const code of [undefined, null, 0, {}, 'unknown']) {
    assert.throws(
      () => new LegacyMutationError(code, 'message'),
      { name: 'TypeError', message: 'Unknown legacy mutation error code.' },
    )
  }
  for (const message of [undefined, null, '', 0, {}, Symbol('message')]) {
    assert.throws(
      () => new LegacyMutationError('legacy_invalid_argument', message),
      {
        name: 'TypeError',
        message: 'Legacy mutation error message must be a non-empty string.',
      },
    )
  }
})

test('M2-A2-01 exact options and nested canonical envelopes fail closed', () => {
  const db = createDatabase()
  try {
    assert.throws(
      () => createLegacyMutationRouter(db, { clock: () => fixedTime, extra: 1 }),
      { code: 'legacy_invalid_argument' },
    )
    assert.throws(
      () => createLegacyMutationRouter(db, { [Symbol('extra')]: true }),
      { code: 'legacy_invalid_argument' },
    )
    let getterCalls = 0
    const accessorOptions = {}
    Object.defineProperty(accessorOptions, 'clock', {
      enumerable: true,
      get() {
        getterCalls += 1
        return () => fixedTime
      },
    })
    assert.throws(
      () => createLegacyMutationRouter(db, accessorOptions),
      { code: 'legacy_invalid_argument' },
    )
    assert.equal(getterCalls, 0)

    const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
    const badPolicy = { ...policy, extra: 1 }
    const badProvenance = baseProvenance()
    delete badProvenance.extractor
    const badRecord = baseRecord()
    badRecord[Symbol('extra')] = true
    const badScope = { palariId: 'palari-a', userId: 'user-a', extra: true }
    const cases = [
      proposalEnvelope({ record: baseRecord(), provenance: baseProvenance() }),
      proposalEnvelope({ provenance: badProvenance }),
      proposalEnvelope({ record: badRecord }),
      proposalEnvelope({
        producer: 'extraction_candidate',
        provenance: baseProvenance({
          eventAt: '2026-01-14T00:00:00.000Z',
          extractor: 'extractor-a',
          writer: 'background_extraction',
        }),
        scope: badScope,
      }),
    ]
    cases[0].policy = badPolicy
    for (const intent of cases) {
      assert.throws(
        () => router.capture(intent),
        { code: 'legacy_invalid_argument' },
      )
    }
  } finally {
    db.close()
  }
})

test('M2-A2-01 canonical boundary rejects proxies, accessors, inheritance, and extra keys trap-free', () => {
  const db = createDatabase()
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    assert.throws(() => router.capture(undefined), { code: 'legacy_invalid_argument' })
    assert.throws(() => router.capture(null), { code: 'legacy_invalid_argument' })
    assert.throws(
      () => router.capture(new Proxy({ intentKind: 'legacy_delete_memory' }, {
        get() { throw new Error('proxy get') },
        ownKeys() { throw new Error('proxy ownKeys') },
      })),
      { code: 'legacy_invalid_argument' },
    )
    let intentGetterCalls = 0
    const accessorIntent = {}
    Object.defineProperty(accessorIntent, 'intentKind', {
      enumerable: true,
      get() {
        intentGetterCalls += 1
        return 'legacy_delete_memory'
      },
    })
    assert.throws(() => router.capture(accessorIntent), {
      code: 'legacy_invalid_argument',
    })
    assert.equal(intentGetterCalls, 0)

    const inherited = Object.create({ intentKind: 'legacy_delete_memory' })
    inherited.actor = 'explicit_user_action'
    inherited.id = 'seed'
    assert.throws(() => router.capture(inherited), {
      code: 'legacy_invalid_argument',
    })
    const extra = {
      intentKind: 'legacy_delete_memory',
      actor: 'explicit_user_action',
      id: 'seed',
      ignored: true,
    }
    assert.throws(() => router.capture(extra), { code: 'legacy_invalid_argument' })
    const symbolExtra = {
      intentKind: 'legacy_delete_memory',
      actor: 'explicit_user_action',
      id: 'seed',
      [Symbol('extra')]: true,
    }
    assert.throws(() => router.capture(symbolExtra), {
      code: 'legacy_invalid_argument',
    })

    const provenance = baseProvenance()
    let writerCalls = 0
    Object.defineProperty(provenance, 'writer', {
      enumerable: true,
      get() {
        writerCalls += 1
        return 'explicit_user_action'
      },
    })
    assert.throws(() => router.capture(proposalEnvelope({ provenance })), {
      code: 'legacy_invalid_argument',
    })
    assert.equal(writerCalls, 0)

    db.close()
    assert.throws(() => router.capture({ intentKind: 'unknown' }), {
      code: 'legacy_invalid_argument',
    })
  } finally {
    if (db.isOpen) db.close()
  }
})

test('M2-A2-01 all five captured envelopes have exact ordered primitive shapes', () => {
  const db = createDatabase()
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const captures = [
      [
        router.capture(proposalEnvelope({ record: baseRecord({ id: 'captured' }) })),
        [
          'intentKind', 'nativeWallTime', 'op', 'policy', 'producer',
          'proposalKind', 'provenance', 'record', 'scope', 'storeTime', 'target',
        ],
      ],
      [
        router.capture({
          intentKind: 'legacy_delete_memory',
          actor: ' explicit_user_action ',
          id: ' captured ',
        }),
        ['intentKind', 'actor', 'id'],
      ],
      [
        router.capture({
          intentKind: 'legacy_forget_topic',
          actor: 'lifecycle_job',
          palariId: ' palari-a ',
          query: ' tea ',
          userId: ' user-a ',
        }),
        ['intentKind', 'actor', 'palariId', 'query', 'userId'],
      ],
      [
        router.capture({
          intentKind: 'legacy_record_recall_inclusion',
          actor: 'lifecycle_job',
          bumpAmount: 0.2,
          memoryIds: [' a ', 'a', '', null, 'b'],
        }),
        ['intentKind', 'actor', 'bumpAmount', 'memoryIds', 'storeTime'],
      ],
      [
        router.capture({
          intentKind: 'legacy_run_lifecycle',
          now: laterTime,
          palariId: ' palari-a ',
        }),
        ['intentKind', 'now', 'palariId'],
      ],
    ]
    for (const [captured, keys] of captures) {
      assert.deepEqual(Reflect.ownKeys(captured), keys)
      assertDeepFrozen(captured)
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(captured, key)
        assert.equal(Object.hasOwn(descriptor, 'value'), true)
        assert.equal(descriptor.enumerable, true)
      }
    }
    const [proposal, deletion, topic, recall, lifecycle] = captures.map(([value]) => value)
    assert.deepEqual(Reflect.ownKeys(proposal.policy), [
      'demote', 'promote', 'permanent', 'ratify',
    ])
    assert.deepEqual(Reflect.ownKeys(proposal.provenance), [
      'actor', 'eventAt', 'extractor', 'sourceKind', 'sourceMessageId', 'writer',
    ])
    assert.deepEqual(Reflect.ownKeys(proposal.record), [
      'id', 'palari_id', 'user_id', 'type', 'content', 'keywords',
      'importance', 'valid_from', 'valid_until', 'last_accessed', 'created_at',
      'shared', 'confidence', 'acquisition_mode', 'fictional',
      'last_decayed_at', 'source_message_id', 'content_hash',
    ])
    assert.deepEqual(Reflect.ownKeys(proposal.scope), ['palariId', 'userId'])
    assert.equal(deletion.actor, 'explicit_user_action')
    assert.equal(deletion.id, 'captured')
    assert.equal(topic.query, 'tea')
    assert.equal(topic.palariId, 'palari-a')
    assert.equal(topic.userId, 'user-a')
    assert.deepEqual(recall.memoryIds, ['a', 'b'])
    assert.equal(recall.storeTime, fixedTime)
    assert.equal(lifecycle.now, laterTime)
    assert.equal(lifecycle.palariId, 'palari-a')

    const other = createLegacyMutationRouter(db, { clock: () => fixedTime })
    assert.throws(() => other.capture(proposal), {
      code: 'legacy_invalid_argument',
      message: legacyErrors.legacy_invalid_argument,
    })
  } finally {
    db.close()
  }
})

test('M2-A2-01 plan branding, deep freeze, lease binding, use-once, and staleness', () => {
  const db = createDatabase()
  seed(db, { id: 'plan-target' })
  const coordinator = createMutationCoordinator(db)
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  const siblingRouter = createLegacyMutationRouter(db, { clock: () => fixedTime })
  const captured = router.capture({
    intentKind: 'legacy_delete_memory',
    actor: 'explicit_user_action',
    id: 'plan-target',
  })
  let stalePlan
  try {
    coordinator.run((lease) => {
      const before = durableSnapshot(db)
      const plan = router.resolve(lease, captured)
      stalePlan = plan
      assert.deepEqual(Reflect.ownKeys(plan), [
        'version', 'intentKind', 'outcome', 'effects', 'result',
      ])
      assert.equal(plan.version, 'CDX-M1-legacy-plan@1')
      assert.equal(plan.intentKind, 'legacy_delete_memory')
      assert.equal(plan.outcome, 'deleted')
      assert.deepEqual(plan.effects.map(({ kind }) => kind), ['cdx_memory_delete'])
      assertDeepFrozen(plan)
      assert.deepEqual(durableSnapshot(db), before, 'resolve must be read-only')
      assert.throws(() => siblingRouter.apply(lease, plan), {
        code: 'legacy_plan_stale',
        message: legacyErrors.legacy_plan_stale,
      })
      assert.throws(() => router.apply(lease, {
        version: plan.version,
        intentKind: plan.intentKind,
        outcome: plan.outcome,
        effects: plan.effects,
        result: plan.result,
      }), {
        code: 'legacy_plan_invalid',
        message: legacyErrors.legacy_plan_invalid,
      })
      router.apply(lease, plan)
      assert.equal(
        db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?')
          .get('plan-target').count,
        0,
      )
      assert.throws(() => router.apply(lease, plan), {
        code: 'legacy_plan_applied',
        message: legacyErrors.legacy_plan_applied,
      })
    })
    assert.throws(() => router.apply({}, stalePlan), {
      code: 'mutation_invalid_argument',
    })
    coordinator.run((laterLease) => {
      assert.throws(() => router.apply(laterLease, stalePlan), {
        code: 'legacy_plan_stale',
        message: legacyErrors.legacy_plan_stale,
      })
    })

    seed(db, { id: 'consume-before-effect' })
    db.exec(`CREATE TRIGGER reject_consumed_delete
      BEFORE DELETE ON memories WHEN old.id = 'consume-before-effect'
      BEGIN SELECT RAISE(ABORT, 'consume failure'); END;`)
    const failingCapture = router.capture({
      intentKind: 'legacy_delete_memory',
      actor: 'explicit_user_action',
      id: 'consume-before-effect',
    })
    coordinator.run((lease) => {
      const plan = router.resolve(lease, failingCapture)
      assert.throws(() => router.apply(lease, plan), /consume failure/)
      assert.throws(() => router.apply(lease, plan), {
        code: 'legacy_plan_applied',
      })
    })
  } finally {
    db.close()
  }
})

test('M2-A2-01 capture detaches ignored actor/writer values and extraction is add-only', () => {
  const db = createDatabase()
  let clockCalls = 0
  const router = createLegacyMutationRouter(db, {
    clock: () => {
      clockCalls += 1
      return fixedTime
    },
  })
  try {
    const callerActor = {}
    callerActor.self = callerActor
    const ratify = router.capture(proposalEnvelope({
      kind: 'ratify',
      op: 'share',
      provenance: baseProvenance({ actor: callerActor }),
      record: null,
      target: 'seed',
    }))
    assert.equal(ratify.provenance.actor, null)
    assert.equal(Object.isFrozen(callerActor), false)

    function callerWriter() {}
    const demote = router.capture(proposalEnvelope({
      kind: 'demote',
      op: 'end_validity',
      provenance: baseProvenance({
        actor: 'lifecycle_job',
        eventAt: fixedTime,
        writer: callerWriter,
      }),
      record: null,
      target: 'seed',
    }))
    assert.equal(demote.provenance.writer, null)
    assert.equal(Object.isFrozen(callerWriter), false)

    assert.throws(
      () => router.capture(proposalEnvelope({
        op: 'supersede',
        producer: 'extraction_candidate',
        provenance: baseProvenance({
          eventAt: fixedTime,
          extractor: 'extractor-a',
          writer: 'background_extraction',
        }),
        scope: { palariId: 'palari-a', userId: 'user-a' },
        target: 'seed',
      })),
      { code: 'legacy_invalid_argument' },
    )
    assert.equal(clockCalls, 0)
  } finally {
    db.close()
  }
})

test('M2-A2-01 module-evaluation dispatch, phase purity, and insert cardinality stay captured', () => {
  for (const mode of ['crypto', 'keywords', 'phases', 'cardinality', 'visibility']) {
    const child = spawnSync(process.execPath, [instrumentationFixture, mode], {
      encoding: 'utf8',
    })
    assert.equal(
      child.status,
      0,
      `instrumentation child ${mode} failed:\n${child.stdout}\n${child.stderr}`,
    )
  }
})

test('M2-A2-01 lease binding, effect validation, and exact cardinality', () => {
  const db = createDatabase()
  seed(db)
  const coordinator = createMutationCoordinator(db)
  assert.throws(
    () => applyLegacyMutationEffectInTransaction({}, db, { kind: 'nope' }),
    { code: 'mutation_invalid_argument' },
  )
  coordinator.run((lease) => {
    assert.throws(
      () => applyLegacyMutationEffectInTransaction(lease, db, { kind: 'nope' }),
      { code: 'legacy_effect_invalid' },
    )
    applyLegacyMutationEffectInTransaction(lease, db, {
      kind: 'cdx_memory_set_importance',
      id: 'seed',
      importance: 0.75,
    })
  })
  assert.equal(db.prepare('SELECT importance FROM memories WHERE id=?').get('seed').importance, 0.75)
  assert.throws(
    () => coordinator.run((lease) => {
      applyLegacyMutationEffectInTransaction(lease, db, {
        kind: 'cdx_memory_delete',
        id: 'absent',
      })
    }),
    { code: 'legacy_effect_cardinality' },
  )
  db.close()
})

test('M2-A2-01 direct child applies all eight exact effects under one active lease', () => {
  const db = createDatabase()
  seed(db, { id: 'effect-target' })
  seed(db, { id: 'delete-target', type: 'working' })
  const insertedRow = canonicalRow({
    id: 'effect-insert',
    type: 'working',
    content: 'insert effect content',
    keywords: 'insert effect',
    content_hash: 'insert-effect-hash',
  })
  const link = {
    id: 'effect-link',
    from_memory_id: 'effect-insert',
    to_memory_id: 'effect-target',
    relation: 'supersedes',
    created_at: fixedTime,
  }
  const effects = [
    { kind: 'cdx_memory_insert', row: insertedRow },
    { kind: 'cdx_memory_end_validity', id: 'effect-target', validUntil: laterTime },
    { kind: 'cdx_memory_set_shared', id: 'effect-target' },
    { kind: 'cdx_memory_set_importance', id: 'effect-target', importance: 0.77 },
    { kind: 'cdx_memory_touch', id: 'effect-target', lastAccessed: fixedTime },
    {
      kind: 'cdx_memory_decay',
      id: 'effect-target',
      importance: 0.55,
      lastDecayedAt: laterTime,
    },
    { kind: 'cdx_link_insert', link },
    { kind: 'cdx_memory_delete', id: 'delete-target' },
  ]
  const coordinator = createMutationCoordinator(db)
  let retiredLease
  try {
    coordinator.run((lease) => {
      retiredLease = lease
      for (const effectValue of effects) {
        applyLegacyMutationEffectInTransaction(lease, db, effectValue)
      }
    })
    const target = db.prepare('SELECT * FROM memories WHERE id=?').get('effect-target')
    assert.equal(target.valid_until, laterTime)
    assert.equal(target.shared, 1)
    assert.equal(target.importance, 0.55)
    assert.equal(target.access_count, 1)
    assert.equal(target.last_accessed, fixedTime)
    assert.equal(target.last_decayed_at, laterTime)
    assert.equal(db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?')
      .get('effect-insert').count, 1)
    assert.equal(db.prepare('SELECT COUNT(*) count FROM memory_fts WHERE memory_id=?')
      .get('effect-insert').count, 1)
    assert.deepEqual({
      ...db.prepare('SELECT * FROM memory_links WHERE id=?').get('effect-link'),
    }, link)
    assert.equal(db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?')
      .get('delete-target').count, 0)

    assert.throws(
      () => applyLegacyMutationEffectInTransaction(
        retiredLease,
        db,
        { kind: 'cdx_memory_set_shared', id: 'effect-target' },
      ),
      { code: 'mutation_transaction_ownership_lost' },
    )

    const otherDb = createDatabase()
    try {
      const wrongCoordinator = createMutationCoordinator(db)
      assert.throws(() => wrongCoordinator.run((lease) => {
        applyLegacyMutationEffectInTransaction(
          lease,
          otherDb,
          { kind: 'cdx_memory_set_shared', id: 'effect-target' },
        )
      }), { code: 'mutation_transaction_ownership_lost' })
    } finally {
      otherDb.close()
    }

    let accessorCalls = 0
    const accessorEffect = {}
    Object.defineProperty(accessorEffect, 'kind', {
      enumerable: true,
      get() {
        accessorCalls += 1
        return 'cdx_memory_delete'
      },
    })
    const accessorRow = canonicalRow({ id: 'accessor-row' })
    Object.defineProperty(accessorRow, 'content', {
      enumerable: true,
      get() {
        accessorCalls += 1
        return 'accessor content'
      },
    })
    const accessorLink = { ...link }
    Object.defineProperty(accessorLink, 'relation', {
      enumerable: true,
      get() {
        accessorCalls += 1
        return 'supersedes'
      },
    })
    coordinator.run((lease) => {
      for (const invalid of [
        accessorEffect,
        { kind: 'cdx_memory_insert', row: accessorRow },
        { kind: 'cdx_link_insert', link: accessorLink },
        new Proxy({ kind: 'cdx_memory_delete', id: 'effect-target' }, {}),
        { kind: 'cdx_memory_delete', id: 'effect-target', extra: true },
        { kind: 'cdx_memory_touch', id: 'effect-target', lastAccessed: null },
        { kind: 'cdx_memory_decay', id: 'effect-target', importance: NaN, lastDecayedAt: fixedTime },
        { kind: 'cdx_link_insert', link: { ...link, extra: true } },
      ]) {
        assert.throws(
          () => applyLegacyMutationEffectInTransaction(lease, db, invalid),
          { code: 'legacy_effect_invalid' },
        )
      }
    })
    assert.equal(accessorCalls, 0)

    for (const effectValue of [
      { kind: 'cdx_memory_end_validity', id: 'absent', validUntil: fixedTime },
      { kind: 'cdx_memory_set_shared', id: 'absent' },
      { kind: 'cdx_memory_set_importance', id: 'absent', importance: 0.1 },
      { kind: 'cdx_memory_touch', id: 'absent', lastAccessed: fixedTime },
      { kind: 'cdx_memory_decay', id: 'absent', importance: 0.1, lastDecayedAt: fixedTime },
      { kind: 'cdx_memory_delete', id: 'absent' },
    ]) {
      assert.throws(
        () => coordinator.run((lease) => {
          applyLegacyMutationEffectInTransaction(lease, db, effectValue)
        }),
        {
          code: 'legacy_effect_cardinality',
          message: legacyErrors.legacy_effect_cardinality,
        },
      )
    }
  } finally {
    db.close()
  }
})

test('M2-A2-02 add, duplicate, supersession, demote, ratify, and delete branches', () => {
  const db = createDatabase()
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  const inserted = router.execute(proposalEnvelope({ record: baseRecord({ id: 'memory-a' }) }))
  assert.deepEqual(Object.keys(inserted), ['memory', 'outcome', 'reasons'])
  assert.equal(inserted.outcome, 'inserted')
  assert.deepEqual(Object.keys(inserted.memory), [
    'id','palari_id','user_id','type','content','keywords','importance',
    'valid_from','valid_until','access_count','last_accessed','created_at',
    'shared','confidence','acquisition_mode','created_by_pipeline','fictional',
    'last_decayed_at','source_message_id','content_hash','source_kind','extractor',
  ])
  const duplicate = router.execute(proposalEnvelope({
    record: baseRecord({ id: 'ignored-duplicate' }),
  }))
  assert.equal(duplicate.outcome, 'duplicate_bumped')
  assert.equal(duplicate.memory.id, 'memory-a')

  const superseded = router.execute(proposalEnvelope({
    op: 'supersede',
    record: baseRecord({ id: 'memory-b', content: 'User prefers coffee' }),
    target: ' memory-a ',
  }))
  assert.equal(superseded.outcome, 'superseded')
  assert.equal(superseded.superseded.id, 'memory-a')
  assert.equal(superseded.link.id, 'link_memory-b_memory-a_supersedes')
  assert.equal(db.prepare('SELECT valid_until FROM memories WHERE id=?').get('memory-a').valid_until, fixedTime)

  const ratified = router.execute(proposalEnvelope({
    kind: 'ratify',
    op: 'share',
    record: null,
    target: 'memory-b',
  }))
  assert.equal(ratified.outcome, 'ratified')
  assert.equal(ratified.memory.shared, 1)

  const demoted = router.execute(proposalEnvelope({
    kind: 'demote',
    op: 'end_validity',
    provenance: baseProvenance({ actor: 'lifecycle_job', eventAt: '2026-02-01T00:00:00.000Z' }),
    record: null,
    target: 'memory-b',
  }))
  assert.equal(demoted.memory.valid_until, '2026-02-01T00:00:00.000Z')

  const deletion = router.execute({
    intentKind: 'legacy_delete_memory',
    actor: 'explicit_user_action',
    id: ' memory-b ',
  })
  assert.deepEqual(Object.keys(deletion), ['deleted', 'memory', 'reason'])
  assert.equal(deletion.deleted, true)
  db.close()
})

test('M2-A2-02 database-dependent proposal rejections and transient demotion are exact', () => {
  const db = createDatabase()
  seed(db, { id: 'permanent-target', type: 'preference' })
  seed(db, { id: 'transient-target', type: 'working', content: 'working target' })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const missing = router.execute(proposalEnvelope({
      kind: 'ratify',
      op: 'share',
      record: null,
      target: '   ',
    }))
    assert.deepEqual(missing, { outcome: 'rejected', reasons: ['missing_target'] })

    const protectedDemotion = router.execute(proposalEnvelope({
      kind: 'demote',
      op: 'delete_transient',
      provenance: baseProvenance({ actor: 'lifecycle_job' }),
      record: null,
      target: 'permanent-target',
    }))
    assert.deepEqual(protectedDemotion, {
      outcome: 'rejected',
      reasons: ['not_transient'],
    })
    const deleted = router.execute(proposalEnvelope({
      kind: 'demote',
      op: 'delete_transient',
      provenance: baseProvenance({ actor: 'lifecycle_job' }),
      record: null,
      target: 'transient-target',
    }))
    assert.deepEqual(deleted, {
      deletedId: 'transient-target',
      outcome: 'demoted',
      reasons: [],
    })

    const crossPartition = router.execute(proposalEnvelope({
      op: 'supersede',
      record: baseRecord({
        id: 'cross-partition-new',
        type: 'preference',
        content: 'cross partition replacement',
      }),
      target: 'transient-target',
    }))
    assert.deepEqual(crossPartition, {
      outcome: 'rejected',
      reasons: ['missing_target'],
    })

    seed(db, { id: 'transient-for-mismatch', type: 'working' })
    const mismatch = router.execute(proposalEnvelope({
      op: 'supersede',
      record: baseRecord({
        id: 'mismatch-new',
        type: 'preference',
        content: 'mismatch replacement',
      }),
      target: 'transient-for-mismatch',
    }))
    assert.deepEqual(mismatch, {
      outcome: 'rejected',
      reasons: ['type_partition_mismatch'],
    })

    const promoted = router.execute(proposalEnvelope({
      kind: 'promote',
      record: baseRecord({
        id: 'promoted-working',
        type: 'working',
        content: 'new promoted working memory',
        confidence: 0.4,
      }),
    }))
    assert.equal(promoted.outcome, 'inserted')
    assert.equal(promoted.memory.type, 'working')
  } finally {
    db.close()
  }
})

test('M2-A2-02 proposal admission reasons, precedence, actor derivation, and clocks are exact', () => {
  const db = createDatabase()
  let clockCalls = 0
  const router = createLegacyMutationRouter(db, {
    clock: () => {
      clockCalls += 1
      return fixedTime
    },
  })
  try {
    for (const proposalKind of ['toString', 'constructor', '__proto__', null, {}]) {
      const intent = proposalEnvelope({ kind: proposalKind })
      intent.policy = { get demote() { throw new Error('must not read policy') } }
      intent.provenance = null
      intent.record = null
      assert.deepEqual(router.execute(intent), {
        outcome: 'rejected',
        reasons: ['invalid_kind'],
      })
    }
    for (const op of [null, 'delete', {}, false]) {
      const intent = proposalEnvelope({ op })
      intent.policy = null
      intent.provenance = null
      intent.record = null
      assert.deepEqual(router.execute(intent), {
        outcome: 'rejected',
        reasons: ['invalid_op'],
      })
    }
    assert.equal(clockCalls, 0)

    assert.deepEqual(router.execute(proposalEnvelope({
      provenance: baseProvenance({
        sourceKind: null,
        writer: null,
      }),
      record: baseRecord({ type: 'working', confidence: 0.1 }),
    })), {
      outcome: 'rejected',
      reasons: [
        'writer_required',
        'source_kind_required',
        'kind_type_mismatch',
        'below_threshold',
      ],
    })
    assert.deepEqual(router.execute(proposalEnvelope({
      provenance: baseProvenance({
        eventAt: null,
        extractor: null,
        sourceKind: 'source_document',
        writer: 'session_summary',
      }),
    })), {
      outcome: 'rejected',
      reasons: ['external_requires_extraction', 'event_time_required'],
    })
    assert.deepEqual(router.execute(proposalEnvelope({
      provenance: baseProvenance({
        eventAt: null,
        extractor: null,
        sourceKind: 17,
        writer: 'background_extraction',
      }),
    })), {
      outcome: 'rejected',
      reasons: ['invalid_source_kind', 'event_time_required', 'extractor_required'],
    })
    assert.deepEqual(router.execute(proposalEnvelope({
      provenance: baseProvenance({ sourceKind: false, writer: false }),
    })).reasons, ['writer_required', 'source_kind_required'])
    assert.deepEqual(router.execute(proposalEnvelope({
      provenance: baseProvenance({ sourceKind: {}, writer: {} }),
    })).reasons, ['invalid_writer', 'invalid_source_kind'])

    const confidenceLog = []
    const confidence = {
      valueOf() {
        confidenceLog.push('confidence')
        return 0.1
      },
    }
    assert.deepEqual(router.execute(proposalEnvelope({
      provenance: baseProvenance({ writer: null, sourceKind: null }),
      record: baseRecord({ type: 'working', confidence }),
    })).reasons, [
      'writer_required',
      'source_kind_required',
      'kind_type_mismatch',
      'below_threshold',
    ])
    assert.deepEqual(confidenceLog, ['confidence'])
    assert.equal(clockCalls, 0)

    const nullFallback = router.capture(proposalEnvelope({
      kind: 'demote',
      op: 'end_validity',
      provenance: baseProvenance({
        actor: null,
        eventAt: laterTime,
        writer: 'lifecycle_job',
      }),
      record: null,
      target: 'seed',
    }))
    assert.equal(nullFallback.provenance.actor, 'lifecycle_job')
    assert.equal(nullFallback.nativeWallTime, laterTime)
    assert.equal(clockCalls, 0)
    assert.deepEqual(router.execute(proposalEnvelope({
      kind: 'demote',
      op: 'end_validity',
      provenance: baseProvenance({
        actor: '',
        eventAt: laterTime,
        writer: 'lifecycle_job',
      }),
      record: null,
      target: 'seed',
    })), { outcome: 'rejected', reasons: ['invalid_actor'] })
    assert.deepEqual(router.execute(proposalEnvelope({
      kind: 'ratify',
      op: 'share',
      provenance: baseProvenance({ writer: 'background_extraction' }),
      record: null,
      target: 'seed',
    })), { outcome: 'rejected', reasons: ['ratify_requires_user'] })

    const admitted = router.capture(proposalEnvelope({
      record: baseRecord({ id: 'one-clock' }),
    }))
    assert.equal(admitted.storeTime, fixedTime)
    assert.equal(clockCalls, 1)
  } finally {
    db.close()
  }
})

test('M2-A2-02 truthy non-primitive event/extractor overrides are rejected after reason accumulation', () => {
  const db = createDatabase()
  let eventCalls = 0
  let extractorCalls = 0
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    assert.throws(() => router.capture(proposalEnvelope({
      provenance: baseProvenance({
        eventAt: {
          toString() {
            eventCalls += 1
            return laterTime
          },
        },
        extractor: {
          toString() {
            extractorCalls += 1
            return 'extractor-a'
          },
        },
        sourceKind: 'invalid-source-kind',
        writer: 'background_extraction',
      }),
    })), {
      code: 'legacy_invalid_argument',
      message: legacyErrors.legacy_invalid_argument,
    })
    assert.equal(eventCalls, 0)
    assert.equal(extractorCalls, 0)
  } finally {
    db.close()
  }
})

test('M2-A2-02 caller clock reentrant close is rechecked and a clock throw wins by identity', () => {
  const closedDb = createDatabase()
  let closedClockCalls = 0
  const closingRouter = createLegacyMutationRouter(closedDb, {
    clock: () => {
      closedClockCalls += 1
      closedDb.close()
      return fixedTime
    },
  })
  assert.throws(() => closingRouter.capture(proposalEnvelope({
    record: baseRecord({ id: 'never-inserted' }),
  })), {
    code: 'legacy_store_closed',
    message: legacyErrors.legacy_store_closed,
  })
  assert.equal(closedClockCalls, 1)
  assert.equal(closedDb.isOpen, false)

  const throwingDb = createDatabase()
  const clockFailure = new Error('clock failed after close')
  const throwingRouter = createLegacyMutationRouter(throwingDb, {
    clock: () => {
      throwingDb.close()
      throw clockFailure
    },
  })
  assert.throws(() => throwingRouter.capture(proposalEnvelope({
    record: baseRecord({ id: 'never-inserted-either' }),
  })), (error) => error === clockFailure)
  assert.equal(throwingDb.isOpen, false)
})

test('M2-A2-02 target, row, provenance, scope, and clock capture is eager and one-time', () => {
  const db = createDatabase()
  const log = []
  const router = createLegacyMutationRouter(db, {
    clock: () => {
      log.push('clock')
      return fixedTime
    },
  })
  const coercible = (name, value) => ({
    toString() {
      log.push(name)
      return value
    },
  })
  try {
    for (const [raw, normalized] of [
      [' padded ', 'padded'],
      [42, '42'],
      [42n, '42'],
      [Buffer.from('buffer-id'), 'buffer-id'],
    ]) {
      const captured = router.capture(proposalEnvelope({
        op: 'supersede',
        record: baseRecord({ id: `target-${normalized}` }),
        target: raw,
      }))
      assert.equal(captured.target, normalized)
    }
    assert.equal(log.filter((entry) => entry === 'clock').length, 4)

    const targetThrow = new Error('target coercion')
    assert.throws(() => router.capture(proposalEnvelope({
      op: 'supersede',
      target: { toString() { throw targetThrow } },
    })), (error) => error === targetThrow)

    let ignoredTargetCalls = 0
    const ignoredTarget = {
      toString() {
        ignoredTargetCalls += 1
        throw new Error('ignored target')
      },
    }
    const addCapture = router.capture(proposalEnvelope({
      record: baseRecord({ id: 'ignored-add-target', content: 'unique add target' }),
      target: ignoredTarget,
    }))
    assert.equal(addCapture.target, null)
    const extractionCapture = router.capture(proposalEnvelope({
      producer: 'extraction_candidate',
      provenance: baseProvenance({
        eventAt: laterTime,
        extractor: 'extractor-a',
        writer: 'background_extraction',
      }),
      record: baseRecord({ id: 'ignored-extraction-target' }),
      scope: { palariId: 'palari-a', userId: 'user-a' },
      target: ignoredTarget,
    }))
    assert.equal(extractionCapture.target, null)
    assert.equal(ignoredTargetCalls, 0)

    log.length = 0
    const captured = router.capture(proposalEnvelope({
      producer: 'extraction_candidate',
      provenance: baseProvenance({
        eventAt: laterTime,
        extractor: 'extractor-a',
        sourceMessageId: coercible('source-message', ' source-msg '),
        writer: 'background_extraction',
      }),
      record: baseRecord({
        id: coercible('id', ' captured-id '),
        palari_id: coercible('row-palari', ' palari-row '),
        user_id: coercible('row-user', ' user-row '),
        content: coercible('content', ' candidate content '),
        keywords: [coercible('keywords', ' topic ')],
        importance: { valueOf() { log.push('importance'); return 0.4 } },
        acquisition_mode: coercible('acquisition', ' extracted '),
        source_message_id: null,
      }),
      scope: {
        palariId: coercible('scope-palari', ' scope-palari '),
        userId: coercible('scope-user', ' scope-user '),
      },
    }))
    assert.deepEqual(log, [
      'id', 'row-palari', 'row-user', 'content', 'keywords', 'importance',
      'acquisition', 'source-message', 'scope-palari', 'scope-user', 'clock',
    ])
    assert.equal(captured.record.id, 'captured-id')
    assert.equal(captured.record.palari_id, 'palari-row')
    assert.equal(captured.record.user_id, 'user-row')
    assert.equal(captured.record.source_message_id, null)
    assert.equal(captured.provenance.sourceMessageId, 'source-msg')
    assert.equal(captured.scope.palariId, 'scope-palari')
    assert.equal(captured.scope.userId, ' scope-user ')
  } finally {
    db.close()
  }
})

test('M2-A2-02 exact add and supersede row normalization preserves every compatibility delta', () => {
  const db = createDatabase()
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const external = router.execute(proposalEnvelope({
      provenance: baseProvenance({
        eventAt: laterTime,
        extractor: 'extractor-a',
        sourceKind: 'source_document',
        sourceMessageId: ' provenance-message ',
        writer: 'background_extraction',
      }),
      record: baseRecord({
        id: 'external-add',
        content: 'External add is unique',
        keywords: [0, false, ' evidence ', null, ''],
        valid_from: null,
        valid_until: ' 2027-01-01T00:00:00.000Z ',
        last_accessed: ' 2026-01-01T00:00:00.000Z ',
        created_at: null,
        acquisition_mode: null,
        fictional: 'yes',
        last_decayed_at: ' 2025-12-01T00:00:00.000Z ',
        source_message_id: null,
        content_hash: 'caller-mismatch-hash',
      }),
    }))
    assert.equal(external.outcome, 'inserted')
    assert.deepEqual(Object.keys(external.memory), memoryKeys)
    assert.deepEqual(external.memory, {
      id: 'external-add',
      palari_id: 'palari-a',
      user_id: 'user-a',
      type: 'preference',
      content: 'External add is unique',
      keywords: 'evidence source:source_document',
      importance: 0.6,
      valid_from: laterTime,
      valid_until: '2027-01-01T00:00:00.000Z',
      access_count: 0,
      last_accessed: '2026-01-01T00:00:00.000Z',
      created_at: fixedTime,
      shared: 0,
      confidence: 0.9,
      acquisition_mode: 'extracted',
      created_by_pipeline: 1,
      fictional: 1,
      last_decayed_at: '2025-12-01T00:00:00.000Z',
      source_message_id: 'provenance-message',
      content_hash: 'caller-mismatch-hash',
      source_kind: 'source_document',
      extractor: 'extractor-a',
    })

    const userAdd = router.execute(proposalEnvelope({
      record: baseRecord({
        id: 'user-add',
        content: 'User add is unique',
        keywords: 0,
        shared: 1,
      }),
    }))
    assert.equal(userAdd.memory.keywords, '0')
    assert.equal(userAdd.memory.acquisition_mode, 'direct')
    assert.equal(userAdd.memory.created_by_pipeline, 0)
    assert.equal(userAdd.memory.source_message_id, 'msg-a')

    seed(db, {
      id: 'supersede-old',
      palari_id: 'fallback-palari',
      user_id: 'fallback-user',
      type: 'preference',
      content: 'Old distinct preference',
    })
    const replacement = router.execute(proposalEnvelope({
      op: 'supersede',
      provenance: baseProvenance({
        eventAt: laterTime,
        extractor: 'extractor-a',
        sourceKind: 'source_document',
        sourceMessageId: 'must-not-fallback',
        writer: 'background_extraction',
      }),
      record: baseRecord({
        id: 'supersede-new',
        palari_id: null,
        user_id: null,
        content: 'New distinct preference',
        keywords: [0, false, 'replacement'],
        source_message_id: null,
      }),
      target: 'supersede-old',
    }))
    assert.equal(replacement.outcome, 'superseded')
    assert.equal(replacement.memory.palari_id, 'fallback-palari')
    assert.equal(replacement.memory.user_id, 'fallback-user')
    assert.equal(replacement.memory.keywords, '0 false replacement')
    assert.equal(replacement.memory.source_message_id, null)
    assert.equal(replacement.memory.valid_from, laterTime)
    assert.equal(replacement.memory.created_at, fixedTime)
    assert.equal(replacement.superseded.valid_until, null)
    assert.deepEqual(Object.keys(replacement.link), [
      'id', 'from_memory_id', 'to_memory_id', 'relation', 'created_at',
    ])
    assert.deepEqual(replacement.link, {
      id: 'link_supersede-new_supersede-old_supersedes',
      from_memory_id: 'supersede-new',
      to_memory_id: 'supersede-old',
      relation: 'supersedes',
      created_at: fixedTime,
    })
  } finally {
    db.close()
  }
})

test('M2-A2-02 insert-only validation and content-hash work are deferred past duplicate selection', () => {
  const db = createDatabase()
  seed(db, {
    id: 'empty-existing',
    type: 'preference',
    content: '',
    keywords: '',
    importance: 0.2,
  })
  seed(db, {
    id: 'hash-existing',
    type: 'preference',
    content: 'duplicate hash candidate',
    importance: 0.2,
  })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const invalidHashCaller = { retained: true }
    const emptyDuplicate = router.execute(proposalEnvelope({
      record: baseRecord({
        id: null,
        content: '',
        keywords: '',
        acquisition_mode: 'unsupported',
        content_hash: invalidHashCaller,
      }),
    }))
    assert.equal(emptyDuplicate.outcome, 'duplicate_bumped')
    assert.equal(emptyDuplicate.memory.id, 'empty-existing')
    assert.equal(Object.isFrozen(invalidHashCaller), false)

    const hashDuplicate = router.execute(proposalEnvelope({
      record: baseRecord({
        id: null,
        content: 'duplicate hash candidate',
        acquisition_mode: 'unsupported',
        content_hash: invalidHashCaller,
      }),
    }))
    assert.equal(hashDuplicate.outcome, 'duplicate_bumped')
    assert.equal(hashDuplicate.memory.id, 'hash-existing')

    assert.throws(() => router.execute(proposalEnvelope({
      record: baseRecord({
        id: null,
        content: 'unique invalid hash candidate',
        content_hash: invalidHashCaller,
      }),
    })), {
      code: 'legacy_invalid_argument',
      message: legacyErrors.legacy_invalid_argument,
    })
    assert.equal(db.prepare('SELECT COUNT(*) count FROM memories WHERE content=?')
      .get('unique invalid hash candidate').count, 0)

    assert.throws(() => router.execute(proposalEnvelope({
      record: baseRecord({
        id: 'empty-insert',
        palari_id: 'other-palari',
        content: '',
      }),
    })), { message: 'Memory content is required.' })
    assert.throws(() => router.execute(proposalEnvelope({
      record: baseRecord({
        id: 'bad-acquisition',
        content: 'unique bad acquisition',
        acquisition_mode: 'unsupported',
      }),
    })), { message: 'Unsupported memory acquisition mode "unsupported".' })
  } finally {
    db.close()
  }
})

test('M2-A2-02 duplicate and contradiction comparator ties use importance, time, and UTF-8 bytes', () => {
  const privateUseId = `tie-\uE000`
  const supplementaryId = `tie-\u{10000}`
  const scenarios = [
    {
      name: 'importance',
      rows: [
        { id: 'low', importance: 0.2, created_at: laterTime },
        { id: 'high', importance: 0.8, created_at: '2025-01-01T00:00:00.000Z' },
      ],
      expected: 'high',
    },
    {
      name: 'creation time',
      rows: [
        { id: 'old', importance: 0.5, created_at: '2025-01-01T00:00:00.000Z' },
        { id: 'new', importance: 0.5, created_at: laterTime },
      ],
      expected: 'new',
    },
    {
      name: 'binary id',
      rows: [
        { id: supplementaryId, importance: 0.5, created_at: fixedTime },
        { id: privateUseId, importance: 0.5, created_at: fixedTime },
      ],
      expected: privateUseId,
    },
  ]
  for (const scenario of scenarios) {
    const db = createDatabase()
    try {
      for (const row of scenario.rows) {
        seed(db, {
          ...row,
          type: 'preference',
          content: 'identical comparator content',
        })
      }
      const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
      const result = router.execute(proposalEnvelope({
        record: baseRecord({
          id: `candidate-${scenario.name}`,
          content: 'identical comparator content',
        }),
      }))
      assert.equal(result.outcome, 'duplicate_bumped')
      assert.equal(result.memory.id, scenario.expected, scenario.name)
    } finally {
      db.close()
    }
  }

  const db = createDatabase()
  try {
    for (const id of [supplementaryId, privateUseId]) {
      seed(db, {
        id,
        type: 'preference',
        content: 'User prefers jasmine tea',
        importance: 0.5,
        created_at: fixedTime,
      })
    }
    const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
    const result = router.execute(proposalEnvelope({
      producer: 'extraction_candidate',
      provenance: baseProvenance({
        eventAt: laterTime,
        extractor: 'extractor-a',
        writer: 'background_extraction',
      }),
      record: baseRecord({
        id: 'contradiction-new',
        content: 'User does not prefer jasmine tea anymore',
      }),
      scope: { palariId: 'palari-a', userId: 'user-a' },
    }))
    assert.equal(result.outcome, 'superseded')
    assert.equal(result.superseded.id, privateUseId)
  } finally {
    db.close()
  }
})

test('M2-A2-02 supersession is atomic when a later effect fails', () => {
  const db = createDatabase()
  seed(db, { id: 'old', type: 'preference', content: 'Old tea preference' })
  db.exec(`CREATE TRIGGER reject_supersession_link
    BEFORE INSERT ON memory_links BEGIN SELECT RAISE(ABORT, 'link rejected'); END;`)
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  assert.throws(() => router.execute(proposalEnvelope({
    op: 'supersede',
    target: 'old',
    record: baseRecord({ id: 'new', content: 'New coffee preference' }),
  })), /link rejected/)
  assert.equal(db.prepare('SELECT valid_until FROM memories WHERE id=?').get('old').valid_until, null)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?').get('new').count, 0)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM memory_links').get().count, 0)
  db.close()
})

test('M2-A2-02 every supersession effect ordinal rolls back memory, FTS, and links', () => {
  const failures = [
    {
      name: 'end-validity',
      trigger: `CREATE TRIGGER fail_ordinal BEFORE UPDATE OF valid_until ON memories
        WHEN old.id = 'old' BEGIN SELECT RAISE(ABORT, 'ordinal 0'); END;`,
      message: /ordinal 0/,
    },
    {
      name: 'memory-insert',
      trigger: `CREATE TRIGGER fail_ordinal BEFORE INSERT ON memories
        WHEN new.id = 'new' BEGIN SELECT RAISE(ABORT, 'ordinal 1'); END;`,
      message: /ordinal 1/,
    },
    {
      name: 'link-insert',
      trigger: `CREATE TRIGGER fail_ordinal BEFORE INSERT ON memory_links
        WHEN new.id = 'link_new_old_supersedes'
        BEGIN SELECT RAISE(ABORT, 'ordinal 2'); END;`,
      message: /ordinal 2/,
    },
  ]
  for (const failure of failures) {
    const db = createDatabase()
    try {
      seed(db, { id: 'old', type: 'preference', content: 'old preference' })
      seed(db, { id: 'anchor', type: 'preference', content: 'anchor preference' })
      db.prepare(`INSERT INTO memory_links
        (id,from_memory_id,to_memory_id,relation,created_at)
        VALUES (?,?,?,?,?)`).run('existing-link', 'old', 'anchor', 'associated', fixedTime)
      db.exec(failure.trigger)
      const before = durableSnapshot(db)
      const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
      assert.throws(() => router.execute(proposalEnvelope({
        op: 'supersede',
        target: 'old',
        record: baseRecord({ id: 'new', content: 'new preference' }),
      })), failure.message, failure.name)
      assert.deepEqual(durableSnapshot(db), before, failure.name)
    } finally {
      db.close()
    }
  }
})

test('M2-A2-02 direct delete distinguishes absent, protected, transient, and explicit branches', () => {
  const db = createDatabase()
  seed(db, { id: 'permanent', type: 'preference' })
  seed(db, { id: 'transient', type: 'working' })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    assert.deepEqual(router.execute({
      intentKind: 'legacy_delete_memory',
      actor: 'lifecycle_job',
      id: '',
    }), { deleted: false, reason: 'not_found' })
    assert.deepEqual(router.execute({
      intentKind: 'legacy_delete_memory',
      actor: 'lifecycle_job',
      id: 'absent',
    }), { deleted: false, reason: 'not_found' })
    const protectedResult = router.execute({
      intentKind: 'legacy_delete_memory',
      actor: 'lifecycle_job',
      id: 'permanent',
    })
    assert.deepEqual(Object.keys(protectedResult), ['deleted', 'memory', 'reason'])
    assert.equal(protectedResult.deleted, false)
    assert.equal(protectedResult.memory.id, 'permanent')
    assert.equal(protectedResult.reason, 'permanent_type_protected')

    const transient = router.execute({
      intentKind: 'legacy_delete_memory',
      actor: 'lifecycle_job',
      id: 'transient',
    })
    assert.equal(transient.deleted, true)
    assert.equal(transient.memory.id, 'transient')
    assert.equal(transient.reason, 'deleted')

    const explicit = router.execute({
      intentKind: 'legacy_delete_memory',
      actor: 'explicit_user_action',
      id: 'permanent',
    })
    assert.equal(explicit.deleted, true)
    assert.equal(explicit.memory.id, 'permanent')
  } finally {
    db.close()
  }
})

test('M2-A2-02 committed results are fresh mutable copies with no plan or row alias', () => {
  const db = createDatabase()
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const inserted = router.execute(proposalEnvelope({
      record: baseRecord({ id: 'mutable-result', content: 'mutable result content' }),
    }))
    assert.equal(Object.isFrozen(inserted), false)
    assert.equal(Object.isFrozen(inserted.memory), false)
    assert.equal(Object.isFrozen(inserted.reasons), false)
    inserted.memory.content = 'caller mutation'
    inserted.reasons.push('caller_reason')
    inserted.outcome = 'caller_outcome'
    const stored = db.prepare('SELECT content FROM memories WHERE id=?')
      .get('mutable-result')
    assert.equal(stored.content, 'mutable result content')

    const duplicate = router.execute(proposalEnvelope({
      record: baseRecord({ id: 'unused', content: 'mutable result content' }),
    }))
    assert.equal(duplicate.outcome, 'duplicate_bumped')
    assert.equal(duplicate.memory.id, 'mutable-result')
    assert.notEqual(duplicate.memory, inserted.memory)
    assert.notEqual(duplicate.reasons, inserted.reasons)
    assert.deepEqual(duplicate.reasons, [])
  } finally {
    db.close()
  }
})

test('M2-A2-02 extraction contradiction excludes other-user private rows for empty user scope', () => {
  const db = createDatabase()
  seed(db, {
    id: 'private-other',
    user_id: 'other-user',
    type: 'preference',
    content: 'User likes tea',
  })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  const result = router.execute(proposalEnvelope({
    producer: 'extraction_candidate',
    provenance: baseProvenance({
      eventAt: '2026-01-14T00:00:00.000Z',
      extractor: 'extractor-a',
      writer: 'background_extraction',
    }),
    record: baseRecord({
      id: 'candidate',
      user_id: null,
      content: 'User no longer likes tea',
    }),
    scope: { palariId: 'palari-a', userId: '' },
  }))
  assert.equal(result.outcome, 'inserted')
  assert.equal(db.prepare('SELECT valid_until FROM memories WHERE id=?').get('private-other').valid_until, null)
  db.close()
})

test('M2-A2-02 explicit scope is ignored, extraction user scope stays untrimmed, and duplicates cross users', () => {
  const db = createDatabase()
  seed(db, {
    id: 'private-same-user',
    user_id: 'user-a',
    type: 'preference',
    content: 'User likes jasmine tea',
  })
  seed(db, {
    id: 'cross-user-duplicate',
    user_id: 'other-user',
    type: 'preference',
    content: 'Cross user duplicate content',
  })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  let ignoredScopeCalls = 0
  try {
    const explicit = router.capture(proposalEnvelope({
      record: baseRecord({
        id: 'explicit-scope-ignored',
        content: 'explicit scope ignored content',
      }),
      scope: {
        get palariId() {
          ignoredScopeCalls += 1
          throw new Error('ignored scope')
        },
      },
    }))
    assert.deepEqual(explicit.scope, { palariId: null, userId: null })
    assert.equal(ignoredScopeCalls, 0)

    const paddedScope = router.execute(proposalEnvelope({
      producer: 'extraction_candidate',
      provenance: baseProvenance({
        eventAt: laterTime,
        extractor: 'extractor-a',
        writer: 'background_extraction',
      }),
      record: baseRecord({
        id: 'padded-scope-candidate',
        content: 'User does not like jasmine tea anymore',
      }),
      scope: { palariId: ' palari-a ', userId: ' user-a ' },
    }))
    assert.equal(paddedScope.outcome, 'inserted')
    assert.equal(db.prepare('SELECT valid_until FROM memories WHERE id=?')
      .get('private-same-user').valid_until, null)

    const crossUser = router.execute(proposalEnvelope({
      record: baseRecord({
        id: 'cross-user-candidate',
        user_id: 'user-a',
        content: 'Cross user duplicate content',
      }),
    }))
    assert.equal(crossUser.outcome, 'duplicate_bumped')
    assert.equal(crossUser.memory.id, 'cross-user-duplicate')
  } finally {
    db.close()
  }
})

test('M2-A2-02 extraction preference contradiction preserves candidate keyword evidence', () => {
  const db = createDatabase()
  seed(db, {
    id: 'coffee-old',
    type: 'preference',
    content: 'Coffee beverage choice',
    keywords: '',
  })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const result = router.execute(proposalEnvelope({
      producer: 'extraction_candidate',
      provenance: baseProvenance({
        eventAt: '2026-01-14T00:00:00.000Z',
        extractor: 'extractor-a',
        writer: 'background_extraction',
      }),
      record: baseRecord({
        id: 'coffee-new',
        content: 'User prefers it',
        keywords: ['coffee'],
      }),
      scope: { palariId: 'palari-a', userId: 'user-a' },
    }))
    assert.equal(result.outcome, 'superseded')
    assert.equal(result.superseded.id, 'coffee-old')
    assert.equal(
      db.prepare('SELECT valid_until FROM memories WHERE id = ?')
        .get('coffee-old').valid_until,
      fixedTime,
    )
  } finally {
    db.close()
  }
})

test('M2-A2-02 similarity priority and preference-score ties end in UTF-8 ID order', () => {
  const db = createDatabase()
  const exactContent =
    'The user strongly prefers jasmine green tea with oat milk every morning before work'
  seed(db, {
    id: 'similarity-exact',
    type: 'preference',
    content: exactContent,
    importance: 0.1,
  })
  seed(db, {
    id: 'similarity-near',
    type: 'preference',
    content: `${exactContent}s`,
    importance: 1,
  })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const duplicate = router.execute(proposalEnvelope({
      record: baseRecord({ id: 'similarity-new', content: exactContent }),
    }))
    assert.equal(duplicate.outcome, 'duplicate_bumped')
    assert.equal(duplicate.memory.id, 'similarity-exact')
  } finally {
    db.close()
  }

  const tieDb = createDatabase()
  const privateUseId = `preference-\uE000`
  const supplementaryId = `preference-\u{10000}`
  for (const id of [supplementaryId, privateUseId]) {
    seed(tieDb, {
      id,
      type: 'preference',
      content: 'Coffee beverage choice',
      keywords: '',
      importance: 0.5,
      created_at: fixedTime,
    })
  }
  const tieRouter = createLegacyMutationRouter(tieDb, { clock: () => fixedTime })
  try {
    const result = tieRouter.execute(proposalEnvelope({
      producer: 'extraction_candidate',
      provenance: baseProvenance({
        eventAt: laterTime,
        extractor: 'extractor-a',
        writer: 'background_extraction',
      }),
      record: baseRecord({
        id: 'preference-new',
        content: 'User prefers it',
        keywords: ['coffee'],
      }),
      scope: { palariId: 'palari-a', userId: 'user-a' },
    }))
    assert.equal(result.outcome, 'superseded')
    assert.equal(result.superseded.id, privateUseId)
  } finally {
    tieDb.close()
  }
})

test('M2-A2-02 malformed projected rows fail as invalid plan before DML', () => {
  const db = createDatabase()
  seed(db, { id: 'malformed', importance: 'not-a-number' })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    assert.throws(
      () => router.execute({
        intentKind: 'legacy_delete_memory',
        actor: 'explicit_user_action',
        id: 'malformed',
      }),
      { code: 'legacy_plan_invalid' },
    )
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM memories WHERE id = ?')
        .get('malformed').count,
      1,
    )
  } finally {
    db.close()
  }
})

test('M2-A2-03 topic forget and recall inclusion are ordered atomic batches', () => {
  const db = createDatabase()
  seed(db, { id: 'b', type: 'working', content: 'shared tea notes' })
  seed(db, { id: 'a', type: 'working', content: 'tea task notes' })
  seed(db, { id: 'protected', type: 'preference', content: 'tea preference' })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  const recalled = router.execute({
    intentKind: 'legacy_record_recall_inclusion',
    actor: 'lifecycle_job',
    bumpAmount: 0.1,
    memoryIds: ['b', 'missing', 'b', 'a'],
  })
  assert.deepEqual(recalled.touched.map(({ id }) => id), ['b', 'a'])
  assert.equal(db.prepare('SELECT access_count FROM memories WHERE id=?').get('b').access_count, 1)

  const forgotten = router.execute({
    intentKind: 'legacy_forget_topic',
    actor: 'lifecycle_job',
    palariId: 'palari-a',
    query: 'tea',
    userId: 'user-a',
  })
  assert.deepEqual(forgotten, { count: 2, deleted: ['a', 'b'] })
  assert.equal(db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?').get('protected').count, 1)
  db.close()
})

test('M2-A2-03 resolvers materialize complete topic, recall, and lifecycle effect order before DML', () => {
  const db = createDatabase()
  const privateUseId = `ordered-\uE000`
  const supplementaryId = `ordered-\u{10000}`
  for (const id of ['ordered-b', supplementaryId, privateUseId, 'ordered-a']) {
    seed(db, {
      id,
      type: 'working',
      content: 'ordered tea batch',
      created_at: '2026-01-01T00:00:00.000Z',
      importance: 0.5,
    })
  }
  const expectedBinary = db.prepare(
    'SELECT id FROM memories ORDER BY id COLLATE BINARY ASC',
  ).all().map(({ id }) => id)
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  const coordinator = createMutationCoordinator(db)
  const topic = router.capture({
    intentKind: 'legacy_forget_topic',
    actor: 'explicit_user_action',
    palariId: 'palari-a',
    query: 'ordered',
    userId: 'user-a',
  })
  const recallOrder = [supplementaryId, 'ordered-b', privateUseId, 'ordered-a']
  const recall = router.capture({
    intentKind: 'legacy_record_recall_inclusion',
    actor: 'lifecycle_job',
    bumpAmount: 0.1,
    memoryIds: recallOrder,
  })
  const lifecycle = router.capture({
    intentKind: 'legacy_run_lifecycle',
    now: fixedTime,
    palariId: 'palari-a',
  })
  const before = durableSnapshot(db)
  try {
    coordinator.run((lease) => {
      const topicPlan = router.resolve(lease, topic)
      assert.deepEqual(
        topicPlan.effects.map(({ kind, id }) => [kind, id]),
        expectedBinary.map((id) => ['cdx_memory_delete', id]),
      )
      assert.deepEqual(topicPlan.result, {
        count: expectedBinary.length,
        deleted: expectedBinary,
      })

      const recallPlan = router.resolve(lease, recall)
      assert.deepEqual(
        recallPlan.effects.map(({ kind, id }) => [kind, id]),
        recallOrder.flatMap((id) => [
          ['cdx_memory_touch', id],
          ['cdx_memory_set_importance', id],
        ]),
      )
      assert.deepEqual(
        recallPlan.result.touched.map(({ id }) => id),
        recallOrder,
      )

      const lifecyclePlan = router.resolve(lease, lifecycle)
      assert.deepEqual(
        lifecyclePlan.effects.map(({ kind, id }) => [kind, id]),
        expectedBinary.map((id) => ['cdx_memory_decay', id]),
      )
      assert.deepEqual(lifecyclePlan.result, {
        decayed: expectedBinary.length,
        deleted: 0,
        skipped: 0,
        touched: expectedBinary.length,
      })
      assertDeepFrozen(topicPlan)
      assertDeepFrozen(recallPlan)
      assertDeepFrozen(lifecyclePlan)
    })
    assert.deepEqual(durableSnapshot(db), before)
  } finally {
    db.close()
  }
})

test('M2-A2-03 delete, topic, recall, and lifecycle capture precedence is exact', () => {
  const db = createDatabase()
  const log = []
  const router = createLegacyMutationRouter(db, {
    clock: () => {
      log.push('clock')
      return fixedTime
    },
  })
  const value = (name, output) => ({
    toString() {
      log.push(name)
      return output
    },
  })
  try {
    const deletion = router.capture({
      intentKind: 'legacy_delete_memory',
      actor: value('delete-actor', ' explicit_user_action '),
      id: value('delete-id', ' target '),
    })
    assert.deepEqual(log, ['delete-actor', 'delete-id'])
    assert.equal(deletion.actor, 'explicit_user_action')
    assert.equal(deletion.id, 'target')

    log.length = 0
    assert.throws(() => router.capture({
      intentKind: 'legacy_delete_memory',
      actor: 'invalid',
      id: value('must-not-read-id', 'target'),
    }), /Unauthorized memory mutation actor "invalid"/)
    assert.deepEqual(log, [])

    assert.throws(() => router.capture({
      intentKind: 'legacy_forget_topic',
      actor: 'invalid',
      palariId: value('must-not-read-palari', 'palari-a'),
      query: value('must-not-read-query', 'tea'),
      userId: value('must-not-read-user', 'user-a'),
    }), /Unauthorized memory mutation actor "invalid"/)
    assert.deepEqual(log, [])
    assert.throws(() => router.capture({
      intentKind: 'legacy_record_recall_inclusion',
      actor: 'invalid',
      bumpAmount: { valueOf() { log.push('must-not-read-bump'); return 0.1 } },
      memoryIds: [value('must-not-read-recall-id', 'target')],
    }), /Unauthorized memory mutation actor "invalid"/)
    assert.deepEqual(log, [])

    const topic = router.capture({
      intentKind: 'legacy_forget_topic',
      actor: value('topic-actor', ' lifecycle_job '),
      palariId: value('topic-palari', ' palari-a '),
      query: value('topic-query', ' tea '),
      userId: value('topic-user', ' user-a '),
    })
    assert.deepEqual(log, [
      'topic-actor', 'topic-query', 'topic-palari', 'topic-user',
    ])
    assert.deepEqual(topic, {
      intentKind: 'legacy_forget_topic',
      actor: 'lifecycle_job',
      palariId: 'palari-a',
      query: 'tea',
      userId: 'user-a',
    })

    log.length = 0
    const recall = router.capture({
      intentKind: 'legacy_record_recall_inclusion',
      actor: value('recall-actor', ' lifecycle_job '),
      bumpAmount: { valueOf() { log.push('recall-bump'); return 0.2 } },
      memoryIds: [
        value('id-a', ' a '),
        ,
        value('id-a-again', 'a'),
        value('id-b', ' b '),
      ],
    })
    assert.deepEqual(log, [
      'recall-actor', 'recall-bump', 'id-a', 'id-a-again', 'id-b', 'clock',
    ])
    assert.equal(recall.bumpAmount, 0.2)
    assert.deepEqual(recall.memoryIds, ['a', 'b'])
    assert.equal(recall.storeTime, fixedTime)

    log.length = 0
    for (const [bumpAmount, expected] of [
      [undefined, 0.05],
      [null, 0],
      [NaN, 0.05],
      [Infinity, 0.05],
    ]) {
      const empty = router.capture({
        intentKind: 'legacy_record_recall_inclusion',
        actor: 'lifecycle_job',
        bumpAmount,
        memoryIds: [null, '', '   '],
      })
      assert.equal(empty.bumpAmount, expected)
      assert.equal(empty.storeTime, null)
      assert.deepEqual(router.execute(empty), { touched: [], touchedCount: 0 })
    }
    assert.deepEqual(log, [], 'empty recall must not call the clock')

    const idFailure = new Error('id conversion')
    assert.throws(() => router.capture({
      intentKind: 'legacy_record_recall_inclusion',
      actor: 'lifecycle_job',
      bumpAmount: 0.1,
      memoryIds: [{ toString() { throw idFailure } }],
    }), (error) => error === idFailure)

    log.length = 0
    const lifecycle = router.capture({
      intentKind: 'legacy_run_lifecycle',
      now: undefined,
      palariId: value('lifecycle-palari', ' palari-a '),
    })
    assert.deepEqual(log, ['lifecycle-palari', 'clock'])
    assert.equal(lifecycle.palariId, 'palari-a')
    assert.equal(lifecycle.now, fixedTime)

    log.length = 0
    const epochLifecycle = router.capture({
      intentKind: 'legacy_run_lifecycle',
      now: null,
      palariId: '',
    })
    assert.equal(epochLifecycle.now, '1970-01-01T00:00:00.000Z')
    assert.deepEqual(log, [])
    assert.throws(() => router.capture({
      intentKind: 'legacy_run_lifecycle',
      now: 'not-a-date',
      palariId: '',
    }), { name: 'RangeError', message: 'Invalid time value' })

    log.length = 0
    const palariFailure = new Error('palari conversion')
    assert.throws(() => router.capture({
      intentKind: 'legacy_run_lifecycle',
      now: undefined,
      palariId: { toString() { log.push('palari'); throw palariFailure } },
    }), (error) => error === palariFailure)
    assert.deepEqual(log, ['palari'])
  } finally {
    db.close()
  }
})

test('M2-A2-03 recall and lifecycle clocks recheck liveness after capture', () => {
  for (const intent of [
    {
      intentKind: 'legacy_record_recall_inclusion',
      actor: 'lifecycle_job',
      bumpAmount: 0.1,
      memoryIds: ['target'],
    },
    {
      intentKind: 'legacy_run_lifecycle',
      now: undefined,
      palariId: 'palari-a',
    },
  ]) {
    const db = createDatabase()
    let clockCalls = 0
    const router = createLegacyMutationRouter(db, {
      clock: () => {
        clockCalls += 1
        db.close()
        return fixedTime
      },
    })
    assert.throws(() => router.capture(intent), {
      code: 'legacy_store_closed',
      message: legacyErrors.legacy_store_closed,
    })
    assert.equal(clockCalls, 1)
    assert.equal(db.isOpen, false)
  }
})

test('M2-A2-03 malformed FTS and batches beyond 100 fail atomically', () => {
  const db = createDatabase()
  for (let index = 0; index < 105; index += 1) {
    seed(db, {
      id: `bulk-${String(index).padStart(3, '0')}`,
      type: 'working',
      content: `bulk tea note ${index}`,
    })
  }
  seed(db, {
    id: 'bulk-protected',
    type: 'preference',
    content: 'bulk tea preference',
  })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const beforeMalformed = durableSnapshot(db)
    assert.throws(() => router.execute({
      intentKind: 'legacy_forget_topic',
      actor: 'lifecycle_job',
      palariId: 'palari-a',
      query: '"unterminated',
      userId: 'user-a',
    }), /unterminated|syntax/i)
    assert.deepEqual(durableSnapshot(db), beforeMalformed)

    db.exec(`CREATE TRIGGER fail_bulk_delete BEFORE DELETE ON memories
      WHEN old.id = 'bulk-050'
      BEGIN SELECT RAISE(ABORT, 'bulk delete failure'); END;`)
    const beforeFailure = durableSnapshot(db)
    assert.throws(() => router.execute({
      intentKind: 'legacy_forget_topic',
      actor: 'lifecycle_job',
      palariId: 'palari-a',
      query: 'bulk',
      userId: 'user-a',
    }), /bulk delete failure/)
    assert.deepEqual(durableSnapshot(db), beforeFailure)

    db.exec('DROP TRIGGER fail_bulk_delete')
    const result = router.execute({
      intentKind: 'legacy_forget_topic',
      actor: 'lifecycle_job',
      palariId: 'palari-a',
      query: 'bulk',
      userId: 'user-a',
    })
    assert.equal(result.count, 105)
    assert.equal(result.deleted.length, 105)
    assert.equal(result.deleted[0], 'bulk-000')
    assert.equal(result.deleted.at(-1), 'bulk-104')
    assert.equal(db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?')
      .get('bulk-protected').count, 1)
  } finally {
    db.close()
  }
})

test('M2-A2-03 topic ordering matches SQLite UTF-8 BINARY collation', () => {
  const db = createDatabase()
  const privateUseId = `id-\uE000`
  const supplementaryId = `id-\u{10000}`
  seed(db, {
    id: supplementaryId,
    type: 'working',
    content: 'binary tea topic',
  })
  seed(db, {
    id: privateUseId,
    type: 'working',
    content: 'binary tea topic',
  })
  const expected = db.prepare(
    'SELECT id FROM memories ORDER BY id COLLATE BINARY ASC',
  ).all().map(({ id }) => id)
  assert.deepEqual(expected, [privateUseId, supplementaryId])
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const result = router.execute({
      intentKind: 'legacy_forget_topic',
      actor: 'explicit_user_action',
      palariId: 'palari-a',
      query: 'binary',
      userId: 'user-a',
    })
    assert.deepEqual(result.deleted, expected)
  } finally {
    db.close()
  }
})

test('M2-A2-03 recall formula clamps, safe increment, and every update phase are atomic', () => {
  const db = createDatabase()
  seed(db, { id: 'high', importance: 0.95, access_count: 0 })
  seed(db, { id: 'low', importance: 0.02, access_count: 2 })
  seed(db, {
    id: 'safe-max',
    importance: 0.5,
    access_count: Number.MAX_SAFE_INTEGER - 1,
  })
  seed(db, { id: 'negative', importance: 0.1, access_count: 0 })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const result = router.execute({
      intentKind: 'legacy_record_recall_inclusion',
      actor: 'lifecycle_job',
      bumpAmount: 0.2,
      memoryIds: ['high', 'missing', 'low', 'high', 'safe-max'],
    })
    assert.deepEqual(result, {
      touched: [
        { id: 'high', importance: 1 },
        { id: 'low', importance: 0.22 },
        { id: 'safe-max', importance: 0.7 },
      ],
      touchedCount: 3,
    })
    for (const id of ['high', 'low', 'safe-max']) {
      assert.equal(db.prepare('SELECT last_accessed FROM memories WHERE id=?')
        .get(id).last_accessed, fixedTime)
    }
    assert.equal(db.prepare('SELECT access_count FROM memories WHERE id=?')
      .get('safe-max').access_count, Number.MAX_SAFE_INTEGER)

    const negative = router.execute({
      intentKind: 'legacy_record_recall_inclusion',
      actor: 'lifecycle_job',
      bumpAmount: -1,
      memoryIds: 'negative',
    })
    assert.deepEqual(negative.touched, [{ id: 'negative', importance: 0 }])

    const coordinator = createMutationCoordinator(db)
    assert.throws(() => coordinator.run((lease) => {
      applyLegacyMutationEffectInTransaction(lease, db, {
        kind: 'cdx_memory_touch',
        id: 'safe-max',
        lastAccessed: laterTime,
      })
    }), { code: 'legacy_effect_cardinality' })
  } finally {
    db.close()
  }

  const failures = [
    {
      name: 'first touch',
      trigger: `CREATE TRIGGER fail_recall BEFORE UPDATE OF access_count ON memories
        WHEN old.id = 'a' BEGIN SELECT RAISE(ABORT, 'touch failure'); END;`,
      message: /touch failure/,
    },
    {
      name: 'first importance',
      trigger: `CREATE TRIGGER fail_recall BEFORE UPDATE OF importance ON memories
        WHEN old.id = 'a' BEGIN SELECT RAISE(ABORT, 'importance failure'); END;`,
      message: /importance failure/,
    },
    {
      name: 'later target',
      trigger: `CREATE TRIGGER fail_recall BEFORE UPDATE OF access_count ON memories
        WHEN old.id = 'b' BEGIN SELECT RAISE(ABORT, 'later failure'); END;`,
      message: /later failure/,
    },
  ]
  for (const failure of failures) {
    const batchDb = createDatabase()
    try {
      seed(batchDb, { id: 'a', importance: 0.3 })
      seed(batchDb, { id: 'b', importance: 0.4 })
      batchDb.exec(failure.trigger)
      const before = durableSnapshot(batchDb)
      const batchRouter = createLegacyMutationRouter(batchDb, { clock: () => fixedTime })
      assert.throws(() => batchRouter.execute({
        intentKind: 'legacy_record_recall_inclusion',
        actor: 'lifecycle_job',
        bumpAmount: 0.1,
        memoryIds: ['a', 'b'],
      }), failure.message, failure.name)
      assert.deepEqual(durableSnapshot(batchDb), before, failure.name)
    } finally {
      batchDb.close()
    }
  }
})

test('M2-A2-03 lifecycle applies invalid/future/window formulas and empty cross-Palari scope', () => {
  const db = createDatabase()
  seed(db, {
    id: 'invalid-reference',
    type: 'working',
    importance: 0.5,
    created_at: 'invalid-reference',
  })
  seed(db, {
    id: 'future',
    type: 'working',
    importance: 0.5,
    created_at: '2026-02-01T00:00:00.000Z',
  })
  seed(db, {
    id: 'fourteen-days',
    type: 'working',
    importance: 0.5,
    created_at: '2026-01-01T00:00:00.000Z',
  })
  seed(db, {
    id: 'twenty-eight-days',
    type: 'working',
    importance: 0.25,
    created_at: '2025-12-18T00:00:00.000Z',
  })
  seed(db, {
    id: 'recent-decay-wins',
    type: 'working',
    importance: 0.5,
    created_at: '2020-01-01T00:00:00.000Z',
    last_decayed_at: '2026-01-14T00:00:00.000Z',
  })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    const result = router.execute({
      intentKind: 'legacy_run_lifecycle',
      now: fixedTime,
      palariId: 'palari-a',
    })
    assert.deepEqual(result, { decayed: 1, deleted: 2, skipped: 2, touched: 3 })
    const decayed = db.prepare('SELECT importance,last_decayed_at FROM memories WHERE id=?')
      .get('fourteen-days')
    assert.equal(decayed.importance, 0.4)
    assert.equal(decayed.last_decayed_at, fixedTime)
    assert.equal(db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?')
      .get('invalid-reference').count, 0)
    assert.equal(db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?')
      .get('twenty-eight-days').count, 0)
    assert.equal(db.prepare('SELECT importance FROM memories WHERE id=?')
      .get('future').importance, 0.5)
    assert.equal(db.prepare('SELECT importance FROM memories WHERE id=?')
      .get('recent-decay-wins').importance, 0.5)
  } finally {
    db.close()
  }

  const crossDb = createDatabase()
  seed(crossDb, {
    id: 'palari-a-row',
    palari_id: 'palari-a',
    type: 'working',
    importance: 0.5,
    created_at: '2026-01-01T00:00:00.000Z',
  })
  seed(crossDb, {
    id: 'palari-b-row',
    palari_id: 'palari-b',
    type: 'working',
    importance: 0.5,
    created_at: '2026-01-01T00:00:00.000Z',
  })
  try {
    const crossRouter = createLegacyMutationRouter(crossDb, { clock: () => fixedTime })
    const result = crossRouter.execute({
      intentKind: 'legacy_run_lifecycle',
      now: fixedTime,
      palariId: '',
    })
    assert.deepEqual(result, { decayed: 2, deleted: 0, skipped: 0, touched: 2 })
    assert.equal(crossDb.prepare('SELECT importance FROM memories WHERE id=?')
      .get('palari-a-row').importance, 0.4)
    assert.equal(crossDb.prepare('SELECT importance FROM memories WHERE id=?')
      .get('palari-b-row').importance, 0.4)
  } finally {
    crossDb.close()
  }
})

test('M2-A2-03 lifecycle batch rolls back every prior decay and deletion consequence', () => {
  const db = createDatabase()
  seed(db, {
    id: 'a-decay',
    type: 'working',
    importance: 0.5,
    created_at: '2026-01-01T00:00:00.000Z',
  })
  seed(db, {
    id: 'b-delete',
    type: 'working',
    importance: 0.15,
    created_at: '2026-01-01T00:00:00.000Z',
  })
  db.exec(`CREATE TRIGGER fail_lifecycle_delete BEFORE DELETE ON memories
    WHEN old.id = 'b-delete'
    BEGIN SELECT RAISE(ABORT, 'lifecycle failure'); END;`)
  const before = durableSnapshot(db)
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  try {
    assert.throws(() => router.execute({
      intentKind: 'legacy_run_lifecycle',
      now: fixedTime,
      palariId: 'palari-a',
    }), /lifecycle failure/)
    assert.deepEqual(durableSnapshot(db), before)
  } finally {
    db.close()
  }
})

test('M2-A2-03 recall overflow and lifecycle rules roll back or land exactly', () => {
  const db = createDatabase()
  seed(db, { id: 'safe', access_count: 1 })
  seed(db, { id: 'overflow', access_count: Number.MAX_SAFE_INTEGER })
  seed(db, {
    id: 'decay',
    importance: 0.5,
    created_at: '2025-12-01T00:00:00.000Z',
  })
  const router = createLegacyMutationRouter(db, { clock: () => fixedTime })
  assert.throws(() => router.execute({
    intentKind: 'legacy_record_recall_inclusion',
    actor: 'lifecycle_job',
    bumpAmount: 0.05,
    memoryIds: ['safe', 'overflow'],
  }), {
    name: 'RangeError',
    message: 'Memory access_count cannot be incremented safely.',
  })
  assert.equal(db.prepare('SELECT access_count FROM memories WHERE id=?').get('safe').access_count, 1)

  const lifecycle = router.execute({
    intentKind: 'legacy_run_lifecycle',
    now: fixedTime,
    palariId: 'palari-a',
  })
  assert.equal(lifecycle.touched, lifecycle.decayed + lifecycle.deleted)
  assert.ok(lifecycle.touched >= 1)
  assert.equal(
    db.prepare('SELECT last_decayed_at FROM memories WHERE id=?').get('decay')?.last_decayed_at,
    fixedTime,
  )
  db.close()
})
