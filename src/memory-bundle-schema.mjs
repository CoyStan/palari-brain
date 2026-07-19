const reflectApply = Reflect.apply
const stringCharCodeAt = String.prototype.charCodeAt
const stringSlice = String.prototype.slice

export const MEMORY_BUNDLE_CAPABILITIES = Object.freeze({
  sourceOfTruth: false,
  physicalDeletion: false,
  deletionProvable: false,
  signed: false,
  cryptographicAudit: false,
  externalAnchorRequired: false,
})

export const MEMORY_BUNDLE_SCHEMA_VERSION = 'CDX-B1'

export const MEMORY_BUNDLE_OBJECTS = Object.freeze([
  Object.freeze({
    type: 'table',
    name: 'memory_bundle_meta',
    executionSql: `CREATE TABLE main.memory_bundle_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version TEXT NOT NULL CHECK (schema_version = 'CDX-B1'),
  stream_id TEXT NOT NULL UNIQUE,
  head_sequence INTEGER NOT NULL
    CHECK (head_sequence >= 0 AND head_sequence <= 9007199254740991),
  created_at TEXT NOT NULL
) STRICT;`,
    persistedSql: `CREATE TABLE memory_bundle_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version TEXT NOT NULL CHECK (schema_version = 'CDX-B1'),
  stream_id TEXT NOT NULL UNIQUE,
  head_sequence INTEGER NOT NULL
    CHECK (head_sequence >= 0 AND head_sequence <= 9007199254740991),
  created_at TEXT NOT NULL
) STRICT;`,
  }),
  Object.freeze({
    type: 'table',
    name: 'memory_bundle_events',
    executionSql: `CREATE TABLE main.memory_bundle_events (
  sequence INTEGER PRIMARY KEY
    CHECK (sequence > 0 AND sequence <= 9007199254740991),
  stream_id TEXT NOT NULL,
  decision_id TEXT NOT NULL UNIQUE,
  proposal_id TEXT NOT NULL UNIQUE,
  proposal_kind TEXT NOT NULL
    CHECK (proposal_kind IN ('promote','permanent','demote')),
  operation TEXT NOT NULL CHECK (operation IN ('create','delete')),
  outcome TEXT NOT NULL CHECK (outcome IN ('applied','refused')),
  reason_code TEXT
    CHECK (reason_code IS NULL OR reason_code IN (
      'below_threshold','duplicate_current','missing_target',
      'unauthorized','unsupported'
    )),
  palari_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  authority_kind TEXT NOT NULL CHECK (authority_kind IN ('user','policy')),
  authority_id TEXT NOT NULL,
  evidence_kind TEXT NOT NULL CHECK (evidence_kind = 'direct_user_message'),
  memory_id TEXT,
  memory_type TEXT CHECK (memory_type IS NULL OR memory_type IN (
    'relationship','preference','opinion','entity','life_event',
    'working','project','recent_life','session_summary'
  )),
  effective_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  FOREIGN KEY (stream_id) REFERENCES memory_bundle_meta(stream_id),
  CHECK (
    (operation = 'create' AND outcome = 'applied'
      AND reason_code IS NULL AND authority_kind = 'user'
      AND authority_id = user_id
      AND memory_id IS NOT NULL AND memory_type IS NOT NULL
      AND (
        (proposal_kind = 'permanent' AND memory_type IN (
          'relationship','preference','opinion','entity','life_event'
        ))
        OR
        (proposal_kind = 'promote' AND memory_type IN (
          'working','project','recent_life','session_summary'
        ))
      ))
    OR
    (operation = 'create' AND outcome = 'refused'
      AND reason_code IS NOT NULL
      AND reason_code IN (
        'below_threshold','duplicate_current','unauthorized','unsupported'
      )
      AND authority_kind = 'policy'
      AND authority_id = 'palari-kernel-admission@1'
      AND memory_id IS NULL AND memory_type IS NOT NULL
      AND (
        (proposal_kind = 'permanent' AND memory_type IN (
          'relationship','preference','opinion','entity','life_event'
        ))
        OR
        (proposal_kind = 'promote' AND memory_type IN (
          'working','project','recent_life','session_summary'
        ))
      ))
    OR
    (operation = 'delete' AND outcome = 'applied'
      AND proposal_kind = 'demote'
      AND reason_code IS NULL AND authority_kind = 'user'
      AND authority_id = user_id
      AND memory_id IS NOT NULL AND memory_type IS NULL)
    OR
    (operation = 'delete' AND outcome = 'refused'
      AND proposal_kind = 'demote'
      AND reason_code IS NOT NULL
      AND reason_code IN ('missing_target','unauthorized','unsupported')
      AND authority_kind = 'policy'
      AND authority_id = 'palari-kernel-admission@1'
      AND memory_id IS NOT NULL AND memory_type IS NULL)
  )
) STRICT;`,
    persistedSql: `CREATE TABLE memory_bundle_events (
  sequence INTEGER PRIMARY KEY
    CHECK (sequence > 0 AND sequence <= 9007199254740991),
  stream_id TEXT NOT NULL,
  decision_id TEXT NOT NULL UNIQUE,
  proposal_id TEXT NOT NULL UNIQUE,
  proposal_kind TEXT NOT NULL
    CHECK (proposal_kind IN ('promote','permanent','demote')),
  operation TEXT NOT NULL CHECK (operation IN ('create','delete')),
  outcome TEXT NOT NULL CHECK (outcome IN ('applied','refused')),
  reason_code TEXT
    CHECK (reason_code IS NULL OR reason_code IN (
      'below_threshold','duplicate_current','missing_target',
      'unauthorized','unsupported'
    )),
  palari_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  authority_kind TEXT NOT NULL CHECK (authority_kind IN ('user','policy')),
  authority_id TEXT NOT NULL,
  evidence_kind TEXT NOT NULL CHECK (evidence_kind = 'direct_user_message'),
  memory_id TEXT,
  memory_type TEXT CHECK (memory_type IS NULL OR memory_type IN (
    'relationship','preference','opinion','entity','life_event',
    'working','project','recent_life','session_summary'
  )),
  effective_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  FOREIGN KEY (stream_id) REFERENCES memory_bundle_meta(stream_id),
  CHECK (
    (operation = 'create' AND outcome = 'applied'
      AND reason_code IS NULL AND authority_kind = 'user'
      AND authority_id = user_id
      AND memory_id IS NOT NULL AND memory_type IS NOT NULL
      AND (
        (proposal_kind = 'permanent' AND memory_type IN (
          'relationship','preference','opinion','entity','life_event'
        ))
        OR
        (proposal_kind = 'promote' AND memory_type IN (
          'working','project','recent_life','session_summary'
        ))
      ))
    OR
    (operation = 'create' AND outcome = 'refused'
      AND reason_code IS NOT NULL
      AND reason_code IN (
        'below_threshold','duplicate_current','unauthorized','unsupported'
      )
      AND authority_kind = 'policy'
      AND authority_id = 'palari-kernel-admission@1'
      AND memory_id IS NULL AND memory_type IS NOT NULL
      AND (
        (proposal_kind = 'permanent' AND memory_type IN (
          'relationship','preference','opinion','entity','life_event'
        ))
        OR
        (proposal_kind = 'promote' AND memory_type IN (
          'working','project','recent_life','session_summary'
        ))
      ))
    OR
    (operation = 'delete' AND outcome = 'applied'
      AND proposal_kind = 'demote'
      AND reason_code IS NULL AND authority_kind = 'user'
      AND authority_id = user_id
      AND memory_id IS NOT NULL AND memory_type IS NULL)
    OR
    (operation = 'delete' AND outcome = 'refused'
      AND proposal_kind = 'demote'
      AND reason_code IS NOT NULL
      AND reason_code IN ('missing_target','unauthorized','unsupported')
      AND authority_kind = 'policy'
      AND authority_id = 'palari-kernel-admission@1'
      AND memory_id IS NOT NULL AND memory_type IS NULL)
  )
) STRICT;`,
  }),
  Object.freeze({
    type: 'table',
    name: 'memory_bundle_atoms',
    executionSql: `CREATE TABLE main.memory_bundle_atoms (
  memory_id TEXT PRIMARY KEY,
  stream_id TEXT NOT NULL,
  created_sequence INTEGER NOT NULL UNIQUE
    CHECK (created_sequence > 0 AND created_sequence <= 9007199254740991),
  palari_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'relationship','preference','opinion','entity','life_event',
    'working','project','recent_life','session_summary'
  )),
  content TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  initial_importance REAL NOT NULL
    CHECK (initial_importance >= 0 AND initial_importance <= 1),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  provenance_kind TEXT NOT NULL CHECK (provenance_kind = 'direct_user_message'),
  source_message_id TEXT,
  valid_from TEXT NOT NULL,
  created_at TEXT NOT NULL,
  fictional INTEGER NOT NULL CHECK (fictional IN (0,1)),
  content_checksum TEXT NOT NULL,
  FOREIGN KEY (stream_id) REFERENCES memory_bundle_meta(stream_id),
  FOREIGN KEY (created_sequence) REFERENCES memory_bundle_events(sequence)
) STRICT;`,
    persistedSql: `CREATE TABLE memory_bundle_atoms (
  memory_id TEXT PRIMARY KEY,
  stream_id TEXT NOT NULL,
  created_sequence INTEGER NOT NULL UNIQUE
    CHECK (created_sequence > 0 AND created_sequence <= 9007199254740991),
  palari_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'relationship','preference','opinion','entity','life_event',
    'working','project','recent_life','session_summary'
  )),
  content TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  initial_importance REAL NOT NULL
    CHECK (initial_importance >= 0 AND initial_importance <= 1),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  provenance_kind TEXT NOT NULL CHECK (provenance_kind = 'direct_user_message'),
  source_message_id TEXT,
  valid_from TEXT NOT NULL,
  created_at TEXT NOT NULL,
  fictional INTEGER NOT NULL CHECK (fictional IN (0,1)),
  content_checksum TEXT NOT NULL,
  FOREIGN KEY (stream_id) REFERENCES memory_bundle_meta(stream_id),
  FOREIGN KEY (created_sequence) REFERENCES memory_bundle_events(sequence)
) STRICT;`,
  }),
  Object.freeze({
    type: 'index',
    name: 'memory_bundle_applied_create_memory_unique',
    executionSql: `CREATE UNIQUE INDEX main.memory_bundle_applied_create_memory_unique
  ON memory_bundle_events(memory_id)
  WHERE operation = 'create' AND outcome = 'applied';`,
    persistedSql: `CREATE UNIQUE INDEX memory_bundle_applied_create_memory_unique
  ON memory_bundle_events(memory_id)
  WHERE operation = 'create' AND outcome = 'applied';`,
  }),
  Object.freeze({
    type: 'index',
    name: 'memory_bundle_applied_delete_memory_unique',
    executionSql: `CREATE UNIQUE INDEX main.memory_bundle_applied_delete_memory_unique
  ON memory_bundle_events(memory_id)
  WHERE operation = 'delete' AND outcome = 'applied';`,
    persistedSql: `CREATE UNIQUE INDEX memory_bundle_applied_delete_memory_unique
  ON memory_bundle_events(memory_id)
  WHERE operation = 'delete' AND outcome = 'applied';`,
  }),
  Object.freeze({
    type: 'trigger',
    name: 'memory_bundle_events_no_update',
    executionSql: `CREATE TRIGGER main.memory_bundle_events_no_update
BEFORE UPDATE ON memory_bundle_events
BEGIN SELECT RAISE(ABORT, 'memory_bundle_events_append_only'); END;`,
    persistedSql: `CREATE TRIGGER memory_bundle_events_no_update
BEFORE UPDATE ON memory_bundle_events
BEGIN SELECT RAISE(ABORT, 'memory_bundle_events_append_only'); END;`,
  }),
  Object.freeze({
    type: 'trigger',
    name: 'memory_bundle_events_no_delete',
    executionSql: `CREATE TRIGGER main.memory_bundle_events_no_delete
BEFORE DELETE ON memory_bundle_events
BEGIN SELECT RAISE(ABORT, 'memory_bundle_events_append_only'); END;`,
    persistedSql: `CREATE TRIGGER memory_bundle_events_no_delete
BEFORE DELETE ON memory_bundle_events
BEGIN SELECT RAISE(ABORT, 'memory_bundle_events_append_only'); END;`,
  }),
  Object.freeze({
    type: 'trigger',
    name: 'memory_bundle_event_next_sequence',
    executionSql: `CREATE TRIGGER main.memory_bundle_event_next_sequence
BEFORE INSERT ON memory_bundle_events
WHEN NOT EXISTS (
  SELECT 1 FROM memory_bundle_meta m
  WHERE m.singleton = 1
    AND NEW.stream_id = m.stream_id
    AND NEW.sequence = m.head_sequence + 1
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_event_sequence'); END;`,
    persistedSql: `CREATE TRIGGER memory_bundle_event_next_sequence
BEFORE INSERT ON memory_bundle_events
WHEN NOT EXISTS (
  SELECT 1 FROM memory_bundle_meta m
  WHERE m.singleton = 1
    AND NEW.stream_id = m.stream_id
    AND NEW.sequence = m.head_sequence + 1
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_event_sequence'); END;`,
  }),
  Object.freeze({
    type: 'trigger',
    name: 'memory_bundle_atoms_no_update',
    executionSql: `CREATE TRIGGER main.memory_bundle_atoms_no_update
BEFORE UPDATE ON memory_bundle_atoms
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atoms_immutable'); END;`,
    persistedSql: `CREATE TRIGGER memory_bundle_atoms_no_update
BEFORE UPDATE ON memory_bundle_atoms
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atoms_immutable'); END;`,
  }),
  Object.freeze({
    type: 'trigger',
    name: 'memory_bundle_atom_insert_guard',
    executionSql: `CREATE TRIGGER main.memory_bundle_atom_insert_guard
BEFORE INSERT ON memory_bundle_atoms
WHEN NOT EXISTS (
  SELECT 1
  FROM memory_bundle_meta m
  JOIN memory_bundle_events e
    ON e.sequence = m.head_sequence + 1
  WHERE m.singleton = 1
    AND e.stream_id = m.stream_id
    AND e.operation = 'create'
    AND e.outcome = 'applied'
    AND e.memory_id = NEW.memory_id
    AND e.memory_type = NEW.type
    AND e.sequence = NEW.created_sequence
    AND e.palari_id = NEW.palari_id
    AND e.user_id = NEW.user_id
    AND e.effective_at = NEW.valid_from
    AND e.observed_at = NEW.created_at
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atom_insert_unauthorized'); END;`,
    persistedSql: `CREATE TRIGGER memory_bundle_atom_insert_guard
BEFORE INSERT ON memory_bundle_atoms
WHEN NOT EXISTS (
  SELECT 1
  FROM memory_bundle_meta m
  JOIN memory_bundle_events e
    ON e.sequence = m.head_sequence + 1
  WHERE m.singleton = 1
    AND e.stream_id = m.stream_id
    AND e.operation = 'create'
    AND e.outcome = 'applied'
    AND e.memory_id = NEW.memory_id
    AND e.memory_type = NEW.type
    AND e.sequence = NEW.created_sequence
    AND e.palari_id = NEW.palari_id
    AND e.user_id = NEW.user_id
    AND e.effective_at = NEW.valid_from
    AND e.observed_at = NEW.created_at
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atom_insert_unauthorized'); END;`,
  }),
  Object.freeze({
    type: 'trigger',
    name: 'memory_bundle_atom_delete_guard',
    executionSql: `CREATE TRIGGER main.memory_bundle_atom_delete_guard
BEFORE DELETE ON memory_bundle_atoms
WHEN NOT EXISTS (
  SELECT 1
  FROM memory_bundle_meta m
  JOIN memory_bundle_events e
    ON e.sequence = m.head_sequence + 1
  WHERE m.singleton = 1
    AND e.stream_id = m.stream_id
    AND e.operation = 'delete'
    AND e.outcome = 'applied'
    AND e.memory_id = OLD.memory_id
    AND e.palari_id = OLD.palari_id
    AND e.user_id = OLD.user_id
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atom_delete_unauthorized'); END;`,
    persistedSql: `CREATE TRIGGER memory_bundle_atom_delete_guard
BEFORE DELETE ON memory_bundle_atoms
WHEN NOT EXISTS (
  SELECT 1
  FROM memory_bundle_meta m
  JOIN memory_bundle_events e
    ON e.sequence = m.head_sequence + 1
  WHERE m.singleton = 1
    AND e.stream_id = m.stream_id
    AND e.operation = 'delete'
    AND e.outcome = 'applied'
    AND e.memory_id = OLD.memory_id
    AND e.palari_id = OLD.palari_id
    AND e.user_id = OLD.user_id
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atom_delete_unauthorized'); END;`,
  }),
  Object.freeze({
    type: 'trigger',
    name: 'memory_bundle_meta_no_delete',
    executionSql: `CREATE TRIGGER main.memory_bundle_meta_no_delete
BEFORE DELETE ON memory_bundle_meta
BEGIN SELECT RAISE(ABORT, 'memory_bundle_meta_required'); END;`,
    persistedSql: `CREATE TRIGGER memory_bundle_meta_no_delete
BEFORE DELETE ON memory_bundle_meta
BEGIN SELECT RAISE(ABORT, 'memory_bundle_meta_required'); END;`,
  }),
  Object.freeze({
    type: 'trigger',
    name: 'memory_bundle_meta_advance_guard',
    executionSql: `CREATE TRIGGER main.memory_bundle_meta_advance_guard
BEFORE UPDATE ON memory_bundle_meta
WHEN NEW.singleton != OLD.singleton
  OR NEW.schema_version != OLD.schema_version
  OR NEW.stream_id != OLD.stream_id
  OR NEW.created_at != OLD.created_at
  OR NEW.head_sequence != OLD.head_sequence + 1
  OR NOT EXISTS (
    SELECT 1 FROM memory_bundle_events e
    WHERE e.stream_id = OLD.stream_id
      AND e.sequence = NEW.head_sequence
      AND (
        (e.outcome = 'refused')
        OR
        (e.operation = 'create' AND e.outcome = 'applied' AND EXISTS (
          SELECT 1 FROM memory_bundle_atoms a
          WHERE a.memory_id = e.memory_id
            AND a.created_sequence = e.sequence
        ))
        OR
        (e.operation = 'delete' AND e.outcome = 'applied'
          AND EXISTS (
            SELECT 1 FROM memory_bundle_events c
            WHERE c.memory_id = e.memory_id
              AND c.operation = 'create'
              AND c.outcome = 'applied'
              AND c.sequence < e.sequence
          )
          AND NOT EXISTS (
            SELECT 1 FROM memory_bundle_atoms a
            WHERE a.memory_id = e.memory_id
          ))
      )
  )
BEGIN SELECT RAISE(ABORT, 'memory_bundle_meta_advance_invalid'); END;`,
    persistedSql: `CREATE TRIGGER memory_bundle_meta_advance_guard
BEFORE UPDATE ON memory_bundle_meta
WHEN NEW.singleton != OLD.singleton
  OR NEW.schema_version != OLD.schema_version
  OR NEW.stream_id != OLD.stream_id
  OR NEW.created_at != OLD.created_at
  OR NEW.head_sequence != OLD.head_sequence + 1
  OR NOT EXISTS (
    SELECT 1 FROM memory_bundle_events e
    WHERE e.stream_id = OLD.stream_id
      AND e.sequence = NEW.head_sequence
      AND (
        (e.outcome = 'refused')
        OR
        (e.operation = 'create' AND e.outcome = 'applied' AND EXISTS (
          SELECT 1 FROM memory_bundle_atoms a
          WHERE a.memory_id = e.memory_id
            AND a.created_sequence = e.sequence
        ))
        OR
        (e.operation = 'delete' AND e.outcome = 'applied'
          AND EXISTS (
            SELECT 1 FROM memory_bundle_events c
            WHERE c.memory_id = e.memory_id
              AND c.operation = 'create'
              AND c.outcome = 'applied'
              AND c.sequence < e.sequence
          )
          AND NOT EXISTS (
            SELECT 1 FROM memory_bundle_atoms a
            WHERE a.memory_id = e.memory_id
          ))
      )
  )
BEGIN SELECT RAISE(ABORT, 'memory_bundle_meta_advance_invalid'); END;`,
  }),
])

export const MEMORY_BUNDLE_AUTOINDEXES = Object.freeze([
  Object.freeze({
    name: 'sqlite_autoindex_memory_bundle_meta_1',
    indexXinfo: Object.freeze([
      Object.freeze({
        seqno: 0,
        cid: 2,
        name: 'stream_id',
        desc: 0,
        coll: 'BINARY',
        key: 1,
      }),
      Object.freeze({
        seqno: 1,
        cid: -1,
        name: null,
        desc: 0,
        coll: 'BINARY',
        key: 0,
      }),
    ]),
  }),
  Object.freeze({
    name: 'sqlite_autoindex_memory_bundle_events_1',
    indexXinfo: Object.freeze([
      Object.freeze({
        seqno: 0,
        cid: 2,
        name: 'decision_id',
        desc: 0,
        coll: 'BINARY',
        key: 1,
      }),
      Object.freeze({
        seqno: 1,
        cid: -1,
        name: null,
        desc: 0,
        coll: 'BINARY',
        key: 0,
      }),
    ]),
  }),
  Object.freeze({
    name: 'sqlite_autoindex_memory_bundle_events_2',
    indexXinfo: Object.freeze([
      Object.freeze({
        seqno: 0,
        cid: 3,
        name: 'proposal_id',
        desc: 0,
        coll: 'BINARY',
        key: 1,
      }),
      Object.freeze({
        seqno: 1,
        cid: -1,
        name: null,
        desc: 0,
        coll: 'BINARY',
        key: 0,
      }),
    ]),
  }),
  Object.freeze({
    name: 'sqlite_autoindex_memory_bundle_atoms_1',
    indexXinfo: Object.freeze([
      Object.freeze({
        seqno: 0,
        cid: 0,
        name: 'memory_id',
        desc: 0,
        coll: 'BINARY',
        key: 1,
      }),
      Object.freeze({
        seqno: 1,
        cid: -1,
        name: null,
        desc: 0,
        coll: 'BINARY',
        key: 0,
      }),
    ]),
  }),
  Object.freeze({
    name: 'sqlite_autoindex_memory_bundle_atoms_2',
    indexXinfo: Object.freeze([
      Object.freeze({
        seqno: 0,
        cid: 2,
        name: 'created_sequence',
        desc: 0,
        coll: 'BINARY',
        key: 1,
      }),
      Object.freeze({
        seqno: 1,
        cid: -1,
        name: null,
        desc: 0,
        coll: 'BINARY',
        key: 0,
      }),
    ]),
  }),
])

export const MEMORY_BUNDLE_TRIGGER_TARGETS = Object.freeze([
  Object.freeze({
    name: 'memory_bundle_atom_delete_guard',
    table: 'memory_bundle_atoms',
  }),
  Object.freeze({
    name: 'memory_bundle_atom_insert_guard',
    table: 'memory_bundle_atoms',
  }),
  Object.freeze({
    name: 'memory_bundle_atoms_no_update',
    table: 'memory_bundle_atoms',
  }),
  Object.freeze({
    name: 'memory_bundle_event_next_sequence',
    table: 'memory_bundle_events',
  }),
  Object.freeze({
    name: 'memory_bundle_events_no_delete',
    table: 'memory_bundle_events',
  }),
  Object.freeze({
    name: 'memory_bundle_events_no_update',
    table: 'memory_bundle_events',
  }),
  Object.freeze({
    name: 'memory_bundle_meta_advance_guard',
    table: 'memory_bundle_meta',
  }),
  Object.freeze({
    name: 'memory_bundle_meta_no_delete',
    table: 'memory_bundle_meta',
  }),
])

function freezeRowManifest(manifest) {
  const names = Object.keys(manifest)
  for (let index = 0; index < names.length; index += 1) {
    const rows = manifest[names[index]]
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      Object.freeze(rows[rowIndex])
    }
    Object.freeze(rows)
  }
  return Object.freeze(manifest)
}

export const MEMORY_BUNDLE_TABLE_XINFO = freezeRowManifest({
  memory_bundle_meta: [
    { cid: 0, name: 'singleton', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1, hidden: 0 },
    { cid: 1, name: 'schema_version', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 2, name: 'stream_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 3, name: 'head_sequence', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 4, name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
  ],
  memory_bundle_events: [
    { cid: 0, name: 'sequence', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1, hidden: 0 },
    { cid: 1, name: 'stream_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 2, name: 'decision_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 3, name: 'proposal_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 4, name: 'proposal_kind', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 5, name: 'operation', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 6, name: 'outcome', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 7, name: 'reason_code', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 8, name: 'palari_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 9, name: 'user_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 10, name: 'authority_kind', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 11, name: 'authority_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 12, name: 'evidence_kind', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 13, name: 'memory_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 14, name: 'memory_type', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 15, name: 'effective_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 16, name: 'observed_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
  ],
  memory_bundle_atoms: [
    { cid: 0, name: 'memory_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1, hidden: 0 },
    { cid: 1, name: 'stream_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 2, name: 'created_sequence', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 3, name: 'palari_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 4, name: 'user_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 5, name: 'type', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 6, name: 'content', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 7, name: 'keywords_json', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 8, name: 'initial_importance', type: 'REAL', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 9, name: 'confidence', type: 'REAL', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 10, name: 'provenance_kind', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 11, name: 'source_message_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 12, name: 'valid_from', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 13, name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 14, name: 'fictional', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { cid: 15, name: 'content_checksum', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
  ],
})

export const MEMORY_BUNDLE_INDEX_LIST = freezeRowManifest({
  memory_bundle_meta: [
    { name: 'sqlite_autoindex_memory_bundle_meta_1', unique: 1, origin: 'u', partial: 0 },
  ],
  memory_bundle_events: [
    { name: 'memory_bundle_applied_create_memory_unique', unique: 1, origin: 'c', partial: 1 },
    { name: 'memory_bundle_applied_delete_memory_unique', unique: 1, origin: 'c', partial: 1 },
    { name: 'sqlite_autoindex_memory_bundle_events_1', unique: 1, origin: 'u', partial: 0 },
    { name: 'sqlite_autoindex_memory_bundle_events_2', unique: 1, origin: 'u', partial: 0 },
  ],
  memory_bundle_atoms: [
    { name: 'sqlite_autoindex_memory_bundle_atoms_1', unique: 1, origin: 'pk', partial: 0 },
    { name: 'sqlite_autoindex_memory_bundle_atoms_2', unique: 1, origin: 'u', partial: 0 },
  ],
})

export const MEMORY_BUNDLE_INDEX_XINFO = freezeRowManifest({
  memory_bundle_applied_create_memory_unique: [
    { seqno: 0, cid: 13, name: 'memory_id', desc: 0, coll: 'BINARY', key: 1 },
    { seqno: 1, cid: -1, name: null, desc: 0, coll: 'BINARY', key: 0 },
  ],
  memory_bundle_applied_delete_memory_unique: [
    { seqno: 0, cid: 13, name: 'memory_id', desc: 0, coll: 'BINARY', key: 1 },
    { seqno: 1, cid: -1, name: null, desc: 0, coll: 'BINARY', key: 0 },
  ],
  sqlite_autoindex_memory_bundle_atoms_1: [
    { seqno: 0, cid: 0, name: 'memory_id', desc: 0, coll: 'BINARY', key: 1 },
    { seqno: 1, cid: -1, name: null, desc: 0, coll: 'BINARY', key: 0 },
  ],
  sqlite_autoindex_memory_bundle_atoms_2: [
    { seqno: 0, cid: 2, name: 'created_sequence', desc: 0, coll: 'BINARY', key: 1 },
    { seqno: 1, cid: -1, name: null, desc: 0, coll: 'BINARY', key: 0 },
  ],
  sqlite_autoindex_memory_bundle_events_1: [
    { seqno: 0, cid: 2, name: 'decision_id', desc: 0, coll: 'BINARY', key: 1 },
    { seqno: 1, cid: -1, name: null, desc: 0, coll: 'BINARY', key: 0 },
  ],
  sqlite_autoindex_memory_bundle_events_2: [
    { seqno: 0, cid: 3, name: 'proposal_id', desc: 0, coll: 'BINARY', key: 1 },
    { seqno: 1, cid: -1, name: null, desc: 0, coll: 'BINARY', key: 0 },
  ],
  sqlite_autoindex_memory_bundle_meta_1: [
    { seqno: 0, cid: 2, name: 'stream_id', desc: 0, coll: 'BINARY', key: 1 },
    { seqno: 1, cid: -1, name: null, desc: 0, coll: 'BINARY', key: 0 },
  ],
})

export const MEMORY_BUNDLE_FOREIGN_KEY_LIST = freezeRowManifest({
  memory_bundle_meta: [],
  memory_bundle_events: [
    {
      table: 'memory_bundle_meta',
      from: 'stream_id',
      to: 'stream_id',
      on_update: 'NO ACTION',
      on_delete: 'NO ACTION',
      match: 'NONE',
    },
  ],
  memory_bundle_atoms: [
    {
      table: 'memory_bundle_events',
      from: 'created_sequence',
      to: 'sequence',
      on_update: 'NO ACTION',
      on_delete: 'NO ACTION',
      match: 'NONE',
    },
    {
      table: 'memory_bundle_meta',
      from: 'stream_id',
      to: 'stream_id',
      on_update: 'NO ACTION',
      on_delete: 'NO ACTION',
      match: 'NONE',
    },
  ],
})

export const MEMORY_BUNDLE_REQUIRED_PRAGMAS = Object.freeze({
  foreign_keys: 1,
  busy_timeout: 0,
  recursive_triggers: 1,
  ignore_check_constraints: 0,
})

function isAsciiSqlWhitespace(unit) {
  return (
    unit === 0x09 ||
    unit === 0x0a ||
    unit === 0x0b ||
    unit === 0x0c ||
    unit === 0x0d ||
    unit === 0x20
  )
}

export function normalizeMemoryBundleSql(sql) {
  let normalized = ''
  for (let index = 0; index < sql.length; index += 1) {
    const unit = reflectApply(stringCharCodeAt, sql, [index])
    if (
      unit === 0x0d &&
      index + 1 < sql.length &&
      reflectApply(stringCharCodeAt, sql, [index + 1]) === 0x0a
    ) {
      normalized += '\n'
      index += 1
    } else {
      normalized += reflectApply(stringSlice, sql, [index, index + 1])
    }
  }

  let start = 0
  let end = normalized.length
  while (
    start < end &&
    isAsciiSqlWhitespace(reflectApply(stringCharCodeAt, normalized, [start]))
  ) {
    start += 1
  }
  while (
    end > start &&
    isAsciiSqlWhitespace(reflectApply(stringCharCodeAt, normalized, [end - 1]))
  ) {
    end -= 1
  }
  if (
    end > start &&
    reflectApply(stringCharCodeAt, normalized, [end - 1]) === 0x3b
  ) {
    end -= 1
    while (
      end > start &&
      isAsciiSqlWhitespace(reflectApply(stringCharCodeAt, normalized, [end - 1]))
    ) {
      end -= 1
    }
  }
  return reflectApply(stringSlice, normalized, [start, end])
}
