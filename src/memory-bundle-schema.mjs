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

export const MEMORY_BUNDLE_REQUIRED_PRAGMAS = Object.freeze({
  foreign_keys: 1,
  busy_timeout: 0,
  recursive_triggers: 1,
  ignore_check_constraints: 0,
})

export function normalizeMemoryBundleSql(sql) {
  let normalized = sql.replaceAll('\r\n', '\n').replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '')
  normalized = normalized.replace(/;[\t\n\v\f\r ]*$/, '')
  return normalized.replace(/[\t\n\v\f\r ]+$/g, '')
}
