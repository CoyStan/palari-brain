# Recall, Reinforce, Compress

## A discussion proposal for self-organizing conversational memory

**Status:** Early research idea, written to invite criticism and experimentation.

## The idea in one paragraph

Long-term memory for an AI assistant should not behave like a static database
that retrieves whichever stored sentences are closest to the current question.
It should learn, over the course of a relationship, which memories tend to be
useful together, which recollections lead to good decisions, and which repeated
patterns can be compressed into higher-level concepts. Before answering, or
asynchronously after answering, the system can sample several small views of
its memory, imagine the answers those views would support, compare them, and
reinforce the useful paths. After the real interaction produces a consequence,
that observation corrects the system's earlier introspection. Over time, the
memory graph reorganizes itself around the particular user and the particular
relationship.

## Why ordinary retrieval is not enough

Most current memory systems have roughly the same shape:

1. Store text, summaries, or extracted facts.
2. Embed the user's question.
3. Retrieve the nearest memories.
4. Put those memories into the model's context window.
5. Generate an answer.

This is useful, but it treats memory as a passive archive. Similarity is not the
same thing as usefulness. A memory can matter without resembling the question.

Suppose an assistant knows that "Paco" is a nickname for Pedro. The statement
"Paco is Pedro" may not belong in the final answer, but it may be essential for
finding Pedro's company, the relevant legal matter, and the correct statute.
It is a routing memory: it unlocks the evidence that should enter the context.

Likewise, an assistant that has worked with the same lawyer for a year should
not approach every question as if it had just received an entire law library
from a stranger. It should have learned the lawyer's language, recurring
clients, frequently used authorities, preferred working style, and the
situations in which external legal research is necessary.

The goal is therefore not merely to remember more. It is to learn how to
remember for this relationship.

## The central hypothesis

> Under a fixed context budget, repeatedly sampling memory subgraphs,
> comparing the responses they support, reinforcing useful paths, and
> reversibly compressing repeated structures will produce a hierarchical,
> personalized memory without requiring a hand-designed ontology of memory
> types.

The proposal has four ingredients:

1. **Stochastic recall:** retrieve several different small subgraphs rather
   than always taking one deterministic nearest-neighbor result.
2. **Introspection:** use a model to imagine and compare the answers supported
   by those different recollections.
3. **Grounding in outcomes:** after one answer is actually given, use the next
   real observation to correct the introspective judgment.
4. **Reversible consolidation:** when several memories repeatedly behave as a
   unit, create a higher-level node that can stand in for them while retaining
   links to the original evidence.

No individual ingredient is entirely new. The research question is whether
their combination creates an effective learning memory system.

## One real action, many imagined alternatives

In a real conversation, the assistant cannot give one hundred answers and see
which one works. It gets one shot. But it can privately consider alternatives,
just as a person can think through several interpretations before speaking.

The process separates imagination from action:

```text
BEFORE OR AFTER THE LIVE ANSWER          AFTER THE WORLD RESPONDS

sample memory view A                     observe the real consequence
sample memory view B                     compare it with expectations
sample memory view C                     correct the introspector
imagine possible answers                 update long-term recall
compare and discard alternatives
```

Only one answer is sent. The other answers are counterfactual simulations, not
observations of reality.

This distinction is essential. The system must never turn "I considered that
Paco might be Pedro" into "the user confirmed that Paco is Pedro." Imagined
content can train a recall policy, but it cannot become canonical evidence.

## Two learning signals

The proposal distinguishes introspective value from observed value.

Let:

- \(H_t\) be the canonical history at interaction \(t\).
- \(G_t\) be the current derived memory graph.
- \(q_t\) be the current question.
- \(C\) be a sampled memory context.
- \(a\) be the answer supported by that context.
- \(o_{t+1}\) be the next observation from the user or environment.

An introspector estimates how well a context and answer are likely to work:

\[
I_t(C,a) = V_\phi(H_t,q_t,C,a) \approx \mathbb{E}[F_t]
\]

After the real outcome arrives, the system interprets what happened:

\[
F_t = J(H_t,q_t,a_t,o_{t+1})
\]

The prediction error is:

\[
\delta_t = F_t - I_t(C_t,a_t)
\]

This error teaches the system two things:

- whether the selected memory paths were useful;
- whether its own introspection was trustworthy in this kind of situation.

The introspective signal is therefore not a second source of truth. It is a
forecast of later value. When reality disagrees, the introspector should learn
from the disagreement.

The observed outcome need not be a clean thumbs-up or reward number. It may be
a correction, continued use of the answer, a failed tool call, a contradiction,
a changed decision, or simply the next turn of an ambiguous conversation. A
model may still need to interpret that event. The interpretation is fallible,
but it can become calibrated by repeatedly predicting what later happens.

## Sampling memory

For a question \(q_t\), the system samples contexts from a learned policy:

\[
C_i \sim \pi_\theta(C \mid q_t,G_t)
\]

The context budget should be measured in tokens rather than a percentage of
nodes because nodes can have very different sizes:

\[
\operatorname{tokens}(C_i) \le B
\]

A practical sampler could combine query-conditioned starting points, weighted
graph walks, and a small probability of exploring weak or unfamiliar paths.
The exact mixture is an experimental question rather than part of the core
claim.

Random negative memories provide diversity, but counterfactual negatives are
more informative:

```text
the original context
the context without memory A
the context with neighboring memory B replacing A
the context with one compressed node replacing A + B + C
```

The marginal contribution of a memory can be estimated by comparing a context
with and without it:

\[
\Delta_A = Q(C) - Q(C \setminus \{A\})
\]

With enough offline computation, this begins to resemble an approximate
Shapley-value analysis over memories. It also reveals interactions: two nodes
may be useless independently but decisive together.

## Memory should learn its own chunks

The most important extension is consolidation. If several memories are
repeatedly activated together, the system can propose a higher-level node:

```text
              Paco's Acme litigation
                /       |        \
       Paco = Pedro    Acme     case 42
                                  |
                              Article 17
```

The higher-level node acts like a learned memory token. For many questions it
may replace all of its children, saving context and search effort. When exact
dates, wording, provenance, or exceptions matter, the node expands back into
the underlying evidence.

A proposed consolidation should be tested behaviorally. Given a group of
children \(D\) and proposed supernode \(z\), replay previous questions and ask
whether the compressed form preserves the useful behavior:

\[
M(q,D) \approx M(q,\{z\})
\]

The supernode is valuable when it preserves answer quality while using less
context:

\[
\operatorname{utility}(z) \approx \operatorname{utility}(D)
\quad\text{and}\quad
\operatorname{tokens}(z) \ll \operatorname{tokens}(D)
\]

This should be a soft, reversible collapse. The raw memories remain available
and retain their provenance. A later contradiction may weaken the supernode,
split it, or create temporal branches. Consolidation is an index over evidence,
not permission to destroy evidence.

Over time, the graph can develop several levels:

```text
raw interactions
    -> recurring memory groups
        -> people, matters, habits, and procedures
            -> higher-level models of the relationship
```

This resembles learned tokenization: frequently useful combinations receive a
compact representation of their own.

## Asynchronous learning

Generating many alternatives on the live request path would create terrible
latency. The user-facing path should remain small:

```text
question
  -> read the latest completed memory snapshot
  -> retrieve one context
  -> generate one answer
  -> record the episode
  -> return immediately
```

The expensive work happens afterward:

```text
recorded episode
  -> sample alternative memory contexts
  -> generate short imagined answer plans
  -> compare them
  -> update provisional retrieval weights
  -> propose and test consolidations
```

When the next user or environmental observation arrives, it closes the prior
episode and supplies the factual correction. If background work finishes before
the next request, the next answer uses the updated graph. If it does not, the
next request uses the last completed snapshot and does not wait.

This means the system optimizes future interactions rather than spending an
unbounded amount of time perfecting the immediate response.

Cheap models may be an advantage here. The background system does not need to
write polished answers. A small model can generate compact answer plans,
identify assumptions, predict consequences, and make pairwise comparisons.
The strong model is reserved for the one response shown to the user.

```text
strong answer model       one live response
small imagination model   many short offline candidates
small critic              pairwise comparisons
occasional strong audit   calibration of the small critic
real interactions         eventual grounding signal
```

Pairwise preference may be enough: given two sampled contexts and their answer
plans, which one would have supported the interaction better, or are they
indistinguishable? This provides a learning direction without requiring a
large, hand-authored taxonomy of rewards.

## Why this might work

### It turns conversation into continual training data

Every interaction produces a query, a retrieved context, an answer, an
introspective expectation, and eventually another observation. Even when the
observation is ambiguous, a long relationship provides repeated weak signals.
The system does not require every turn to contain an explicit correction.

### It amortizes expensive thinking

Offline sampling can happen during the natural gap between conversations.
Useful conclusions and consolidated nodes are then reused across future
questions. Work performed once can improve many later interactions.

### It can learn non-semantic routes

The graph can reinforce paths that embedding similarity misses: aliases,
causal links, recurring procedures, temporal transitions, and combinations of
facts that only become useful together.

### It separates fluent judgment from reality

Self-evaluation alone can create a loop in which a confidently wrong system
rewards itself. Prediction error gives the introspector a chance to learn that
some of its confident judgments are unreliable.

### Compression creates abstraction

Repeatedly useful groups become concepts. The memory system can gradually move
from recalling individual sentences to recalling a compact model of a person,
project, case, or working relationship, while retaining the ability to inspect
the original evidence.

## What may be innovative

Several neighboring ideas already exist:

- [Self-Consistency](https://arxiv.org/abs/2203.11171) samples multiple
  reasoning paths and aggregates their answers.
- [Self-Rewarding Language Models](https://arxiv.org/abs/2401.10020) use a
  language model to generate preferences for improving itself.
- [Reflexion](https://arxiv.org/abs/2303.11366) stores verbal reflections from
  experience for later decisions.
- [Generative Agents](https://arxiv.org/abs/2304.03442) synthesize low-level
  observations into recursively higher-level reflections.
- [A-MEM](https://arxiv.org/abs/2502.12110) dynamically links memories and
  evolves their representations as new memories arrive.
- [DiffPool](https://arxiv.org/abs/1806.08804) learns hierarchical graph
  coarsening through soft node-to-cluster assignments.
- [Hopfield Networks Is All You Need](https://arxiv.org/abs/2008.02217)
  connects attention with associative memory retrieval and describes attractor
  states representing individual memories or subsets of memories.
- [Sleep-time Compute](https://arxiv.org/abs/2504.13171) moves useful reasoning
  away from latency-sensitive test-time inference.

The proposed contribution is not any one of these mechanisms. It is their
closed-loop combination:

> Sample different remembered contexts, let their proposed responses compete,
> use the one observed outcome to calibrate introspection and assign credit,
> and allow repeated successful combinations to become reversible higher-level
> memory nodes.

The especially unusual parts appear to be:

1. Learning the **recall graph**, rather than only model parameters or stored
   reflections, from response-level consequences.
2. Treating internal simulations as provisional counterfactuals and later
   interactions as calibration data.
3. Learning both retrieval weights and the granularity of memory itself.
4. Performing this learning asynchronously so that it improves future turns
   without delaying the current one.
5. Personalizing the resulting hierarchy to one continuing relationship.

This novelty claim is provisional. A serious literature review may find closer
precedents, and that would help sharpen the proposal.

## Main risks

### Self-confirming errors

If imagined candidates are generated and judged by the same weak model, they
may agree for the same wrong reason. Exploration, later observations, and
periodic independent audits are necessary.

### Sycophancy

User approval is not identical to correctness. In factual domains, documents,
tool results, corrections, and real task outcomes must remain part of the
observed world. The system should learn a user's working style without learning
that familiar claims are automatically true.

### Counterfactual blindness

Only the selected answer changes the real interaction. The next user response
cannot be treated as factual evidence about answers that were never sent.
Those alternatives must retain lower-confidence, simulated credit.

### Destructive compression

A concise supernode can conceal exceptions or temporal changes. Raw evidence
must remain reachable, and every derived node must be invalidated when its
supporting evidence is corrected or deleted.

### Rich-get-richer retrieval

Frequently sampled nodes may become stronger simply because they were already
easy to sample. Random exploration, weight decay, uncertainty, and
counterfactual removal tests are needed to keep rare memories discoverable.

### Ambiguous outcomes

Many user responses do not clearly indicate success or failure. When the
outcome is uninformative, the correct update may be little or no durable
update. The system should preserve uncertainty rather than manufacture a
reward.

## A first falsifiable experiment

The first implementation should be a small Python research harness, not a
production integration. A synthetic conversational world can provide ground
truth that real conversations cannot.

Construct an environment with:

- thousands of noisy memory nodes;
- a small number of relevant nodes per question;
- aliases and indirect routing facts;
- recurring preferences and procedures;
- temporal updates and contradictions;
- one external answer and one subsequent observation per turn.

Compare six systems:

1. Static top-\(k\) semantic retrieval.
2. Random-walk sampling without learning.
3. Learning from introspection only.
4. Learning from observed outcomes only.
5. Introspection calibrated by observed outcomes.
6. The full system with reversible consolidation.

Sweep at least these variables:

- memory granularity: full turn, proposition, and learned hierarchy;
- context budget: 0.5%, 1%, and 2% of total memory tokens;
- background samples: 1, 4, 8, 16, and 32;
- exploration rate and walk depth;
- frequency and aggressiveness of consolidation;
- strength and bias of the imagination and critic models.

Measure:

- improvement on the next and later interactions;
- cumulative answer quality;
- live response latency;
- background token and compute cost;
- context tokens consumed;
- recovery after a correction;
- calibration of introspective predictions;
- compression ratio;
- errors introduced by merging memories;
- survival of rare but important memories.

The key result is not whether the full system eventually performs well. It is
whether outcome-calibrated introspection improves future recall more reliably
than static retrieval, and whether learned consolidation reduces context cost
without destroying correction recovery.

## Minimal invariants

The cognitive organization should be learned, but a few system boundaries
cannot safely be emergent:

- Canonical observations remain separate from simulations.
- Derived memories retain links to their supporting evidence.
- Corrections and deletions invalidate every dependent representation.
- User and workspace isolation cannot be modified by learned weights.
- Background updates are versioned and cannot overwrite newer state.

In short:

> Be rigid about evidence, identity, deletion, and concurrency. Be flexible
> about how memory organizes itself.

## Closing thought

Current AI memory mostly asks, "Which stored text resembles this question?"
The proposed system asks a different question:

> Which ways of remembering have repeatedly helped me understand and act well
> in this particular relationship, and what higher-level concepts can I learn
> from that experience?

If the idea works, long-term memory would stop being a passive extension of the
context window. It would become a learned, evolving part of the agent's
intelligence.
