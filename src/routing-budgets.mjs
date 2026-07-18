// Vendored from palari-v05 @ 190a4ad2f8d5187f5f21222048dd11efb2ad9991
//   apps/palari-local-workbench/scripts/workspace-backend/assistant-routing-policy.mjs
//   (blob afd06e68ddf5; fns at lines 334/343, registry entry
//   memory_extraction at line 218: outputBudgetTokens 8000,
//   thinkingBudgetTokens 0).
// The kernel's only call sites pass the literal role
// 'memory_extraction' (memory-extraction.mjs lines 742/745), so this
// shim pins that entry's values instead of dragging in the product
// routing registry — per docs/SOURCE-MAP.md severance ledger.
// U5, Fable 5, 2026-07-18.

const memoryExtractionBudget = Object.freeze({
  outputBudgetTokens: 8000,
  thinkingBudgetTokens: 0,
})

export function assistantRoleThinkingBudgetTokens() {
  return memoryExtractionBudget.thinkingBudgetTokens
}

export function assistantRoleRequestOutputBudgetTokens() {
  return memoryExtractionBudget.outputBudgetTokens + memoryExtractionBudget.thinkingBudgetTokens
}
