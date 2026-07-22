// V2-M2-B governed compatibility gate.
//
// This module is the public adapter from the established proposal/mutation
// surface to the private governed bridge held by the store runtime. It owns no
// authority, database connection, SQL, transaction, clock, random source, or
// raw mutation capability. Only separately granted deletion can reach the
// bridge's ratified erasure path; every other current route refuses.

import { types as nodeUtilTypes } from 'node:util'

import {
  assertKernelStoreCapability,
  executeGovernedStoreIntent,
} from './kernel-store-runtime.mjs'
import { LegacyMutationError } from './legacy-mutation-router.mjs'

const ObjectFreeze = Object.freeze
const ObjectDefineProperty = Object.defineProperty
const ObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
const ObjectGetPrototypeOf = Object.getPrototypeOf
const ObjectPrototype = Object.prototype
const ObjectPrototypeHasOwnProperty = Object.prototype.hasOwnProperty
const ArrayPrototypePush = Array.prototype.push
const ErrorConstructor = Error
const NumberConstructor = Number
const NumberIsFinite = Number.isFinite
const ReflectApply = Reflect.apply
const ReflectGet = Reflect.get
const WeakMapConstructor = WeakMap
const WeakMapPrototypeGet = WeakMap.prototype.get
const WeakMapPrototypeHas = WeakMap.prototype.has
const WeakMapPrototypeSet = WeakMap.prototype.set
const isProxy = nodeUtilTypes.isProxy

const gateStates = new WeakMapConstructor()
const gatedStates = new WeakMapConstructor()

const proposalKindOps = ObjectFreeze({
  demote: ObjectFreeze(['end_validity', 'delete_transient']),
  permanent: ObjectFreeze(['add', 'supersede']),
  promote: ObjectFreeze(['add', 'supersede']),
  ratify: ObjectFreeze(['share']),
})

const provenanceKeys = ObjectFreeze([
  'actor',
  'eventAt',
  'extractor',
  'sourceKind',
  'sourceMessageId',
  'writer',
])

const recordKeys = ObjectFreeze([
  'id',
  'palari_id',
  'user_id',
  'type',
  'content',
  'keywords',
  'importance',
  'valid_from',
  'valid_until',
  'last_accessed',
  'created_at',
  'shared',
  'confidence',
  'acquisition_mode',
  'fictional',
  'last_decayed_at',
  'source_message_id',
  'content_hash',
])

const scopeKeys = ObjectFreeze(['palariId', 'userId'])
const policyKeys = ObjectFreeze(['demote', 'promote', 'permanent', 'ratify'])

function legacyError(code, message) {
  return new LegacyMutationError(code, message)
}

function invalidArgument() {
  return legacyError(
    'legacy_invalid_argument',
    'A valid legacy mutation argument is required.',
  )
}

function invalidCapability() {
  return legacyError(
    'legacy_invalid_capability',
    'A supported branded memory capability is required.',
  )
}

function storeClosed() {
  return legacyError('legacy_store_closed', 'The memory store is closed.')
}

function weakHas(map, value) {
  return ReflectApply(WeakMapPrototypeHas, map, [value])
}

function weakGet(map, value) {
  return ReflectApply(WeakMapPrototypeGet, map, [value])
}

function weakSet(map, key, value) {
  ReflectApply(WeakMapPrototypeSet, map, [key, value])
}

function isOrdinaryRecord(value) {
  if (typeof value !== 'object' || value === null || isProxy(value)) return false
  const prototype = ReflectApply(ObjectGetPrototypeOf, Object, [value])
  return prototype === ObjectPrototype || prototype === null
}

function ownDescriptor(value, key) {
  return ReflectApply(ObjectGetOwnPropertyDescriptor, Object, [value, key])
}

function ownDataValue(value, key) {
  const descriptor = ownDescriptor(value, key)
  if (descriptor === undefined) return undefined
  if (!ReflectApply(ObjectPrototypeHasOwnProperty, descriptor, ['value'])) {
    throw invalidArgument()
  }
  return descriptor.value
}

function makeRecord(keys, values) {
  const record = {}
  for (let index = 0; index < keys.length; index += 1) {
    ReflectApply(ObjectDefineProperty, Object, [record, keys[index], {
      configurable: true,
      enumerable: true,
      value: values[index],
      writable: true,
    }])
  }
  return record
}

function emptyKnownRecord(keys) {
  const values = []
  for (let index = 0; index < keys.length; index += 1) {
    ReflectApply(ArrayPrototypePush, values, [null])
  }
  return makeRecord(keys, values)
}

function captureKnownRecord(value, keys) {
  if (value === undefined) return emptyKnownRecord(keys)
  if (!isOrdinaryRecord(value)) throw invalidArgument()
  const values = []
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    const captured = ownDataValue(value, key)
    ReflectApply(ArrayPrototypePush, values, [captured === undefined ? null : captured])
  }
  return makeRecord(keys, values)
}

function captureOptionalRecordField(value, key) {
  if (value === undefined) return undefined
  if (!isOrdinaryRecord(value)) throw invalidArgument()
  return ownDataValue(value, key)
}

function proposalRejected(reason) {
  return { outcome: 'rejected', reasons: [reason] }
}

function operationIsKnown(kind, op) {
  let operations
  if (kind === 'demote') operations = proposalKindOps.demote
  else if (kind === 'permanent') operations = proposalKindOps.permanent
  else if (kind === 'promote') operations = proposalKindOps.promote
  else if (kind === 'ratify') operations = proposalKindOps.ratify
  else return false
  for (let index = 0; index < operations.length; index += 1) {
    if (operations[index] === op) return true
  }
  return false
}

function proposalKindIsKnown(kind) {
  return kind === 'demote' || kind === 'permanent' || kind === 'promote' || kind === 'ratify'
}

function isPermanentType(type) {
  return type === 'relationship' ||
    type === 'preference' ||
    type === 'opinion' ||
    type === 'entity' ||
    type === 'life_event'
}

function assertEnabledStateLive(state) {
  if (!state.enabled) return
  const status = state.status()
  if (status?.status === 'closed') throw storeClosed()
}

function assertActiveBase(base) {
  assertKernelStoreCapability(base)
  if (base.status().status === 'closed') throw storeClosed()
}

function executeForState(state, routeKind, input = undefined) {
  assertEnabledStateLive(state)
  return executeGovernedStoreIntent(state.base, routeKind, input)
}

export const admissionPolicyDefaults = ObjectFreeze({
  demote: 0,
  promote: 0.25,
  permanent: 0.6,
  ratify: 0.75,
})

export function createAdmissionPolicy(overrides) {
  if (overrides === undefined || overrides === null) {
    return ObjectFreeze({
      demote: admissionPolicyDefaults.demote,
      promote: admissionPolicyDefaults.promote,
      permanent: admissionPolicyDefaults.permanent,
      ratify: admissionPolicyDefaults.ratify,
    })
  }
  if (typeof overrides !== 'object' || isProxy(overrides)) {
    throw invalidArgument()
  }

  const values = []
  for (let index = 0; index < policyKeys.length; index += 1) {
    const key = policyKeys[index]
    const descriptor = ownDescriptor(overrides, key)
    let raw
    if (descriptor === undefined || descriptor.enumerable !== true) {
      raw = admissionPolicyDefaults[key]
    } else {
      raw = ReflectApply(ReflectGet, Reflect, [overrides, key])
    }
    ReflectApply(ArrayPrototypePush, values, [
      ReflectApply(NumberConstructor, undefined, [raw]),
    ])
  }

  const demote = values[0]
  const promote = values[1]
  const permanent = values[2]
  const ratify = values[3]
  if (
    !ReflectApply(NumberIsFinite, Number, [demote]) ||
    !ReflectApply(NumberIsFinite, Number, [promote]) ||
    !ReflectApply(NumberIsFinite, Number, [permanent]) ||
    !ReflectApply(NumberIsFinite, Number, [ratify]) ||
    !(demote < promote && promote < permanent && permanent < ratify)
  ) {
    throw new ErrorConstructor(
      'Admission thresholds must keep order demote < promote < permanent < ratify.',
    )
  }

  return ObjectFreeze({ demote, promote, permanent, ratify })
}

function captureExplicitProposal(proposal, policy) {
  if (proposal === undefined) return proposalRejected('invalid_kind')
  if (!isOrdinaryRecord(proposal)) throw invalidArgument()

  const proposalKind = ownDataValue(proposal, 'kind')
  if (!proposalKindIsKnown(proposalKind)) {
    return proposalRejected('invalid_kind')
  }

  const rawOp = ownDataValue(proposal, 'op')
  const op = rawOp === undefined ? 'add' : rawOp
  if (!operationIsKnown(proposalKind, op)) {
    return proposalRejected('invalid_op')
  }

  const rawProvenance = ownDataValue(proposal, 'provenance')
  const provenance = captureKnownRecord(rawProvenance, provenanceKeys)
  const needsRecord = proposalKind === 'promote' || proposalKind === 'permanent'
  const rawRecord = needsRecord ? ownDataValue(proposal, 'record') : undefined
  const record = needsRecord
    ? captureKnownRecord(rawRecord, recordKeys)
    : emptyKnownRecord(recordKeys)
  const needsTarget = op !== 'add'
  const target = needsTarget ? ownDataValue(proposal, 'target') : null

  return {
    intentKind: 'legacy_proposal',
    op,
    policy,
    producer: 'explicit_proposal',
    proposalKind,
    provenance,
    record,
    scope: makeRecord(scopeKeys, [null, null]),
    target: target === undefined ? null : target,
  }
}

export function createMemoryGate(base, options = {}) {
  assertActiveBase(base)
  if (!isOrdinaryRecord(options)) throw invalidArgument()
  const suppliedPolicy = ownDataValue(options, 'policy')
  const policy = createAdmissionPolicy(
    suppliedPolicy === undefined ? admissionPolicyDefaults : suppliedPolicy,
  )
  assertActiveBase(base)
  const enabled = base.enabled === true
  const status = base.status
  const state = ObjectFreeze({ base, enabled, policy, status })

  function propose(proposal) {
    if (!enabled) {
      return { outcome: 'rejected', reasons: ['memory_disabled'] }
    }
    assertEnabledStateLive(state)
    return executeForState(state, 'legacy_proposal')
  }

  const gate = ObjectFreeze({ policy, propose })
  weakSet(gateStates, gate, state)
  return gate
}

export function assertGatedStoreCapability(gated) {
  if (
    (typeof gated !== 'object' && typeof gated !== 'function') ||
    gated === null ||
    isProxy(gated) ||
    !weakHas(gatedStates, gated)
  ) {
    throw invalidCapability()
  }
  const state = weakGet(gatedStates, gated)
  assertEnabledStateLive(state)
}

export function proposeExtractedMemoryCandidate(gated, input) {
  assertGatedStoreCapability(gated)
  const state = weakGet(gatedStates, gated)
  if (!state.enabled) {
    return { outcome: 'rejected', reasons: ['memory_disabled'] }
  }
  return executeForState(state, 'legacy_proposal')
}

export function createGatedStore(base, options = {}) {
  assertActiveBase(base)
  const gate = createMemoryGate(base, options)
  const enabled = base.enabled === true
  const state = ObjectFreeze({
    base,
    enabled,
    policy: gate.policy,
    status: base.status,
  })

  function inertOrExecute(inert, routeKind, input = undefined) {
    if (!enabled) return inert()
    assertEnabledStateLive(state)
    return executeForState(state, routeKind, input)
  }

  const gated = ObjectFreeze({
    close: base.close,
    config: base.config,
    dbPath: base.dbPath,
    deleteMemory(id, optionsValue, authorityGrant) {
      return inertOrExecute(
        () => ({ deleted: false, reason: 'memory_disabled' }),
        'legacy_delete_memory',
        {
          id,
          options: optionsValue,
          authorityGrant,
        },
      )
    },
    enabled,
    getMemoryById: base.getMemoryById,
    listMemories: base.listMemories,
    propose: gate.propose,
    publicStatus: base.publicStatus,
    recallMemories: base.recallMemories,
    recordRecallInclusion(memoryIds, optionsValue) {
      return inertOrExecute(
        () => ({ touched: [], touchedCount: 0 }),
        'legacy_record_recall_inclusion',
      )
    },
    runLifecycleJobs(optionsValue) {
      return inertOrExecute(
        () => ({ decayed: 0, deleted: 0, skipped: 0, touched: 0 }),
        'legacy_run_lifecycle',
      )
    },
    searchMemories: base.searchMemories,
    status: base.status,
    topicForget(query, scopeValue, optionsValue) {
      return inertOrExecute(
        () => ({ count: 0, deleted: [] }),
        'legacy_forget_topic',
      )
    },
  })

  weakSet(gatedStates, gated, state)
  return gated
}
