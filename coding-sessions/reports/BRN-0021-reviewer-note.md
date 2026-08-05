# BRN-0021 Reviewer Note

## Review Result

Fresh independent read-only review inspected exact clean pushed head
`30d0d4f` against target `main` at `773e959`. It recommends **REOPEN**. No P0
finding was identified. Two P1, three P2, and one P3 findings remain. The
reviewer performed no repository edit, provider/private access, acceptance,
merge, or implementation repair.

## Findings

- **P1 — mutable global `BigInt` can reduce every reservation to zero.** The
  authoritative calculation calls the uncaptured global constructor. Replacing
  `globalThis.BigInt` after import with `() => 0n` made a valid branded
  1,000-input/512-output reservation report zero input, output, total, and USD.
  Exact and fallback modes both violate the no-under-reservation guarantee.
- **P1 — pathname-only scratch ownership permits copy escape.** A callback
  using only its supplied copied path can rename the owned scratch directory
  and create a replacement at the old pathname. Prefix-only cleanup removes
  the replacement, returns success, and leaves the actual database copy behind.
- **P2 — exact mode verification discards special permission bits.** Recording
  and comparing `mode & 0o777` accepted a source change from `0600` to `04600`
  and reported it as unchanged.
- **P2 — parent-directory retargeting escapes source identity checks.** Leaf
  `O_NOFOLLOW` does not pin a symlinked parent. Retargeting the parent from
  physical directory A to an identical B during the callback returned success
  because only names, masked modes, and hashes were compared.
- **P2 — the branch amended its own governed contract.** Target `773e959`
  forbids `*token*` paths, which also conflicts with the generated ticket's own
  token-bearing filename. Branch commit `e96a723` removed those two patterns so
  scope could pass. The original contradiction needs explicit governance
  reconciliation; it must not be concealed as an implementation result.
- **P3 — a virtual Proxy can synthesize a plain count response.** Prototype,
  key, and descriptor traps over an empty target were accepted and branded as a
  valid count despite the plain-response criterion.

## Verification Reviewed

- Focused contracts: 12/12.
- Full suite: 739 passed, 15 optional skips, 0 failed.
- Quickstart: 6/6.
- Diff and branch scope checks: PASS.
- Ticket check: expected failure because this reviewer note did not yet exist
  at reviewed head.
- No provider, credential, private-result, network, or spend activity.

## Required Changes

1. Capture all authoritative integer operations and reproduce the poisoned
   global attack for both reservation paths.
2. Bind cleanup to the created directory's physical identity and fail closed
   without deleting a substituted path or leaking the renamed owned directory.
3. Compare complete permission mode and stable source identity, including a
   parent-symlink retarget reproduction.
4. Reject proxy-synthesized response shapes before branding a count.
5. Reconcile the self-conflicting original scope contract explicitly, retain
   the audit trail, and rerun fresh independent review.

## Recommendation

Reopen BRN-0021. Do not accept, merge, or use these primitives in a live
launcher until all findings have permanent tests and a fresh reviewer returns
no P0-P3 issue.

## First Cumulative Rereview

Fresh rereview of exact clean pushed repair head `156f763` against reconciled
target `8a880e2` confirmed all six original findings fixed and the scope
reconciliation genuinely present on target main. It also confirmed descriptor-
based cleanup deletes the renamed owned inode, preserves a replacement path,
aggregates combined callback/source/cleanup failures, and fails closed when
Linux `/proc/self/fd` resolution is unavailable.

The rereview correctly reopened four additional P1-class intrinsic-poisoning
gaps. Mutable `Array.prototype.unshift` could swallow a callback exception;
mutable `push` could swallow a detected source-mode change; mutable
`String.prototype.startsWith` could admit scratch beneath the source namespace;
and a poisoned array iterator could make WAL/SHM enumeration skip both
sidecars. No other P0-P3 finding was confirmed in that pass. The reviewer made
no edits or private/provider access.

The cumulative specialist repair removes prototype-dependent collection and
iteration from the custody path, captures the required string/sort/stat/file-
handle operations before callbacks, supplies its own exact error iterable, and
adds all four reproductions. A second fresh cumulative rereview is required.
