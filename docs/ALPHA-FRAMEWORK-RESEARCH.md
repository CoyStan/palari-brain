# Alpha agent-framework research

Date: 2026-08-07. Scope: official open-source repositories only. This is an
architecture survey, not a feature or popularity ranking. Palari needs a fast
single-agent memory-debug loop; it does not currently need a general agent
framework.

## The 20 repositories

| # | Official repository | Adopt | Avoid for Palari alpha |
|---:|---|---|---|
| 1 | [OpenAI Agents SDK for JavaScript](https://github.com/openai/openai-agents-js) | One explicit `run` boundary, small primitives, optional tracing. | Provider-specific SDK ownership and handoff machinery in the memory kernel. |
| 2 | [OpenAI Agents SDK for Python](https://github.com/openai/openai-agents-python) | A runner owns the loop while models and tools stay replaceable. | Copying a second language implementation or multi-agent handoffs. |
| 3 | [LangGraph](https://github.com/langchain-ai/langgraph) | Explicit state and resumable steps are useful when a workflow truly branches. | A graph/state-machine abstraction for today's linear write–retrieve–answer diagnosis. |
| 4 | [PydanticAI](https://github.com/pydantic/pydantic-ai) | Dependency injection makes provider-free tests and provider swaps ordinary. | Bringing Python validation/runtime dependencies into this Node project. |
| 5 | [Mastra](https://github.com/mastra-ai/mastra) | TypeScript-native composition and local developer workflows. | Its broad workflow, deployment, observability, and integration platform surface. |
| 6 | [smolagents](https://github.com/huggingface/smolagents) | Keep the agent loop understandable in one file with a strict step bound. | Code-generating agents and general tool ecosystems for a fixed memory pipeline. |
| 7 | [AutoGen](https://github.com/microsoft/autogen) | Separate model clients from orchestration; bound tool iterations. | Multi-agent conversations; the repository itself now directs new users to Microsoft Agent Framework. |
| 8 | [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | Provider-neutral clients and explicit workflow boundaries. | Enterprise orchestration, distributed runtimes, and cross-language scope during prototype repair. |
| 9 | [CrewAI](https://github.com/crewAIInc/crewAI) | Clear task inputs and outputs can make diagnostics readable. | Roles, crews, delegation, and process ceremony around a single memory path. |
| 10 | [Agno](https://github.com/agno-agi/agno) | Treat framework overhead and latency as product constraints. | AgentOS, team, knowledge, UI, and serving layers before the core behavior works. |
| 11 | [Google ADK](https://github.com/google/adk-python) | Code-first local runs and model/provider seams. | Deployment, multi-agent hierarchy, sessions, and evaluation platform adoption. |
| 12 | [Strands Agents](https://github.com/strands-agents/sdk-python) | A small model-driven loop with hooks at real safety boundaries. | Hook/plugin proliferation and cloud integration before stable behavior. |
| 13 | [BeeAI Framework](https://github.com/i-am-bee/beeai-framework) | Observable events and replaceable model/tool interfaces. | General multi-platform framework and catalog complexity. |
| 14 | [Semantic Kernel](https://github.com/microsoft/semantic-kernel) | Keep connectors behind narrow interfaces. | Planner/plugin abstractions and enterprise compatibility layers in the prototype. |
| 15 | [LlamaIndex](https://github.com/run-llama/llama_index) | Make retrieval stages explicit and independently inspectable. | A large ingestion/index/query ecosystem when Palari already owns canonical storage. |
| 16 | [Haystack](https://github.com/deepset-ai/haystack) | Plain components with explicit typed inputs/outputs compose into a visible pipeline. | A full pipeline framework or document-store replacement. |
| 17 | [Letta](https://github.com/letta-ai/letta) | Memory is active system state; expose what entered context and why. | Replacing Palari's kernel with a server/platform or adding autonomous memory policies now. |
| 18 | [Mem0](https://github.com/mem0ai/mem0) | Keep extraction, storage, and retrieval replaceable; test the user journey directly. | Mirroring its provider/vector-store integration matrix inside core orchestration. |
| 19 | [Graphiti](https://github.com/getzep/graphiti) | Temporal provenance and revisable relationships are valuable retrieval concepts. | Making a graph/database service mandatory before basic recall is reliable. |
| 20 | [DSPy](https://github.com/stanfordnlp/dspy) | Optimize prompts only against a stable metric and stable pipeline. | Automated prompt optimization while failures are still primarily plumbing failures. |

## Decision

Do not install any of them. Adopt four small patterns directly:

1. smolagents: a short, bounded loop visible in one runner;
2. OpenAI Agents SDK: one `run` boundary and optional diagnostics;
3. PydanticAI: dependencies injected rather than discovered globally;
4. Haystack: writer, embedder, reranker, and answer are explicit components.

The repeated lesson is progressive complexity: begin with a single runner and
add graphs, persistence, distributed execution, teams, and formal evaluation
only when the working product demands them. Palari had reversed that order.

## What this changes

The default path is now a provider-free contract test plus one reusable debug
runner. The runner accepts injected questions and dependencies, writes mutable
diagnostic JSONL, bounds retries, continues after row failures when requested,
and reserves a declared worst-case cost before each stage. Debug output is not
a benchmark grade. The broader product suite remains available through
`npm run test:legacy`; superseded machinery remains at release tag
`v0.1.0-alpha.1`.
