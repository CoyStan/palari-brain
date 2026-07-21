import { types as utilTypes } from 'node:util';

'use strict';

const isProxyValue = utilTypes.isProxy;

const reflectApply = Reflect.apply;
const reflectDefineProperty = Reflect.defineProperty;
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const reflectGetPrototypeOf = Reflect.getPrototypeOf;
const reflectOwnKeys = Reflect.ownKeys;
const arrayIsArray = Array.isArray;
const arrayPopMethod = Array.prototype.pop;
const functionHasInstance = Function.prototype[Symbol.hasInstance];
const jsonStringify = JSON.stringify;
const mapGetMethod = Map.prototype.get;
const mapSetMethod = Map.prototype.set;
const nativeError = Error;
const nativeMap = Map;
const nativeProxy = Proxy;
const nativeSet = Set;
const numberIsSafeInteger = Number.isSafeInteger;
const objectCreate = Object.create;
const objectEntries = Object.entries;
const objectFreeze = Object.freeze;
const objectHasOwn = Object.hasOwn;
const objectKeys = Object.keys;
const objectPrototype = Object.prototype;
const objectValues = Object.values;
const setAddMethod = Set.prototype.add;
const setHasMethod = Set.prototype.has;
const setSizeGetter = reflectGetOwnPropertyDescriptor(Set.prototype, 'size').get;
const stringEndsWithMethod = String.prototype.endsWith;
const stringFromCharCode = String.fromCharCode;
const stringIncludesMethod = String.prototype.includes;
const stringSliceMethod = String.prototype.slice;
const stringStartsWithMethod = String.prototype.startsWith;
const symbolIterator = Symbol.iterator;

function arrayEvery(values, predicate) {
  for (let index = 0; index < values.length; index += 1) {
    if (!predicate(values[index], index, values)) return false;
  }
  return true;
}

function arrayFilter(values, predicate) {
  const result = [];
  for (let index = 0; index < values.length; index += 1) {
    if (predicate(values[index], index, values)) {
      appendArrayValue(result, values[index]);
    }
  }
  return result;
}

function arrayFind(values, predicate) {
  for (let index = 0; index < values.length; index += 1) {
    if (predicate(values[index], index, values)) return values[index];
  }
  return undefined;
}

function arrayFlatMap(values, predicate) {
  const result = [];
  for (let index = 0; index < values.length; index += 1) {
    arrayPushAll(result, predicate(values[index], index, values));
  }
  return result;
}

function arrayForEach(values, predicate) {
  for (let index = 0; index < values.length; index += 1) {
    predicate(values[index], index, values);
  }
}

function arrayIncludes(values, value) {
  for (let index = 0; index < values.length; index += 1) {
    const candidate = values[index];
    if (candidate === value || (candidate !== candidate && value !== value)) {
      return true;
    }
  }
  return false;
}

function arrayMap(values, predicate) {
  const result = [];
  for (let index = 0; index < values.length; index += 1) {
    appendArrayValue(result, predicate(values[index], index, values));
  }
  return result;
}

function arrayPop(values) {
  return reflectApply(arrayPopMethod, values, []);
}

function appendArrayValue(values, value) {
  const index = values.length;
  const defined = reflectDefineProperty(values, index, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  if (!defined) throw new nativeError('internal array append failed');
  return values.length;
}

function arrayPush(values, ...items) {
  for (let index = 0; index < items.length; index += 1) {
    appendArrayValue(values, items[index]);
  }
  return values.length;
}

function arrayPushAll(values, additions) {
  for (let index = 0; index < additions.length; index += 1) {
    appendArrayValue(values, additions[index]);
  }
}

function concatenateArrays(left, right) {
  const result = [];
  arrayPushAll(result, left);
  arrayPushAll(result, right);
  return result;
}

function arraySome(values, predicate) {
  for (let index = 0; index < values.length; index += 1) {
    if (predicate(values[index], index, values)) return true;
  }
  return false;
}

function sameData(left, right) {
  if (left === right ||
      (left !== left && right !== right)) return true;
  if (left === null || right === null ||
      typeof left !== 'object' || typeof right !== 'object') return false;

  const leftIsArray = arrayIsArray(left);
  if (leftIsArray !== arrayIsArray(right)) return false;
  if (leftIsArray) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      const leftDescriptor = reflectGetOwnPropertyDescriptor(left, index);
      const rightDescriptor = reflectGetOwnPropertyDescriptor(right, index);
      if (leftDescriptor === undefined || rightDescriptor === undefined ||
          !objectHasOwn(leftDescriptor, 'value') ||
          !objectHasOwn(rightDescriptor, 'value') ||
          !sameData(leftDescriptor.value, rightDescriptor.value)) return false;
    }
    return true;
  }

  const leftKeys = objectKeys(left);
  const rightKeys = objectKeys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index]) return false;
    const leftDescriptor = reflectGetOwnPropertyDescriptor(left, key);
    const rightDescriptor = reflectGetOwnPropertyDescriptor(right, key);
    if (leftDescriptor === undefined || rightDescriptor === undefined ||
        !objectHasOwn(leftDescriptor, 'value') ||
        !objectHasOwn(rightDescriptor, 'value') ||
        !sameData(leftDescriptor.value, rightDescriptor.value)) return false;
  }
  return true;
}

function createMap(entries = undefined) {
  const result = new nativeMap();
  if (entries !== undefined) {
    for (let index = 0; index < entries.length; index += 1) {
      reflectApply(mapSetMethod, result, [entries[index][0], entries[index][1]]);
    }
  }
  return result;
}

function createSet(values = undefined) {
  const result = new nativeSet();
  if (values !== undefined) {
    for (let index = 0; index < values.length; index += 1) {
      reflectApply(setAddMethod, result, [values[index]]);
    }
  }
  return result;
}

function isNativeError(value) {
  return reflectApply(functionHasInstance, nativeError, [value]);
}

function mapGet(map, key) {
  return reflectApply(mapGetMethod, map, [key]);
}

function mapSet(map, key, value) {
  reflectApply(mapSetMethod, map, [key, value]);
}

function safeArrayIterable(values) {
  let index = 0;
  const iterator = objectCreate(null);
  reflectDefineProperty(iterator, symbolIterator, {
    configurable: false,
    enumerable: false,
    value() { return iterator; },
    writable: false,
  });
  reflectDefineProperty(iterator, 'next', {
    configurable: false,
    enumerable: false,
    value() {
      if (index >= values.length) return {done: true, value: undefined};
      const value = values[index];
      index += 1;
      return {done: false, value};
    },
    writable: false,
  });
  return iterator;
}

function setAdd(set, value) {
  reflectApply(setAddMethod, set, [value]);
}

function setHas(set, value) {
  return reflectApply(setHasMethod, set, [value]);
}

function setSize(set) {
  return reflectApply(setSizeGetter, set, []);
}

function stringEndsWith(value, suffix) {
  return reflectApply(stringEndsWithMethod, value, [suffix]);
}

function stringIncludes(value, search) {
  return reflectApply(stringIncludesMethod, value, [search]);
}

function stringSlice(value, start) {
  return reflectApply(stringSliceMethod, value, [start]);
}

function stringStartsWith(value, prefix) {
  return reflectApply(stringStartsWithMethod, value, [prefix]);
}

const N = 'not_applicable';
const EMPTY_INPUT = objectFreeze({});
const GENERIC_INPUT_KEYS = objectFreeze([
  'authorityPreflightOutcome',
  'authorityUseOutcome',
  'compatibilityOutcome',
]);
const PRE_ROUTE_INPUT_KEYS = objectFreeze([
  ...GENERIC_INPUT_KEYS,
  'routeKind',
]);
const ERASURE_INPUT_KEYS = objectFreeze([
  'authorityPreflightOutcome',
  'authorityUseOutcome',
  'compatibilityOutcome',
  'syntaxValid',
  'projectionVerified',
  'idClass',
  'targetMatchesGrant',
  'actorClass',
  'targetExists',
  'legacyType',
  'validityClass',
  'scopeClass',
  'sharedFlag',
  'incidentLinkCount',
  'targetBranch',
]);

const dimensionOrder = objectFreeze([
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
]);

const SETS = objectFreeze({
  PUBLIC_MUTATION_ROUTES: objectFreeze([
    'legacy_proposal',
    'legacy_delete_memory',
    'legacy_forget_topic',
    'legacy_record_recall_inclusion',
    'legacy_run_lifecycle',
    'legacy_extraction_pass',
    'legacy_summary_pass',
    'legacy_scheduler_turn',
    'legacy_delete_kernel_store_file',
  ]),
  INVALID_KIND_CLASSES: objectFreeze([
    'kind_missing',
    'kind_unknown',
    'kind_prototype_collision',
  ]),
  KNOWN_KIND_OP_CLASSES: objectFreeze([
    'op_omitted_defaults_add',
    'op_undefined_defaults_add',
    'op_null_invalid',
    'op_unknown_invalid',
    'promote_add',
    'promote_supersede',
    'permanent_add',
    'permanent_supersede',
    'demote_end_validity',
    'demote_delete_transient',
    'ratify_share',
  ]),
  PROMOTE_PERMANENT_OPS: objectFreeze([
    'promote_add',
    'promote_supersede',
    'permanent_add',
    'permanent_supersede',
  ]),
  ADD_OPS: objectFreeze(['promote_add', 'permanent_add']),
  SUPERSEDE_OPS: objectFreeze([
    'promote_supersede',
    'permanent_supersede',
  ]),
  DEMOTE_OPS: objectFreeze([
    'demote_end_validity',
    'demote_delete_transient',
  ]),
  LEGACY_TYPES: objectFreeze([
    'relationship',
    'preference',
    'opinion',
    'entity',
    'life_event',
    'working',
    'project',
    'recent_life',
    'session_summary',
  ]),
  PERMANENT_TYPES: objectFreeze([
    'relationship',
    'preference',
    'opinion',
    'entity',
    'life_event',
  ]),
  TRANSIENT_TYPES: objectFreeze([
    'working',
    'project',
    'recent_life',
    'session_summary',
  ]),
  TYPE_ADMISSION_CLASSES: objectFreeze([
    'relationship',
    'preference',
    'opinion',
    'entity',
    'life_event',
    'working',
    'project',
    'recent_life',
    'session_summary',
    'type_missing',
    'type_invalid',
  ]),
  VALID_ACTORS: objectFreeze([
    'actor_explicit_user',
    'actor_background_extraction',
    'actor_session_summary',
    'actor_lifecycle_job',
  ]),
  ACTOR_CLASSES: objectFreeze([
    'actor_explicit_user',
    'actor_background_extraction',
    'actor_session_summary',
    'actor_lifecycle_job',
    'actor_missing',
    'actor_null_fallback',
    'actor_empty_invalid',
    'actor_unknown_invalid',
  ]),
  VALID_WRITERS: objectFreeze([
    'writer_explicit_user',
    'writer_background_extraction',
    'writer_session_summary',
  ]),
  WRITER_CLASSES: objectFreeze([
    'writer_explicit_user',
    'writer_background_extraction',
    'writer_session_summary',
    'writer_missing',
    'writer_invalid',
  ]),
  PROPOSAL_PRODUCERS: objectFreeze([
    'explicit_proposal',
    'extraction_candidate',
  ]),
  SOURCE_CLASSES: objectFreeze([
    'user_direct',
    'user_told',
    'external_extracted',
    'summary_summarized',
    'source_missing',
    'source_invalid',
    'external_non_extraction',
    'pipeline_event_missing',
    'extractor_id_missing',
    'acquisition_invalid',
  ]),
  VALID_SOURCE_CLASSES: objectFreeze([
    'user_direct',
    'user_told',
    'external_extracted',
    'summary_summarized',
  ]),
  VALID_EXTRACTION_SOURCE_CLASSES: objectFreeze(['external_extracted']),
  EXTRACTION_SKIP_SOURCE_CLASSES: objectFreeze([
    'extraction_disabled',
    'extractor_missing',
    'pipeline_event_missing',
    'extractor_id_missing',
    'extractor_error',
    'extractor_payload_invalid',
  ]),
  SUMMARY_SKIP_SOURCE_CLASSES: objectFreeze([
    'summary_source_missing',
    'summary_disabled',
    'summary_text_missing',
    'summary_event_missing',
  ]),
  SCOPE_CLASSES: objectFreeze([
    'same_palari_same_user_private',
    'same_palari_same_user_shared',
    'same_palari_general',
    'same_palari_cross_user_private',
    'same_palari_cross_user_shared',
    'cross_palari_general',
    'cross_palari_same_user_private',
    'cross_palari_same_user_shared',
    'cross_palari_cross_user_private',
    'cross_palari_cross_user_shared',
    'scope_missing',
  ]),
  TARGET_SCOPE_CLASSES: objectFreeze([
    'same_palari_same_user_private',
    'same_palari_same_user_shared',
    'same_palari_general',
    'same_palari_cross_user_private',
    'same_palari_cross_user_shared',
    'cross_palari_general',
    'cross_palari_same_user_private',
    'cross_palari_same_user_shared',
    'cross_palari_cross_user_private',
    'cross_palari_cross_user_shared',
  ]),
  TOPIC_VISIBLE_SCOPE_CLASSES: objectFreeze([
    'same_palari_same_user_private',
    'same_palari_same_user_shared',
    'same_palari_general',
    'same_palari_cross_user_private',
    'same_palari_cross_user_shared',
    'cross_palari_general',
    'cross_palari_same_user_private',
    'cross_palari_same_user_shared',
    'cross_palari_cross_user_private',
    'cross_palari_cross_user_shared',
  ]),
  DECORATION_CLASSES: objectFreeze([
    'add_source_absent_keywords_plain',
    'add_record_source_keywords_plain',
    'add_provenance_source_keywords_plain',
    'add_source_absent_keywords_decorated',
    'add_record_source_keywords_decorated',
    'add_provenance_source_keywords_decorated',
    'supersede_source_absent_keywords_plain',
    'supersede_record_source_keywords_plain',
  ]),
  SHARED_CLASSES: objectFreeze(['shared_0', 'shared_1', 'shared_invalid']),
  PROPOSAL_ID_CLASSES: objectFreeze([
    'proposed_id_absent',
    'proposed_id_empty',
    'proposed_id_caller',
    'generated_id',
  ]),
  TARGET_ID_CLASSES: objectFreeze([
    'target_id_missing',
    'target_id_empty',
    'normalized_target_id',
  ]),
  MISSING_TARGET_ID_CLASSES: objectFreeze([
    'target_id_missing',
    'target_id_empty',
  ]),
  MISSING_OR_NORMALIZED_TARGET_IDS: objectFreeze([
    'target_id_missing',
    'target_id_empty',
    'normalized_target_id',
  ]),
  TOPIC_QUERY_ID_CLASSES: objectFreeze([
    'query_missing',
    'query_empty',
    'palari_empty',
    'normalized_topic_query',
    'malformed_direct_fts_query',
  ]),
  RECALL_ID_CLASSES: objectFreeze([
    'ids_conversion_throw',
    'normalized_ids_empty',
    'first_occurrence_ids',
  ]),
  HASH_CLASSES: objectFreeze([
    'hash_computed',
    'hash_supplied_matching',
    'hash_supplied_mismatching',
    'hash_invalid_type',
  ]),
  CAPTURE_CLASSES: objectFreeze([
    'capture_success',
    'capture_throw_record_id',
    'capture_throw_record_palari_id',
    'capture_throw_record_user_id',
    'capture_throw_record_content',
    'capture_throw_record_keywords',
    'capture_throw_record_importance',
    'capture_throw_record_valid_from',
    'capture_throw_record_valid_until',
    'capture_throw_record_last_accessed',
    'capture_throw_record_created_at',
    'capture_throw_record_confidence',
    'capture_throw_record_acquisition_mode',
    'capture_throw_record_last_decayed_at',
    'capture_throw_record_source_message_id',
    'capture_throw_provenance_source_message',
    'capture_throw_scope_palari',
    'capture_throw_scope_user',
    'capture_throw_target',
    'caller_clock_throw',
    'post_callback_store_closed',
    'deferred_valid',
    'deferred_empty_content',
    'deferred_invalid_acquisition',
    'deferred_invalid_hash_type',
  ]),
  ADMISSION_CAPTURE_CLASSES: objectFreeze([
    'capture_success',
    'deferred_valid',
    'deferred_empty_content',
    'deferred_invalid_acquisition',
    'deferred_invalid_hash_type',
  ]),
  DUPLICATE_SKIPPED_VALIDATION_CLASSES: objectFreeze([
    'deferred_empty_content',
    'deferred_invalid_acquisition',
    'deferred_invalid_hash_type',
  ]),
  DEFERRED_INVALID_CLASSES: objectFreeze([
    'deferred_empty_content',
    'deferred_invalid_acquisition',
    'deferred_invalid_hash_type',
  ]),
  CAPTURE_OR_APPLY_THROW_CLASSES: objectFreeze([
    'capture_throw_record_id',
    'capture_throw_record_palari_id',
    'capture_throw_record_user_id',
    'capture_throw_record_content',
    'capture_throw_record_keywords',
    'capture_throw_record_importance',
    'capture_throw_record_valid_from',
    'capture_throw_record_valid_until',
    'capture_throw_record_last_accessed',
    'capture_throw_record_created_at',
    'capture_throw_record_confidence',
    'capture_throw_record_acquisition_mode',
    'capture_throw_record_last_decayed_at',
    'capture_throw_record_source_message_id',
    'capture_throw_provenance_source_message',
    'capture_throw_scope_palari',
    'capture_throw_scope_user',
    'capture_throw_target',
    'apply_throw_at_effect_ordinal',
  ]),
  CONFIDENCE_CLASSES: objectFreeze([
    'confidence_below_floor',
    'confidence_at_floor',
    'confidence_above_floor',
    'confidence_nonfinite',
    'confidence_conversion_throw',
  ]),
  ADMITTED_CONFIDENCE_CLASSES: objectFreeze([
    'confidence_at_floor',
    'confidence_above_floor',
  ]),
  CAPTURE_TIME_CLASSES: objectFreeze([
    'caller_clock_success',
    'caller_clock_throw',
  ]),
  WRITE_TIME_CLASSES: objectFreeze([
    'event_absent',
    'event_now',
    'event_historical',
    'event_future',
    'event_invalid_type',
    'created_at_caller',
    'valid_from_caller',
    'valid_until_caller',
    'store_time',
    'native_wall_time',
  ]),
  DEMOTION_TIME_CLASSES: objectFreeze([
    'event_absent',
    'event_now',
    'event_historical',
    'event_future',
    'event_invalid_type',
    'store_time',
    'native_wall_time',
  ]),
  LIFECYCLE_REFERENCE_TIME_CLASSES: objectFreeze([
    'invalid_reference_time',
    'future_reference_time',
    'valid_reference_time',
  ]),
  HISTORICAL_CLASSES: objectFreeze([
    'historical_fields_absent',
    'access_fields_present',
    'decay_fields_present',
    'source_fields_present',
    'all_historical_fields_present',
  ]),
  ACCESS_COUNT_CLASSES: objectFreeze([
    'access_below_max',
    'access_at_max_safe_integer',
  ]),
  LIFECYCLE_SCOPE_CLASSES: objectFreeze([
    'nonempty_palari_exact_filter',
    'empty_palari_cross_palari_sweep',
  ]),
  DEMOTION_TARGET_CLASSES: objectFreeze([
    'target_private_same_scope_current',
    'target_private_same_scope_ended',
    'target_general_current',
    'target_shared_current',
    'target_cross_user_current',
    'target_cross_palari_current',
  ]),
  ERASE_TARGET_CLASSES: objectFreeze([
    'target_private_same_scope_zero_links',
    'target_private_same_scope_with_links',
    'target_general_zero_links',
    'target_general_with_links',
    'target_shared_zero_links',
    'target_shared_with_links',
    'target_cross_user_zero_links',
    'target_cross_user_with_links',
    'target_cross_palari_zero_links',
    'target_cross_palari_with_links',
  ]),
  TOPIC_MATCH_SET_CLASSES: objectFreeze([
    'topic_match_set_empty',
    'topic_match_own_general_shared_other_private',
    'topic_match_permanent_protected',
    'topic_match_transient_or_explicit_user_deletable',
    'topic_match_binary_id_order_zero_links',
    'topic_match_binary_id_order_one_or_more_links',
  ]),
});

// These are the exact first obligation rows for each captured route. Producer
// rows that route a candidate into the legacy proposal planner use the closed
// cross-route transitions below. Terminal storage is a historical three-row
// obligation group, but production evaluates that group from the route kind
// alone and never selects F-01/F-02/F-03 by observing path state.
const ROUTE_ENTRY_ROWS = objectFreeze({
  legacy_proposal: objectFreeze(['P-01', 'P-02']),
  legacy_delete_memory: objectFreeze(['D-01']),
  legacy_forget_topic: objectFreeze(['T-01']),
  legacy_record_recall_inclusion: objectFreeze(['R-01']),
  legacy_run_lifecycle: objectFreeze(['L-01']),
  legacy_extraction_pass: objectFreeze([
    'E-01', 'E-02', 'E-03', 'E-04', 'E-05',
  ]),
  legacy_summary_pass: objectFreeze(['S-01', 'S-02']),
  legacy_scheduler_turn: objectFreeze(['S-03']),
  legacy_delete_kernel_store_file: objectFreeze(['F-01', 'F-02', 'F-03']),
});

const ROUTE_TRANSITIONS = objectFreeze({
  legacy_proposal: objectFreeze(['legacy_proposal']),
  legacy_delete_memory: objectFreeze(['legacy_delete_memory']),
  legacy_forget_topic: objectFreeze(['legacy_forget_topic']),
  legacy_record_recall_inclusion: objectFreeze([
    'legacy_record_recall_inclusion',
  ]),
  legacy_run_lifecycle: objectFreeze(['legacy_run_lifecycle']),
  legacy_extraction_pass: objectFreeze([
    'legacy_extraction_pass', 'legacy_proposal',
  ]),
  legacy_summary_pass: objectFreeze([
    'legacy_summary_pass', 'legacy_proposal',
  ]),
  legacy_scheduler_turn: objectFreeze(['legacy_scheduler_turn']),
  legacy_delete_kernel_store_file: objectFreeze([
    'legacy_delete_kernel_store_file',
  ]),
});

const ALL_ROUTE_ENTRY_ROWS = objectFreeze(
  arrayFlatMap(SETS.PUBLIC_MUTATION_ROUTES, (routeKind) =>
    ROUTE_ENTRY_ROWS[routeKind]),
);

const rows = [];

function R(id, phase, next, continueOutcomes, rule, v) {
  arrayPush(rows, objectFreeze({
    id,
    phase,
    next: objectFreeze(next),
    continueOutcomes: objectFreeze(continueOutcomes),
    rule,
    v: objectFreeze(v),
  }));
}

R('PRE-01', 'pre_route', ['PRE-02'], ['capability_enabled'],
  'STOP_MEMORY_DISABLED', [
    '@PUBLIC_MUTATION_ROUTES', N, N, N, N, N, N, N, N, N, N, N, N, N,
    N, N, N, ['capability_disabled_before_close',
      'capability_disabled_after_close'],
    'exact_inert_disabled_result', 'effects_none', 'consequences_none',
    'compatibility_disabled_surface',
  ]);

R('PRE-02', 'pre_route', ['PRE-03'], ['store_open'], 'STOP_STORE_CLOSED', [
  '@PUBLIC_MUTATION_ROUTES', N, N, N, N, N, N, N, N, N, N, N, N, N, N,
  N, N, ['store_closed', 'store_revoked'], 'legacy_store_closed',
  'effects_none', 'consequences_none', 'defects_none',
]);

R('PRE-03', 'capture',
  ALL_ROUTE_ENTRY_ROWS,
  ['captured_intent'], 'CAPTURE_OR_ADVANCE', [
    '@PUBLIC_MUTATION_ROUTES', N, N, N, N, N, N, N, N, N, N,
    '@CAPTURE_CLASSES', N, '@CAPTURE_TIME_CLASSES', N, N, N,
    'capture_or_post_callback_close',
    ['captured_intent', 'original_throw', 'legacy_store_closed'],
    'effects_none', 'consequences_none', 'caller_controlled_coercion_clock',
  ]);

R('P-01', 'proposal_admission', [], [], 'STOP_INVALID_COMPATIBILITY', [
  'legacy_proposal', '@INVALID_KIND_CLASSES', N, N, 'explicit_proposal', N, N,
  N, N, N, N, 'capture_success', N, N, N, N, N, N, 'rejected_invalid_kind',
  'effects_none', 'consequences_none', 'caller_supplied_semantics',
]);

R('P-02', 'proposal_admission', ['P-03', 'P-04', 'P-05'], ['accepted_op'],
  'INVALID_OR_ADVANCE', [
    'legacy_proposal', '@KNOWN_KIND_OP_CLASSES', N, N, 'explicit_proposal', N,
    N, N, N, N, N, 'capture_success', N, N, N, N, N, N,
    ['accepted_op', 'rejected_invalid_op'], 'effects_none', 'consequences_none',
    'caller_supplied_semantics',
  ]);

R('P-03', 'proposal_admission',
  ['PA-01', 'PA-02', 'PA-03', 'PA-04', 'PX-01', 'PX-02', 'PX-03', 'PS-01',
    'PS-02', 'PS-03'],
  ['admitted'], 'ADMISSION_OR_DEFER', [
    'legacy_proposal', '@PROMOTE_PERMANENT_OPS', '@TYPE_ADMISSION_CLASSES',
    '@WRITER_CLASSES', '@PROPOSAL_PRODUCERS', '@SOURCE_CLASSES',
    '@SCOPE_CLASSES', '@DECORATION_CLASSES', '@SHARED_CLASSES',
    '@PROPOSAL_ID_CLASSES', '@HASH_CLASSES', '@ADMISSION_CAPTURE_CLASSES',
    '@CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES', '@HISTORICAL_CLASSES', N, N,
    N, ['ordered_admission_rejection', 'admitted'], 'effects_none',
    'consequences_none', 'proposal_admission_assertions',
  ]);

R('P-04', 'proposal_admission', ['PD-01', 'PD-02', 'PD-03'], ['admitted'],
  'ADMISSION_OR_DEMOTION_REFUSAL', [
    'legacy_proposal', '@DEMOTE_OPS', '@LEGACY_TYPES', '@ACTOR_CLASSES',
    'explicit_proposal', N, '@SCOPE_CLASSES', N, N, '@TARGET_ID_CLASSES', N,
    '@ADMISSION_CAPTURE_CLASSES', N, '@DEMOTION_TIME_CLASSES', N, N, N, N,
    ['rejected_invalid_actor', 'admitted'], 'effects_none', 'consequences_none',
    'caller_asserted_actor',
  ]);

R('P-05', 'proposal_admission', ['PR-01'], ['admitted'],
  'ADMISSION_OR_SHARING_REFUSAL', [
    'legacy_proposal', 'ratify_share', '@LEGACY_TYPES', '@WRITER_CLASSES',
    'explicit_proposal', N, '@SCOPE_CLASSES', N, N, '@TARGET_ID_CLASSES', N,
    '@ADMISSION_CAPTURE_CLASSES', N, '@WRITE_TIME_CLASSES', N, N, N, N,
    ['rejected_ratify_requires_user', 'admitted'], 'effects_none',
    'consequences_none', 'unauthenticated_ratification',
  ]);

R('PA-01', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'explicit_proposal', '@VALID_SOURCE_CLASSES', '@SCOPE_CLASSES',
  '@DECORATION_CLASSES', '@SHARED_CLASSES', '@PROPOSAL_ID_CLASSES',
  '@HASH_CLASSES', 'deferred_valid', '@ADMITTED_CONFIDENCE_CLASSES',
  '@WRITE_TIME_CLASSES', '@HISTORICAL_CLASSES', N, N,
  'duplicate_absent_insert_valid', 'inserted', 'cdx_memory_insert',
  'fts_insert_trigger', 'create_evidence_untrusted',
]);

R('PA-02', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'explicit_proposal', '@VALID_SOURCE_CLASSES', '@SCOPE_CLASSES',
  '@DECORATION_CLASSES', '@SHARED_CLASSES', '@PROPOSAL_ID_CLASSES',
  '@HASH_CLASSES', 'deferred_valid', '@ADMITTED_CONFIDENCE_CLASSES',
  '@WRITE_TIME_CLASSES', '@HISTORICAL_CLASSES', N, N,
  'duplicate_present_same_or_cross_user', 'duplicate_bumped',
  'cdx_memory_set_importance', 'consequences_none', 'create_evidence_untrusted',
]);

R('PA-03', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'explicit_proposal', '@VALID_SOURCE_CLASSES', '@SCOPE_CLASSES',
  '@DECORATION_CLASSES', '@SHARED_CLASSES', '@PROPOSAL_ID_CLASSES',
  '@HASH_CLASSES', '@DUPLICATE_SKIPPED_VALIDATION_CLASSES',
  '@ADMITTED_CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
  '@HISTORICAL_CLASSES', N, N,
  'duplicate_present_empty_candidate_or_existing_content', 'duplicate_bumped',
  'cdx_memory_set_importance', 'consequences_none', 'create_evidence_untrusted',
]);

R('PA-04', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'explicit_proposal', '@VALID_SOURCE_CLASSES', '@SCOPE_CLASSES',
  '@DECORATION_CLASSES', '@SHARED_CLASSES', '@PROPOSAL_ID_CLASSES',
  '@HASH_CLASSES', '@DEFERRED_INVALID_CLASSES',
  '@ADMITTED_CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
  '@HISTORICAL_CLASSES', N, N, 'duplicate_absent',
  'native_or_legacy_validation_failure', 'effects_none', 'consequences_none',
  'create_evidence_untrusted',
]);

R('PX-01', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'extraction_candidate', '@VALID_EXTRACTION_SOURCE_CLASSES',
  '@SCOPE_CLASSES', '@DECORATION_CLASSES', '@SHARED_CLASSES',
  '@PROPOSAL_ID_CLASSES', '@HASH_CLASSES', 'deferred_valid',
  '@ADMITTED_CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
  '@HISTORICAL_CLASSES', N, N,
  'visible_contradiction_target_same_or_cross_user_palari', 'superseded',
  'cdx_memory_end_validity_then_insert_then_link', 'fts_insert_trigger',
  'extraction_evidence_noncanonical',
]);

R('PX-02', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'extraction_candidate', '@VALID_EXTRACTION_SOURCE_CLASSES',
  '@SCOPE_CLASSES', '@DECORATION_CLASSES', '@SHARED_CLASSES',
  '@PROPOSAL_ID_CLASSES', '@HASH_CLASSES', 'deferred_valid',
  '@ADMITTED_CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
  '@HISTORICAL_CLASSES', N, N,
  'no_contradiction_duplicate_present_same_or_cross_user', 'duplicate_bumped',
  'cdx_memory_set_importance', 'consequences_none',
  'extraction_evidence_noncanonical',
]);

R('PX-03', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'extraction_candidate', '@VALID_EXTRACTION_SOURCE_CLASSES',
  '@SCOPE_CLASSES', '@DECORATION_CLASSES', '@SHARED_CLASSES',
  '@PROPOSAL_ID_CLASSES', '@HASH_CLASSES', 'deferred_valid',
  '@ADMITTED_CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
  '@HISTORICAL_CLASSES', N, N, 'no_contradiction_duplicate_absent', 'inserted',
  'cdx_memory_insert', 'fts_insert_trigger',
  'extraction_evidence_noncanonical',
]);

R('PS-01', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@SUPERSEDE_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'explicit_proposal', '@VALID_SOURCE_CLASSES', '@SCOPE_CLASSES',
  '@DECORATION_CLASSES', '@SHARED_CLASSES', '@MISSING_TARGET_ID_CLASSES',
  '@HASH_CLASSES', '@ADMISSION_CAPTURE_CLASSES',
  '@ADMITTED_CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
  '@HISTORICAL_CLASSES', N, N, 'target_missing_or_empty',
  'rejected_missing_target', 'effects_none', 'consequences_none',
  'supersession_edge_unregistered',
]);

R('PS-02', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@SUPERSEDE_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'explicit_proposal', '@VALID_SOURCE_CLASSES', '@SCOPE_CLASSES',
  '@DECORATION_CLASSES', '@SHARED_CLASSES', 'normalized_target_id',
  '@HASH_CLASSES', '@ADMISSION_CAPTURE_CLASSES',
  '@ADMITTED_CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
  '@HISTORICAL_CLASSES', N, N, 'target_present_same_or_cross_partition',
  ['accepted', 'rejected_type_partition_mismatch'], 'effects_none',
  'consequences_none', 'supersession_edge_unregistered',
]);

R('PS-03', 'proposal_effect', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_proposal', '@SUPERSEDE_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'explicit_proposal', '@VALID_SOURCE_CLASSES', '@SCOPE_CLASSES',
  '@DECORATION_CLASSES', '@SHARED_CLASSES', 'normalized_target_id',
  '@HASH_CLASSES', 'deferred_valid', '@ADMITTED_CONFIDENCE_CLASSES',
  '@WRITE_TIME_CLASSES', '@HISTORICAL_CLASSES', N, N,
  'target_present_same_partition_same_or_cross_scope', 'superseded',
  'cdx_memory_end_validity_then_insert_then_link', 'fts_insert_trigger',
  'supersession_edge_unregistered',
]);

R('PD-01', 'proposal_effect', [], [], 'STOP_DEMOTION_UNSEALED', [
  'legacy_proposal', 'demote_end_validity', '@LEGACY_TYPES', '@VALID_ACTORS',
  'explicit_proposal', N, '@SCOPE_CLASSES', N, N, 'normalized_target_id', N,
  'deferred_valid', N, '@DEMOTION_TIME_CLASSES', N, N, N, 'target_missing',
  'rejected_missing_target', 'effects_none', 'consequences_none',
  'demotion_unauthenticated',
]);

R('PD-02', 'proposal_effect', [], [], 'STOP_DEMOTION_UNSEALED', [
  'legacy_proposal', 'demote_end_validity', '@LEGACY_TYPES', '@VALID_ACTORS',
  'explicit_proposal', N, '@SCOPE_CLASSES', N, N, 'normalized_target_id', N,
  'deferred_valid', N, '@DEMOTION_TIME_CLASSES', N, N, N,
  '@DEMOTION_TARGET_CLASSES', 'demoted', 'cdx_memory_end_validity',
  'consequences_none', 'demotion_unauthenticated',
]);

R('PD-03', 'proposal_effect', [], [], 'STOP_LEGACY_DESTRUCTIVE_OPERATION', [
  'legacy_proposal', 'demote_delete_transient', '@LEGACY_TYPES',
  '@VALID_ACTORS', 'explicit_proposal', N, '@SCOPE_CLASSES', N, N,
  'normalized_target_id', N, 'deferred_valid', N, '@DEMOTION_TIME_CLASSES', N,
  N, N, ['target_missing', 'permanent_target', 'transient_target_zero_links',
    'transient_target_one_or_more_links'],
  ['missing_target', 'not_transient', 'demoted'],
  ['effects_none', 'cdx_memory_delete'],
  ['consequences_none', 'fts_delete_zero_incident_links',
    'fts_delete_one_or_more_incident_links'],
  'demotion_unauthenticated',
]);

R('PR-01', 'proposal_effect', [], [], 'STOP_SHARING_UNSEALED', [
  'legacy_proposal', 'ratify_share', '@LEGACY_TYPES', '@VALID_WRITERS',
  'explicit_proposal', N, '@SCOPE_CLASSES', N, N, 'normalized_target_id', N,
  'deferred_valid', N, '@WRITE_TIME_CLASSES', N, N, N,
  ['target_missing', 'target_present'], ['missing_target', 'ratified'],
  ['effects_none', 'cdx_memory_set_shared'], 'consequences_none',
  'unauthenticated_ratification',
]);

R('D-01', 'route_effect', ['D-02', 'D-03'], ['target_present'],
  'ERASE_MISSING_OR_INVALID', [
    'legacy_delete_memory', N, N, '@ACTOR_CLASSES', N, N,
    '@TARGET_SCOPE_CLASSES', N, N, '@MISSING_OR_NORMALIZED_TARGET_IDS', N,
    '@ADMISSION_CAPTURE_CLASSES', N, N, N, N, N,
    ['target_id_missing', 'target_id_empty', 'target_not_found'],
    ['validation_failure', 'not_found'], 'effects_none', 'consequences_none',
    'delete_target_unauthenticated',
  ]);

R('D-02', 'route_effect', [], [], 'ERASE_TRANSITION', [
  'legacy_delete_memory', N, '@PERMANENT_TYPES', '@VALID_ACTORS', N, N,
  '@TARGET_SCOPE_CLASSES', N, N, 'normalized_target_id', N, 'deferred_valid',
  N, N, N, N, N, '@ERASE_TARGET_CLASSES',
  ['deleted', 'permanent_type_protected'],
  ['cdx_memory_delete', 'effects_none'],
  ['fts_delete_zero_incident_links', 'fts_delete_one_or_more_incident_links',
    'consequences_none'],
  'delete_target_unauthenticated',
]);

R('D-03', 'route_effect', [], [], 'ERASE_TRANSITION', [
  'legacy_delete_memory', N, '@TRANSIENT_TYPES', '@VALID_ACTORS', N, N,
  '@TARGET_SCOPE_CLASSES', N, N, 'normalized_target_id', N, 'deferred_valid',
  N, N, N, N, N, '@ERASE_TARGET_CLASSES', 'deleted', 'cdx_memory_delete',
  ['fts_delete_zero_incident_links', 'fts_delete_one_or_more_incident_links'],
  'delete_target_unauthenticated',
]);

R('T-01', 'route_effect', ['T-02', 'T-03'], ['topic_input_valid'],
  'STOP_TOPIC_UNSEALED', [
    'legacy_forget_topic', N, N, '@ACTOR_CLASSES', N, N, '@SCOPE_CLASSES', N,
    N, '@TOPIC_QUERY_ID_CLASSES', N, '@ADMISSION_CAPTURE_CLASSES', N, N, N, N,
    N, ['actor_invalid', 'query_empty', 'palari_empty', 'topic_input_valid'],
    ['invalid_actor', 'topic_forgotten_zero'], 'effects_none',
    'consequences_none', 'topic_selector_unauthenticated',
  ]);

R('T-02', 'route_effect', [], [], 'STOP_TOPIC_UNSEALED', [
  'legacy_forget_topic', N, N, '@VALID_ACTORS', N, N, '@SCOPE_CLASSES', N, N,
  'malformed_direct_fts_query', N, 'deferred_valid', N, N, N, N, N,
  'malformed_direct_fts_syntax', 'native_sqlite_failure', 'effects_none',
  'consequences_none', 'topic_selector_unauthenticated',
]);

R('T-03', 'route_effect', [], [], 'STOP_TOPIC_UNSEALED', [
  'legacy_forget_topic', N, '@LEGACY_TYPES', '@VALID_ACTORS', N, N,
  '@TOPIC_VISIBLE_SCOPE_CLASSES', N, N, 'normalized_topic_query', N,
  'deferred_valid', N, N, N, N, N, '@TOPIC_MATCH_SET_CLASSES',
  'topic_forgotten', 'zero_or_more_ordered_cdx_memory_delete',
  ['consequences_none', 'per_delete_fts_delete_zero_incident_links',
    'per_delete_fts_delete_one_or_more_incident_links'],
  'topic_selector_unauthenticated',
]);

R('R-01', 'route_effect', ['R-02', 'R-03'], ['normalized_ids_nonempty'],
  'STOP_RECALL_UNREGISTERED', [
    'legacy_record_recall_inclusion', N, N, '@ACTOR_CLASSES', N, N,
    '@SCOPE_CLASSES', N, N, '@RECALL_ID_CLASSES', N,
    '@ADMISSION_CAPTURE_CLASSES', N, N, N, '@ACCESS_COUNT_CLASSES', N,
    'normalized_list_empty_or_nonempty',
    ['empty_result', 'conversion_failure', 'normalized_ids_nonempty'],
    'effects_none', 'consequences_none', 'recall_operation_unregistered',
  ]);

R('R-02', 'route_effect', [], [], 'STOP_RECALL_UNREGISTERED', [
  'legacy_record_recall_inclusion', N, '@LEGACY_TYPES', '@VALID_ACTORS', N, N,
  '@SCOPE_CLASSES', N, N, 'first_occurrence_ids', N, 'deferred_valid', N, N,
  N, 'access_below_max', N, 'first_occurrence_ids_missing_or_present',
  'recall_recorded', 'per_present_touch_then_set_importance',
  'consequences_none', 'recall_operation_unregistered',
]);

R('R-03', 'route_effect', [], [], 'STOP_RECALL_UNREGISTERED', [
  'legacy_record_recall_inclusion', N, '@LEGACY_TYPES', '@VALID_ACTORS', N, N,
  '@SCOPE_CLASSES', N, N, 'first_occurrence_ids', N, 'deferred_valid', N, N,
  N, 'access_at_max_safe_integer', N, 'any_present_id_at_max',
  'native_overflow_range_error', 'effects_none', 'consequences_none',
  'recall_operation_unregistered',
]);

R('L-01', 'route_effect', ['L-02', 'L-03', 'L-04'], ['selection_complete'],
  'STOP_LIFECYCLE_UNREGISTERED', [
    'legacy_run_lifecycle', N, '@TRANSIENT_TYPES', N, N, N, '@SCOPE_CLASSES',
    N, N, N, N, '@ADMISSION_CAPTURE_CLASSES', N,
    '@LIFECYCLE_REFERENCE_TIME_CLASSES', N, N, '@LIFECYCLE_SCOPE_CLASSES',
    'selected_rows', 'lifecycle_ran', 'per_selected_row_effects',
    'consequences_none', 'lifecycle_formula_unregistered',
  ]);

R('L-02', 'route_effect', [], [], 'STOP_LIFECYCLE_UNREGISTERED', [
  'legacy_run_lifecycle', N, '@TRANSIENT_TYPES', N, N, N, '@SCOPE_CLASSES', N,
  N, N, N, 'deferred_valid', N, '@LIFECYCLE_REFERENCE_TIME_CLASSES', N, N,
  '@LIFECYCLE_SCOPE_CLASSES', 'zero_windows', 'skipped', 'effects_none',
  'consequences_none', 'lifecycle_formula_unregistered',
]);

R('L-03', 'route_effect', [], [], 'STOP_LIFECYCLE_UNREGISTERED', [
  'legacy_run_lifecycle', N, '@TRANSIENT_TYPES', N, N, N, '@SCOPE_CLASSES', N,
  N, N, N, 'deferred_valid', N, 'valid_reference_time', N, N,
  '@LIFECYCLE_SCOPE_CLASSES',
  'one_or_more_windows_next_importance_above_point_one', 'decayed',
  'cdx_memory_decay', 'consequences_none', 'lifecycle_formula_unregistered',
]);

R('L-04', 'route_effect', [], [], 'STOP_LIFECYCLE_UNREGISTERED', [
  'legacy_run_lifecycle', N, '@TRANSIENT_TYPES', N, N, N, '@SCOPE_CLASSES', N,
  N, N, N, 'deferred_valid', N, 'valid_reference_time', N, N,
  '@LIFECYCLE_SCOPE_CLASSES',
  ['one_or_more_windows_next_importance_at_or_below_point_one_zero_links',
    'one_or_more_windows_next_importance_at_or_below_point_one_one_or_more_links'],
  'deleted', 'cdx_memory_delete',
  ['fts_delete_zero_incident_links', 'fts_delete_one_or_more_incident_links'],
  'lifecycle_formula_unregistered',
]);

R('E-01', 'producer_result', [], [], 'STOP_NO_SEMANTIC_MUTATION', [
  'legacy_extraction_pass', N, N, N, 'extraction_producer',
  '@EXTRACTION_SKIP_SOURCE_CLASSES', N, N, N, N, N,
  '@ADMISSION_CAPTURE_CLASSES', N, N, N, N, N, 'extractor_skip_or_drop',
  'exact_three_key_skip_or_drop', 'effects_none', 'consequences_none',
  'producer_receipt_incomplete',
]);

R('E-02', 'producer_result', [], [], 'STOP_NO_SEMANTIC_MUTATION', [
  'legacy_extraction_pass', N, '@TRANSIENT_TYPES', N, 'extraction_candidate',
  '@VALID_EXTRACTION_SOURCE_CLASSES', '@SCOPE_CLASSES', N, N, N, N,
  'deferred_valid', N, N, N, N, N, 'transient_detail_or_source_boundary_drop',
  'completed_no_write_count', 'effects_none', 'consequences_none',
  'producer_receipt_incomplete',
]);

R('E-03', 'producer_result', ['P-03'], ['candidate_routed'],
  'STOP_TRUSTED_EVIDENCE_DEFERRED', [
    'legacy_extraction_pass', '@PROMOTE_PERMANENT_OPS',
    '@TYPE_ADMISSION_CLASSES', '@WRITER_CLASSES', 'extraction_candidate',
    '@SOURCE_CLASSES', '@SCOPE_CLASSES', '@DECORATION_CLASSES',
    '@SHARED_CLASSES', '@PROPOSAL_ID_CLASSES', '@HASH_CLASSES',
    '@ADMISSION_CAPTURE_CLASSES', '@CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
    '@HISTORICAL_CLASSES', N, N, 'candidate_admission_rejection',
    'rejected_outcome_reasons_discarded_later_continue', 'effects_none',
    'consequences_none', 'producer_receipt_incomplete',
  ]);

R('E-04', 'producer_result', ['PA-01', 'PA-02', 'PX-01', 'PX-02', 'PX-03'],
  ['candidate_routed'], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
    'legacy_extraction_pass', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
    'extraction_candidate', '@VALID_EXTRACTION_SOURCE_CLASSES',
    '@SCOPE_CLASSES', '@DECORATION_CLASSES', '@SHARED_CLASSES',
    '@PROPOSAL_ID_CLASSES', '@HASH_CLASSES', 'deferred_valid',
    '@ADMITTED_CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES',
    '@HISTORICAL_CLASSES', N, N,
    ['candidate_insert', 'candidate_duplicate', 'candidate_supersede'],
    ['inserted', 'duplicate_bumped', 'superseded'],
    ['cdx_memory_insert', 'cdx_memory_set_importance',
      'cdx_memory_end_validity_then_insert_then_link'],
    ['fts_insert_trigger', 'consequences_none'], 'producer_receipt_incomplete',
  ]);

R('E-05', 'producer_result', [], [], 'STOP_TRUSTED_EVIDENCE_DEFERRED', [
  'legacy_extraction_pass', '@ADD_OPS', '@LEGACY_TYPES', '@VALID_WRITERS',
  'extraction_candidate', '@VALID_EXTRACTION_SOURCE_CLASSES',
  '@SCOPE_CLASSES', '@DECORATION_CLASSES', '@SHARED_CLASSES',
  '@PROPOSAL_ID_CLASSES', '@HASH_CLASSES',
  '@CAPTURE_OR_APPLY_THROW_CLASSES', '@ADMITTED_CONFIDENCE_CLASSES',
  '@WRITE_TIME_CLASSES', '@HISTORICAL_CLASSES', N, N,
  'candidate_capture_or_apply_throw',
  'pass_rejects_after_earlier_candidate_commits',
  'zero_or_more_previously_committed_candidate_effects',
  'zero_or_more_previously_committed_trigger_fk_consequences',
  'producer_receipt_incomplete',
]);

R('S-01', 'producer_result', [], [], 'STOP_SUMMARY_LINEAGE_INCOMPLETE', [
  'legacy_summary_pass', N, N, N, 'session_summary',
  '@SUMMARY_SKIP_SOURCE_CLASSES', N, N, N, N, N,
  '@ADMISSION_CAPTURE_CLASSES', N, N, N, N, N, 'summary_skip',
  'exact_reason_source_boundary_status', 'effects_none', 'consequences_none',
  'summary_lineage_incomplete',
]);

R('S-02', 'producer_result', ['P-03', 'PA-01', 'PA-02'], ['summary_routed'],
  'STOP_SUMMARY_LINEAGE_INCOMPLETE', [
    'legacy_summary_pass', 'permanent_add', 'session_summary',
    'writer_session_summary', 'session_summary', 'summary_summarized',
    '@SCOPE_CLASSES', '@DECORATION_CLASSES', '@SHARED_CLASSES',
    '@PROPOSAL_ID_CLASSES', '@HASH_CLASSES', '@ADMISSION_CAPTURE_CLASSES',
    '@CONFIDENCE_CLASSES', '@WRITE_TIME_CLASSES', '@HISTORICAL_CLASSES', N, N,
    ['summary_insert', 'summary_duplicate', 'summary_rejected'],
    ['inserted', 'duplicate_bumped', 'rejected'],
    ['effects_none', 'cdx_memory_insert', 'cdx_memory_set_importance'],
    ['consequences_none', 'fts_insert_trigger'], 'summary_lineage_incomplete',
  ]);

R('S-03', 'producer_result', [], [], 'STOP_SUMMARY_LINEAGE_INCOMPLETE', [
  'legacy_scheduler_turn', N, N, N, 'scheduler_summary', N, N, N, N, N, N,
  'capture_success', N, N, N, N, N, 'session_summary_disabled',
  'synthetic_session_summary_disabled_skip', 'effects_none',
  'consequences_none', 'summary_lineage_incomplete',
]);

R('F-01', 'terminal_storage', [], [], 'STOP_TERMINAL_STORAGE_REFUSED', [
  'legacy_delete_kernel_store_file', N, N, N, N, N, N, N, N,
  'canonical_path', N, '@ADMISSION_CAPTURE_CLASSES', N, N, N, N, N,
  ['live_path', 'in_flight_path', 'close_failed_path', 'poisoned_path'],
  'legacy_store_open', 'effects_none', 'consequences_none',
  'terminal_same_file_destruction',
]);

R('F-02', 'terminal_storage', [], [], 'STOP_TERMINAL_STORAGE_REFUSED', [
  'legacy_delete_kernel_store_file', N, N, N, N, N, N, N, N,
  'canonical_path', N, 'deferred_valid', N, N, N, N, N, 'zero_live_path',
  'filesystem_artifacts_removed', 'remove_main_wal_shm_journal',
  'filesystem_removal_consequences', 'terminal_same_file_destruction',
]);

R('F-03', 'terminal_storage', [], [], 'STOP_TERMINAL_STORAGE_REFUSED', [
  'legacy_delete_kernel_store_file', N, N, N, N, N, N, N, N,
  'canonical_path', N, 'deferred_valid', N, N, N, N, N,
  'native_removal_failure_at_any_path', 'native_removal_failure',
  'partially_completed_remove_sequence',
  'already_removed_artifacts_not_restored', 'terminal_same_file_destruction',
]);

objectFreeze(rows);

const EXPECTED_IDS = objectFreeze([
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
]);

const PHASES = objectFreeze([
  'pre_route',
  'capture',
  'proposal_admission',
  'proposal_effect',
  'route_effect',
  'producer_result',
  'terminal_storage',
]);

const RULE_VOCABULARY = objectFreeze([
  'STOP_MEMORY_DISABLED',
  'STOP_STORE_CLOSED',
  'CAPTURE_OR_ADVANCE',
  'STOP_INVALID_COMPATIBILITY',
  'INVALID_OR_ADVANCE',
  'ADMISSION_OR_DEFER',
  'ADMISSION_OR_DEMOTION_REFUSAL',
  'ADMISSION_OR_SHARING_REFUSAL',
  'STOP_TRUSTED_EVIDENCE_DEFERRED',
  'STOP_DEMOTION_UNSEALED',
  'STOP_LEGACY_DESTRUCTIVE_OPERATION',
  'STOP_SHARING_UNSEALED',
  'ERASE_MISSING_OR_INVALID',
  'ERASE_TRANSITION',
  'STOP_TOPIC_UNSEALED',
  'STOP_RECALL_UNREGISTERED',
  'STOP_LIFECYCLE_UNREGISTERED',
  'STOP_NO_SEMANTIC_MUTATION',
  'STOP_SUMMARY_LINEAGE_INCOMPLETE',
  'STOP_TERMINAL_STORAGE_REFUSED',
]);

const DISPOSITIONS = objectFreeze(['MAP', 'REFUSE']);
const ACTIONS = objectFreeze([
  'CONTINUE',
  'RETURN',
  'RETHROW',
  'THROW',
  'TERMINAL',
]);
const RECORDING_MODES = objectFreeze([
  'pre_gate_no_journal',
  'decision_only',
  'decision_and_effects',
]);
const MEMORY_AUTHORITY_PUBLIC_EXPORTS = objectFreeze([
  'MemoryAuthorityError',
  'createMemoryAuthorityRoot',
  'issueMemoryAuthorityGrant',
  'revokeMemoryAuthorityGrant',
  'revokeMemoryAuthorityRoot',
]);
const MEMORY_AUTHORITY_ERRORS = objectFreeze({
  authority_invalid_argument:
    'A valid memory authority argument is required.',
  authority_root_invalid:
    'A module-issued memory authority root is required.',
  authority_root_revoked:
    'The memory authority root has been revoked.',
  authority_root_unbound:
    'The memory authority root is not bound to a live store generation.',
  authority_root_busy:
    'The memory authority root is already bound to a store generation.',
  authority_scope_mismatch:
    'The memory authority scope does not match the store audience.',
  authority_grant_invalid:
    'A module-issued memory authority grant is required.',
  authority_grant_unavailable:
    'The memory authority grant is no longer available.',
  authority_grant_expired:
    'The memory authority grant has expired.',
  authority_grant_mismatch:
    'The memory authority grant does not authorize this target and verb.',
  authority_clock_invalid:
    'The native authority clock is invalid or moved backward.',
  authority_ledger_unavailable:
    'The external authority grant is not active at use time.',
  authority_ledger_protocol:
    'The authority activity check must return a primitive boolean synchronously.',
});
const MEMORY_AUTHORITY_ERROR_CODES = objectFreeze(
  objectKeys(MEMORY_AUTHORITY_ERRORS),
);
const AUTHORITY_PREFLIGHT_OUTCOMES = objectFreeze([
  'absent',
  'authority_grant_invalid',
  'authority_grant_unavailable',
  'authority_grant_expired',
  'authority_scope_mismatch',
  'ready',
]);
const AUTHORITY_USE_OUTCOMES = objectFreeze([
  'legacy_store_closed',
  'authority_root_revoked',
  'authority_scope_mismatch',
  'authority_grant_expired',
  'authority_grant_unavailable',
  'authority_grant_mismatch',
  'authority_ledger_unavailable',
  'authority_ledger_protocol',
  'authority_clock_invalid',
  'valid',
]);
const ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES = objectFreeze([
  'authority_invalid_argument',
  'authority_root_invalid',
  'authority_root_unbound',
  'authority_root_busy',
]);
const AUTHORITY_ACTION_COUNTS = objectFreeze({
  preflightReturn: 1,
  preflightThrow: 4,
  preflightContinue: 1,
  useThrow: 9,
  useContinue: 1,
});
const FINAL_REASONS = objectFreeze([
  'memory_disabled',
  'store_closed',
  'capture_failed',
  'invalid_compatibility',
  'trusted_evidence_deferred',
  'demotion_projection_unsealed',
  'legacy_destructive_operation_refused',
  'sharing_semantics_unsealed',
  'topic_authority_unsealed',
  'recall_mutation_unregistered',
  'lifecycle_mutation_unregistered',
  'no_semantic_mutation',
  'summary_lineage_incomplete',
  'terminal_storage_refused',
  'authority_required',
  'missing_target',
  'scope_mismatch',
  'shared_scope_unsealed',
  'incident_edges_unemittable',
]);

const AUTHORITY_STAGE_DEFINITIONS = objectFreeze({
  nonErasureMarker:
    'not_applicable is legal only on non-D routes and is rejected in either D authority phase',
  preflight:
    'absence returns before caller capture; only grant-invalid, unavailable, expired, or scope-mismatch may throw before capture; ready alone continues',
  capture:
    'after ready, a failed compatibility capture rethrows the exact lexically retained capture-thrown value by identity before any post-capture or use-time outcome is evaluated',
  use:
    'after successful capture, only the closed local-recheck, activity-predicate, native-clock, expiry, or valid outcomes may occur',
  phaseOverlap:
    'scope-mismatch, grant-expired, and grant-unavailable are legal in both phases because initial preflight and reentrant post-capture checks can each observe them',
  excludedHostErrors:
    'authority_invalid_argument, authority_root_invalid, authority_root_unbound, and authority_root_busy are host construction, binding, or issuance outcomes and never D-call outcomes',
});

const PRODUCTION_FIXTURE_CROSSCHECK = objectFreeze({
  required: true,
  sourceCommit: '53e5b0357f83be7700a32458d38922cb7777a66e',
  sourceObligationsBlob: '33d8fa3b89e5348d3e5d624315fcd1c870ed095c',
  sourceRoutingContractBlob:
    'a3ad75dc78644de2329af2feb680aef559068774',
  sourcePlan: 'CDX-M1-legacy-plan@1',
  rule:
    'every certified A2 fixture must match one obligation coordinate projection and its preserved correlated outcome/effect/consequence tuple',
});

const MAP_ALLOWLIST = objectFreeze(['D-02', 'D-03']);
const ERASURE_IDS = objectFreeze(['D-01', 'D-02', 'D-03']);
const TERMINAL_STORAGE_IDS = objectFreeze(['F-01', 'F-02', 'F-03']);
const TARGET_VALIDITY_CLASSES = objectFreeze(['current', 'ended']);

const STATIC_REASON_BY_ID = objectFreeze({
  'PRE-01': 'memory_disabled',
  'PRE-02': 'store_closed',
  'PRE-03': 'capture_failed',
  'P-01': 'invalid_compatibility',
  'P-02': 'invalid_compatibility',
  'P-03': 'trusted_evidence_deferred',
  'P-04': 'invalid_compatibility',
  'P-05': 'invalid_compatibility',
  'PA-01': 'trusted_evidence_deferred',
  'PA-02': 'trusted_evidence_deferred',
  'PA-03': 'trusted_evidence_deferred',
  'PA-04': 'trusted_evidence_deferred',
  'PX-01': 'trusted_evidence_deferred',
  'PX-02': 'trusted_evidence_deferred',
  'PX-03': 'trusted_evidence_deferred',
  'PS-01': 'trusted_evidence_deferred',
  'PS-02': 'trusted_evidence_deferred',
  'PS-03': 'trusted_evidence_deferred',
  'PD-01': 'demotion_projection_unsealed',
  'PD-02': 'demotion_projection_unsealed',
  'PD-03': 'legacy_destructive_operation_refused',
  'PR-01': 'sharing_semantics_unsealed',
  'T-01': 'topic_authority_unsealed',
  'T-02': 'topic_authority_unsealed',
  'T-03': 'topic_authority_unsealed',
  'R-01': 'recall_mutation_unregistered',
  'R-02': 'recall_mutation_unregistered',
  'R-03': 'recall_mutation_unregistered',
  'L-01': 'lifecycle_mutation_unregistered',
  'L-02': 'lifecycle_mutation_unregistered',
  'L-03': 'lifecycle_mutation_unregistered',
  'L-04': 'lifecycle_mutation_unregistered',
  'E-01': 'no_semantic_mutation',
  'E-02': 'no_semantic_mutation',
  'E-03': 'trusted_evidence_deferred',
  'E-04': 'trusted_evidence_deferred',
  'E-05': 'trusted_evidence_deferred',
  'S-01': 'summary_lineage_incomplete',
  'S-02': 'summary_lineage_incomplete',
  'S-03': 'summary_lineage_incomplete',
  'F-01': 'terminal_storage_refused',
  'F-02': 'terminal_storage_refused',
  'F-03': 'terminal_storage_refused',
});

function refusal(reason, recordingMode) {
  return objectFreeze({
    action: 'TERMINAL',
    disposition: 'REFUSE',
    outcome: 'refused',
    reason,
    recordingMode,
  });
}

function authorityAbsentReturn() {
  return objectFreeze({
    action: 'RETURN',
    disposition: 'REFUSE',
    outcome: 'refused',
    reason: 'authority_required',
    recordingMode: 'pre_gate_no_journal',
    routeKind: 'legacy_delete_memory',
    publicResultShape: '{deleted:false,reason:"governance_refused"}',
  });
}

function authorityThrow(code) {
  return objectFreeze({
    action: 'THROW',
    disposition: 'REFUSE',
    errorName: 'MemoryAuthorityError',
    errorCode: code,
    errorMessage: MEMORY_AUTHORITY_ERRORS[code],
    recordingMode: 'pre_gate_no_journal',
  });
}

function captureRethrow() {
  return objectFreeze({
    action: 'RETHROW',
    disposition: 'REFUSE',
    reason: 'capture_failed',
    recordingMode: 'pre_gate_no_journal',
    preserveCapturedErrorByIdentity: true,
  });
}

function legacyStoreClosedThrow() {
  return objectFreeze({
    action: 'THROW',
    disposition: 'REFUSE',
    errorName: 'LegacyMutationError',
    errorCode: 'legacy_store_closed',
    errorMessage: 'The memory store is closed.',
    recordingMode: 'pre_gate_no_journal',
  });
}

function evaluateTerminalStorageGroup() {
  return objectFreeze({
    action: 'THROW',
    disposition: 'REFUSE',
    errorName: 'LegacyMutationError',
    errorCode: 'legacy_terminal_storage_refused',
    errorMessage: 'Terminal deletion of a governed memory store is refused.',
    reason: 'terminal_storage_refused',
    recordingMode: 'pre_gate_no_journal',
    coveredObligationIds: TERMINAL_STORAGE_IDS,
  });
}

function continueTo(next) {
  return objectFreeze({action: 'CONTINUE', next});
}

function evaluateRouteEntry(routeKind) {
  if (typeof routeKind !== 'string' ||
      !arrayIncludes(SETS.PUBLIC_MUTATION_ROUTES, routeKind)) {
    throw new nativeError('unknown public mutation route');
  }
  if (routeKind === 'legacy_delete_kernel_store_file') {
    // This result is selected from the route tag alone. No options, path,
    // live-path registry, or filesystem state is accepted or inspected.
    return evaluateTerminalStorageGroup();
  }
  return continueTo(ROUTE_ENTRY_ROWS[routeKind]);
}

function appliedErasure() {
  return objectFreeze({
    action: 'TERMINAL',
    disposition: 'MAP',
    outcome: 'applied',
    reason: null,
    recordingMode: 'decision_and_effects',
  });
}

function assertDispositionInputRecord(input, allowedKeys) {
  if (input === null || typeof input !== 'object' ||
      isProxyValue(input) || arrayIsArray(input)) {
    throw new nativeError('disposition input must be a data record');
  }
  const prototype = reflectGetPrototypeOf(input);
  if (prototype !== objectPrototype && prototype !== null) {
    throw new nativeError('disposition input must have an ordinary or null prototype');
  }
  for (const key of safeArrayIterable(reflectOwnKeys(input))) {
    if (typeof key !== 'string' || !arrayIncludes(allowedKeys, key)) {
      throw new nativeError('disposition input contains an unknown field');
    }
  }
}

function readOwnDispositionDescriptor(input, key, allowedKeys) {
  assertDispositionInputRecord(input, allowedKeys);
  const descriptor = reflectGetOwnPropertyDescriptor(input, key);
  if (descriptor !== undefined && !objectHasOwn(descriptor, 'value')) {
    throw new nativeError('disposition input fields must be own data properties');
  }
  return descriptor;
}

function readOwnErasureField(input, key) {
  const descriptor = readOwnDispositionDescriptor(
    input, key, ERASURE_INPUT_KEYS);
  if (descriptor === undefined) return undefined;
  return descriptor.value;
}

function assertProjectionVerified(input) {
  if (readOwnErasureField(input, 'projectionVerified') !== true) {
    throw new nativeError(
      'internal projection mismatch: complete projection verification required',
    );
  }
}

function evaluateErasureAuthorityPreflight(input) {
  const outcome = readOwnErasureField(input, 'authorityPreflightOutcome');
  if (outcome === 'not_applicable') {
    throw new nativeError('erasure requires an applicable authority preflight outcome');
  }
  if (!arrayIncludes(AUTHORITY_PREFLIGHT_OUTCOMES, outcome)) {
    throw new nativeError('unknown erasure authority preflight outcome');
  }
  if (outcome === 'absent') {
    return authorityAbsentReturn();
  }
  if (outcome !== 'ready') {
    return authorityThrow(outcome);
  }
  return null;
}

function evaluateErasureAuthorityUse(input) {
  const outcome = readOwnErasureField(input, 'authorityUseOutcome');
  if (outcome === 'not_applicable') {
    throw new nativeError('erasure requires an applicable authority use outcome');
  }
  if (!arrayIncludes(AUTHORITY_USE_OUTCOMES, outcome)) {
    throw new nativeError('unknown erasure authority use outcome');
  }
  if (outcome === 'legacy_store_closed') {
    return legacyStoreClosedThrow();
  }
  if (outcome !== 'valid') {
    return authorityThrow(outcome);
  }
  return null;
}

function assertCommonErasureCoordinates(input) {
  if (readOwnErasureField(input, 'idClass') !== 'normalized_target_id') {
    throw new nativeError('valid erasure authority requires a normalized target id');
  }
  if (readOwnErasureField(input, 'targetMatchesGrant') !== true) {
    throw new nativeError('valid erasure authority requires an exact target match');
  }
  if (!arrayIncludes(
    SETS.VALID_ACTORS,
    readOwnErasureField(input, 'actorClass'),
  )) {
    throw new nativeError('valid erasure syntax requires a valid captured actor');
  }
  const targetExists = readOwnErasureField(input, 'targetExists');
  if (targetExists !== true && targetExists !== false) {
    throw new nativeError('erasure target existence must be a primitive boolean');
  }
  return targetExists;
}

function assertScopeSharedRelation(scopeClass, sharedFlag) {
  if (!arrayIncludes(SETS.TARGET_SCOPE_CLASSES, scopeClass)) {
    throw new nativeError('erasure leaf has an unknown target scope');
  }
  if (sharedFlag !== 'shared_0' && sharedFlag !== 'shared_1') {
    throw new nativeError('erasure leaf has an invalid retained shared flag');
  }
  if (stringEndsWith(scopeClass, '_private') && sharedFlag !== 'shared_0') {
    throw new nativeError('erasure scope/shared coordinates are inconsistent');
  }
  if (stringEndsWith(scopeClass, '_shared') && sharedFlag !== 'shared_1') {
    throw new nativeError('erasure scope/shared coordinates are inconsistent');
  }
}

function deriveEraseTargetClassFromCoordinates(scopeClass, incidentLinkCount) {
  if (!numberIsSafeInteger(incidentLinkCount) || incidentLinkCount < 0) {
    throw new nativeError('internal projection mismatch: invalid incident-link count');
  }
  let family;
  if (scopeClass === 'same_palari_same_user_private') {
    family = 'private_same_scope';
  } else if (scopeClass === 'same_palari_same_user_shared') {
    family = 'shared';
  } else if (stringIncludes(scopeClass, 'general')) {
    family = 'general';
  } else if (stringStartsWith(scopeClass, 'same_palari_cross_user_')) {
    family = 'cross_user';
  } else if (stringStartsWith(scopeClass, 'cross_palari_')) {
    family = 'cross_palari';
  } else {
    throw new nativeError('erasure scope has no target-branch derivation');
  }
  const linkClass = incidentLinkCount === 0 ?
    'zero_links' : 'with_links';
  return `target_${family}_${linkClass}`;
}

function deriveEraseTargetClass(input) {
  return deriveEraseTargetClassFromCoordinates(
    readOwnErasureField(input, 'scopeClass'),
    readOwnErasureField(input, 'incidentLinkCount'),
  );
}

function assertErasureLeafCoordinates(rowId, input, targetExists) {
  if (targetExists !== true) {
    throw new nativeError('erasure leaf requires a present target');
  }
  const validityClass = readOwnErasureField(input, 'validityClass');
  if (!arrayIncludes(TARGET_VALIDITY_CLASSES, validityClass)) {
    throw new nativeError('erasure leaf has an unknown target validity class');
  }
  const legacyType = readOwnErasureField(input, 'legacyType');
  if (rowId === 'D-02' && !arrayIncludes(SETS.PERMANENT_TYPES, legacyType)) {
    throw new nativeError('D-02 requires a permanent legacy target type');
  }
  if (rowId === 'D-03' && !arrayIncludes(SETS.TRANSIENT_TYPES, legacyType)) {
    throw new nativeError('D-03 requires a transient legacy target type');
  }
  const scopeClass = readOwnErasureField(input, 'scopeClass');
  const sharedFlag = readOwnErasureField(input, 'sharedFlag');
  const incidentLinkCount = readOwnErasureField(input, 'incidentLinkCount');
  assertScopeSharedRelation(scopeClass, sharedFlag);
  const derivedTargetClass = deriveEraseTargetClassFromCoordinates(
    scopeClass,
    incidentLinkCount,
  );
  if (readOwnErasureField(input, 'targetBranch') !== derivedTargetClass ||
      !arrayIncludes(SETS.ERASE_TARGET_CLASSES, derivedTargetClass)) {
    throw new nativeError('erasure target coordinates do not derive the named branch');
  }
  return {incidentLinkCount, scopeClass, sharedFlag};
}

function evaluateErasure(rowId, input) {
  const preflightTerminal = evaluateErasureAuthorityPreflight(input);
  if (preflightTerminal !== null) return preflightTerminal;

  const syntaxValid = readOwnErasureField(input, 'syntaxValid');
  if (syntaxValid !== true && syntaxValid !== false) {
    throw new nativeError('erasure capture status must be a primitive boolean');
  }
  if (syntaxValid === false) {
    return captureRethrow();
  }

  const useTerminal = evaluateErasureAuthorityUse(input);
  if (useTerminal !== null) return useTerminal;

  // The complete B2 reducer/projection verifier is an integrity precondition.
  // No missing/scope/shared/link policy reason may hide corrupt projection.
  assertProjectionVerified(input);
  const targetExists = assertCommonErasureCoordinates(input);

  if (rowId === 'D-01') {
    if (targetExists === true) {
      const legacyType = readOwnErasureField(input, 'legacyType');
      if (!arrayIncludes(SETS.LEGACY_TYPES, legacyType)) {
        throw new nativeError('present erasure target has an unknown legacy type');
      }
      return continueTo(objectFreeze([
        arrayIncludes(SETS.PERMANENT_TYPES, legacyType) ? 'D-02' : 'D-03',
      ]));
    }
    return refusal('missing_target', 'decision_only');
  }

  if (!arrayIncludes(MAP_ALLOWLIST, rowId)) {
    throw new nativeError('erasure evaluator received a non-allowlisted leaf');
  }
  const leaf = assertErasureLeafCoordinates(rowId, input, targetExists);

  // Scope precedes link enumeration. Cross-scope callers must not learn links.
  if (leaf.scopeClass !== 'same_palari_same_user_private') {
    if (leaf.scopeClass === 'same_palari_same_user_shared') {
      return refusal('shared_scope_unsealed', 'decision_only');
    }
    return refusal('scope_mismatch', 'decision_only');
  }
  if (leaf.sharedFlag !== 'shared_0') {
    return refusal('shared_scope_unsealed', 'decision_only');
  }
  if (leaf.incidentLinkCount > 0) {
    return refusal('incident_edges_unemittable', 'decision_only');
  }

  return appliedErasure();
}

function closedCompatibilityOutcome(row, input, allowedKeys) {
  assertDispositionInputRecord(input, allowedKeys);
  const descriptor = reflectGetOwnPropertyDescriptor(
    input, 'compatibilityOutcome');
  if (descriptor === undefined) return undefined;
  if (!objectHasOwn(descriptor, 'value') ||
      typeof descriptor.value !== 'string') {
    throw new nativeError('unknown compatibility outcome');
  }
  const closedOutcomes = createSet(concatenateArrays(
    row.continueOutcomes,
    expandCell(row.v[18], row.id + '.legacy_outcome'),
  ));
  if (!setHas(closedOutcomes, descriptor.value)) {
    throw new nativeError('unknown compatibility outcome');
  }
  return descriptor.value;
}

function evaluateFinal(rowId, input = EMPTY_INPUT) {
  const row = arrayFind(rows, (candidate) => candidate.id === rowId);
  if (!row) {
    throw new nativeError('unknown obligation id');
  }

  if (arrayIncludes(TERMINAL_STORAGE_IDS, rowId)) {
    return evaluateTerminalStorageGroup();
  }

  // D dispatch deliberately precedes generic compatibility continuation.
  if (arrayIncludes(ERASURE_IDS, rowId)) {
    return evaluateErasure(rowId, input);
  }

  const allowedKeys = rowId === 'PRE-03' ?
    PRE_ROUTE_INPUT_KEYS : GENERIC_INPUT_KEYS;
  assertDispositionInputRecord(input, allowedKeys);
  for (const key of safeArrayIterable([
    'authorityPreflightOutcome',
    'authorityUseOutcome',
  ])) {
    const descriptor = readOwnDispositionDescriptor(input, key, allowedKeys);
    if (descriptor !== undefined && descriptor.value !== 'not_applicable') {
      throw new nativeError('authority is not applicable to a non-erasure row');
    }
  }

  const compatibilityOutcome = closedCompatibilityOutcome(
    row, input, allowedKeys);
  if (arrayIncludes(row.continueOutcomes, compatibilityOutcome)) {
    if (rowId === 'PRE-03') {
      const routeDescriptor = readOwnDispositionDescriptor(
        input, 'routeKind', allowedKeys);
      return evaluateRouteEntry(routeDescriptor?.value);
    }
    return continueTo(row.next);
  }

  let reason = STATIC_REASON_BY_ID[rowId];
  if (rowId === 'PRE-03' && compatibilityOutcome === 'legacy_store_closed') {
    reason = 'store_closed';
  }
  if (!reason) {
    throw new nativeError('row has no closed terminal reason');
  }
  return refusal(reason, 'pre_gate_no_journal');
}

const REGISTRY = objectFreeze({
  version: 'CDX-M1-legacy-disposition@5',
  baseline: '53e5b0357f83be7700a32458d38922cb7777a66e',
  obligationCount: 46,
  cellSemantics: 'coordinate_projection_not_cartesian',
  dimensionOrder,
  sets: SETS,
  rows,
  routeEntryRows: ROUTE_ENTRY_ROWS,
  routeTransitions: ROUTE_TRANSITIONS,
  phases: PHASES,
  ruleVocabulary: RULE_VOCABULARY,
  dispositions: DISPOSITIONS,
  actions: ACTIONS,
  recordingModes: RECORDING_MODES,
  memoryAuthorityPublicExports: MEMORY_AUTHORITY_PUBLIC_EXPORTS,
  memoryAuthorityErrors: MEMORY_AUTHORITY_ERRORS,
  authorityPreflightOutcomes: AUTHORITY_PREFLIGHT_OUTCOMES,
  authorityUseOutcomes: AUTHORITY_USE_OUTCOMES,
  rootOrIssuanceOnlyAuthorityCodes: ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES,
  authorityActionCounts: AUTHORITY_ACTION_COUNTS,
  authorityStageDefinitions: AUTHORITY_STAGE_DEFINITIONS,
  productionFixtureCrosscheck: PRODUCTION_FIXTURE_CROSSCHECK,
  finalReasons: FINAL_REASONS,
  mapAllowlist: MAP_ALLOWLIST,
  terminalStorageIds: TERMINAL_STORAGE_IDS,
});

function assert(condition, message) {
  if (!condition) throw new nativeError(message);
}

function assertUniqueStrings(values, label) {
  assert(arrayIsArray(values) && values.length > 0, label + ' must be nonempty');
  assert(arrayEvery(values,
    (value) => typeof value === 'string' && value.length > 0),
    label + ' must contain nonempty strings');
  assert(setSize(createSet(values)) === values.length,
    label + ' contains duplicates');
}

function expandCell(cell, label) {
  const variants = arrayIsArray(cell) ? cell : [cell];
  assert(variants.length > 0, label + ' has an empty finite union');
  const expanded = [];
  for (const variant of safeArrayIterable(variants)) {
    assert(typeof variant === 'string' && variant.length > 0,
      label + ' has a non-string symbol');
    assert(variant !== stringFromCharCode(42), label + ' contains a wildcard');
    if (stringStartsWith(variant, '@')) {
      const setName = stringSlice(variant, 1);
      assert(objectHasOwn(SETS, setName), label + ' has unknown set ' + setName);
      arrayPushAll(expanded, SETS[setName]);
    } else {
      arrayPush(expanded, variant);
    }
  }
  assert(setSize(createSet(expanded)) === expanded.length,
    label + ' expands to duplicate symbols');
  return expanded;
}

function validateRegistry() {
  assertUniqueStrings(dimensionOrder, 'dimensionOrder');
  assert(dimensionOrder.length === 22, 'dimensionOrder must contain 22 keys');
  assertUniqueStrings(EXPECTED_IDS, 'EXPECTED_IDS');
  assert(EXPECTED_IDS.length === 46, 'EXPECTED_IDS must contain 46 ids');
  assert(rows.length === 46, 'registry must contain 46 rows');
  assert(sameData(arrayMap(rows, (row) => row.id), EXPECTED_IDS),
    'row ids/order differ from the A2 inventory');

  assertUniqueStrings(PHASES, 'PHASES');
  assertUniqueStrings(RULE_VOCABULARY, 'RULE_VOCABULARY');
  assertUniqueStrings(DISPOSITIONS, 'DISPOSITIONS');
  assertUniqueStrings(ACTIONS, 'ACTIONS');
  assertUniqueStrings(RECORDING_MODES, 'RECORDING_MODES');
  assertUniqueStrings(MEMORY_AUTHORITY_PUBLIC_EXPORTS,
    'MEMORY_AUTHORITY_PUBLIC_EXPORTS');
  assert(MEMORY_AUTHORITY_PUBLIC_EXPORTS.length === 5,
    'authority namespace must contain one class and four host operations');
  assertUniqueStrings(MEMORY_AUTHORITY_ERROR_CODES,
    'MEMORY_AUTHORITY_ERROR_CODES');
  assertUniqueStrings(AUTHORITY_PREFLIGHT_OUTCOMES,
    'AUTHORITY_PREFLIGHT_OUTCOMES');
  assertUniqueStrings(AUTHORITY_USE_OUTCOMES, 'AUTHORITY_USE_OUTCOMES');
  assertUniqueStrings(ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES,
    'ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES');
  assertUniqueStrings(FINAL_REASONS, 'FINAL_REASONS');
  assertUniqueStrings(MAP_ALLOWLIST, 'MAP_ALLOWLIST');
  assertUniqueStrings(ERASURE_IDS, 'ERASURE_IDS');
  assertUniqueStrings(TERMINAL_STORAGE_IDS, 'TERMINAL_STORAGE_IDS');
  assert(PRODUCTION_FIXTURE_CROSSCHECK.required === true,
    'certified A2 fixture correlation crosscheck must be required');
  assert(sameData(AUTHORITY_PREFLIGHT_OUTCOMES, [
    'absent',
    'authority_grant_invalid',
    'authority_grant_unavailable',
    'authority_grant_expired',
    'authority_scope_mismatch',
    'ready',
  ]), 'authority preflight outcomes differ from the exact mutation-use set');
  assert(sameData(AUTHORITY_USE_OUTCOMES, [
    'legacy_store_closed',
    'authority_root_revoked',
    'authority_scope_mismatch',
    'authority_grant_expired',
    'authority_grant_unavailable',
    'authority_grant_mismatch',
    'authority_ledger_unavailable',
    'authority_ledger_protocol',
    'authority_clock_invalid',
    'valid',
  ]), 'authority use outcomes differ from the exact post-capture set');
  assert(sameData(ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES, [
      'authority_invalid_argument',
      'authority_root_invalid',
      'authority_root_unbound',
      'authority_root_busy',
    ]), 'host-only authority error set differs from the exact exclusion');
  assert(arrayEvery(ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES, (code) =>
    arrayIncludes(MEMORY_AUTHORITY_ERROR_CODES, code)),
  'every host-only authority code must remain in the public error vocabulary');
  assert(arrayEvery(ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES, (code) =>
    !arrayIncludes(AUTHORITY_PREFLIGHT_OUTCOMES, code) &&
      !arrayIncludes(AUTHORITY_USE_OUTCOMES, code)),
  'host-only authority errors must be unreachable from D calls');
  const stagedMutationAuthorityCodes = createSet(arrayFilter(
    concatenateArrays(AUTHORITY_PREFLIGHT_OUTCOMES, AUTHORITY_USE_OUTCOMES),
    (outcome) => objectHasOwn(MEMORY_AUTHORITY_ERRORS, outcome),
  ));
  assert(arrayEvery(MEMORY_AUTHORITY_ERROR_CODES, (code) =>
    setHas(stagedMutationAuthorityCodes, code) !==
      arrayIncludes(ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES, code)),
  'every public authority error must be exactly D-reachable or host-only');
  assert(sameData(AUTHORITY_ACTION_COUNTS, {
    preflightReturn: 1,
    preflightThrow: 4,
    preflightContinue: 1,
    useThrow: 9,
    useContinue: 1,
  }), 'staged authority action counts differ from the exact phase domains');
  assert(AUTHORITY_ACTION_COUNTS.preflightReturn +
    AUTHORITY_ACTION_COUNTS.preflightThrow +
    AUTHORITY_ACTION_COUNTS.preflightContinue ===
      AUTHORITY_PREFLIGHT_OUTCOMES.length,
  'preflight authority action counts must cover the exact outcome set');
  assert(AUTHORITY_ACTION_COUNTS.useThrow +
    AUTHORITY_ACTION_COUNTS.useContinue === AUTHORITY_USE_OUTCOMES.length,
  'use-time authority action counts must cover the exact outcome set');
  assert(evaluateErasureAuthorityPreflight({
    authorityPreflightOutcome: 'ready',
  }) === null, 'ready must be the sole preflight continuation');
  assert(evaluateErasureAuthorityUse({
    authorityUseOutcome: 'valid',
  }) === null, 'valid must be the sole use-time continuation');
  assert(setSize(createSet(arrayMap(rows, (row) => row.phase))) === PHASES.length,
    'every closed phase must be used');
  assert(setSize(createSet(arrayMap(rows, (row) => row.rule))) ===
    RULE_VOCABULARY.length,
    'every closed rule must be used');

  for (const entry of safeArrayIterable(objectEntries(SETS))) {
    const name = entry[0];
    const values = entry[1];
    assertUniqueStrings(values, 'SETS.' + name);
    for (const value of safeArrayIterable(values)) {
      assert(value !== stringFromCharCode(42), 'SETS.' + name + ' has wildcard');
      assert(!stringStartsWith(value, '@'),
        'SETS.' + name + ' nests a set reference');
    }
  }

  const ids = createSet(arrayMap(rows, (row) => row.id));
  const byId = createMap(arrayMap(rows, (row) => [row.id, row]));
  const domains = arrayMap(dimensionOrder, () => createSet());
  for (const row of safeArrayIterable(rows)) {
    assert(arrayIncludes(PHASES, row.phase), row.id + ' has unknown phase');
    assert(arrayIncludes(RULE_VOCABULARY, row.rule),
      row.id + ' has unknown rule');
    assert(arrayIsArray(row.v) && row.v.length === 22,
      row.id + ' must have exactly 22 cells');
    assert(arrayIsArray(row.next), row.id + ' next must be an array');
    assert(setSize(createSet(row.next)) === row.next.length,
      row.id + ' has duplicate next references');
    for (const nextId of safeArrayIterable(row.next)) {
      assert(setHas(ids, nextId), row.id + ' has unknown next id ' + nextId);
      assert(nextId !== row.id, row.id + ' has a self next reference');
    }
    assert(arrayIsArray(row.continueOutcomes),
      row.id + ' continueOutcomes must be an array');
    assert(setSize(createSet(row.continueOutcomes)) ===
      row.continueOutcomes.length,
      row.id + ' has duplicate continue outcomes');
    assert(arrayEvery(row.continueOutcomes, (value) =>
      typeof value === 'string' && value.length > 0),
    row.id + ' has invalid continue outcome');
    assert((row.next.length === 0) === (row.continueOutcomes.length === 0),
      row.id + ' next/continue shape is inconsistent');

    arrayForEach(row.v, (cell, index) => {
      const expanded = expandCell(cell, row.id + '.' + dimensionOrder[index]);
      for (const symbol of safeArrayIterable(expanded)) {
        setAdd(domains[index], symbol);
      }
    });
  }
  assert(arrayEvery(domains, (domain) => setSize(domain) > 0),
    'every ordered dimension must have a finite nonempty global domain');

  const terminalRows = arrayFilter(rows, (row) => row.next.length === 0);
  assert(terminalRows.length === 32,
    'registry must contain exactly 32 terminal leaf rows');
  let terminalPairCount = 0;
  for (let leftIndex = 0; leftIndex < terminalRows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1;
      rightIndex < terminalRows.length;
      rightIndex += 1) {
      terminalPairCount += 1;
      const left = terminalRows[leftIndex];
      const right = terminalRows[rightIndex];
      const overlaps = arrayEvery(dimensionOrder, (dimension, index) => {
        const leftValues = createSet(expandCell(
          left.v[index],
          left.id + '.' + dimension,
        ));
        return arraySome(expandCell(
          right.v[index],
          right.id + '.' + dimension,
        ), (value) => setHas(leftValues, value));
      });
      assert(!overlaps,
        left.id + ' and ' + right.id + ' overlap as terminal leaves');
    }
  }
  assert(terminalPairCount === 496,
    'terminal leaf pair matrix must contain exactly 496 comparisons');

  // The route-entry map is exact, route-compatible, fully reachable, and
  // acyclic. This closes the prior gap where 26 registered rows had no path.
  assert(sameData(objectKeys(ROUTE_ENTRY_ROWS), SETS.PUBLIC_MUTATION_ROUTES),
  'route-entry keys must equal the exact public route vocabulary');
  assert(sameData(objectKeys(ROUTE_TRANSITIONS), SETS.PUBLIC_MUTATION_ROUTES),
  'route-transition keys must equal the exact public route vocabulary');
  assert(sameData(mapGet(byId, 'PRE-03').next, ALL_ROUTE_ENTRY_ROWS),
  'PRE-03 must name every exact route entry row');
  const entryIds = [];
  for (const routeKind of safeArrayIterable(SETS.PUBLIC_MUTATION_ROUTES)) {
    const entries = ROUTE_ENTRY_ROWS[routeKind];
    assertUniqueStrings(entries, 'ROUTE_ENTRY_ROWS.' + routeKind);
    assertUniqueStrings(ROUTE_TRANSITIONS[routeKind],
      'ROUTE_TRANSITIONS.' + routeKind);
    for (const entryId of safeArrayIterable(entries)) {
      assert(setHas(ids, entryId), routeKind + ' has unknown entry ' + entryId);
      arrayPush(entryIds, entryId);
      const entryRoutes = expandCell(mapGet(byId, entryId).v[0],
        entryId + '.route_kind');
      assert(sameData(entryRoutes, [routeKind]),
        entryId + ' is not an exact entry for ' + routeKind);
    }
  }
  assert(setSize(createSet(entryIds)) === entryIds.length,
    'a route-entry row may belong to only one route');

  for (const row of safeArrayIterable(rows)) {
    if (stringStartsWith(row.id, 'PRE-')) continue;
    const sourceRoutes = expandCell(row.v[0], row.id + '.route_kind');
    for (const nextId of safeArrayIterable(row.next)) {
      const targetRoutes = expandCell(mapGet(byId, nextId).v[0],
        nextId + '.route_kind');
      const compatible = arraySome(sourceRoutes, (sourceRoute) =>
        arrayEvery(targetRoutes, (targetRoute) =>
          arrayIncludes(ROUTE_TRANSITIONS[sourceRoute], targetRoute)));
      assert(compatible, row.id + ' -> ' + nextId + ' crosses an invalid route');
    }
  }

  const colors = createMap();
  function visit(id) {
    const color = mapGet(colors, id) ?? 0;
    assert(color !== 1, 'obligation graph contains a cycle at ' + id);
    if (color === 2) return;
    mapSet(colors, id, 1);
    for (const nextId of safeArrayIterable(mapGet(byId, id).next)) visit(nextId);
    mapSet(colors, id, 2);
  }
  for (const id of safeArrayIterable(EXPECTED_IDS)) visit(id);

  const reachable = createSet();
  const pending = ['PRE-01'];
  while (pending.length > 0) {
    const id = arrayPop(pending);
    if (setHas(reachable, id)) continue;
    setAdd(reachable, id);
    arrayPushAll(pending, mapGet(byId, id).next);
  }
  assert(setSize(reachable) === EXPECTED_IDS.length,
    'every obligation row must be reachable from PRE-01');
  assert(arrayEvery(EXPECTED_IDS, (id) => setHas(reachable, id)),
    'the reachable obligation set differs from the exact inventory');

  const expectedStaticIds = arrayFilter(EXPECTED_IDS,
    (id) => !stringStartsWith(id, 'D-'));
  assert(sameData(objectKeys(STATIC_REASON_BY_ID), expectedStaticIds),
  'static reason map must cover every and only non-D row in inventory order');
  for (const reason of safeArrayIterable(objectValues(STATIC_REASON_BY_ID))) {
    assert(arrayIncludes(FINAL_REASONS, reason),
      'static reason is outside closed enum');
  }

  for (const row of safeArrayIterable(rows)) {
    if (arrayIncludes(ERASURE_IDS, row.id) ||
        arrayIncludes(TERMINAL_STORAGE_IDS, row.id)) {
      continue;
    }
    const closedOutcomes = createSet(concatenateArrays(
      row.continueOutcomes,
      expandCell(row.v[18], row.id + '.legacy_outcome'),
    ));
    assert(setSize(closedOutcomes) > 0,
      row.id + ' must have a nonempty closed compatibility outcome domain');
    for (const invalidOutcome of safeArrayIterable([
      undefined,
      '__unknown_compatibility__',
    ])) {
      let rejected = false;
      try {
        evaluateFinal(row.id, {compatibilityOutcome: invalidOutcome});
      } catch (error) {
        rejected = isNativeError(error) &&
          error.message === 'unknown compatibility outcome';
      }
      assert(rejected,
        row.id + ' accepted a present non-domain compatibility outcome');
    }
  }

  assert(sameData(MAP_ALLOWLIST, ['D-02', 'D-03']),
    'only D-02 and D-03 may map');
  assert(arrayFind(rows, (row) => row.id === 'PD-02').rule ===
    'STOP_DEMOTION_UNSEALED', 'PD-02 must refuse as unsealed demotion');
  assert(arrayFind(rows, (row) => row.id === 'PD-03').rule ===
    'STOP_LEGACY_DESTRUCTIVE_OPERATION',
  'PD-03 must refuse legacy destructive demotion');

  const cleanPermanent = objectFreeze({
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
  });
  const cleanTransient = objectFreeze({
    ...cleanPermanent,
    legacyType: 'working',
  });

  const mapProducingIds = arrayMap(arrayFilter(rows, (row) => {
      let result;
      if (row.id === 'D-01') result = evaluateFinal(row.id, cleanPermanent);
      else if (row.id === 'D-02') result = evaluateFinal(row.id, cleanPermanent);
      else if (row.id === 'D-03') result = evaluateFinal(row.id, cleanTransient);
      else result = evaluateFinal(row.id, {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
      });
      return result.disposition === 'MAP';
    }), (row) => row.id);
  assert(sameData(mapProducingIds, MAP_ALLOWLIST),
    'evaluator MAP surface differs from exact allowlist');
  assert(evaluateFinal('PD-02', {
    authorityPreflightOutcome: 'not_applicable',
    authorityUseOutcome: 'not_applicable',
  }).disposition === 'REFUSE', 'PD-02 evaluator must refuse');

  // Exhaust every retained target scope, shared-bit-consistent class, link
  // class, and validity class for both mapped row ids.
  let erasureMatrixCaseCount = 0;
  for (const erasureCase of safeArrayIterable([
    ['D-02', cleanPermanent, SETS.PERMANENT_TYPES],
    ['D-03', cleanTransient, SETS.TRANSIENT_TYPES],
  ])) {
    const rowId = erasureCase[0];
    const base = erasureCase[1];
    const legacyTypes = erasureCase[2];
    for (const legacyType of safeArrayIterable(legacyTypes)) {
      for (const actorClass of safeArrayIterable(SETS.VALID_ACTORS)) {
        for (const scopeClass of safeArrayIterable(SETS.TARGET_SCOPE_CLASSES)) {
          let sharedFlags = ['shared_0', 'shared_1'];
          if (stringEndsWith(scopeClass, '_private')) sharedFlags = ['shared_0'];
          if (stringEndsWith(scopeClass, '_shared')) sharedFlags = ['shared_1'];
          for (const sharedFlag of safeArrayIterable(sharedFlags)) {
            for (const incidentLinkCount of safeArrayIterable([0, 1])) {
              for (const validityClass of safeArrayIterable(
                TARGET_VALIDITY_CLASSES,
              )) {
                const draft = {
                  ...base,
                  actorClass,
                  legacyType,
                  scopeClass,
                  sharedFlag,
                  incidentLinkCount,
                  validityClass,
                };
                draft.targetBranch = deriveEraseTargetClass(draft);
                erasureMatrixCaseCount += 1;
                const result = evaluateFinal(rowId, draft);
                const cleanMap =
                  scopeClass === 'same_palari_same_user_private' &&
                  sharedFlag === 'shared_0' && incidentLinkCount === 0;
                assert(result.disposition === (cleanMap ? 'MAP' : 'REFUSE'),
                  rowId + ' target matrix has the wrong disposition');
                if (!cleanMap) {
                  let expectedReason = 'scope_mismatch';
                  if (scopeClass === 'same_palari_same_user_shared') {
                    expectedReason = 'shared_scope_unsealed';
                  } else if (scopeClass ===
                    'same_palari_same_user_private') {
                    expectedReason = 'incident_edges_unemittable';
                  }
                  assert(result.reason === expectedReason,
                    rowId + ' target matrix has the wrong refusal reason');
                }
              }
            }
          }
        }
      }
    }
  }

  const missingTargetResult = evaluateFinal('D-01', {
    ...cleanPermanent,
    targetExists: false,
  });
  assert(missingTargetResult.reason === 'missing_target' &&
    missingTargetResult.recordingMode === 'decision_only',
  'valid normalized absent-target erasure must journal only the decision');
  assert(sameData(evaluateFinal('D-01', cleanPermanent).next, ['D-02']),
    'permanent D-01 must continue only to D-02');
  assert(sameData(evaluateFinal('D-01', cleanTransient).next, ['D-03']),
    'transient D-01 must continue only to D-03');

  // Authority is staged exactly as the mutation-use path: preflight first,
  // then capture or exact retained-value rethrow, then post-capture
  // local/activity/time checks.
  let stagedAuthorityCaseCount = 0;
  let absentLaterObservationCount = 0;
  const absentInput = {authorityPreflightOutcome: 'absent'};
  for (const key of safeArrayIterable([
    'compatibilityOutcome',
    'syntaxValid',
    'authorityUseOutcome',
    'projectionVerified',
  ])) {
    reflectDefineProperty(absentInput, key, {
      get() {
        absentLaterObservationCount += 1;
        throw new nativeError('later erasure phase was observed');
      },
    });
  }
  for (const rowId of safeArrayIterable(ERASURE_IDS)) {
    const result = evaluateFinal(rowId, absentInput);
    stagedAuthorityCaseCount += 1;
    assert(result.action === 'RETURN' && result.disposition === 'REFUSE' &&
      result.reason === 'authority_required' &&
      result.publicResultShape ===
        '{deleted:false,reason:"governance_refused"}' &&
      result.recordingMode === 'pre_gate_no_journal',
    rowId + ' absent authority must return the exact route refusal shape');
  }
  assert(absentLaterObservationCount === 0,
    'absent authority must inspect no capture, use, or projection field');

  const preflightErrorCodes = arrayFilter(AUTHORITY_PREFLIGHT_OUTCOMES,
    (outcome) => outcome !== 'absent' && outcome !== 'ready');
  assert(sameData(preflightErrorCodes, [
    'authority_grant_invalid',
    'authority_grant_unavailable',
    'authority_grant_expired',
    'authority_scope_mismatch',
  ]), 'preflight throw set differs from the exact mutation-use errors');
  for (const code of safeArrayIterable(preflightErrorCodes)) {
    for (const rowId of safeArrayIterable(ERASURE_IDS)) {
      const result = evaluateFinal(rowId, {
        compatibilityOutcome: 'target_present',
        syntaxValid: false,
        authorityPreflightOutcome: code,
        authorityUseOutcome: 'valid',
        projectionVerified: false,
      });
      stagedAuthorityCaseCount += 1;
      assert(result.action === 'THROW' && result.disposition === 'REFUSE' &&
        result.errorName === 'MemoryAuthorityError' &&
        result.errorCode === code &&
        result.errorMessage === MEMORY_AUTHORITY_ERRORS[code] &&
        result.recordingMode === 'pre_gate_no_journal',
      rowId + ' ' + code +
        ' must throw unchanged before capture or any later authority phase');
    }
  }

  // A use-time result cannot exist until capture succeeded. Supplying any
  // closed later-phase symbol alongside a failed capture must still stop at
  // the capture rethrow and must never turn a later callback/clock result into an
  // earlier throw.
  for (const useOutcome of safeArrayIterable(AUTHORITY_USE_OUTCOMES)) {
    for (const rowId of safeArrayIterable(ERASURE_IDS)) {
      const result = evaluateFinal(rowId, {
        compatibilityOutcome: 'target_present',
        syntaxValid: false,
        authorityPreflightOutcome: 'ready',
        authorityUseOutcome: useOutcome,
        projectionVerified: false,
      });
      stagedAuthorityCaseCount += 1;
      assert(result.action === 'RETHROW' && result.disposition === 'REFUSE' &&
        result.reason === 'capture_failed' &&
        result.preserveCapturedErrorByIdentity === true &&
        result.recordingMode === 'pre_gate_no_journal',
      rowId + ' failed capture must precede use outcome ' + useOutcome);
    }
  }
  let invalidSyntaxUseObservationCount = 0;
  const invalidSyntaxInput = {
    authorityPreflightOutcome: 'ready',
    syntaxValid: false,
  };
  reflectDefineProperty(invalidSyntaxInput, 'authorityUseOutcome', {
    get() {
      invalidSyntaxUseObservationCount += 1;
      throw new nativeError('use-time outcome was observed before successful capture');
    },
  });
  for (const rowId of safeArrayIterable(ERASURE_IDS)) {
    const result = evaluateFinal(rowId, invalidSyntaxInput);
    assert(result.action === 'RETHROW' && result.reason === 'capture_failed' &&
      result.preserveCapturedErrorByIdentity === true,
    rowId + ' failed capture must rethrow before use-time observation');
  }
  assert(invalidSyntaxUseObservationCount === 0,
    'failed capture must not inspect a use-time authority outcome');

  const useThrowOutcomes = arrayFilter(AUTHORITY_USE_OUTCOMES,
    (outcome) => outcome !== 'valid');
  for (const outcome of safeArrayIterable(useThrowOutcomes)) {
    for (const rowId of safeArrayIterable(ERASURE_IDS)) {
      const result = evaluateFinal(rowId, {
        compatibilityOutcome: 'target_present',
        syntaxValid: true,
        authorityPreflightOutcome: 'ready',
        authorityUseOutcome: outcome,
        projectionVerified: false,
      });
      stagedAuthorityCaseCount += 1;
      assert(result.action === 'THROW' && result.disposition === 'REFUSE' &&
        result.recordingMode === 'pre_gate_no_journal',
      rowId + ' use-time outcome ' + outcome + ' must throw before projection');
      if (outcome === 'legacy_store_closed') {
        assert(result.errorName === 'LegacyMutationError' &&
          result.errorCode === 'legacy_store_closed' &&
          result.errorMessage === 'The memory store is closed.',
        rowId + ' post-capture close must preserve the exact legacy error');
      } else {
        assert(result.errorName === 'MemoryAuthorityError' &&
          result.errorCode === outcome &&
          result.errorMessage === MEMORY_AUTHORITY_ERRORS[outcome],
        rowId + ' post-capture authority error must be preserved exactly');
      }
    }
  }

  const overlappingPhaseCodes = arrayFilter(preflightErrorCodes, (code) =>
    arrayIncludes(AUTHORITY_USE_OUTCOMES, code));
  assert(sameData(overlappingPhaseCodes, [
    'authority_grant_unavailable',
    'authority_grant_expired',
    'authority_scope_mismatch',
  ]), 'the exact repeated preflight/use error set must stay phase-explicit');

  // Closed phase domains reject misplaced and host-only outcomes. These are
  // contract defects, not governed refusals.
  for (const outcome of safeArrayIterable(concatenateArrays([
    'legacy_store_closed', 'authority_root_revoked',
    'authority_grant_mismatch', 'authority_ledger_unavailable',
    'authority_ledger_protocol', 'authority_clock_invalid', 'valid',
  ], ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES))) {
    let rejected = false;
    try {
      evaluateFinal('D-02', {authorityPreflightOutcome: outcome});
    } catch (error) {
      rejected = isNativeError(error) &&
        error.message === 'unknown erasure authority preflight outcome';
    }
    assert(rejected, outcome + ' must be rejected as a preflight outcome');
  }
  for (const outcome of safeArrayIterable(concatenateArrays([
    'absent', 'ready', 'authority_grant_invalid',
  ], ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES))) {
    let rejected = false;
    try {
      evaluateFinal('D-02', {
        syntaxValid: true,
        authorityPreflightOutcome: 'ready',
        authorityUseOutcome: outcome,
      });
    } catch (error) {
      rejected = isNativeError(error) &&
        error.message === 'unknown erasure authority use outcome';
    }
    assert(rejected, outcome + ' must be rejected as a use-time outcome');
  }

  // Generic compatibility continuation must never bypass the D evaluator.
  const absentWithContinue = evaluateFinal('D-01', absentInput);
  assert(absentWithContinue.action === 'RETURN' &&
    absentWithContinue.reason === 'authority_required',
  'D-01 target_present must not bypass absent-authority return');
  const invalidSyntaxWithContinue = evaluateFinal('D-01', {
    ...cleanPermanent,
    compatibilityOutcome: 'target_present',
    syntaxValid: false,
  });
  assert(invalidSyntaxWithContinue.action === 'RETHROW' &&
    invalidSyntaxWithContinue.reason === 'capture_failed' &&
    invalidSyntaxWithContinue.preserveCapturedErrorByIdentity === true,
  'D-01 target_present must not bypass capture-error preservation');

  for (const phaseInput of safeArrayIterable([
    {authorityPreflightOutcome: 'not_applicable'},
    {
      syntaxValid: true,
      authorityPreflightOutcome: 'ready',
      authorityUseOutcome: 'not_applicable',
    },
  ])) {
    let notApplicableThrew = false;
    try {
      evaluateFinal('D-02', phaseInput);
    } catch (error) {
      notApplicableThrew = isNativeError(error) && stringStartsWith(
        error.message,
        'erasure requires an applicable authority',
      );
    }
    assert(notApplicableThrew,
      'not_applicable must be rejected in either D authority phase');
  }
  for (const missingCase of safeArrayIterable([
    [{}, 'unknown erasure authority preflight outcome'],
    [{
      syntaxValid: true,
      authorityPreflightOutcome: 'ready',
    }, 'unknown erasure authority use outcome'],
  ])) {
    const input = missingCase[0];
    const expectedMessage = missingCase[1];
    let missingPhaseThrew = false;
    try {
      evaluateFinal('D-02', input);
    } catch (error) {
      missingPhaseThrew = isNativeError(error) &&
        error.message === expectedMessage;
    }
    assert(missingPhaseThrew,
      'a reached authority phase requires one exact closed outcome');
  }

  let emptyIdThrew = false;
  try {
    evaluateFinal('D-01', {
      ...cleanPermanent,
      idClass: 'target_id_empty',
      targetExists: false,
    });
  } catch (error) {
    emptyIdThrew = isNativeError(error) &&
      stringIncludes(error.message, 'normalized target id');
  }
  assert(emptyIdThrew,
    'empty/missing target ids cannot become valid missing-target decisions');

  for (const corruptCase of safeArrayIterable([
    ['D-01', {
      ...cleanPermanent,
      targetExists: false,
      projectionVerified: false,
    }],
    ['D-02', {
      ...cleanPermanent,
      projectionVerified: false,
      scopeClass: 'same_palari_cross_user_private',
      targetBranch: 'target_cross_user_zero_links',
    }],
    ['D-03', {
      ...cleanTransient,
      projectionVerified: false,
      incidentLinkCount: 1,
      targetBranch: 'target_private_same_scope_with_links',
    }],
  ])) {
    const rowId = corruptCase[0];
    const corrupt = corruptCase[1];
    let projectionThrew = false;
    try {
      evaluateFinal(rowId, corrupt);
    } catch (error) {
      projectionThrew = isNativeError(error) &&
        stringStartsWith(error.message, 'internal projection mismatch');
    }
    assert(projectionThrew,
      'projection corruption must throw before every target classifier reason');
  }

  const terminal = evaluateTerminalStorageGroup();
  assert(terminal.action === 'THROW' && terminal.disposition === 'REFUSE' &&
    terminal.errorName === 'LegacyMutationError' &&
    terminal.errorCode === 'legacy_terminal_storage_refused' &&
    sameData(terminal.coveredObligationIds, TERMINAL_STORAGE_IDS),
  'terminal storage must use one route-level three-obligation refusal');
  let terminalObservationCount = 0;
  const hostileTerminalInput = new nativeProxy({}, {
    get() { terminalObservationCount += 1; throw new nativeError('observed get'); },
    ownKeys() { terminalObservationCount += 1; throw new nativeError('observed keys'); },
  });
  evaluateTerminalStorageGroup(hostileTerminalInput);
  assert(terminalObservationCount === 0,
    'terminal storage group evaluator must inspect no caller/path input');
  assert(evaluateRouteEntry('legacy_delete_kernel_store_file').errorCode ===
    'legacy_terminal_storage_refused',
  'terminal route entry must refuse before branch selection');
  for (const id of safeArrayIterable(TERMINAL_STORAGE_IDS)) {
    const result = evaluateFinal(id, hostileTerminalInput);
    assert(result.errorCode === 'legacy_terminal_storage_refused' &&
      sameData(result.coveredObligationIds, TERMINAL_STORAGE_IDS),
    id + ' must collapse to the same unobserved terminal group');
  }

  for (const routeKind of safeArrayIterable(SETS.PUBLIC_MUTATION_ROUTES)) {
    const result = evaluateRouteEntry(routeKind);
    if (routeKind === 'legacy_delete_kernel_store_file') {
      assert(result.errorCode === 'legacy_terminal_storage_refused',
        'terminal route must return the terminal group action');
    } else {
      assert(sameData(result.next, ROUTE_ENTRY_ROWS[routeKind]),
      routeKind + ' must expose only its exact first branches');
    }
  }
  assert(sameData(evaluateFinal('PRE-03', {
    authorityPreflightOutcome: 'not_applicable',
    authorityUseOutcome: 'not_applicable',
    compatibilityOutcome: 'captured_intent',
    routeKind: 'legacy_extraction_pass',
  }).next, ['E-01', 'E-02', 'E-03', 'E-04', 'E-05']),
  'PRE-03 must dispatch to the exact captured route entries');
  assert(stagedAuthorityCaseCount === 72,
    'staged authority action matrix must contain exactly 72 cases');

  return objectFreeze({
    obligationCount: rows.length,
    dimensionCount: dimensionOrder.length,
    reachableObligationCount: setSize(reachable),
    authorityErrorCount: MEMORY_AUTHORITY_ERROR_CODES.length,
    authorityPreflightOutcomeCount: AUTHORITY_PREFLIGHT_OUTCOMES.length,
    authorityUseOutcomeCount: AUTHORITY_USE_OUTCOMES.length,
    authorityActionCounts: AUTHORITY_ACTION_COUNTS,
    stagedAuthorityCaseCount,
    erasureMatrixCaseCount,
    mapAllowlist: MAP_ALLOWLIST,
    terminalStorageGroup: TERMINAL_STORAGE_IDS,
    fixtureCrosscheckRequired: PRODUCTION_FIXTURE_CROSSCHECK.required,
    globalDomainSizes: objectFreeze(arrayMap(domains, (domain) => setSize(domain))),
  });
}

validateRegistry();

function cloneFrozenData(value) {
  if (arrayIsArray(value)) {
    return objectFreeze(arrayMap(value, (entry) => cloneFrozenData(entry)));
  }
  if (value === null || typeof value !== 'object') return value;

  const clone = objectCreate(null);
  for (const key of safeArrayIterable(reflectOwnKeys(value))) {
    const descriptor = reflectGetOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string' ||
      descriptor === undefined ||
      !objectHasOwn(descriptor, 'value')
    ) {
      throw new nativeError('registry data must contain only own string data properties');
    }
    reflectDefineProperty(clone, key, {
      configurable: false,
      enumerable: descriptor.enumerable,
      value: cloneFrozenData(descriptor.value),
      writable: false,
    });
  }
  return objectFreeze(clone);
}

export const GOVERNED_MUTATION_DISPOSITION_VERSION =
  'CDX-M1-legacy-disposition@5';

export const governedMutationDispositionRegistry = cloneFrozenData(REGISTRY);

export function evaluateGovernedMutationDisposition(obligationId, input) {
  return cloneFrozenData(evaluateFinal(obligationId, input));
}

export function verifyGovernedMutationDispositionRegistry() {
  return cloneFrozenData(validateRegistry());
}
