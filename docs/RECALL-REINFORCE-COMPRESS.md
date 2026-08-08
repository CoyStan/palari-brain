# Recall, Reinforce, Compress (RRC)

## Relationship-scale attention for self-organizing agent memory

**Status:** Early research idea, written to invite criticism and experimentation.

## The idea in one paragraph

A transformer uses parameters learned during training to compute transient,
query-conditioned interactions among tokens during a forward pass. Recall,
Reinforce, Compress (RRC) proposes an external, persistent routing and
consolidation mechanism that may learn across interactions which source-bearing
experiences should be exposed to the model. The system samples small views of
memory, compares the answers those views support, and may compress repeated
structures into provenance-linked higher-level nodes. Verified outcomes can
then train the routing policy without rewriting the shared language model.

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

> Under fixed live-context and background-compute budgets, an outcome-trained
> sparse routing policy over a persistent evidence graph may preserve more of
> the useful behavior of an oracle full-memory reader than static retrieval.
> Reversible, provenance-linked routing abstractions may further reduce context
> cost without increasing decision distortion.

The proposal has four ingredients:

1. **Stochastic recall:** retrieve several different small subgraphs rather
   than always taking one deterministic nearest-neighbor result.
2. **Introspection:** use a model to imagine and compare the answers supported
   by those different recollections.
3. **Grounding in outcomes:** after one answer is actually given, use explicit
   corrections or independently verifiable task outcomes to calibrate the
   introspective judgment.
4. **Reversible consolidation:** when several memories repeatedly behave as a
   unit, create a higher-level node that can stand in for them while retaining
   links to the original evidence.

No individual ingredient is entirely new. The research question is whether
their combination creates an effective learning memory system.

## RRC as a structural interpretation of attention

RRC is inspired by attention, but it is not an implementation of transformer
attention over an external text graph. The following calculation is a narrow
motivating model, followed by the different objective that an operational RRC
system would actually optimize.

### Idealized external-attention readout

Suppose memory contains \(N\) nodes. Node \(i\) has a key \(k_i\), describing
when it is relevant, and a value \(v_i\), containing what it contributes. Given
query vector \(q\), a standard attention head assigns:

\[
p_i(q)=
\frac{\exp(q^\top k_i/\sqrt d)}
{\sum_{j=1}^{N}\exp(q^\top k_j/\sqrt d)}
\]

and mixes all memory values:

\[
h(q)=\sum_{i=1}^{N}p_i(q)v_i
\]

RRC cannot afford to place every remembered experience into every prompt. It
instead samples memories from a cheaper learned distribution:

\[
i_s \sim r_\theta(i\mid q,G)
\]

An idealized importance-sampling estimate of full attention is:

\[
\hat h_S=
\frac{1}{S}
\sum_{s=1}^{S}
\frac{p_{i_s}}{r_{i_s}}v_{i_s}
\]

Its expectation is the full attention result:

\[
\begin{aligned}
\mathbb E[\hat h_S]
&=
\frac{1}{S}
\sum_{s=1}^{S}
\sum_i r_i\frac{p_i}{r_i}v_i\\
&=\sum_i p_i v_i\\
&=h
\end{aligned}
\]

Therefore, in this simplified setting:

\[
\boxed{
\mathbb E[\text{sampled memory representation}]
=
\text{full attention representation}
}
\]

The result is important but limited. Given exact importance correction,
learning \(r_\theta\) changes sampling efficiency and variance; it does not
personalize the expected representation, which remains the fixed target
\(h\). Computing normalized \(p_i\) also requires the denominator over all
\(N\) memories, eliminating much of the intended saving.

If samples are independent, importance weights have finite variance, and the
downstream answer computation \(f\) is Lipschitz-continuous, its expected
deviation is bounded by the sampling variance:

\[
\mathbb E[\|f(\hat h_S)-f(h)\|]
\le
L\sqrt{\operatorname{Var}(\hat h_S)}
=O\left(\frac{1}{\sqrt S}\right)
\]

Graph walks violate the independent-sample assumption unless their mixing is
accounted for, and importance weights can have enormous variance when \(r_i\)
is small where \(p_i\) is large. More fundamentally, prompt-based RRC samples
correlated, token-budgeted subgraphs, orders source text in a prompt, and asks
a nonlinear LLM to answer. It never constructs \(\hat h_S\).

This identity motivates sparse sampling, but it does not describe an
implemented RRC system or establish equivalence to running a transformer over
the complete relationship history.

The actual outcome-trained routing hypothesis is closer to:

\[
P_\theta(y\mid q,G)
=
\sum_C
\pi_\theta(C\mid q,G)
P_M(y\mid q,C)
\]

Here changing \(\pi_\theta\) genuinely changes expected behavior because the
language model receives different discrete evidence. Whether learning that
policy improves held-out interactions is an empirical question, not a result
of the importance-sampling identity.

### Graph walks provide persistent stochastic routing

An attention-like graph router would combine a persistent relationship
association \(w_{ij}\) with a query-dependent gate \(g_\theta\):

\[
P_{ij}(q)
\propto
\exp\left(w_{ij}+g_\theta(q,k_i,k_j)\right)
\]

If \(x_0\) is the query-conditioned initial activation, an \(L\)-step walk
produces an activation distribution. With node values collected in \(V\), a
corresponding retrieved representation would be:

\[
h_L(q)=x_0(q)P(q)^L V
\]

A transformer attention matrix is also row-normalized:

\[
A=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt d}\right)
\]

and one attention head computes \(H'=AV\). Both operations can be viewed as
message passing through row-normalized matrices, but the similarity stops
there. Transformer attention is recomputed across heads and layers during a
forward pass. RRC proposes persistent associations combined with a current
query gate and returns source-bearing text to a separate model.

The analogy can be summarized as:

```text
Transformer                         RRC

tokens                              experiences
attention within one inference      recall across interactions
temporary attention matrix          persistent relationship graph
backpropagation                     outcome-corrected reinforcement
hidden representations              reversible memory supernodes
general population learning         individual relationship learning
```

### Full-context prompting is one boundary strategy

RRC can be written as the problem of finding a useful context while paying for
its size:

\[
\min_\theta
\mathbb E_{C\sim\pi_\theta}
\left[
\ell(M(q,C),o)
+\lambda\operatorname{tokens}(C)
\right]
\]

Choosing \(C=G\) places every memory into the model's context. It is one
boundary strategy in the policy class when complete memory fits and context
cost is ignored. Setting \(\lambda=0\) does not force an optimizer to choose
that strategy because irrelevant context may still increase answer loss. RRC
asks whether a learned sparse policy can outperform static retrieval at a
fixed context and compute budget, with an oracle full-memory reader serving as
a comparison when it is feasible.

This framing also defines the limit of the proposal. Given infinite context,
free computation, perfect attention, instant personalization, exact deletion
from model weights, and no provenance requirements, an external RRC layer
would provide little additional capability. Its benefit comes from the actual
constraints under which persistent assistants operate.

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

After a later observation arrives, the system may interpret what happened:

\[
F_t = J(H_t,q_t,a_t,o_{t+1})
\]

The prediction error is:

\[
\delta_t = F_t - I_t(C_t,a_t)
\]

This prediction error calibrates the introspector. It is not, by itself,
sufficient credit for the retrieval policy: one answer can depend on several
retrieved memories, evidence selection, composition, and the answer model's
use of that evidence. A separate credit-assignment method must establish which
decision contributed to a verified outcome.

The introspective signal is therefore not a second source of truth. It is a
forecast of later value. When reality disagrees, the introspector should learn
from the disagreement.

A later event need not be a clean thumbs-up or reward number. An explicit
correction, verified tool result, or measured task outcome may provide useful
feedback. The next user message by itself is only another observation: silence,
continuation, or agreement does not prove that the preceding answer was
correct. When no reliable outcome exists, the honest update may be no durable
update.

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

When the next user or environmental observation arrives, it may close the prior
episode, but only explicit or independently verifiable outcomes should be
treated as factual correction. If background work finishes before the next
request, the next answer uses the updated graph. If it does not, the next
request uses the last completed snapshot and does not wait.

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
- [Reflective Memory Management](https://arxiv.org/abs/2503.08026) builds
  memories at several granularities and refines retrieval from cited evidence.
- [MemRL](https://arxiv.org/abs/2601.03192) combines semantic retrieval with
  memory utilities learned from environmental feedback.
- [CoEvo-Mem](https://arxiv.org/abs/2608.01739) explicitly co-evolves a
  retrieval router and memory bank from task outcomes and trajectory feedback.
- [RoMeRL](https://arxiv.org/abs/2608.02508) studies the memory-reward trap in
  which irrelevant co-retrieved memories inherit misleading utility updates.

The proposed contribution is not any one of these mechanisms. It is their
closed-loop combination:

> Sample different remembered contexts, let their proposed responses compete,
> use verified outcomes to calibrate introspection, learn a defensible credit
> assignment over routing decisions, and allow repeatedly successful
> combinations to become reversible higher-level memory nodes.

Seen through the attention correspondence, RRC externalizes the part of a
language model that must change at a different speed. The base model remains
general, dense, shared, and slowly trained. The relationship-scale attention
layer becomes personal, sparse, rapidly updateable, persistent, and linked to
evidence. The claim is not that RRC introduces a completely different form of
intelligence. It applies familiar learning logic to a timescale and scope that
ordinary transformer inference does not retain.

The especially unusual parts appear to be:

1. Learning the **recall graph**, rather than only model parameters or stored
   reflections, from response-level consequences.
2. Treating internal simulations as provisional counterfactuals and later
   interactions as calibration data.
3. Learning both retrieval weights and the granularity of memory itself.
4. Performing this learning asynchronously so that it improves future turns
   without delaying the current one.
5. Personalizing the resulting hierarchy to one continuing relationship.

These recent systems make learned memory routing an active research direction,
not an untouched mechanism. Any RRC novelty claim must therefore rest on a
specific tested difference—such as relationship-scoped asynchronous routing
with reversible provenance-linked consolidation—rather than on reinforcement
of retrieval in general.

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

## A staged falsification path

The first experiment should not implement full RRC. It should determine
whether retrieval is actually the bottleneck. For every labelled case, record:

1. whether the required evidence was stored canonically;
2. whether retrieval returned the complete required evidence set;
3. whether the answer selected that complete set;
4. whether the selected evidence was materially used;
5. whether the answer was correct or the case was genuinely ambiguous.

This separates write, retrieval, composition, utilization, and ambiguity
failures. If an answer remains wrong when given oracle evidence, learned
routing cannot solve that case.

Only if conventional hybrid retrieval is a material, repeated bottleneck
should a small Python research harness test one mechanism: a learned utility
reranker over the same candidate pool. Compare it with exact search, embedding
search, hybrid rank fusion, and the existing reranker at the same context-token
budget. Use chronological held-out interactions rather than a random split.

Continue only if the learned router improves complete evidence-set recall on
held-out future interactions across several domains without regressing rare
facts, corrections, or temporal updates. Test it in shadow mode before it can
change live recall.

Self-generated rewards, online edge updates, random-walk sampling, imagined
answers, and autonomous consolidation should remain separate later
experiments. Adding them together first would make both success and failure
impossible to attribute.

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

Transformer attention computes how tokens interact during one inference using
parameters learned during training. The RRC hypothesis asks whether an
external relationship-scale router can learn across interactions how
source-bearing experiences should be exposed to a continuing agent.
