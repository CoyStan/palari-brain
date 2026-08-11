# Long, pasted, and repeated content — survey and policy

Decided 2026-08-01 (founder, in session; ledger entry in
`docs/DECISIONS.md`). This records how recognized memory systems handle
long messages, pasted documents, and repeated content, what Palari Brain
already does, and the resulting policy, so the question is not re-derived
from scratch.

## What Palari Brain does today (verified offline, 2026-08-01)

Replaying the extreme case through the real write path with a
deterministic reducer showed:

- Every durable paste is stored byte-for-byte as canonical evidence, every
  time. There is no content dedup across different `sourceMessageId`s;
  exact replay of the same `sourceMessageId` with the same bytes is an
  idempotent no-op.
- An interaction that cannot fit the 40,000-character reducer envelope
  quarantines deterministically on the first attempt
  (`REDUCER_INPUT_CAPACITY`): it stays canonical and searchable, later
  interactions flow past it, the digest reports `ready_with_gaps` with a
  `blocked` count, and `memoryFreshness` reports staleness honestly.
- Quarantined is not lost: `memory_find` returns bounded snippets and
  `memory_read` returns the complete uncut body, so `answerWithRetrieval`
  can still consult the paste. Plain `answerQuestion` (digest-only) will
  not see it.
- `forgetWithReport` deletes paste turns wholesale by phrase and reports
  residual mentions.
- A document passed via `sourceTexts` instead of message text is never
  stored at all (`externalSourcesIgnored`), and `retention: 'ephemeral'`
  skips the whole turn.

The real cost of the extreme case is journal growth (disk plus `find`
latency) and earlier `digest_incomplete` refusals during pre-digest
canonical fallback. The digest itself is protected by construction.

## How others handle it (surveyed 2026-08-01, primary sources)

| System | Long messages | Documents vs chat | Repeated content |
| --- | --- | --- | --- |
| Mem0 | No ingestion limit; raw messages are not durably kept (OSS keeps a rolling 10-message window); memory is extracted facts only | Same extraction pipeline; the prompt extracts facts from shared material | MD5 exact-hash guard, then top-10 vector search injected into the extraction prompt; v3 additive-only |
| Zep / Graphiti | Hard cap 4,096 chars per message (400 error beyond; official integrations truncate to 4,000) | Separate `graph.add` business-data path (10,000 chars/call); docs advise detecting pasted documents and rerouting them as attachments | Entity/edge dedup: exact name, MinHash/LSH, then LLM; duplicate facts append provenance to the existing edge |
| Letta (MemGPT) | Context summarizes/compacts near 90% capacity; evicted turns stay searchable in recall | Separate folders/files upload, chunked (~300 tokens) and embedded; in-context file views size-capped | No mechanical content dedup; filename-level handling for uploads; agent-mediated consolidation |
| LangMem / LangGraph | Background extraction debounced until activity settles; separate summarization for context | Documents belong to thread state / RAG, not long-term memory | LLM reconciliation against top-5 similar memories; profiles upserted in place |
| LlamaIndex | Memory is a FIFO (30K-token budget); overflow flushes ~3K-token batches to memory blocks — the fact extractor never sees whole transcripts | Documents go through IngestionPipeline into an index, a different object from chat memory | Exact doc_id+hash skip at document ingestion; prompt-level fact dedup plus a condense pass |
| ChatGPT / Claude / Slack / Discord (products) | The composer intercepts the paste event and converts large pastes to attachments (ChatGPT: over 5,000 chars, later 10,000, official release notes; Claude earlier, community-documented; Discord over 2,000 chars; Slack snippets, 40K truncation) | Files/pastes live in a file store; memory layers store only small distilled facts | Fact-level, inside the memory layer |

The convergent pattern has three layers: (1) catch bulk content at the
composer and reify it as a document object; (2) run documents and chat
through different channels; (3) keep long-term memory as small distilled
facts, deduped cheaply first (exact hash) then semantically.

Palari differs from the frameworks in one deliberate way: it keeps a
lossless canonical journal (the evidence law), where Mem0 discards raw
messages and Zep refuses them past 4,096 characters. That is why bulk
content must be routed out before ingest rather than "handled" inside the
kernel.

## Distinguishing typed text from pasted text

Post-hoc classification of pasted text is brittle: the only real prior art
is email reply/quote parsing (Mailgun Talon, GitHub email_reply_parser),
whose own documentation catalogs the failure modes, and no surveyed
product infers "this was pasted" from content after the fact. Every
shipped product captures the client-side paste event instead, where
provenance is free.

`src/quote-context.mjs` already provides the post-hoc backstop
(forwarded-mail markers, header clusters, quoted-reply runs), correctly
positioned so its failure mode is cheap: an `asserted` memory downgrades
to `uncertain`; nothing is misrouted.

## Policy

1. **Application composer, not kernel.** The integrating application
   intercepts large pastes at the paste event (threshold on the order of
   4,000 characters; industry range 2,000-10,000), presents them as an
   attached document with a per-paste user choice (insert as text /
   attach / remember), and routes attached documents as `sourceTexts` at
   ingest. The same threshold at send catches oversized non-paste
   messages.
2. **No new kernel mechanism now.** `sourceTexts`,
   `retention: 'ephemeral'`, the bounded reducer envelope with loud
   quarantine, and the quote-context guard already implement the
   receiving side of the industry pattern.
3. **Held in reserve, pending pilot evidence:** a content-hash "seen
   before" ingest hint (per-turn SHA-256s already exist in the canonical
   manifests) so an application can decline to store an identical copy.
   Open a scoped, reviewed change only if pilot usage is demonstrably
   paste-heavy.
4. **Rejected as a build target:** post-hoc pasted-text classification as
   a routing mechanism. The quote-context guard remains an epistemic
   backstop only.
5. **Parked as a separate future decision:** "remember this document"
   (a chunk-and-embed document index beside chat memory). Out of current
   repository scope.

## Sources

Officially documented: [ChatGPT release notes (paste-to-attachment
thresholds)](https://help.openai.com/en/articles/6825453-chatgpt-release-notes),
[ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq),
[ChatGPT file storage](https://help.openai.com/en/articles/20001052-file-storage-and-library-in-chatgpt),
[Anthropic memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool),
[Anthropic context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing),
[Discord long-paste-to-file](https://support.discord.com/hc/en-us/articles/1500005466681-File-Preview),
[Slack snippets](https://slack.com/help/articles/204145658-Create-or-paste-code-snippets-in-Slack),
[MDN paste event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event).

Framework internals, read from official repositories at 2026-07/08 HEAD:
[Mem0 pipeline](https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py)
and [docs](https://github.com/mem0ai/mem0/blob/main/docs/core-concepts/how-it-works.mdx);
[Zep limits](https://github.com/getzep/zep/blob/main/ingestion/src/zep_ingest/threads.py)
and [Graphiti dedup](https://github.com/getzep/graphiti/blob/main/graphiti_core/utils/maintenance/dedup_helpers.py);
[Letta constants and file processor](https://github.com/letta-ai/letta/blob/main/letta/constants.py);
[LangMem conceptual guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)
and [LangGraph memory concepts](https://docs.langchain.com/oss/python/concepts/memory);
[LlamaIndex memory](https://docs.llamaindex.ai/en/stable/module_guides/deploying/agents/memory/)
and [ingestion dedup](https://docs.llamaindex.ai/en/stable/module_guides/loading/ingestion_pipeline/).
Post-hoc detection prior art: [Talon](https://github.com/mailgun/talon),
[email_reply_parser](https://github.com/github/email_reply_parser).

Verification honesty: ChatGPT thresholds are official release-notes
content; Claude.ai's paste-to-attachment behavior and Zep's
"detect pasted documents" guidance were verified only through community
documentation and search snippets of the official pages; framework
internals were read from their official repositories directly. No claim
here rests on a search snippet alone except where stated.
