// Kernel store surface (KERNEL-API §3) — U3, Fable 5, 2026-07-18.
// Wraps the extracted baseline store (./memory-store.mjs, verbatim from
// palari-v05 @ 190a4ad2) and adds the two kernel-only operations:
//   - topicForget: composed per SOURCE-MAP finding 2 (no baseline
//     method exists) — contract C18.
//   - deleteKernelStoreFile: kernel-named whole-store deletion (C19).
// No baseline behavior is altered here; the gate lands in U4.

import {
  acquisitionModes,
  createPalariMemoryStore,
  createWorkspaceMemoryManager,
  deleteWorkspaceMemoryDatabase,
  extractMemoryQueryKeywords,
  externalMemorySourceKinds,
  memoryAddWriters,
  memoryFtsTokenizer,
  memoryMutationActors,
  memoryStoreSchemaVersion,
  memoryTypes,
  permanentMemoryTypes,
  probeMemorySqliteDriver,
  transientMemoryTypes,
  workspaceMemoryDbPath,
} from './memory-store.mjs'

const topicForgetBatchLimit = 100

/**
 * Remove every row matching `topicQuery` that is visible to the
 * requesting scope (own + general + shared within the palari), and
 * nothing else: other users' private rows and other palaris are never
 * touched (contract C18). Deletion goes through the baseline
 * deleteMemory, so FTS/link residue removal (C17) is inherited.
 */
function topicForget(store, topicQuery, { palariId, userId = '' } = {}, { actor = 'explicit_user_action' } = {}) {
  const deleted = []
  // Batch until the scoped search drains: no silent cap on how many
  // rows a topic-forget removes.
  for (;;) {
    const matches = store.searchMemories(topicQuery, {
      limit: topicForgetBatchLimit,
      palariId,
      userId,
    })
    if (!matches.length) break
    for (const row of matches) {
      store.deleteMemory(row.id, { actor })
      deleted.push(row.id)
    }
    if (matches.length < topicForgetBatchLimit) break
  }
  return { count: deleted.length, deleted }
}

export async function createKernelStore(options = {}) {
  const store = await createPalariMemoryStore(options)
  if (!store.enabled) return store
  return {
    ...store,
    topicForget(topicQuery, scope, opts) {
      return topicForget(store, topicQuery, scope, opts)
    },
  }
}

export const deleteKernelStoreFile = deleteWorkspaceMemoryDatabase

export {
  acquisitionModes,
  createWorkspaceMemoryManager,
  extractMemoryQueryKeywords,
  externalMemorySourceKinds,
  memoryAddWriters,
  memoryFtsTokenizer,
  memoryMutationActors,
  memoryStoreSchemaVersion,
  memoryTypes,
  permanentMemoryTypes,
  probeMemorySqliteDriver,
  transientMemoryTypes,
  workspaceMemoryDbPath,
}
