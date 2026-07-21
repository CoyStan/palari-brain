# Governed Mutation Disposition Registry — Palari v2 M2-B

**Status:** normative for the M2-B compatibility-disposition surface. This
artifact narrows the governed mutation bridge contract; it does not widen the
canonical patch registry. If prose and this registry disagree about an A2
branch, this registry governs the branch disposition. Higher-precedence
Unified Specification and kernel law still govern.

The JavaScript artifact below is the complete closed registry. A scalar cell
is one symbolic value, an array cell is a finite coordinate projection, and a
string beginning with `@` is an exact reference to a named finite set.
`not_applicable` is a real symbolic value. There are no implicit values and no
wildcard matching. An unknown value, unknown set reference, omitted dimension,
or duplicate row is invalid rather than extensible.

The values projected by two different cells are **never** an implied Cartesian
product. The certified A2 fixture matrix owns the historical correlations
among target branch, legacy outcome, explicit effects, and implicit SQLite
consequences. M2-B production MUST cross-check that fixture matrix against all
46 coordinate projections. Every non-`D-*` row has one static M2-B disposition
before semantic CDX DML, so its projected A2 correlations are retained only as
provenance obligations; they are not executable mutation choices. D-01/D-02/
D-03 additionally use the exact relational derivation and terminal evaluator
below, because those are the only rows with a potentially mapped leaf.

The 22 positions in every `v` array correspond exactly, in order, to the A2
obligation dimensions. `next` records the narrower A2 branch rows reachable
from the current compatibility branch; `continueOutcomes` records the exact
compatibility control outcomes that permit such descent. Those links do not
grant governance authority.

The companion authority namespace is read as exactly five public exports: one
`MemoryAuthorityError` class plus four host operations. “Four host operations”
must never be shortened to “four names.”

Erasure authority is not one flat caller-supplied state. The evaluator records
the exact mutation chronology as separate preflight and post-capture/use-time
domains, with compatibility capture between them. A later-phase outcome is
never allowed to outrank or stand in for a phase that was not reached.

```js
'use strict';

const N = 'not_applicable';

const dimensionOrder = Object.freeze([
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

const SETS = Object.freeze({
  PUBLIC_MUTATION_ROUTES: Object.freeze([
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
  INVALID_KIND_CLASSES: Object.freeze([
    'kind_missing',
    'kind_unknown',
    'kind_prototype_collision',
  ]),
  KNOWN_KIND_OP_CLASSES: Object.freeze([
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
  PROMOTE_PERMANENT_OPS: Object.freeze([
    'promote_add',
    'promote_supersede',
    'permanent_add',
    'permanent_supersede',
  ]),
  ADD_OPS: Object.freeze(['promote_add', 'permanent_add']),
  SUPERSEDE_OPS: Object.freeze([
    'promote_supersede',
    'permanent_supersede',
  ]),
  DEMOTE_OPS: Object.freeze([
    'demote_end_validity',
    'demote_delete_transient',
  ]),
  LEGACY_TYPES: Object.freeze([
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
  PERMANENT_TYPES: Object.freeze([
    'relationship',
    'preference',
    'opinion',
    'entity',
    'life_event',
  ]),
  TRANSIENT_TYPES: Object.freeze([
    'working',
    'project',
    'recent_life',
    'session_summary',
  ]),
  TYPE_ADMISSION_CLASSES: Object.freeze([
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
  VALID_ACTORS: Object.freeze([
    'actor_explicit_user',
    'actor_background_extraction',
    'actor_session_summary',
    'actor_lifecycle_job',
  ]),
  ACTOR_CLASSES: Object.freeze([
    'actor_explicit_user',
    'actor_background_extraction',
    'actor_session_summary',
    'actor_lifecycle_job',
    'actor_missing',
    'actor_null_fallback',
    'actor_empty_invalid',
    'actor_unknown_invalid',
  ]),
  VALID_WRITERS: Object.freeze([
    'writer_explicit_user',
    'writer_background_extraction',
    'writer_session_summary',
  ]),
  WRITER_CLASSES: Object.freeze([
    'writer_explicit_user',
    'writer_background_extraction',
    'writer_session_summary',
    'writer_missing',
    'writer_invalid',
  ]),
  PROPOSAL_PRODUCERS: Object.freeze([
    'explicit_proposal',
    'extraction_candidate',
  ]),
  SOURCE_CLASSES: Object.freeze([
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
  VALID_SOURCE_CLASSES: Object.freeze([
    'user_direct',
    'user_told',
    'external_extracted',
    'summary_summarized',
  ]),
  VALID_EXTRACTION_SOURCE_CLASSES: Object.freeze(['external_extracted']),
  EXTRACTION_SKIP_SOURCE_CLASSES: Object.freeze([
    'extraction_disabled',
    'extractor_missing',
    'pipeline_event_missing',
    'extractor_id_missing',
    'extractor_error',
    'extractor_payload_invalid',
  ]),
  SUMMARY_SKIP_SOURCE_CLASSES: Object.freeze([
    'summary_source_missing',
    'summary_disabled',
    'summary_text_missing',
    'summary_event_missing',
  ]),
  SCOPE_CLASSES: Object.freeze([
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
  TARGET_SCOPE_CLASSES: Object.freeze([
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
  TOPIC_VISIBLE_SCOPE_CLASSES: Object.freeze([
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
  DECORATION_CLASSES: Object.freeze([
    'add_source_absent_keywords_plain',
    'add_record_source_keywords_plain',
    'add_provenance_source_keywords_plain',
    'add_source_absent_keywords_decorated',
    'add_record_source_keywords_decorated',
    'add_provenance_source_keywords_decorated',
    'supersede_source_absent_keywords_plain',
    'supersede_record_source_keywords_plain',
  ]),
  SHARED_CLASSES: Object.freeze(['shared_0', 'shared_1', 'shared_invalid']),
  PROPOSAL_ID_CLASSES: Object.freeze([
    'proposed_id_absent',
    'proposed_id_empty',
    'proposed_id_caller',
    'generated_id',
  ]),
  TARGET_ID_CLASSES: Object.freeze([
    'target_id_missing',
    'target_id_empty',
    'normalized_target_id',
  ]),
  MISSING_TARGET_ID_CLASSES: Object.freeze([
    'target_id_missing',
    'target_id_empty',
  ]),
  MISSING_OR_NORMALIZED_TARGET_IDS: Object.freeze([
    'target_id_missing',
    'target_id_empty',
    'normalized_target_id',
  ]),
  TOPIC_QUERY_ID_CLASSES: Object.freeze([
    'query_missing',
    'query_empty',
    'palari_empty',
    'normalized_topic_query',
    'malformed_direct_fts_query',
  ]),
  RECALL_ID_CLASSES: Object.freeze([
    'ids_conversion_throw',
    'normalized_ids_empty',
    'first_occurrence_ids',
  ]),
  HASH_CLASSES: Object.freeze([
    'hash_computed',
    'hash_supplied_matching',
    'hash_supplied_mismatching',
    'hash_invalid_type',
  ]),
  CAPTURE_CLASSES: Object.freeze([
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
  ADMISSION_CAPTURE_CLASSES: Object.freeze([
    'capture_success',
    'deferred_valid',
    'deferred_empty_content',
    'deferred_invalid_acquisition',
    'deferred_invalid_hash_type',
  ]),
  DUPLICATE_SKIPPED_VALIDATION_CLASSES: Object.freeze([
    'deferred_empty_content',
    'deferred_invalid_acquisition',
    'deferred_invalid_hash_type',
  ]),
  DEFERRED_INVALID_CLASSES: Object.freeze([
    'deferred_empty_content',
    'deferred_invalid_acquisition',
    'deferred_invalid_hash_type',
  ]),
  CAPTURE_OR_APPLY_THROW_CLASSES: Object.freeze([
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
  CONFIDENCE_CLASSES: Object.freeze([
    'confidence_below_floor',
    'confidence_at_floor',
    'confidence_above_floor',
    'confidence_nonfinite',
    'confidence_conversion_throw',
  ]),
  ADMITTED_CONFIDENCE_CLASSES: Object.freeze([
    'confidence_at_floor',
    'confidence_above_floor',
  ]),
  CAPTURE_TIME_CLASSES: Object.freeze([
    'caller_clock_success',
    'caller_clock_throw',
  ]),
  WRITE_TIME_CLASSES: Object.freeze([
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
  DEMOTION_TIME_CLASSES: Object.freeze([
    'event_absent',
    'event_now',
    'event_historical',
    'event_future',
    'event_invalid_type',
    'store_time',
    'native_wall_time',
  ]),
  LIFECYCLE_REFERENCE_TIME_CLASSES: Object.freeze([
    'invalid_reference_time',
    'future_reference_time',
    'valid_reference_time',
  ]),
  HISTORICAL_CLASSES: Object.freeze([
    'historical_fields_absent',
    'access_fields_present',
    'decay_fields_present',
    'source_fields_present',
    'all_historical_fields_present',
  ]),
  ACCESS_COUNT_CLASSES: Object.freeze([
    'access_below_max',
    'access_at_max_safe_integer',
  ]),
  LIFECYCLE_SCOPE_CLASSES: Object.freeze([
    'nonempty_palari_exact_filter',
    'empty_palari_cross_palari_sweep',
  ]),
  DEMOTION_TARGET_CLASSES: Object.freeze([
    'target_private_same_scope_current',
    'target_private_same_scope_ended',
    'target_general_current',
    'target_shared_current',
    'target_cross_user_current',
    'target_cross_palari_current',
  ]),
  ERASE_TARGET_CLASSES: Object.freeze([
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
  TOPIC_MATCH_SET_CLASSES: Object.freeze([
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
const ROUTE_ENTRY_ROWS = Object.freeze({
  legacy_proposal: Object.freeze(['P-01', 'P-02']),
  legacy_delete_memory: Object.freeze(['D-01']),
  legacy_forget_topic: Object.freeze(['T-01']),
  legacy_record_recall_inclusion: Object.freeze(['R-01']),
  legacy_run_lifecycle: Object.freeze(['L-01']),
  legacy_extraction_pass: Object.freeze([
    'E-01', 'E-02', 'E-03', 'E-04', 'E-05',
  ]),
  legacy_summary_pass: Object.freeze(['S-01', 'S-02']),
  legacy_scheduler_turn: Object.freeze(['S-03']),
  legacy_delete_kernel_store_file: Object.freeze(['F-01', 'F-02', 'F-03']),
});

const ROUTE_TRANSITIONS = Object.freeze({
  legacy_proposal: Object.freeze(['legacy_proposal']),
  legacy_delete_memory: Object.freeze(['legacy_delete_memory']),
  legacy_forget_topic: Object.freeze(['legacy_forget_topic']),
  legacy_record_recall_inclusion: Object.freeze([
    'legacy_record_recall_inclusion',
  ]),
  legacy_run_lifecycle: Object.freeze(['legacy_run_lifecycle']),
  legacy_extraction_pass: Object.freeze([
    'legacy_extraction_pass', 'legacy_proposal',
  ]),
  legacy_summary_pass: Object.freeze([
    'legacy_summary_pass', 'legacy_proposal',
  ]),
  legacy_scheduler_turn: Object.freeze(['legacy_scheduler_turn']),
  legacy_delete_kernel_store_file: Object.freeze([
    'legacy_delete_kernel_store_file',
  ]),
});

const ALL_ROUTE_ENTRY_ROWS = Object.freeze(
  SETS.PUBLIC_MUTATION_ROUTES.flatMap((routeKind) =>
    ROUTE_ENTRY_ROWS[routeKind]),
);

const rows = [];

function R(id, phase, next, continueOutcomes, rule, v) {
  rows.push(Object.freeze({
    id,
    phase,
    next: Object.freeze(next),
    continueOutcomes: Object.freeze(continueOutcomes),
    rule,
    v: Object.freeze(v),
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

Object.freeze(rows);

const EXPECTED_IDS = Object.freeze([
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

const PHASES = Object.freeze([
  'pre_route',
  'capture',
  'proposal_admission',
  'proposal_effect',
  'route_effect',
  'producer_result',
  'terminal_storage',
]);

const RULE_VOCABULARY = Object.freeze([
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

const DISPOSITIONS = Object.freeze(['MAP', 'REFUSE']);
const ACTIONS = Object.freeze([
  'CONTINUE',
  'RETURN',
  'RETHROW',
  'THROW',
  'TERMINAL',
]);
const RECORDING_MODES = Object.freeze([
  'pre_gate_no_journal',
  'decision_only',
  'decision_and_effects',
]);
const MEMORY_AUTHORITY_PUBLIC_EXPORTS = Object.freeze([
  'MemoryAuthorityError',
  'createMemoryAuthorityRoot',
  'issueMemoryAuthorityGrant',
  'revokeMemoryAuthorityGrant',
  'revokeMemoryAuthorityRoot',
]);
const MEMORY_AUTHORITY_ERRORS = Object.freeze({
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
const MEMORY_AUTHORITY_ERROR_CODES = Object.freeze(
  Object.keys(MEMORY_AUTHORITY_ERRORS),
);
const AUTHORITY_PREFLIGHT_OUTCOMES = Object.freeze([
  'absent',
  'authority_grant_invalid',
  'authority_grant_unavailable',
  'authority_grant_expired',
  'authority_scope_mismatch',
  'ready',
]);
const AUTHORITY_USE_OUTCOMES = Object.freeze([
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
const ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES = Object.freeze([
  'authority_invalid_argument',
  'authority_root_invalid',
  'authority_root_unbound',
  'authority_root_busy',
]);
const AUTHORITY_ACTION_COUNTS = Object.freeze({
  preflightReturn: 1,
  preflightThrow: 4,
  preflightContinue: 1,
  useThrow: 9,
  useContinue: 1,
});
const FINAL_REASONS = Object.freeze([
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

const AUTHORITY_STAGE_DEFINITIONS = Object.freeze({
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

const PRODUCTION_FIXTURE_CROSSCHECK = Object.freeze({
  required: true,
  sourceCommit: '53e5b0357f83be7700a32458d38922cb7777a66e',
  sourceObligationsBlob: '33d8fa3b89e5348d3e5d624315fcd1c870ed095c',
  sourceRoutingContractBlob:
    'a3ad75dc78644de2329af2feb680aef559068774',
  sourcePlan: 'CDX-M1-legacy-plan@1',
  rule:
    'every certified A2 fixture must match one obligation coordinate projection and its preserved correlated outcome/effect/consequence tuple',
});

const MAP_ALLOWLIST = Object.freeze(['D-02', 'D-03']);
const ERASURE_IDS = Object.freeze(['D-01', 'D-02', 'D-03']);
const TERMINAL_STORAGE_IDS = Object.freeze(['F-01', 'F-02', 'F-03']);
const TARGET_VALIDITY_CLASSES = Object.freeze(['current', 'ended']);

const STATIC_REASON_BY_ID = Object.freeze({
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
  return Object.freeze({
    action: 'TERMINAL',
    disposition: 'REFUSE',
    outcome: 'refused',
    reason,
    recordingMode,
  });
}

function authorityAbsentReturn() {
  return Object.freeze({
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
  return Object.freeze({
    action: 'THROW',
    disposition: 'REFUSE',
    errorName: 'MemoryAuthorityError',
    errorCode: code,
    errorMessage: MEMORY_AUTHORITY_ERRORS[code],
    recordingMode: 'pre_gate_no_journal',
  });
}

function captureRethrow() {
  return Object.freeze({
    action: 'RETHROW',
    disposition: 'REFUSE',
    reason: 'capture_failed',
    recordingMode: 'pre_gate_no_journal',
    preserveCapturedErrorByIdentity: true,
  });
}

function legacyStoreClosedThrow() {
  return Object.freeze({
    action: 'THROW',
    disposition: 'REFUSE',
    errorName: 'LegacyMutationError',
    errorCode: 'legacy_store_closed',
    errorMessage: 'The memory store is closed.',
    recordingMode: 'pre_gate_no_journal',
  });
}

function evaluateTerminalStorageGroup() {
  return Object.freeze({
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
  return Object.freeze({action: 'CONTINUE', next});
}

function evaluateRouteEntry(routeKind) {
  if (!Object.hasOwn(ROUTE_ENTRY_ROWS, routeKind)) {
    throw new Error('unknown public mutation route');
  }
  if (routeKind === 'legacy_delete_kernel_store_file') {
    // This result is selected from the route tag alone. No options, path,
    // live-path registry, or filesystem state is accepted or inspected.
    return evaluateTerminalStorageGroup();
  }
  return continueTo(ROUTE_ENTRY_ROWS[routeKind]);
}

function appliedErasure() {
  return Object.freeze({
    action: 'TERMINAL',
    disposition: 'MAP',
    outcome: 'applied',
    reason: null,
    recordingMode: 'decision_and_effects',
  });
}

function assertProjectionVerified(input) {
  if (input.projectionVerified !== true) {
    throw new Error(
      'internal projection mismatch: complete projection verification required',
    );
  }
}

function evaluateErasureAuthorityPreflight(input) {
  const outcome = input.authorityPreflightOutcome;
  if (outcome === 'not_applicable') {
    throw new Error('erasure requires an applicable authority preflight outcome');
  }
  if (!AUTHORITY_PREFLIGHT_OUTCOMES.includes(outcome)) {
    throw new Error('unknown erasure authority preflight outcome');
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
  const outcome = input.authorityUseOutcome;
  if (outcome === 'not_applicable') {
    throw new Error('erasure requires an applicable authority use outcome');
  }
  if (!AUTHORITY_USE_OUTCOMES.includes(outcome)) {
    throw new Error('unknown erasure authority use outcome');
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
  if (input.idClass !== 'normalized_target_id') {
    throw new Error('valid erasure authority requires a normalized target id');
  }
  if (input.targetMatchesGrant !== true) {
    throw new Error('valid erasure authority requires an exact target match');
  }
  if (!SETS.VALID_ACTORS.includes(input.actorClass)) {
    throw new Error('valid erasure syntax requires a valid captured actor');
  }
  if (input.targetExists !== true && input.targetExists !== false) {
    throw new Error('erasure target existence must be a primitive boolean');
  }
}

function assertScopeSharedRelation(input) {
  if (!SETS.TARGET_SCOPE_CLASSES.includes(input.scopeClass)) {
    throw new Error('erasure leaf has an unknown target scope');
  }
  if (input.sharedFlag !== 'shared_0' && input.sharedFlag !== 'shared_1') {
    throw new Error('erasure leaf has an invalid retained shared flag');
  }
  if (input.scopeClass.endsWith('_private') &&
      input.sharedFlag !== 'shared_0') {
    throw new Error('erasure scope/shared coordinates are inconsistent');
  }
  if (input.scopeClass.endsWith('_shared') &&
      input.sharedFlag !== 'shared_1') {
    throw new Error('erasure scope/shared coordinates are inconsistent');
  }
}

function deriveEraseTargetClass(input) {
  if (!Number.isSafeInteger(input.incidentLinkCount) ||
      input.incidentLinkCount < 0) {
    throw new Error('internal projection mismatch: invalid incident-link count');
  }
  let family;
  if (input.scopeClass === 'same_palari_same_user_private') {
    family = 'private_same_scope';
  } else if (input.scopeClass === 'same_palari_same_user_shared') {
    family = 'shared';
  } else if (input.scopeClass.includes('general')) {
    family = 'general';
  } else if (input.scopeClass.startsWith('same_palari_cross_user_')) {
    family = 'cross_user';
  } else if (input.scopeClass.startsWith('cross_palari_')) {
    family = 'cross_palari';
  } else {
    throw new Error('erasure scope has no target-branch derivation');
  }
  const linkClass = input.incidentLinkCount === 0 ?
    'zero_links' : 'with_links';
  return `target_${family}_${linkClass}`;
}

function assertErasureLeafCoordinates(rowId, input) {
  if (input.targetExists !== true) {
    throw new Error('erasure leaf requires a present target');
  }
  if (!TARGET_VALIDITY_CLASSES.includes(input.validityClass)) {
    throw new Error('erasure leaf has an unknown target validity class');
  }
  if (rowId === 'D-02' && !SETS.PERMANENT_TYPES.includes(input.legacyType)) {
    throw new Error('D-02 requires a permanent legacy target type');
  }
  if (rowId === 'D-03' && !SETS.TRANSIENT_TYPES.includes(input.legacyType)) {
    throw new Error('D-03 requires a transient legacy target type');
  }
  assertScopeSharedRelation(input);
  const derivedTargetClass = deriveEraseTargetClass(input);
  if (input.targetBranch !== derivedTargetClass ||
      !SETS.ERASE_TARGET_CLASSES.includes(derivedTargetClass)) {
    throw new Error('erasure target coordinates do not derive the named branch');
  }
}

function evaluateErasure(rowId, input) {
  const preflightTerminal = evaluateErasureAuthorityPreflight(input);
  if (preflightTerminal !== null) return preflightTerminal;

  if (input.syntaxValid !== true) {
    return captureRethrow();
  }

  const useTerminal = evaluateErasureAuthorityUse(input);
  if (useTerminal !== null) return useTerminal;

  // The complete B2 reducer/projection verifier is an integrity precondition.
  // No missing/scope/shared/link policy reason may hide corrupt projection.
  assertProjectionVerified(input);
  assertCommonErasureCoordinates(input);

  if (rowId === 'D-01') {
    if (input.targetExists === true) {
      if (!SETS.LEGACY_TYPES.includes(input.legacyType)) {
        throw new Error('present erasure target has an unknown legacy type');
      }
      return continueTo(Object.freeze([
        SETS.PERMANENT_TYPES.includes(input.legacyType) ? 'D-02' : 'D-03',
      ]));
    }
    return refusal('missing_target', 'decision_only');
  }

  if (!MAP_ALLOWLIST.includes(rowId)) {
    throw new Error('erasure evaluator received a non-allowlisted leaf');
  }
  assertErasureLeafCoordinates(rowId, input);

  // Scope precedes link enumeration. Cross-scope callers must not learn links.
  if (input.scopeClass !== 'same_palari_same_user_private') {
    if (input.scopeClass === 'same_palari_same_user_shared') {
      return refusal('shared_scope_unsealed', 'decision_only');
    }
    return refusal('scope_mismatch', 'decision_only');
  }
  if (input.sharedFlag !== 'shared_0') {
    return refusal('shared_scope_unsealed', 'decision_only');
  }
  if (input.incidentLinkCount > 0) {
    return refusal('incident_edges_unemittable', 'decision_only');
  }

  return appliedErasure();
}

function evaluateFinal(rowId, input = Object.freeze({})) {
  const row = rows.find((candidate) => candidate.id === rowId);
  if (!row) {
    throw new Error('unknown obligation id');
  }

  if (TERMINAL_STORAGE_IDS.includes(rowId)) {
    return evaluateTerminalStorageGroup();
  }

  // D dispatch deliberately precedes generic compatibility continuation.
  if (ERASURE_IDS.includes(rowId)) {
    return evaluateErasure(rowId, input);
  }

  for (const key of ['authorityPreflightOutcome', 'authorityUseOutcome']) {
    if (Object.hasOwn(input, key) && input[key] !== 'not_applicable') {
      throw new Error('authority is not applicable to a non-erasure row');
    }
  }

  if (row.continueOutcomes.includes(input.compatibilityOutcome)) {
    if (rowId === 'PRE-03') return evaluateRouteEntry(input.routeKind);
    return continueTo(row.next);
  }

  let reason = STATIC_REASON_BY_ID[rowId];
  if (rowId === 'PRE-03' && input.compatibilityOutcome === 'legacy_store_closed') {
    reason = 'store_closed';
  }
  if (!reason) {
    throw new Error('row has no closed terminal reason');
  }
  return refusal(reason, 'pre_gate_no_journal');
}

const REGISTRY = Object.freeze({
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
  if (!condition) throw new Error(message);
}

function assertUniqueStrings(values, label) {
  assert(Array.isArray(values) && values.length > 0, label + ' must be nonempty');
  assert(values.every((value) => typeof value === 'string' && value.length > 0),
    label + ' must contain nonempty strings');
  assert(new Set(values).size === values.length, label + ' contains duplicates');
}

function expandCell(cell, label) {
  const variants = Array.isArray(cell) ? cell : [cell];
  assert(variants.length > 0, label + ' has an empty finite union');
  const expanded = [];
  for (const variant of variants) {
    assert(typeof variant === 'string' && variant.length > 0,
      label + ' has a non-string symbol');
    assert(variant !== String.fromCharCode(42), label + ' contains a wildcard');
    if (variant.startsWith('@')) {
      const setName = variant.slice(1);
      assert(Object.hasOwn(SETS, setName), label + ' has unknown set ' + setName);
      expanded.push(...SETS[setName]);
    } else {
      expanded.push(variant);
    }
  }
  assert(new Set(expanded).size === expanded.length,
    label + ' expands to duplicate symbols');
  return expanded;
}

function validateRegistry() {
  assertUniqueStrings(dimensionOrder, 'dimensionOrder');
  assert(dimensionOrder.length === 22, 'dimensionOrder must contain 22 keys');
  assertUniqueStrings(EXPECTED_IDS, 'EXPECTED_IDS');
  assert(EXPECTED_IDS.length === 46, 'EXPECTED_IDS must contain 46 ids');
  assert(rows.length === 46, 'registry must contain 46 rows');
  assert(JSON.stringify(rows.map((row) => row.id)) ===
    JSON.stringify(EXPECTED_IDS), 'row ids/order differ from the A2 inventory');

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
  assert(JSON.stringify(AUTHORITY_PREFLIGHT_OUTCOMES) === JSON.stringify([
    'absent',
    'authority_grant_invalid',
    'authority_grant_unavailable',
    'authority_grant_expired',
    'authority_scope_mismatch',
    'ready',
  ]), 'authority preflight outcomes differ from the exact mutation-use set');
  assert(JSON.stringify(AUTHORITY_USE_OUTCOMES) === JSON.stringify([
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
  assert(JSON.stringify(ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES) ===
    JSON.stringify([
      'authority_invalid_argument',
      'authority_root_invalid',
      'authority_root_unbound',
      'authority_root_busy',
    ]), 'host-only authority error set differs from the exact exclusion');
  assert(ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES.every((code) =>
    MEMORY_AUTHORITY_ERROR_CODES.includes(code)),
  'every host-only authority code must remain in the public error vocabulary');
  assert(ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES.every((code) =>
    !AUTHORITY_PREFLIGHT_OUTCOMES.includes(code) &&
      !AUTHORITY_USE_OUTCOMES.includes(code)),
  'host-only authority errors must be unreachable from D calls');
  const stagedMutationAuthorityCodes = new Set([
    ...AUTHORITY_PREFLIGHT_OUTCOMES,
    ...AUTHORITY_USE_OUTCOMES,
  ].filter((outcome) => Object.hasOwn(MEMORY_AUTHORITY_ERRORS, outcome)));
  assert(MEMORY_AUTHORITY_ERROR_CODES.every((code) =>
    stagedMutationAuthorityCodes.has(code) !==
      ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES.includes(code)),
  'every public authority error must be exactly D-reachable or host-only');
  assert(JSON.stringify(AUTHORITY_ACTION_COUNTS) === JSON.stringify({
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
  assert(new Set(rows.map((row) => row.phase)).size === PHASES.length,
    'every closed phase must be used');
  assert(new Set(rows.map((row) => row.rule)).size === RULE_VOCABULARY.length,
    'every closed rule must be used');

  for (const [name, values] of Object.entries(SETS)) {
    assertUniqueStrings(values, 'SETS.' + name);
    for (const value of values) {
      assert(value !== String.fromCharCode(42), 'SETS.' + name + ' has wildcard');
      assert(!value.startsWith('@'), 'SETS.' + name + ' nests a set reference');
    }
  }

  const ids = new Set(rows.map((row) => row.id));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const domains = dimensionOrder.map(() => new Set());
  for (const row of rows) {
    assert(PHASES.includes(row.phase), row.id + ' has unknown phase');
    assert(RULE_VOCABULARY.includes(row.rule), row.id + ' has unknown rule');
    assert(Array.isArray(row.v) && row.v.length === 22,
      row.id + ' must have exactly 22 cells');
    assert(Array.isArray(row.next), row.id + ' next must be an array');
    assert(new Set(row.next).size === row.next.length,
      row.id + ' has duplicate next references');
    for (const nextId of row.next) {
      assert(ids.has(nextId), row.id + ' has unknown next id ' + nextId);
      assert(nextId !== row.id, row.id + ' has a self next reference');
    }
    assert(Array.isArray(row.continueOutcomes),
      row.id + ' continueOutcomes must be an array');
    assert(new Set(row.continueOutcomes).size === row.continueOutcomes.length,
      row.id + ' has duplicate continue outcomes');
    assert(row.continueOutcomes.every((value) =>
      typeof value === 'string' && value.length > 0),
    row.id + ' has invalid continue outcome');
    assert((row.next.length === 0) === (row.continueOutcomes.length === 0),
      row.id + ' next/continue shape is inconsistent');

    row.v.forEach((cell, index) => {
      const expanded = expandCell(cell, row.id + '.' + dimensionOrder[index]);
      for (const symbol of expanded) domains[index].add(symbol);
    });
  }
  assert(domains.every((domain) => domain.size > 0),
    'every ordered dimension must have a finite nonempty global domain');

  // The route-entry map is exact, route-compatible, fully reachable, and
  // acyclic. This closes the prior gap where 26 registered rows had no path.
  assert(JSON.stringify(Object.keys(ROUTE_ENTRY_ROWS)) ===
    JSON.stringify(SETS.PUBLIC_MUTATION_ROUTES),
  'route-entry keys must equal the exact public route vocabulary');
  assert(JSON.stringify(Object.keys(ROUTE_TRANSITIONS)) ===
    JSON.stringify(SETS.PUBLIC_MUTATION_ROUTES),
  'route-transition keys must equal the exact public route vocabulary');
  assert(JSON.stringify(byId.get('PRE-03').next) ===
    JSON.stringify(ALL_ROUTE_ENTRY_ROWS),
  'PRE-03 must name every exact route entry row');
  const entryIds = [];
  for (const routeKind of SETS.PUBLIC_MUTATION_ROUTES) {
    const entries = ROUTE_ENTRY_ROWS[routeKind];
    assertUniqueStrings(entries, 'ROUTE_ENTRY_ROWS.' + routeKind);
    assertUniqueStrings(ROUTE_TRANSITIONS[routeKind],
      'ROUTE_TRANSITIONS.' + routeKind);
    for (const entryId of entries) {
      assert(ids.has(entryId), routeKind + ' has unknown entry ' + entryId);
      entryIds.push(entryId);
      const entryRoutes = expandCell(byId.get(entryId).v[0],
        entryId + '.route_kind');
      assert(JSON.stringify(entryRoutes) === JSON.stringify([routeKind]),
        entryId + ' is not an exact entry for ' + routeKind);
    }
  }
  assert(new Set(entryIds).size === entryIds.length,
    'a route-entry row may belong to only one route');

  for (const row of rows) {
    if (row.id.startsWith('PRE-')) continue;
    const sourceRoutes = expandCell(row.v[0], row.id + '.route_kind');
    for (const nextId of row.next) {
      const targetRoutes = expandCell(byId.get(nextId).v[0],
        nextId + '.route_kind');
      const compatible = sourceRoutes.some((sourceRoute) =>
        targetRoutes.every((targetRoute) =>
          ROUTE_TRANSITIONS[sourceRoute].includes(targetRoute)));
      assert(compatible, row.id + ' -> ' + nextId + ' crosses an invalid route');
    }
  }

  const colors = new Map();
  function visit(id) {
    const color = colors.get(id) ?? 0;
    assert(color !== 1, 'obligation graph contains a cycle at ' + id);
    if (color === 2) return;
    colors.set(id, 1);
    for (const nextId of byId.get(id).next) visit(nextId);
    colors.set(id, 2);
  }
  for (const id of EXPECTED_IDS) visit(id);

  const reachable = new Set();
  const pending = ['PRE-01'];
  while (pending.length > 0) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    pending.push(...byId.get(id).next);
  }
  assert(reachable.size === EXPECTED_IDS.length,
    'every obligation row must be reachable from PRE-01');
  assert(EXPECTED_IDS.every((id) => reachable.has(id)),
    'the reachable obligation set differs from the exact inventory');

  const expectedStaticIds = EXPECTED_IDS.filter((id) => !id.startsWith('D-'));
  assert(JSON.stringify(Object.keys(STATIC_REASON_BY_ID)) ===
    JSON.stringify(expectedStaticIds),
  'static reason map must cover every and only non-D row in inventory order');
  for (const reason of Object.values(STATIC_REASON_BY_ID)) {
    assert(FINAL_REASONS.includes(reason), 'static reason is outside closed enum');
  }

  assert(JSON.stringify(MAP_ALLOWLIST) === JSON.stringify(['D-02', 'D-03']),
    'only D-02 and D-03 may map');
  assert(rows.find((row) => row.id === 'PD-02').rule ===
    'STOP_DEMOTION_UNSEALED', 'PD-02 must refuse as unsealed demotion');
  assert(rows.find((row) => row.id === 'PD-03').rule ===
    'STOP_LEGACY_DESTRUCTIVE_OPERATION',
  'PD-03 must refuse legacy destructive demotion');

  const cleanPermanent = Object.freeze({
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
  const cleanTransient = Object.freeze({
    ...cleanPermanent,
    legacyType: 'working',
  });

  const mapProducingIds = rows
    .filter((row) => {
      let result;
      if (row.id === 'D-01') result = evaluateFinal(row.id, cleanPermanent);
      else if (row.id === 'D-02') result = evaluateFinal(row.id, cleanPermanent);
      else if (row.id === 'D-03') result = evaluateFinal(row.id, cleanTransient);
      else result = evaluateFinal(row.id, {
        authorityPreflightOutcome: 'not_applicable',
        authorityUseOutcome: 'not_applicable',
      });
      return result.disposition === 'MAP';
    })
    .map((row) => row.id);
  assert(JSON.stringify(mapProducingIds) === JSON.stringify(MAP_ALLOWLIST),
    'evaluator MAP surface differs from exact allowlist');
  assert(evaluateFinal('PD-02', {
    authorityPreflightOutcome: 'not_applicable',
    authorityUseOutcome: 'not_applicable',
  }).disposition === 'REFUSE', 'PD-02 evaluator must refuse');

  // Exhaust every retained target scope, shared-bit-consistent class, link
  // class, and validity class for both mapped row ids.
  let erasureMatrixCaseCount = 0;
  for (const [rowId, base, legacyTypes] of [
    ['D-02', cleanPermanent, SETS.PERMANENT_TYPES],
    ['D-03', cleanTransient, SETS.TRANSIENT_TYPES],
  ]) {
    for (const legacyType of legacyTypes) {
      for (const actorClass of SETS.VALID_ACTORS) {
        for (const scopeClass of SETS.TARGET_SCOPE_CLASSES) {
          let sharedFlags = ['shared_0', 'shared_1'];
          if (scopeClass.endsWith('_private')) sharedFlags = ['shared_0'];
          if (scopeClass.endsWith('_shared')) sharedFlags = ['shared_1'];
          for (const sharedFlag of sharedFlags) {
            for (const incidentLinkCount of [0, 1]) {
              for (const validityClass of TARGET_VALIDITY_CLASSES) {
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
  assert(JSON.stringify(evaluateFinal('D-01', cleanPermanent).next) ===
    JSON.stringify(['D-02']), 'permanent D-01 must continue only to D-02');
  assert(JSON.stringify(evaluateFinal('D-01', cleanTransient).next) ===
    JSON.stringify(['D-03']), 'transient D-01 must continue only to D-03');

  // Authority is staged exactly as the mutation-use path: preflight first,
  // then capture or exact retained-value rethrow, then post-capture
  // local/activity/time checks.
  let stagedAuthorityCaseCount = 0;
  let absentLaterObservationCount = 0;
  const absentInput = {authorityPreflightOutcome: 'absent'};
  for (const key of [
    'compatibilityOutcome',
    'syntaxValid',
    'authorityUseOutcome',
    'projectionVerified',
  ]) {
    Object.defineProperty(absentInput, key, {
      get() {
        absentLaterObservationCount += 1;
        throw new Error('later erasure phase was observed');
      },
    });
  }
  for (const rowId of ERASURE_IDS) {
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

  const preflightErrorCodes = AUTHORITY_PREFLIGHT_OUTCOMES.filter((outcome) =>
    outcome !== 'absent' && outcome !== 'ready');
  assert(JSON.stringify(preflightErrorCodes) === JSON.stringify([
    'authority_grant_invalid',
    'authority_grant_unavailable',
    'authority_grant_expired',
    'authority_scope_mismatch',
  ]), 'preflight throw set differs from the exact mutation-use errors');
  for (const code of preflightErrorCodes) {
    for (const rowId of ERASURE_IDS) {
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
  for (const useOutcome of AUTHORITY_USE_OUTCOMES) {
    for (const rowId of ERASURE_IDS) {
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
  Object.defineProperty(invalidSyntaxInput, 'authorityUseOutcome', {
    get() {
      invalidSyntaxUseObservationCount += 1;
      throw new Error('use-time outcome was observed before successful capture');
    },
  });
  for (const rowId of ERASURE_IDS) {
    const result = evaluateFinal(rowId, invalidSyntaxInput);
    assert(result.action === 'RETHROW' && result.reason === 'capture_failed' &&
      result.preserveCapturedErrorByIdentity === true,
    rowId + ' failed capture must rethrow before use-time observation');
  }
  assert(invalidSyntaxUseObservationCount === 0,
    'failed capture must not inspect a use-time authority outcome');

  const useThrowOutcomes = AUTHORITY_USE_OUTCOMES.filter((outcome) =>
    outcome !== 'valid');
  for (const outcome of useThrowOutcomes) {
    for (const rowId of ERASURE_IDS) {
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

  const overlappingPhaseCodes = preflightErrorCodes.filter((code) =>
    AUTHORITY_USE_OUTCOMES.includes(code));
  assert(JSON.stringify(overlappingPhaseCodes) === JSON.stringify([
    'authority_grant_unavailable',
    'authority_grant_expired',
    'authority_scope_mismatch',
  ]), 'the exact repeated preflight/use error set must stay phase-explicit');

  // Closed phase domains reject misplaced and host-only outcomes. These are
  // contract defects, not governed refusals.
  for (const outcome of [
    'legacy_store_closed',
    'authority_root_revoked',
    'authority_grant_mismatch',
    'authority_ledger_unavailable',
    'authority_ledger_protocol',
    'authority_clock_invalid',
    'valid',
    ...ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES,
  ]) {
    let rejected = false;
    try {
      evaluateFinal('D-02', {authorityPreflightOutcome: outcome});
    } catch (error) {
      rejected = error instanceof Error &&
        error.message === 'unknown erasure authority preflight outcome';
    }
    assert(rejected, outcome + ' must be rejected as a preflight outcome');
  }
  for (const outcome of [
    'absent',
    'ready',
    'authority_grant_invalid',
    ...ROOT_OR_ISSUANCE_ONLY_AUTHORITY_CODES,
  ]) {
    let rejected = false;
    try {
      evaluateFinal('D-02', {
        syntaxValid: true,
        authorityPreflightOutcome: 'ready',
        authorityUseOutcome: outcome,
      });
    } catch (error) {
      rejected = error instanceof Error &&
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

  for (const phaseInput of [
    {authorityPreflightOutcome: 'not_applicable'},
    {
      syntaxValid: true,
      authorityPreflightOutcome: 'ready',
      authorityUseOutcome: 'not_applicable',
    },
  ]) {
    let notApplicableThrew = false;
    try {
      evaluateFinal('D-02', phaseInput);
    } catch (error) {
      notApplicableThrew = error instanceof Error &&
        error.message.startsWith('erasure requires an applicable authority');
    }
    assert(notApplicableThrew,
      'not_applicable must be rejected in either D authority phase');
  }
  for (const [input, expectedMessage] of [
    [{}, 'unknown erasure authority preflight outcome'],
    [{
      syntaxValid: true,
      authorityPreflightOutcome: 'ready',
    }, 'unknown erasure authority use outcome'],
  ]) {
    let missingPhaseThrew = false;
    try {
      evaluateFinal('D-02', input);
    } catch (error) {
      missingPhaseThrew = error instanceof Error &&
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
    emptyIdThrew = error instanceof Error &&
      error.message.includes('normalized target id');
  }
  assert(emptyIdThrew,
    'empty/missing target ids cannot become valid missing-target decisions');

  for (const [rowId, corrupt] of [
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
  ]) {
    let projectionThrew = false;
    try {
      evaluateFinal(rowId, corrupt);
    } catch (error) {
      projectionThrew = error instanceof Error &&
        error.message.startsWith('internal projection mismatch');
    }
    assert(projectionThrew,
      'projection corruption must throw before every target classifier reason');
  }

  const terminal = evaluateTerminalStorageGroup();
  assert(terminal.action === 'THROW' && terminal.disposition === 'REFUSE' &&
    terminal.errorName === 'LegacyMutationError' &&
    terminal.errorCode === 'legacy_terminal_storage_refused' &&
    JSON.stringify(terminal.coveredObligationIds) ===
      JSON.stringify(TERMINAL_STORAGE_IDS),
  'terminal storage must use one route-level three-obligation refusal');
  let terminalObservationCount = 0;
  const hostileTerminalInput = new Proxy({}, {
    get() { terminalObservationCount += 1; throw new Error('observed get'); },
    ownKeys() { terminalObservationCount += 1; throw new Error('observed keys'); },
  });
  evaluateTerminalStorageGroup(hostileTerminalInput);
  assert(terminalObservationCount === 0,
    'terminal storage group evaluator must inspect no caller/path input');
  assert(evaluateRouteEntry('legacy_delete_kernel_store_file').errorCode ===
    'legacy_terminal_storage_refused',
  'terminal route entry must refuse before branch selection');
  for (const id of TERMINAL_STORAGE_IDS) {
    const result = evaluateFinal(id, hostileTerminalInput);
    assert(result.errorCode === 'legacy_terminal_storage_refused' &&
      JSON.stringify(result.coveredObligationIds) ===
        JSON.stringify(TERMINAL_STORAGE_IDS),
    id + ' must collapse to the same unobserved terminal group');
  }

  for (const routeKind of SETS.PUBLIC_MUTATION_ROUTES) {
    const result = evaluateRouteEntry(routeKind);
    if (routeKind === 'legacy_delete_kernel_store_file') {
      assert(result.errorCode === 'legacy_terminal_storage_refused',
        'terminal route must return the terminal group action');
    } else {
      assert(JSON.stringify(result.next) ===
        JSON.stringify(ROUTE_ENTRY_ROWS[routeKind]),
      routeKind + ' must expose only its exact first branches');
    }
  }
  assert(JSON.stringify(evaluateFinal('PRE-03', {
    authorityPreflightOutcome: 'not_applicable',
    authorityUseOutcome: 'not_applicable',
    compatibilityOutcome: 'captured_intent',
    routeKind: 'legacy_extraction_pass',
  }).next) === JSON.stringify(['E-01', 'E-02', 'E-03', 'E-04', 'E-05']),
  'PRE-03 must dispatch to the exact captured route entries');
  assert(stagedAuthorityCaseCount === 72,
    'staged authority action matrix must contain exactly 72 cases');

  return Object.freeze({
    obligationCount: rows.length,
    dimensionCount: dimensionOrder.length,
    reachableObligationCount: reachable.size,
    authorityErrorCount: MEMORY_AUTHORITY_ERROR_CODES.length,
    authorityPreflightOutcomeCount: AUTHORITY_PREFLIGHT_OUTCOMES.length,
    authorityUseOutcomeCount: AUTHORITY_USE_OUTCOMES.length,
    authorityActionCounts: AUTHORITY_ACTION_COUNTS,
    stagedAuthorityCaseCount,
    erasureMatrixCaseCount,
    mapAllowlist: MAP_ALLOWLIST,
    terminalStorageGroup: TERMINAL_STORAGE_IDS,
    fixtureCrosscheckRequired: PRODUCTION_FIXTURE_CROSSCHECK.required,
    globalDomainSizes: Object.freeze(domains.map((domain) => domain.size)),
  });
}

const verification = validateRegistry();
console.log(JSON.stringify({ok: true, ...verification}));
```

The evaluator order is normative. The terminal-storage route is selected from
its trusted route tag alone and throws one exact error covering F-01/F-02/F-03;
it never selects a historical F branch or inspects options, path, live-owner,
or filesystem state. D-01/D-02/D-03 use two explicit authority phases. Initial
preflight runs first: `absent` returns the exact delete-route governance refusal
without observing capture or later-phase fields; the exact pre-capture
`authority_grant_invalid`, `authority_grant_unavailable`,
`authority_grant_expired`, or `authority_scope_mismatch` error throws unchanged;
and only `ready` continues. Capture runs next. The bridge lexically retains the
exact capture-thrown value by identity—including a caller/coercion throw,
`LegacyMutationError`, or native compatibility-validation error;
`syntaxValid:false` returns `RETHROW`, and the bridge rethrows that retained
value without passing it into or exposing it through the data-only evaluator.
Private `captureThrew` is separate from `captureThrownValue`, so exact
`undefined` or `null` remains a legal retained throw value. `RETHROW` with
`captureThrew !== true` is an internal invariant failure. No post-capture field
is observed.
Only successful capture may evaluate the closed use-time set:
`legacy_store_closed`; the exact
post-capture local-check, predicate, clock, or expiry `MemoryAuthorityError`;
or `valid`. Only `valid` reaches projection verification. The repeated scope,
unavailable, and expired codes remain phase-explicit because either initial or
reentrant checks may observe them. Host construction/binding/issuance-only
codes are invalid in both D phases. `not_applicable` is legal only on non-D
rows.

For valid erasure authority, complete projection verification is a mandatory
integrity precondition before any target-policy classification. It proves the
required CDX/FTS/cardinality state; the terminal evaluator does not reorder FTS
checks among policy reasons. Corruption always throws an internal projection
failure and can never be hidden by a missing/scope/shared/link refusal. On a
verified projection, target scope precedes link enumeration. A same-Palari,
same-user shared target refuses as `shared_scope_unsealed`; every other wrong
scope refuses as `scope_mismatch`. A clean private target with one or more
incident links refuses as `incident_edges_unemittable`. Only a verified clean
private same-scope target with `shared_0` and zero incident links can reach
`MAP`, and only through D-02 or D-03. Type selects exactly D-02 versus D-03;
type and current/ended validity do not alter the final erasure policy.

The following verifier is standalone. Run it from the repository root with
Node; it executes the first JavaScript block above and therefore runs every
embedded assertion.

```js
'use strict';

const fs = require('node:fs');
const vm = require('node:vm');

const path = process.argv[2] ||
  'docs/GOVERNED-MUTATION-DISPOSITION-REGISTRY.md';
const markdown = fs.readFileSync(path, 'utf8');
const fence = String.fromCharCode(96).repeat(3);
const open = fence + 'js';
const start = markdown.indexOf(open);
if (start < 0) throw new Error('normative JavaScript block not found');
const bodyStart = start + open.length;
const end = markdown.indexOf(fence, bodyStart);
if (end < 0) throw new Error('normative JavaScript block is unterminated');
const source = markdown.slice(bodyStart, end);
vm.runInNewContext(source, {console}, {filename: path + '#registry'});
```
