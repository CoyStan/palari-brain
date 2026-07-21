const reflectApply = Reflect.apply
const objectCreate = Object.create
const objectDefineProperty = Object.defineProperty
const objectFreeze = Object.freeze
const objectKeys = Object.keys
const arrayIsArray = Array.isArray
const stringCharCodeAt = String.prototype.charCodeAt
const stringIndexOf = String.prototype.indexOf
const stringSlice = String.prototype.slice
const nativeTypeError = TypeError

function defineArrayValue(target, index, value) {
  objectDefineProperty(target, index, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  })
}

function toFrozenData(value) {
  if (arrayIsArray(value)) {
    const result = []
    for (let index = 0; index < value.length; index += 1) {
      defineArrayValue(result, index, toFrozenData(value[index]))
    }
    return objectFreeze(result)
  }
  if (value !== null && typeof value === 'object') {
    const result = objectCreate(null)
    const keys = objectKeys(value)
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      objectDefineProperty(result, key, {
        value: toFrozenData(value[key]),
        writable: false,
        enumerable: true,
        configurable: false,
      })
    }
    return objectFreeze(result)
  }
  return value
}

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

export function normalizeCdxB2Sql(sql) {
  if (typeof sql !== 'string') {
    throw new nativeTypeError('sql must be a primitive string')
  }

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

export const CDX_B2_KERNEL_CONFIG_JSON = "{\"schemaVersion\":\"CDX-B2-kernel-config@1\",\"profiles\":{\"schema\":\"CDX-B2\",\"kernel\":\"FB1-4.ratified-erasure-apply-v1\",\"projection\":\"CDX-M1-runtime@1\",\"authority\":\"host-checked-external-grant-v1\",\"referenceKernel\":\"FB1-4.patch-kernel-v1\"},\"pins\":{\"unifiedCommit\":\"c9af823c7dee29d29fd937d44527f3b78d8d3845\",\"part2Blob\":\"0df141ad0c5dacb50e81a40b6199769b120f0770\",\"part4Blob\":\"a0eda8e01c876f7955b74d26afe014bc74147c26\",\"part5Blob\":\"4d8239e8e2b3f7b85698a56cd6b9d93b195ae5fc\",\"part8Blob\":\"3ddac03564d518e86b7494d2e408c2b839a88df2\",\"part12Blob\":\"6108926f82f8c44c7ed5a946314c39ce8ea1a115\",\"part13Blob\":\"39c92bd7a3626e808053a7ae8ceb17dbccf40e59\",\"part15Blob\":\"e6d21d558bce132678ac8b50abb832797b40a950\",\"referencePatchKernelBlob\":\"df4de5f00ae88ba670305f9b2bb699441cc5b234\",\"a1Implementation\":\"07d65adcd271b5db04beb9a9fec2335adfb443e2\",\"a2CertifiedBaseline\":\"53e5b0357f83be7700a32458d38922cb7777a66e\",\"a2RouterBlob\":\"566395f2f114ebfa0d52481632a9cfc6f21b3256\",\"a2ObligationsBlob\":\"33d8fa3b89e5348d3e5d624315fcd1c870ed095c\",\"a2RoutingContractBlob\":\"a3ad75dc78644de2329af2feb680aef559068774\",\"a2PlanVersion\":\"CDX-M1-legacy-plan@1\",\"protectedB1Baseline\":\"1d65bb09de854a46abb21d762ea50cc80bb99a9f\"},\"registry\":{\"kinds\":[{\"kind\":\"audit\",\"theta\":0.9},{\"kind\":\"conf\",\"theta\":0.3},{\"kind\":\"demote\",\"theta\":0.55},{\"kind\":\"emit\",\"theta\":0.5},{\"kind\":\"obligate\",\"theta\":0.65},{\"kind\":\"pause\",\"theta\":0.5},{\"kind\":\"perm\",\"theta\":0.85},{\"kind\":\"promote\",\"theta\":0.65},{\"kind\":\"ratify\",\"theta\":1},{\"kind\":\"resume\",\"theta\":0.5},{\"kind\":\"scope_expand\",\"theta\":0.85},{\"kind\":\"trace\",\"theta\":0},{\"kind\":\"write\",\"theta\":0.5}],\"visibilities\":[{\"visibility\":\"reason_only\",\"floor\":0},{\"visibility\":\"ledger\",\"floor\":1},{\"visibility\":\"user_visible\",\"floor\":2},{\"visibility\":\"external\",\"floor\":3}],\"prioritiesAscending\":[\"promotion\",\"confidence\",\"repair\",\"provenance\",\"permission\",\"safety\"],\"sources\":[{\"source\":\"g_audit\",\"rank\":4},{\"source\":\"g_conf\",\"rank\":3},{\"source\":\"g_demote\",\"rank\":3},{\"source\":\"g_obligate\",\"rank\":3},{\"source\":\"g_perm\",\"rank\":3},{\"source\":\"g_promote\",\"rank\":3},{\"source\":\"operator\",\"rank\":6},{\"source\":\"peer_palari\",\"rank\":1},{\"source\":\"ratified_user\",\"rank\":5}],\"priorityMap\":[{\"kind\":\"audit\",\"source\":\"g_audit\",\"priority\":\"safety\"},{\"kind\":\"conf\",\"source\":\"g_conf\",\"priority\":\"confidence\"},{\"kind\":\"demote\",\"source\":\"g_demote\",\"priority\":\"repair\"},{\"kind\":\"obligate\",\"source\":\"g_obligate\",\"priority\":\"provenance\"},{\"kind\":\"perm\",\"source\":\"g_perm\",\"priority\":\"permission\"},{\"kind\":\"promote\",\"source\":\"g_promote\",\"priority\":\"promotion\"},{\"kind\":\"ratify\",\"source\":\"operator\",\"priority\":\"provenance\"},{\"kind\":\"ratify\",\"source\":\"ratified_user\",\"priority\":\"provenance\"},{\"kind\":\"scope_expand\",\"source\":\"ratified_user\",\"priority\":\"permission\"},{\"kind\":\"trace\",\"source\":\"g_audit\",\"priority\":\"promotion\"}],\"exclusiveKinds\":[\"conf\",\"perm\",\"promote\",\"write\"],\"admissionConditions\":[\"C1_kind\",\"C2_target\",\"C3_source\",\"C4_map_covers\",\"C5_priority_matches\",\"C6_valid_now\",\"C7_evidence\",\"C8_trust_scope\"],\"conflicts\":{\"explicit\":\"either_conflictsWith_array_includes_other_id\",\"promoteDemote\":\"same_slot_and_one_promote_one_demote\",\"exclusive\":\"same_slot_same_exclusive_kind_and_JSON_stringified_payload_differs\"},\"resolver\":{\"order\":\"strict_descending\",\"key\":[{\"field\":\"priorityRank\",\"formula\":\"patchPriorities.indexOf(patch.priority)\",\"direction\":\"desc\"},{\"field\":\"strength\",\"formula\":\"Number(patch?.provenance?.strength)||0\",\"direction\":\"desc\"},{\"field\":\"freshness\",\"formula\":\"-Math.max(0,(Date.parse(now)||0)-timestampMs)\",\"direction\":\"desc\"},{\"field\":\"sourceRank\",\"formula\":\"sourceRankTable[patch.source]??0\",\"direction\":\"desc\"},{\"field\":\"timestampMs\",\"formula\":\"Date.parse(patch?.provenance?.timestamp??'')||0\",\"direction\":\"desc\"},{\"field\":\"patchHash\",\"formula\":\"sha256_utf8(JSON.stringify(patchHashRecord))\",\"direction\":\"lex_desc\"}],\"patchHash\":{\"algorithm\":\"sha256\",\"inputEncoding\":\"utf8\",\"outputEncoding\":\"hex\",\"serialization\":\"JSON.stringify\",\"record\":[{\"field\":\"id\",\"value\":\"patch.id\"},{\"field\":\"kind\",\"value\":\"patch.kind\"},{\"field\":\"payload\",\"value\":\"patch.payload\"},{\"field\":\"slot\",\"value\":\"patch.target?.slot\"},{\"field\":\"source\",\"value\":\"patch.source\"},{\"field\":\"timestamp\",\"value\":\"patch.provenance?.timestamp\"}]},\"walk\":\"sort_then_keep_iff_no_conflict_with_kept\",\"dropReceipt\":\"kept_defeater_id\",\"ghostDefeatFree\":true}},\"specialization\":{\"operations\":[\"atom_erase\"],\"mappedObligations\":[\"D-02\",\"D-03\"],\"targetKind\":\"memory.atom\",\"patch\":{\"id\":\"<b2p_uuidv4>\",\"kind\":\"ratify\",\"target\":{\"slot\":\"mem/<id>\",\"visibility\":\"ledger\"},\"source\":\"ratified_user\",\"priority\":\"provenance\",\"payload\":{\"operation\":\"erase_owned_atom@1\",\"atomId\":\"<id>\"},\"provenance\":{\"strength\":1,\"timestamp\":\"<evidence_at>\",\"evidence\":[\"<authority_event_id>\"]},\"validity\":{\"notBefore\":\"<issued_at>\",\"notAfter\":\"<expires_at>\"},\"permRank\":1,\"conflictsWith\":[]},\"admissionContext\":{\"now\":\"<observed_at>\",\"trustRank\":1},\"timeLaw\":\"evidence_at<=issued_at<=effective_at=observed_at<expires_at\",\"classifier\":[{\"condition\":\"target_absent\",\"outcome\":\"refused\",\"reason\":\"missing_target\"},{\"condition\":\"palari_or_user_differs\",\"outcome\":\"refused\",\"reason\":\"scope_mismatch\"},{\"condition\":\"shared_equals_1\",\"outcome\":\"refused\",\"reason\":\"shared_scope_unsealed\"},{\"condition\":\"incident_link_count_greater_than_0\",\"outcome\":\"refused\",\"reason\":\"incident_edges_unemittable\"},{\"condition\":\"private_exact_scope_zero_links_exactly_one_fts\",\"outcome\":\"applied\",\"reason\":null}],\"ftsCardinality\":{\"required\":1,\"otherwise\":\"internal_rollback\"},\"projectionMismatch\":\"internal_rollback\",\"effects\":[{\"ordinal\":0,\"kind\":\"projection_atom_erased\"},{\"ordinal\":1,\"kind\":\"projection_fts_erased\"}],\"cdxEffect\":\"cdx_memory_delete\",\"eligibilityIgnores\":[\"memory_type\",\"validity_state\"]}}"

export const CDX_B2_KERNEL_CONFIG_HASH =
  'e1ded27e33516d73c60da1f4a4c9cb0767b1bb0b1482e78b429449ec7c0b07f4'

const PERSISTED_STATEMENTS = objectFreeze([
  `CREATE TABLE cdx_b2_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version TEXT NOT NULL CHECK (schema_version = 'CDX-B2'),
  kernel_profile TEXT NOT NULL CHECK (
    kernel_profile = 'FB1-4.ratified-erasure-apply-v1'
  ),
  projection_profile TEXT NOT NULL CHECK (
    projection_profile = 'CDX-M1-runtime@1'
  ),
  authority_profile TEXT NOT NULL CHECK (
    authority_profile = 'host-checked-external-grant-v1'
  ),
  stream_id TEXT NOT NULL UNIQUE CHECK (
    length(stream_id) = 40 AND
    substr(stream_id, 1, 4) = 'b2s_' AND
    substr(stream_id, 13, 1) = '-' AND
    substr(stream_id, 18, 1) = '-' AND
    substr(stream_id, 23, 1) = '-' AND
    substr(stream_id, 28, 1) = '-' AND
    substr(stream_id, 19, 1) = '4' AND
    substr(stream_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(stream_id, 5), '-', '')) = 32 AND
    replace(substr(stream_id, 5), '-', '') NOT GLOB '*[^0-9a-f]*'
  ),
  head_mutation_sequence INTEGER NOT NULL CHECK (
    head_mutation_sequence BETWEEN 0 AND 9007199254740991
  ),
  workspace_id TEXT NOT NULL CHECK (
    length(workspace_id) BETWEEN 1 AND 48 AND
    substr(workspace_id, 1, 1) GLOB '[a-z0-9]' AND
    workspace_id NOT GLOB '*[^a-z0-9-]*' AND
    instr(workspace_id, '--') = 0 AND
    (
      length(workspace_id) = 48 OR
      substr(workspace_id, -1, 1) GLOB '[a-z0-9]'
    )
  ),
  checkpoint_id TEXT NOT NULL UNIQUE CHECK (
    length(checkpoint_id) = 40 AND
    substr(checkpoint_id, 1, 4) = 'b2c_' AND
    substr(checkpoint_id, 13, 1) = '-' AND
    substr(checkpoint_id, 18, 1) = '-' AND
    substr(checkpoint_id, 23, 1) = '-' AND
    substr(checkpoint_id, 28, 1) = '-' AND
    substr(checkpoint_id, 19, 1) = '4' AND
    substr(checkpoint_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(checkpoint_id, 5), '-', '')) = 32 AND
    replace(substr(checkpoint_id, 5), '-', '') NOT GLOB '*[^0-9a-f]*'
  ),
  checkpoint_at TEXT NOT NULL CHECK (
    length(checkpoint_at) = 24 AND
    strftime('%Y-%m-%dT%H:%M:%fZ', checkpoint_at) IS checkpoint_at
  ),
  checkpoint_memory_count INTEGER NOT NULL CHECK (
    checkpoint_memory_count BETWEEN 0 AND 9007199254740991
  ),
  checkpoint_link_count INTEGER NOT NULL CHECK (
    checkpoint_link_count BETWEEN 0 AND 9007199254740991 AND
    checkpoint_memory_count <= 9007199254740991 - checkpoint_link_count
  ),
  baseline_disposition TEXT NOT NULL CHECK (
    baseline_disposition = 'unadjudicated'
  ),
  legacy_schema_variant TEXT NOT NULL CHECK (
    legacy_schema_variant IN (
      'cdx_m1_order_0',
      'cdx_m1_order_1',
      'cdx_m1_order_2'
    )
  ),
  kernel_version TEXT NOT NULL CHECK (
    kernel_version = 'FB1-4.patch-kernel-v1'
  ),
  kernel_source_commit TEXT NOT NULL CHECK (
    kernel_source_commit =
      'c9af823c7dee29d29fd937d44527f3b78d8d3845'
  ),
  kernel_source_blob TEXT NOT NULL CHECK (
    kernel_source_blob =
      'df4de5f00ae88ba670305f9b2bb699441cc5b234'
  ),
  kernel_config_hash TEXT NOT NULL CHECK (
    length(kernel_config_hash) = 64 AND
    kernel_config_hash NOT GLOB '*[^0-9a-f]*'
  )
) STRICT;`,
  `CREATE TABLE cdx_b2_legacy_checkpoint (
  checkpoint_ordinal INTEGER PRIMARY KEY CHECK (
    checkpoint_ordinal BETWEEN 1 AND 9007199254740991
  ),
  stream_id TEXT NOT NULL,
  entity_kind TEXT NOT NULL CHECK (
    entity_kind IN ('memory', 'link')
  ),
  entity_id TEXT NOT NULL,
  palari_id TEXT,
  user_id TEXT,
  memory_type TEXT,
  shared INTEGER,
  validity_state TEXT,
  from_memory_id TEXT,
  to_memory_id TEXT,
  UNIQUE (stream_id, entity_kind, entity_id),
  FOREIGN KEY (stream_id)
    REFERENCES cdx_b2_meta(stream_id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    MATCH NONE,
  CHECK (
    (
      entity_kind = 'memory' AND
      palari_id IS NOT NULL AND
      memory_type IS NOT NULL AND
      memory_type IN (
        'relationship',
        'preference',
        'opinion',
        'entity',
        'life_event',
        'working',
        'project',
        'recent_life',
        'session_summary'
      ) AND
      shared IS NOT NULL AND
      shared IN (0, 1) AND
      validity_state IS NOT NULL AND
      validity_state IN ('current', 'ended') AND
      from_memory_id IS NULL AND
      to_memory_id IS NULL
    ) OR (
      entity_kind = 'link' AND
      palari_id IS NULL AND
      user_id IS NULL AND
      memory_type IS NULL AND
      shared IS NULL AND
      validity_state IS NULL AND
      from_memory_id IS NOT NULL AND
      to_memory_id IS NOT NULL AND
      from_memory_id <> to_memory_id
    )
  )
) STRICT;`,
  `CREATE TABLE cdx_b2_decisions (
  sequence INTEGER PRIMARY KEY CHECK (
    sequence BETWEEN 1 AND 9007199254740991
  ),
  stream_id TEXT NOT NULL,
  decision_id TEXT NOT NULL UNIQUE CHECK (
    length(decision_id) = 40 AND
    substr(decision_id, 1, 4) = 'b2d_' AND
    substr(decision_id, 13, 1) = '-' AND
    substr(decision_id, 18, 1) = '-' AND
    substr(decision_id, 23, 1) = '-' AND
    substr(decision_id, 28, 1) = '-' AND
    substr(decision_id, 19, 1) = '4' AND
    substr(decision_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(decision_id, 5), '-', '')) = 32 AND
    replace(substr(decision_id, 5), '-', '') NOT GLOB '*[^0-9a-f]*'
  ),
  patch_id TEXT NOT NULL UNIQUE CHECK (
    length(patch_id) = 40 AND
    substr(patch_id, 1, 4) = 'b2p_' AND
    substr(patch_id, 13, 1) = '-' AND
    substr(patch_id, 18, 1) = '-' AND
    substr(patch_id, 23, 1) = '-' AND
    substr(patch_id, 28, 1) = '-' AND
    substr(patch_id, 19, 1) = '4' AND
    substr(patch_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(patch_id, 5), '-', '')) = 32 AND
    replace(substr(patch_id, 5), '-', '') NOT GLOB '*[^0-9a-f]*'
  ),
  operation TEXT NOT NULL CHECK (operation = 'atom_erase'),
  patch_kind TEXT NOT NULL CHECK (patch_kind = 'ratify'),
  patch_source TEXT NOT NULL CHECK (patch_source = 'ratified_user'),
  patch_priority TEXT NOT NULL CHECK (patch_priority = 'provenance'),
  target_kind TEXT NOT NULL CHECK (target_kind = 'memory.atom'),
  target_id TEXT NOT NULL CHECK (
    length(target_id) = 40 AND
    substr(target_id, 1, 4) = 'mem_' AND
    substr(target_id, 13, 1) = '-' AND
    substr(target_id, 18, 1) = '-' AND
    substr(target_id, 23, 1) = '-' AND
    substr(target_id, 28, 1) = '-' AND
    substr(target_id, 19, 1) = '4' AND
    substr(target_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(target_id, 5), '-', '')) = 32 AND
    replace(substr(target_id, 5), '-', '') NOT GLOB '*[^0-9a-f]*'
  ),
  visibility TEXT NOT NULL CHECK (visibility = 'ledger'),
  authority_profile TEXT NOT NULL CHECK (
    authority_profile = 'host-checked-external-grant-v1'
  ),
  authority_kind TEXT NOT NULL CHECK (authority_kind = 'user'),
  authority_id TEXT NOT NULL,
  authority_ledger_id TEXT NOT NULL CHECK (
    length(authority_ledger_id) = 40 AND
    substr(authority_ledger_id, 1, 4) = 'led_' AND
    substr(authority_ledger_id, 13, 1) = '-' AND
    substr(authority_ledger_id, 18, 1) = '-' AND
    substr(authority_ledger_id, 23, 1) = '-' AND
    substr(authority_ledger_id, 28, 1) = '-' AND
    substr(authority_ledger_id, 19, 1) = '4' AND
    substr(authority_ledger_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(authority_ledger_id, 5), '-', '')) = 32 AND
    replace(substr(authority_ledger_id, 5), '-', '')
      NOT GLOB '*[^0-9a-f]*'
  ),
  authority_event_id TEXT NOT NULL UNIQUE CHECK (
    length(authority_event_id) = 40 AND
    substr(authority_event_id, 1, 4) = 'agr_' AND
    substr(authority_event_id, 13, 1) = '-' AND
    substr(authority_event_id, 18, 1) = '-' AND
    substr(authority_event_id, 23, 1) = '-' AND
    substr(authority_event_id, 28, 1) = '-' AND
    substr(authority_event_id, 19, 1) = '4' AND
    substr(authority_event_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(authority_event_id, 5), '-', '')) = 32 AND
    replace(substr(authority_event_id, 5), '-', '')
      NOT GLOB '*[^0-9a-f]*'
  ),
  capability_id TEXT NOT NULL UNIQUE CHECK (
    length(capability_id) = 40 AND
    substr(capability_id, 1, 4) = 'cap_' AND
    substr(capability_id, 13, 1) = '-' AND
    substr(capability_id, 18, 1) = '-' AND
    substr(capability_id, 23, 1) = '-' AND
    substr(capability_id, 28, 1) = '-' AND
    substr(capability_id, 19, 1) = '4' AND
    substr(capability_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(capability_id, 5), '-', '')) = 32 AND
    replace(substr(capability_id, 5), '-', '')
      NOT GLOB '*[^0-9a-f]*'
  ),
  palari_id TEXT NOT NULL CHECK (
    length(palari_id) BETWEEN 1 AND 64 AND
    substr(palari_id, 1, 1) GLOB '[a-z]' AND
    palari_id NOT GLOB '*[^a-z0-9_-]*'
  ),
  user_id TEXT NOT NULL CHECK (
    length(user_id) BETWEEN 1 AND 64 AND
    substr(user_id, 1, 1) GLOB '[a-z]' AND
    user_id NOT GLOB '*[^a-z0-9_-]*'
  ),
  evidence_kind TEXT NOT NULL CHECK (
    evidence_kind = 'ratified_user'
  ),
  evidence_strength REAL NOT NULL CHECK (
    typeof(evidence_strength) = 'real' AND
    evidence_strength = 1.0
  ),
  evidence_at TEXT NOT NULL CHECK (
    length(evidence_at) = 24 AND
    strftime('%Y-%m-%dT%H:%M:%fZ', evidence_at) IS evidence_at
  ),
  issued_at TEXT NOT NULL CHECK (
    length(issued_at) = 24 AND
    strftime('%Y-%m-%dT%H:%M:%fZ', issued_at) IS issued_at
  ),
  effective_at TEXT NOT NULL CHECK (
    length(effective_at) = 24 AND
    strftime('%Y-%m-%dT%H:%M:%fZ', effective_at) IS effective_at
  ),
  observed_at TEXT NOT NULL CHECK (
    length(observed_at) = 24 AND
    strftime('%Y-%m-%dT%H:%M:%fZ', observed_at) IS observed_at
  ),
  expires_at TEXT NOT NULL CHECK (
    length(expires_at) = 24 AND
    strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) IS expires_at
  ),
  outcome TEXT NOT NULL CHECK (
    outcome IN ('applied', 'refused')
  ),
  reason_code TEXT CHECK (
    reason_code IS NULL OR
    reason_code IN (
      'missing_target',
      'scope_mismatch',
      'shared_scope_unsealed',
      'incident_edges_unemittable'
    )
  ),
  failed_condition_mask INTEGER NOT NULL CHECK (
    failed_condition_mask = 0
  ),
  resolution TEXT NOT NULL CHECK (resolution = 'kept'),
  effect_count INTEGER NOT NULL CHECK (effect_count IN (0, 2)),
  kernel_config_hash TEXT NOT NULL CHECK (
    length(kernel_config_hash) = 64 AND
    kernel_config_hash NOT GLOB '*[^0-9a-f]*'
  ),
  FOREIGN KEY (stream_id)
    REFERENCES cdx_b2_meta(stream_id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    MATCH NONE,
  CHECK (authority_id = user_id),
  CHECK (
    evidence_at <= issued_at AND
    issued_at <= effective_at AND
    effective_at = observed_at AND
    observed_at < expires_at
  ),
  CHECK (
    (
      outcome = 'applied' AND
      reason_code IS NULL AND
      effect_count = 2
    ) OR (
      outcome = 'refused' AND
      reason_code IS NOT NULL AND
      effect_count = 0
    )
  )
) STRICT;`,
  `CREATE TABLE cdx_b2_effects (
  decision_sequence INTEGER NOT NULL,
  effect_ordinal INTEGER NOT NULL CHECK (
    effect_ordinal IN (0, 1)
  ),
  effect_kind TEXT NOT NULL CHECK (
    effect_kind IN (
      'projection_atom_erased',
      'projection_fts_erased'
    )
  ),
  object_id TEXT NOT NULL CHECK (
    length(object_id) = 40 AND
    substr(object_id, 1, 4) = 'mem_' AND
    substr(object_id, 13, 1) = '-' AND
    substr(object_id, 18, 1) = '-' AND
    substr(object_id, 23, 1) = '-' AND
    substr(object_id, 28, 1) = '-' AND
    substr(object_id, 19, 1) = '4' AND
    substr(object_id, 24, 1) GLOB '[89ab]' AND
    length(replace(substr(object_id, 5), '-', '')) = 32 AND
    replace(substr(object_id, 5), '-', '') NOT GLOB '*[^0-9a-f]*'
  ),
  PRIMARY KEY (decision_sequence, effect_ordinal),
  FOREIGN KEY (decision_sequence)
    REFERENCES cdx_b2_decisions(sequence)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    MATCH NONE,
  CHECK (
    (
      effect_ordinal = 0 AND
      effect_kind = 'projection_atom_erased'
    ) OR (
      effect_ordinal = 1 AND
      effect_kind = 'projection_fts_erased'
    )
  )
) STRICT;`,
  `CREATE UNIQUE INDEX cdx_b2_applied_erase_target_unique
ON cdx_b2_decisions(target_id)
WHERE outcome = 'applied';`,
  `CREATE TRIGGER cdx_b2_meta_no_delete
BEFORE DELETE ON cdx_b2_meta
BEGIN
  SELECT RAISE(ABORT, 'cdx_b2_meta_no_delete');
END;`,
  `CREATE TRIGGER cdx_b2_meta_advance_guard
BEFORE UPDATE ON cdx_b2_meta
BEGIN
  SELECT CASE WHEN
    NEW.singleton IS NOT OLD.singleton OR
    NEW.schema_version IS NOT OLD.schema_version OR
    NEW.kernel_profile IS NOT OLD.kernel_profile OR
    NEW.projection_profile IS NOT OLD.projection_profile OR
    NEW.authority_profile IS NOT OLD.authority_profile OR
    NEW.stream_id IS NOT OLD.stream_id OR
    NEW.workspace_id IS NOT OLD.workspace_id OR
    NEW.checkpoint_id IS NOT OLD.checkpoint_id OR
    NEW.checkpoint_at IS NOT OLD.checkpoint_at OR
    NEW.checkpoint_memory_count IS NOT OLD.checkpoint_memory_count OR
    NEW.checkpoint_link_count IS NOT OLD.checkpoint_link_count OR
    NEW.baseline_disposition IS NOT OLD.baseline_disposition OR
    NEW.legacy_schema_variant IS NOT OLD.legacy_schema_variant OR
    NEW.kernel_version IS NOT OLD.kernel_version OR
    NEW.kernel_source_commit IS NOT OLD.kernel_source_commit OR
    NEW.kernel_source_blob IS NOT OLD.kernel_source_blob OR
    NEW.kernel_config_hash IS NOT OLD.kernel_config_hash OR
    NEW.head_mutation_sequence <> OLD.head_mutation_sequence + 1
  THEN RAISE(ABORT, 'cdx_b2_meta_advance_guard') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM cdx_b2_decisions AS d
    WHERE d.sequence = NEW.head_mutation_sequence
      AND d.stream_id = NEW.stream_id
      AND d.kernel_config_hash = NEW.kernel_config_hash
      AND d.authority_profile = NEW.authority_profile
      AND (
        (
          d.outcome = 'applied' AND
          d.effect_count = 2 AND
          (
            SELECT count(*)
            FROM cdx_b2_effects AS e
            WHERE e.decision_sequence = d.sequence
          ) = 2 AND
          EXISTS (
            SELECT 1
            FROM cdx_b2_effects AS e
            WHERE e.decision_sequence = d.sequence
              AND e.effect_ordinal = 0
              AND e.effect_kind = 'projection_atom_erased'
              AND e.object_id = d.target_id
          ) AND
          EXISTS (
            SELECT 1
            FROM cdx_b2_effects AS e
            WHERE e.decision_sequence = d.sequence
              AND e.effect_ordinal = 1
              AND e.effect_kind = 'projection_fts_erased'
              AND e.object_id = d.target_id
          ) AND
          EXISTS (
            SELECT 1
            FROM cdx_b2_legacy_checkpoint AS c
            WHERE c.stream_id = d.stream_id
              AND c.entity_kind = 'memory'
              AND c.entity_id = d.target_id
              AND c.palari_id = d.palari_id
              AND c.user_id = d.user_id
              AND c.shared = 0
          ) AND
          NOT EXISTS (
            SELECT 1
            FROM cdx_b2_legacy_checkpoint AS c
            WHERE c.stream_id = d.stream_id
              AND c.entity_kind = 'link'
              AND (
                c.from_memory_id = d.target_id OR
                c.to_memory_id = d.target_id
              )
          ) AND
          NOT EXISTS (
            SELECT 1 FROM memories AS m
            WHERE m.id = d.target_id
          ) AND
          NOT EXISTS (
            SELECT 1 FROM memory_fts AS f
            WHERE f.memory_id = d.target_id
          ) AND
          NOT EXISTS (
            SELECT 1 FROM memory_links AS l
            WHERE l.from_memory_id = d.target_id
               OR l.to_memory_id = d.target_id
          )
        ) OR (
          d.outcome = 'refused' AND
          d.effect_count = 0 AND
          NOT EXISTS (
            SELECT 1
            FROM cdx_b2_effects AS e
            WHERE e.decision_sequence = d.sequence
          ) AND
          (
            (
              d.reason_code = 'missing_target' AND
              NOT EXISTS (
                SELECT 1 FROM memories AS m
                WHERE m.id = d.target_id
              ) AND
              NOT EXISTS (
                SELECT 1 FROM memory_fts AS f
                WHERE f.memory_id = d.target_id
              ) AND
              NOT EXISTS (
                SELECT 1 FROM memory_links AS l
                WHERE l.from_memory_id = d.target_id
                   OR l.to_memory_id = d.target_id
              )
            ) OR (
              d.reason_code = 'scope_mismatch' AND
              (
                SELECT count(*)
                FROM memory_fts AS f
                WHERE f.memory_id = d.target_id
              ) = 1 AND
              EXISTS (
                SELECT 1
                FROM memories AS m
                JOIN cdx_b2_legacy_checkpoint AS c
                  ON c.stream_id = d.stream_id
                 AND c.entity_kind = 'memory'
                 AND c.entity_id = m.id
                 AND c.palari_id IS m.palari_id
                 AND c.user_id IS m.user_id
                 AND c.memory_type IS m.type
                 AND c.shared IS m.shared
                 AND c.validity_state =
                   CASE
                     WHEN m.valid_until IS NULL THEN 'current'
                     ELSE 'ended'
                   END
                WHERE m.id = d.target_id
                  AND (
                    m.palari_id IS NOT d.palari_id OR
                    m.user_id IS NOT d.user_id
                  )
              )
            ) OR (
              d.reason_code = 'shared_scope_unsealed' AND
              (
                SELECT count(*)
                FROM memory_fts AS f
                WHERE f.memory_id = d.target_id
              ) = 1 AND
              EXISTS (
                SELECT 1
                FROM memories AS m
                JOIN cdx_b2_legacy_checkpoint AS c
                  ON c.stream_id = d.stream_id
                 AND c.entity_kind = 'memory'
                 AND c.entity_id = m.id
                 AND c.palari_id IS m.palari_id
                 AND c.user_id IS m.user_id
                 AND c.memory_type IS m.type
                 AND c.shared IS m.shared
                 AND c.validity_state =
                   CASE
                     WHEN m.valid_until IS NULL THEN 'current'
                     ELSE 'ended'
                   END
                WHERE m.id = d.target_id
                  AND m.palari_id = d.palari_id
                  AND m.user_id = d.user_id
                  AND m.shared = 1
              )
            ) OR (
              d.reason_code = 'incident_edges_unemittable' AND
              (
                SELECT count(*)
                FROM memory_fts AS f
                WHERE f.memory_id = d.target_id
              ) = 1 AND
              EXISTS (
                SELECT 1
                FROM memories AS m
                JOIN cdx_b2_legacy_checkpoint AS c
                  ON c.stream_id = d.stream_id
                 AND c.entity_kind = 'memory'
                 AND c.entity_id = m.id
                 AND c.palari_id IS m.palari_id
                 AND c.user_id IS m.user_id
                 AND c.memory_type IS m.type
                 AND c.shared IS m.shared
                 AND c.validity_state =
                   CASE
                     WHEN m.valid_until IS NULL THEN 'current'
                     ELSE 'ended'
                   END
                WHERE m.id = d.target_id
                  AND m.palari_id = d.palari_id
                  AND m.user_id = d.user_id
                  AND m.shared = 0
              ) AND
              EXISTS (
                SELECT 1 FROM memory_links AS l
                WHERE l.from_memory_id = d.target_id
                   OR l.to_memory_id = d.target_id
              )
            )
          )
        )
      )
  ) THEN RAISE(ABORT, 'cdx_b2_meta_advance_guard') END;
END;`,
  `CREATE TRIGGER cdx_b2_checkpoint_no_update
BEFORE UPDATE ON cdx_b2_legacy_checkpoint
BEGIN
  SELECT RAISE(ABORT, 'cdx_b2_checkpoint_no_update');
END;`,
  `CREATE TRIGGER cdx_b2_checkpoint_no_delete
BEFORE DELETE ON cdx_b2_legacy_checkpoint
BEGIN
  SELECT RAISE(ABORT, 'cdx_b2_checkpoint_no_delete');
END;`,
  `CREATE TRIGGER cdx_b2_checkpoint_insert_guard
BEFORE INSERT ON cdx_b2_legacy_checkpoint
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM cdx_b2_meta AS m
    WHERE NEW.stream_id = m.stream_id
      AND m.head_mutation_sequence = 0
      AND NEW.checkpoint_ordinal = (
        SELECT count(*) + 1
        FROM cdx_b2_legacy_checkpoint
      )
      AND NEW.checkpoint_ordinal <=
          m.checkpoint_memory_count + m.checkpoint_link_count
      AND (
        (
          NEW.entity_kind = 'memory' AND
          NEW.checkpoint_ordinal <= m.checkpoint_memory_count AND
          (
            NEW.checkpoint_ordinal = 1 OR
            NEW.entity_id COLLATE BINARY > (
              SELECT c.entity_id COLLATE BINARY
              FROM cdx_b2_legacy_checkpoint AS c
              WHERE c.checkpoint_ordinal =
                    NEW.checkpoint_ordinal - 1
                AND c.entity_kind = 'memory'
            )
          )
        ) OR (
          NEW.entity_kind = 'link' AND
          NEW.checkpoint_ordinal > m.checkpoint_memory_count AND
          (
            NEW.checkpoint_ordinal =
              m.checkpoint_memory_count + 1 OR
            NEW.entity_id COLLATE BINARY > (
              SELECT c.entity_id COLLATE BINARY
              FROM cdx_b2_legacy_checkpoint AS c
              WHERE c.checkpoint_ordinal =
                    NEW.checkpoint_ordinal - 1
                AND c.entity_kind = 'link'
            )
          ) AND
          EXISTS (
            SELECT 1
            FROM cdx_b2_legacy_checkpoint AS c
            WHERE c.stream_id = NEW.stream_id
              AND c.entity_kind = 'memory'
              AND c.entity_id = NEW.from_memory_id
          ) AND
          EXISTS (
            SELECT 1
            FROM cdx_b2_legacy_checkpoint AS c
            WHERE c.stream_id = NEW.stream_id
              AND c.entity_kind = 'memory'
              AND c.entity_id = NEW.to_memory_id
          )
        )
      )
  ) THEN RAISE(ABORT, 'cdx_b2_checkpoint_insert_guard') END;
END;`,
  `CREATE TRIGGER cdx_b2_decisions_no_update
BEFORE UPDATE ON cdx_b2_decisions
BEGIN
  SELECT RAISE(ABORT, 'cdx_b2_decisions_no_update');
END;`,
  `CREATE TRIGGER cdx_b2_decisions_no_delete
BEFORE DELETE ON cdx_b2_decisions
BEGIN
  SELECT RAISE(ABORT, 'cdx_b2_decisions_no_delete');
END;`,
  `CREATE TRIGGER cdx_b2_decision_next_sequence
BEFORE INSERT ON cdx_b2_decisions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM cdx_b2_meta AS m
    WHERE NEW.stream_id = m.stream_id
      AND NEW.sequence = m.head_mutation_sequence + 1
      AND NEW.kernel_config_hash = m.kernel_config_hash
      AND NEW.authority_profile = m.authority_profile
      AND (
        SELECT count(*)
        FROM cdx_b2_legacy_checkpoint
      ) = m.checkpoint_memory_count + m.checkpoint_link_count
      AND (
        NEW.sequence = 1 OR
        EXISTS (
          SELECT 1
          FROM cdx_b2_decisions AS a
          WHERE a.sequence = 1
            AND a.stream_id = NEW.stream_id
            AND a.authority_ledger_id = NEW.authority_ledger_id
        )
      )
      AND (
        NEW.sequence = 1 OR
        EXISTS (
          SELECT 1
          FROM cdx_b2_decisions AS p
          WHERE p.sequence = NEW.sequence - 1
            AND p.stream_id = NEW.stream_id
            AND p.observed_at <= NEW.observed_at
        )
      )
  ) THEN RAISE(ABORT, 'cdx_b2_decision_next_sequence') END;

  SELECT CASE WHEN NOT (
    (
      NEW.outcome = 'refused' AND
      NEW.reason_code = 'missing_target' AND
      NOT EXISTS (
        SELECT 1 FROM memories AS m
        WHERE m.id = NEW.target_id
      ) AND
      NOT EXISTS (
        SELECT 1 FROM memory_fts AS f
        WHERE f.memory_id = NEW.target_id
      ) AND
      NOT EXISTS (
        SELECT 1 FROM memory_links AS l
        WHERE l.from_memory_id = NEW.target_id
           OR l.to_memory_id = NEW.target_id
      )
    ) OR (
      NEW.outcome = 'refused' AND
      NEW.reason_code = 'scope_mismatch' AND
      (
        SELECT count(*)
        FROM memory_fts AS f
        WHERE f.memory_id = NEW.target_id
      ) = 1 AND
      EXISTS (
        SELECT 1
        FROM memories AS m
        JOIN cdx_b2_legacy_checkpoint AS c
          ON c.stream_id = NEW.stream_id
         AND c.entity_kind = 'memory'
         AND c.entity_id = m.id
         AND c.palari_id IS m.palari_id
         AND c.user_id IS m.user_id
         AND c.memory_type IS m.type
         AND c.shared IS m.shared
         AND c.validity_state =
           CASE
             WHEN m.valid_until IS NULL THEN 'current'
             ELSE 'ended'
           END
        WHERE m.id = NEW.target_id
          AND (
            m.palari_id IS NOT NEW.palari_id OR
            m.user_id IS NOT NEW.user_id
          )
      )
    ) OR (
      NEW.outcome = 'refused' AND
      NEW.reason_code = 'shared_scope_unsealed' AND
      (
        SELECT count(*)
        FROM memory_fts AS f
        WHERE f.memory_id = NEW.target_id
      ) = 1 AND
      EXISTS (
        SELECT 1
        FROM memories AS m
        JOIN cdx_b2_legacy_checkpoint AS c
          ON c.stream_id = NEW.stream_id
         AND c.entity_kind = 'memory'
         AND c.entity_id = m.id
         AND c.palari_id IS m.palari_id
         AND c.user_id IS m.user_id
         AND c.memory_type IS m.type
         AND c.shared IS m.shared
         AND c.validity_state =
           CASE
             WHEN m.valid_until IS NULL THEN 'current'
             ELSE 'ended'
           END
        WHERE m.id = NEW.target_id
          AND m.palari_id = NEW.palari_id
          AND m.user_id = NEW.user_id
          AND m.shared = 1
      )
    ) OR (
      NEW.outcome = 'refused' AND
      NEW.reason_code = 'incident_edges_unemittable' AND
      (
        SELECT count(*)
        FROM memory_fts AS f
        WHERE f.memory_id = NEW.target_id
      ) = 1 AND
      EXISTS (
        SELECT 1
        FROM memories AS m
        JOIN cdx_b2_legacy_checkpoint AS c
          ON c.stream_id = NEW.stream_id
         AND c.entity_kind = 'memory'
         AND c.entity_id = m.id
         AND c.palari_id IS m.palari_id
         AND c.user_id IS m.user_id
         AND c.memory_type IS m.type
         AND c.shared IS m.shared
         AND c.validity_state =
           CASE
             WHEN m.valid_until IS NULL THEN 'current'
             ELSE 'ended'
           END
        WHERE m.id = NEW.target_id
          AND m.palari_id = NEW.palari_id
          AND m.user_id = NEW.user_id
          AND m.shared = 0
      ) AND
      EXISTS (
        SELECT 1 FROM memory_links AS l
        WHERE l.from_memory_id = NEW.target_id
           OR l.to_memory_id = NEW.target_id
      )
    ) OR (
      NEW.outcome = 'applied' AND
      NEW.reason_code IS NULL AND
      (
        SELECT count(*)
        FROM memory_fts AS f
        WHERE f.memory_id = NEW.target_id
      ) = 1 AND
      EXISTS (
        SELECT 1
        FROM memories AS m
        JOIN cdx_b2_legacy_checkpoint AS c
          ON c.stream_id = NEW.stream_id
         AND c.entity_kind = 'memory'
         AND c.entity_id = m.id
         AND c.palari_id IS m.palari_id
         AND c.user_id IS m.user_id
         AND c.memory_type IS m.type
         AND c.shared IS m.shared
         AND c.validity_state =
           CASE
             WHEN m.valid_until IS NULL THEN 'current'
             ELSE 'ended'
           END
        WHERE m.id = NEW.target_id
          AND m.palari_id = NEW.palari_id
          AND m.user_id = NEW.user_id
          AND m.shared = 0
      ) AND
      NOT EXISTS (
        SELECT 1 FROM memory_links AS l
        WHERE l.from_memory_id = NEW.target_id
           OR l.to_memory_id = NEW.target_id
      )
    )
  ) THEN RAISE(ABORT, 'cdx_b2_decision_classification') END;
END;`,
  `CREATE TRIGGER cdx_b2_effects_no_update
BEFORE UPDATE ON cdx_b2_effects
BEGIN
  SELECT RAISE(ABORT, 'cdx_b2_effects_no_update');
END;`,
  `CREATE TRIGGER cdx_b2_effects_no_delete
BEFORE DELETE ON cdx_b2_effects
BEGIN
  SELECT RAISE(ABORT, 'cdx_b2_effects_no_delete');
END;`,
  `CREATE TRIGGER cdx_b2_effect_insert_guard
BEFORE INSERT ON cdx_b2_effects
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM cdx_b2_decisions AS d
    JOIN cdx_b2_meta AS m
      ON m.stream_id = d.stream_id
    WHERE d.sequence = NEW.decision_sequence
      AND d.sequence = m.head_mutation_sequence + 1
      AND d.outcome = 'applied'
      AND d.effect_count = 2
      AND NEW.object_id = d.target_id
      AND NEW.effect_ordinal = (
        SELECT count(*)
        FROM cdx_b2_effects AS e
        WHERE e.decision_sequence = NEW.decision_sequence
      )
      AND NEW.effect_ordinal < d.effect_count
  ) THEN RAISE(ABORT, 'cdx_b2_effect_insert_guard') END;
END;`,
])

const OBJECT_SPECS = objectFreeze([
  objectFreeze(["table", "cdx_b2_meta", "cdx_b2_meta"]),
  objectFreeze(["table", "cdx_b2_legacy_checkpoint", "cdx_b2_legacy_checkpoint"]),
  objectFreeze(["table", "cdx_b2_decisions", "cdx_b2_decisions"]),
  objectFreeze(["table", "cdx_b2_effects", "cdx_b2_effects"]),
  objectFreeze(["index", "cdx_b2_applied_erase_target_unique", "cdx_b2_decisions"]),
  objectFreeze(["trigger", "cdx_b2_meta_no_delete", "cdx_b2_meta"]),
  objectFreeze(["trigger", "cdx_b2_meta_advance_guard", "cdx_b2_meta"]),
  objectFreeze(["trigger", "cdx_b2_checkpoint_no_update", "cdx_b2_legacy_checkpoint"]),
  objectFreeze(["trigger", "cdx_b2_checkpoint_no_delete", "cdx_b2_legacy_checkpoint"]),
  objectFreeze(["trigger", "cdx_b2_checkpoint_insert_guard", "cdx_b2_legacy_checkpoint"]),
  objectFreeze(["trigger", "cdx_b2_decisions_no_update", "cdx_b2_decisions"]),
  objectFreeze(["trigger", "cdx_b2_decisions_no_delete", "cdx_b2_decisions"]),
  objectFreeze(["trigger", "cdx_b2_decision_next_sequence", "cdx_b2_decisions"]),
  objectFreeze(["trigger", "cdx_b2_effects_no_update", "cdx_b2_effects"]),
  objectFreeze(["trigger", "cdx_b2_effects_no_delete", "cdx_b2_effects"]),
  objectFreeze(["trigger", "cdx_b2_effect_insert_guard", "cdx_b2_effects"]),
])

const createStatements = []
const manifestObjects = []
for (let index = 0; index < PERSISTED_STATEMENTS.length; index += 1) {
  const persistedStatement = PERSISTED_STATEMENTS[index]
  const spec = OBJECT_SPECS[index]
  const nameOffset = reflectApply(stringIndexOf, persistedStatement, [spec[1]])
  const executionSql =
    reflectApply(stringSlice, persistedStatement, [0, nameOffset]) +
    'main.' +
    reflectApply(stringSlice, persistedStatement, [nameOffset])
  defineArrayValue(createStatements, index, executionSql)
  defineArrayValue(manifestObjects, index, {
    type: spec[0],
    name: spec[1],
    table: spec[2],
    executionSql,
    persistedSql: normalizeCdxB2Sql(persistedStatement),
  })
}

export const CDX_B2_CREATE_STATEMENTS = objectFreeze(createStatements)

const MANIFEST_STATIC = {
  "autoindexes": [
    {
      "name": "sqlite_autoindex_cdx_b2_meta_1",
      "table": "cdx_b2_meta"
    },
    {
      "name": "sqlite_autoindex_cdx_b2_meta_2",
      "table": "cdx_b2_meta"
    },
    {
      "name": "sqlite_autoindex_cdx_b2_legacy_checkpoint_1",
      "table": "cdx_b2_legacy_checkpoint"
    },
    {
      "name": "sqlite_autoindex_cdx_b2_decisions_1",
      "table": "cdx_b2_decisions"
    },
    {
      "name": "sqlite_autoindex_cdx_b2_decisions_2",
      "table": "cdx_b2_decisions"
    },
    {
      "name": "sqlite_autoindex_cdx_b2_decisions_3",
      "table": "cdx_b2_decisions"
    },
    {
      "name": "sqlite_autoindex_cdx_b2_decisions_4",
      "table": "cdx_b2_decisions"
    },
    {
      "name": "sqlite_autoindex_cdx_b2_effects_1",
      "table": "cdx_b2_effects"
    }
  ],
  "tableXinfo": [
    {
      "table": "cdx_b2_meta",
      "strict": 1,
      "wr": 0,
      "rows": [
        {
          "cid": 0,
          "name": "singleton",
          "type": "INTEGER",
          "notnull": 0,
          "dflt_value": null,
          "pk": 1,
          "hidden": 0
        },
        {
          "cid": 1,
          "name": "schema_version",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 2,
          "name": "kernel_profile",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 3,
          "name": "projection_profile",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 4,
          "name": "authority_profile",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 5,
          "name": "stream_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 6,
          "name": "head_mutation_sequence",
          "type": "INTEGER",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 7,
          "name": "workspace_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 8,
          "name": "checkpoint_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 9,
          "name": "checkpoint_at",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 10,
          "name": "checkpoint_memory_count",
          "type": "INTEGER",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 11,
          "name": "checkpoint_link_count",
          "type": "INTEGER",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 12,
          "name": "baseline_disposition",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 13,
          "name": "legacy_schema_variant",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 14,
          "name": "kernel_version",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 15,
          "name": "kernel_source_commit",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 16,
          "name": "kernel_source_blob",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 17,
          "name": "kernel_config_hash",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        }
      ]
    },
    {
      "table": "cdx_b2_legacy_checkpoint",
      "strict": 1,
      "wr": 0,
      "rows": [
        {
          "cid": 0,
          "name": "checkpoint_ordinal",
          "type": "INTEGER",
          "notnull": 0,
          "dflt_value": null,
          "pk": 1,
          "hidden": 0
        },
        {
          "cid": 1,
          "name": "stream_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 2,
          "name": "entity_kind",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 3,
          "name": "entity_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 4,
          "name": "palari_id",
          "type": "TEXT",
          "notnull": 0,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 5,
          "name": "user_id",
          "type": "TEXT",
          "notnull": 0,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 6,
          "name": "memory_type",
          "type": "TEXT",
          "notnull": 0,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 7,
          "name": "shared",
          "type": "INTEGER",
          "notnull": 0,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 8,
          "name": "validity_state",
          "type": "TEXT",
          "notnull": 0,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 9,
          "name": "from_memory_id",
          "type": "TEXT",
          "notnull": 0,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 10,
          "name": "to_memory_id",
          "type": "TEXT",
          "notnull": 0,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        }
      ]
    },
    {
      "table": "cdx_b2_decisions",
      "strict": 1,
      "wr": 0,
      "rows": [
        {
          "cid": 0,
          "name": "sequence",
          "type": "INTEGER",
          "notnull": 0,
          "dflt_value": null,
          "pk": 1,
          "hidden": 0
        },
        {
          "cid": 1,
          "name": "stream_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 2,
          "name": "decision_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 3,
          "name": "patch_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 4,
          "name": "operation",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 5,
          "name": "patch_kind",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 6,
          "name": "patch_source",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 7,
          "name": "patch_priority",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 8,
          "name": "target_kind",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 9,
          "name": "target_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 10,
          "name": "visibility",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 11,
          "name": "authority_profile",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 12,
          "name": "authority_kind",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 13,
          "name": "authority_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 14,
          "name": "authority_ledger_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 15,
          "name": "authority_event_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 16,
          "name": "capability_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 17,
          "name": "palari_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 18,
          "name": "user_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 19,
          "name": "evidence_kind",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 20,
          "name": "evidence_strength",
          "type": "REAL",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 21,
          "name": "evidence_at",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 22,
          "name": "issued_at",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 23,
          "name": "effective_at",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 24,
          "name": "observed_at",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 25,
          "name": "expires_at",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 26,
          "name": "outcome",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 27,
          "name": "reason_code",
          "type": "TEXT",
          "notnull": 0,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 28,
          "name": "failed_condition_mask",
          "type": "INTEGER",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 29,
          "name": "resolution",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 30,
          "name": "effect_count",
          "type": "INTEGER",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 31,
          "name": "kernel_config_hash",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        }
      ]
    },
    {
      "table": "cdx_b2_effects",
      "strict": 1,
      "wr": 0,
      "rows": [
        {
          "cid": 0,
          "name": "decision_sequence",
          "type": "INTEGER",
          "notnull": 1,
          "dflt_value": null,
          "pk": 1,
          "hidden": 0
        },
        {
          "cid": 1,
          "name": "effect_ordinal",
          "type": "INTEGER",
          "notnull": 1,
          "dflt_value": null,
          "pk": 2,
          "hidden": 0
        },
        {
          "cid": 2,
          "name": "effect_kind",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        },
        {
          "cid": 3,
          "name": "object_id",
          "type": "TEXT",
          "notnull": 1,
          "dflt_value": null,
          "pk": 0,
          "hidden": 0
        }
      ]
    }
  ],
  "indexLists": [
    {
      "table": "cdx_b2_meta",
      "rows": [
        {
          "seq": 0,
          "name": "sqlite_autoindex_cdx_b2_meta_2",
          "unique": 1,
          "origin": "u",
          "partial": 0
        },
        {
          "seq": 1,
          "name": "sqlite_autoindex_cdx_b2_meta_1",
          "unique": 1,
          "origin": "u",
          "partial": 0
        }
      ]
    },
    {
      "table": "cdx_b2_legacy_checkpoint",
      "rows": [
        {
          "seq": 0,
          "name": "sqlite_autoindex_cdx_b2_legacy_checkpoint_1",
          "unique": 1,
          "origin": "u",
          "partial": 0
        }
      ]
    },
    {
      "table": "cdx_b2_decisions",
      "rows": [
        {
          "seq": 0,
          "name": "cdx_b2_applied_erase_target_unique",
          "unique": 1,
          "origin": "c",
          "partial": 1
        },
        {
          "seq": 1,
          "name": "sqlite_autoindex_cdx_b2_decisions_4",
          "unique": 1,
          "origin": "u",
          "partial": 0
        },
        {
          "seq": 2,
          "name": "sqlite_autoindex_cdx_b2_decisions_3",
          "unique": 1,
          "origin": "u",
          "partial": 0
        },
        {
          "seq": 3,
          "name": "sqlite_autoindex_cdx_b2_decisions_2",
          "unique": 1,
          "origin": "u",
          "partial": 0
        },
        {
          "seq": 4,
          "name": "sqlite_autoindex_cdx_b2_decisions_1",
          "unique": 1,
          "origin": "u",
          "partial": 0
        }
      ]
    },
    {
      "table": "cdx_b2_effects",
      "rows": [
        {
          "seq": 0,
          "name": "sqlite_autoindex_cdx_b2_effects_1",
          "unique": 1,
          "origin": "pk",
          "partial": 0
        }
      ]
    }
  ],
  "indexXinfo": [
    {
      "name": "sqlite_autoindex_cdx_b2_meta_1",
      "rows": [
        {
          "seqno": 0,
          "cid": 5,
          "name": "stream_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    },
    {
      "name": "sqlite_autoindex_cdx_b2_meta_2",
      "rows": [
        {
          "seqno": 0,
          "cid": 8,
          "name": "checkpoint_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    },
    {
      "name": "sqlite_autoindex_cdx_b2_legacy_checkpoint_1",
      "rows": [
        {
          "seqno": 0,
          "cid": 1,
          "name": "stream_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": 2,
          "name": "entity_kind",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 2,
          "cid": 3,
          "name": "entity_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 3,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    },
    {
      "name": "sqlite_autoindex_cdx_b2_decisions_1",
      "rows": [
        {
          "seqno": 0,
          "cid": 2,
          "name": "decision_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    },
    {
      "name": "sqlite_autoindex_cdx_b2_decisions_2",
      "rows": [
        {
          "seqno": 0,
          "cid": 3,
          "name": "patch_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    },
    {
      "name": "sqlite_autoindex_cdx_b2_decisions_3",
      "rows": [
        {
          "seqno": 0,
          "cid": 15,
          "name": "authority_event_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    },
    {
      "name": "sqlite_autoindex_cdx_b2_decisions_4",
      "rows": [
        {
          "seqno": 0,
          "cid": 16,
          "name": "capability_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    },
    {
      "name": "cdx_b2_applied_erase_target_unique",
      "rows": [
        {
          "seqno": 0,
          "cid": 9,
          "name": "target_id",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    },
    {
      "name": "sqlite_autoindex_cdx_b2_effects_1",
      "rows": [
        {
          "seqno": 0,
          "cid": 0,
          "name": "decision_sequence",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 1,
          "cid": 1,
          "name": "effect_ordinal",
          "desc": 0,
          "coll": "BINARY",
          "key": 1
        },
        {
          "seqno": 2,
          "cid": -1,
          "name": null,
          "desc": 0,
          "coll": "BINARY",
          "key": 0
        }
      ]
    }
  ],
  "foreignKeys": [
    {
      "table": "cdx_b2_meta",
      "rows": []
    },
    {
      "table": "cdx_b2_legacy_checkpoint",
      "rows": [
        {
          "id": 0,
          "seq": 0,
          "table": "cdx_b2_meta",
          "from": "stream_id",
          "to": "stream_id",
          "on_update": "NO ACTION",
          "on_delete": "NO ACTION",
          "match": "NONE"
        }
      ]
    },
    {
      "table": "cdx_b2_decisions",
      "rows": [
        {
          "id": 0,
          "seq": 0,
          "table": "cdx_b2_meta",
          "from": "stream_id",
          "to": "stream_id",
          "on_update": "NO ACTION",
          "on_delete": "NO ACTION",
          "match": "NONE"
        }
      ]
    },
    {
      "table": "cdx_b2_effects",
      "rows": [
        {
          "id": 0,
          "seq": 0,
          "table": "cdx_b2_decisions",
          "from": "decision_sequence",
          "to": "sequence",
          "on_update": "NO ACTION",
          "on_delete": "NO ACTION",
          "match": "NONE"
        }
      ]
    }
  ],
  "triggerTargets": [
    {
      "name": "cdx_b2_checkpoint_insert_guard",
      "table": "cdx_b2_legacy_checkpoint"
    },
    {
      "name": "cdx_b2_checkpoint_no_delete",
      "table": "cdx_b2_legacy_checkpoint"
    },
    {
      "name": "cdx_b2_checkpoint_no_update",
      "table": "cdx_b2_legacy_checkpoint"
    },
    {
      "name": "cdx_b2_decision_next_sequence",
      "table": "cdx_b2_decisions"
    },
    {
      "name": "cdx_b2_decisions_no_delete",
      "table": "cdx_b2_decisions"
    },
    {
      "name": "cdx_b2_decisions_no_update",
      "table": "cdx_b2_decisions"
    },
    {
      "name": "cdx_b2_effect_insert_guard",
      "table": "cdx_b2_effects"
    },
    {
      "name": "cdx_b2_effects_no_delete",
      "table": "cdx_b2_effects"
    },
    {
      "name": "cdx_b2_effects_no_update",
      "table": "cdx_b2_effects"
    },
    {
      "name": "cdx_b2_meta_advance_guard",
      "table": "cdx_b2_meta"
    },
    {
      "name": "cdx_b2_meta_no_delete",
      "table": "cdx_b2_meta"
    }
  ],
  "caseFoldedNames": [
    "cdx_b2_applied_erase_target_unique",
    "cdx_b2_checkpoint_insert_guard",
    "cdx_b2_checkpoint_no_delete",
    "cdx_b2_checkpoint_no_update",
    "cdx_b2_decision_next_sequence",
    "cdx_b2_decisions",
    "cdx_b2_decisions_no_delete",
    "cdx_b2_decisions_no_update",
    "cdx_b2_effect_insert_guard",
    "cdx_b2_effects",
    "cdx_b2_effects_no_delete",
    "cdx_b2_effects_no_update",
    "cdx_b2_legacy_checkpoint",
    "cdx_b2_meta",
    "cdx_b2_meta_advance_guard",
    "cdx_b2_meta_no_delete",
    "sqlite_autoindex_cdx_b2_decisions_1",
    "sqlite_autoindex_cdx_b2_decisions_2",
    "sqlite_autoindex_cdx_b2_decisions_3",
    "sqlite_autoindex_cdx_b2_decisions_4",
    "sqlite_autoindex_cdx_b2_effects_1",
    "sqlite_autoindex_cdx_b2_legacy_checkpoint_1",
    "sqlite_autoindex_cdx_b2_meta_1",
    "sqlite_autoindex_cdx_b2_meta_2"
  ]
}

export const CDX_B2_MANIFEST = toFrozenData({
  schemaVersion: 'CDX-B2',
  schemaDocumentSha256:
    '84f01ae2b5bdf084cacf27b8d6e6d3a611852094e985c36aaa18bba8baa2813e',
  objects: manifestObjects,
  autoindexes: MANIFEST_STATIC.autoindexes,
  tableXinfo: MANIFEST_STATIC.tableXinfo,
  indexLists: MANIFEST_STATIC.indexLists,
  indexXinfo: MANIFEST_STATIC.indexXinfo,
  foreignKeys: MANIFEST_STATIC.foreignKeys,
  triggerTargets: MANIFEST_STATIC.triggerTargets,
  caseFoldedNames: MANIFEST_STATIC.caseFoldedNames,
})

export const CDX_B2_REQUIRED_PRAGMAS = toFrozenData([
  {
    name: 'foreign_keys',
    setSql: 'PRAGMA foreign_keys = ON',
    readSql: 'PRAGMA foreign_keys',
    value: 1,
  },
  {
    name: 'busy_timeout',
    setSql: 'PRAGMA busy_timeout = 0',
    readSql: 'PRAGMA busy_timeout',
    value: 0,
  },
  {
    name: 'recursive_triggers',
    setSql: 'PRAGMA recursive_triggers = ON',
    readSql: 'PRAGMA recursive_triggers',
    value: 1,
  },
  {
    name: 'ignore_check_constraints',
    setSql: 'PRAGMA ignore_check_constraints = OFF',
    readSql: 'PRAGMA ignore_check_constraints',
    value: 0,
  },
  {
    name: 'trusted_schema',
    setSql: 'PRAGMA trusted_schema = OFF',
    readSql: 'PRAGMA trusted_schema',
    value: 0,
  },
])
