const e=`# From Basis to graph-reduction

This note records how the older \`~/basis\` project relates to the current
\`graph-reduction\` work, what carried forward, what changed, and what that
suggests for the next phase.

The short version:

\`\`\`text
Basis asks whether Catalan structure can support causality, computation,
and dynamics.

graph-reduction tries to turn that question into a small executable machine.
\`\`\`

Lisp is not just a demonstration language here. Lisp is the authoring layer for
causal structure. The simulator is the graph-native observer moving through
that structure.

Related docs:

- \`GRAPH_COMPILER_HISTORIES.md\` records the branch and commit archaeology.
- \`GRAPH_COMPILER_RECOMMENDATIONS.md\` gives the current engineering plan.
- \`ALLOCATION_FREE_GROWTH.md\` isolates the runtime-growth constraint.

## What Basis was doing

\`~/basis\` is the broad research laboratory. It contains:

- the Catalan Light Cone paper and supporting notes;
- Catalan/Dyck/Motzkin generators and bijections;
- collapse-policy and motif experiments;
- a pointer-graph evaluator for SK/lambda-style programs;
- a kernel abstraction for replayable actions, reducers, and schedulers;
- a trace/visualization system.

The conceptual center is the claim that Dyck paths, full binary trees, and
parenthesized pair structures are different coordinate systems on one Catalan
object.

Each view emphasizes a different aspect:

- Dyck paths show causal prefix order, height, area, and scaling limits.
- Trees show recursion, locality, and substructure.
- S-expressions show computation and authorable pair structure.

The important discipline in \`basis\` is that physics-facing ideas are not added
as independent state. Observables, phases, collapse policies, and amplitudes
are functions of the Catalan object or of local events on it.

That is the mathematical anchor.

## What graph-reduction changes

\`graph-reduction\` is more radical and more concrete.

The older graph evaluator in \`basis\` used explicit node kinds:

\`\`\`text
pair, binder, slot, symbol, empty
\`\`\`

The current compiler compresses those roles into raw pair shape and identity:

\`\`\`text
atom        left=self, right=self
slot        left=self, right=definition
answer      left=self, right=result
definition  pending pair whose right edge is a slot pointing home
application everything else
\`\`\`

This is the right direction for the present project. The substrate is no
longer a tagged graph describing a machine. The substrate is the machine.

Names moved to a legend. That is not a cosmetic choice. It preserves the rule:

\`\`\`text
the observer does not know symbols
\`\`\`

The runtime boundary is now extremely small:

\`\`\`js
observe(pair):
  follow left edges until the left edge is self
\`\`\`

The cost is that the compiler currently writes the causal record in advance.
Runtime observation reads that record. This is why the current system feels
like "the program already happened."

That is not a bug in the current model. It is the present model's honest
meaning.

## What carried forward

The strongest continuities are these.

### 1. Pair structure is the primitive

Both projects begin from the same pressure:

\`\`\`text
What if cons-pairs are enough?
\`\`\`

In \`basis\`, this was connected to Catalan objects and pair-local dynamics.
In \`graph-reduction\`, it becomes a stronger implementation rule: even roles
like atom, slot, answer, and definition should be recognized by shape rather
than by tags.

### 2. Collapse is causal

The old rule:

\`\`\`text
(() x) -> x
\`\`\`

can still be read as the seed of the current observation rule.

Mechanically, the old rule says that a settled or empty left edge releases the
right edge. The current rule generalizes the boundary condition from syntax to
identity:

\`\`\`text
left is self -> locally settled
\`\`\`

So emptiness and self-reference may be two views of the same local fact:

\`\`\`text
no unresolved exterior dependency
\`\`\`

This does not mean "nothing exists." It means "nothing is owed here." In that
sense an atom/self-loop is a zero of obligation, not an absence of structure.

### 3. The observer is a lens

\`basis\` names a useful split:

\`\`\`text
(lens, substrate)
\`\`\`

The substrate is conserved structure. The lens is the current reading,
frontier, focus, or observer state that turns a partial order into a sequence.

The current \`graph-reduction\` machine has mostly substrate, plus a tiny
host-side lens. The central next question is whether the lens can also become
graph structure.

### 4. Traces are evidence

For ordinary compilers, final result tests are often enough.

Here they are not. The trace is the visible causal path. If a change produces
the right answer while erasing the path, it may be wrong for this project.

This is why the old trace corpus and the dashboard remain important.

### 5. Loops are finite representations of infinity

Both projects return to loops because unbounded unfolding cannot be represented
literally in finite memory.

The current compiler's recursive knot is a major result:

\`\`\`text
infinite unfolding -> finite self-consistent cycle
\`\`\`

This is not merely an optimization. It is one of the system's core claims about
how infinite potential can have finite structure.

## Where the current system is aligned

The current \`main\` branch is well aligned with the deeper project in these
ways:

- pair-only runtime graph;
- symbols outside the observer;
- tiny passive \`observe\`;
- true structural sharing by identity;
- recursive knots for self-consistent loops;
- partial application as inert future structure;
- Scott data as a practical discipline for avoiding eager branch expansion;
- WASM image proving that the machine can read graph bytes directly.

This is why \`main\` should remain the canonical working system for now.

It is small enough to reason about and complete enough to run meaningful Lisp.

## Where the current system is not aligned yet

The unresolved gaps are also clear.

### 1. The observer is not fully graph-native

The host still performs the sequence:

\`\`\`js
event = observe(graph)
value = event[1]
\`\`\`

That means the event/payload distinction is still partly outside the graph.

The next machine should make this distinction structural.

### 2. The lens is outside the substrate

The current graph does not yet carry a first-class observer state:

- current focus;
- prior event/history;
- next potential;
- visible output;
- continuation;
- available/free structure.

The old \`basis\` lens/substrate split says exactly what is missing. The answer
is not to reintroduce a large external observer. The answer is to find the
smallest pair structure that acts as the lens.

### 3. Growth is still compile-time or prelinked

If a graph is finite, deterministic, non-mutating, and non-allocating, repeated
stepping eventually becomes periodic.

So "allocation-free growth" has only three honest forms:

1. a finite history prewritten into the graph;
2. a periodic graph with a growing external projection;
3. graph-internal allocation from already available free structure.

The first is already consistent with "the program already happened." The third
is the path toward a graph-native OS.

### 4. Computation is mostly compiled history

The compiler currently performs reduction while constructing the graph. The
runtime reads the resulting causal record.

This is coherent, but it is not yet a live graph-native simulator. To get
there, the observer/lens and event boundary must move into the graph.

## Physics-facing interpretation

The physics analogies should guide questions, not override the machine.

Useful prompts:

- What is conserved across a step?
- Which identities survive?
- Which obligations are discharged?
- Which futures become inaccessible from this observer path?
- Which structures are fixed points?
- Which apparent infinities are finite loops?

The zero point should be read carefully. In the graph, "empty" does not have to
mean absence. A self-loop is complete local reference. It can be read as a
vacuum-like boundary condition: no unresolved exterior dependency.

Likewise, creation and destruction may be observer language. The deeper event
may be identity plus state transition:

\`\`\`text
before: unresolved dependency
after:  same causal record, newly settled/readable relation
\`\`\`

Dirac/QM concepts are worth mining in this spirit:

- sequence versus symmetry;
- dual readings of one structure;
- conserved identity through local transitions;
- finite representation of infinite background structure;
- event boundaries rather than persistent little objects.

But the project should remain anchored to executable structure. The code is the
proof machine. The mathematics is a checksum and vocabulary, not the driver.

## Recommendations

### 1. Keep \`main\` canonical

The current compiler is the best complete system:

- it runs useful Lisp;
- it preserves the pair-only machine boundary;
- it supports recursion, Scott data, arithmetic, residuals, loops, and WASM;
- it is small enough to inspect.

Do not replace it with a heavier research branch until the replacement is both
smaller in principle and at least as complete in behavior.

### 2. Make the event boundary structural

The most important next experiment remains:

\`\`\`text
represent observe/select as graph structure
\`\`\`

The goal is not a nicer API. The goal is to stop requiring the host to decide
what the event means.

Acceptance criteria:

- \`observe\` remains passive and tiny;
- names remain outside the observer;
- the graph contains the event/payload distinction;
- repeated observation does not accidentally consume the payload;
- the visible trace still shows the causal path;
- WASM can eventually read the same structure.

### 3. Reintroduce only the smallest lens

From \`basis\`, revive the lens/substrate idea, not the whole tagged evaluator.

Look for a pair-only observer state carrying:

\`\`\`text
(focus, context/history)
\`\`\`

or an equivalent shape. This should be authored or produced as ordinary graph
structure, not as a new host object if possible.

### 4. Use Lisp source to search for the machine

Before adding compiler machinery, try to write the observer loop in source.

This follows the current project rule:

\`\`\`text
source should reveal the structure before code special-cases it
\`\`\`

If a \`Loop\`, \`Yield\`, \`Event\`, or related source pattern expresses the event
boundary, prefer that over new compiler logic.

### 5. Treat allocation-free growth honestly

For the immediate CLI demonstration, use prelinked finite history:

\`\`\`text
build-time: allocate the causal record
runtime:    traverse existing edges
view:       show accumulated event history
\`\`\`

For actual unbounded graph-native growth, do not pretend no allocation exists.
Instead, make allocation internal: a graph-resident arena, free list, or unused
future material consumed by the machine.

### 6. Keep trace-shape tests

Add tests that assert not only final values but intermediate structures.

The simulator is meant to study dynamics. A correct answer with the wrong
history is not necessarily correct.

### 7. Keep the epistemic layers explicit

Borrow the discipline from \`basis\`:

\`\`\`text
fact
model choice
interpretation
open question
\`\`\`

This will let the project remain ambitious without letting physical metaphor
blur mechanical claims.

## A concrete next path

The next branch should be narrow.

Suggested goal:

\`\`\`text
Can a graph-resident event/lens make observe/select structural?
\`\`\`

Suggested sequence:

1. Add tests for repeated observation of an event boundary.
2. Try to express the boundary in \`core.lisp\`.
3. If source cannot express it, add the smallest compiler support.
4. Keep \`observe\` unchanged unless the graph shape forces a smaller rule.
5. Add a CLI trace that shows event, payload, and next/history separately.
6. Only after JS is clear, update WASM.

The guiding invariant:

\`\`\`text
A step should move a graph-resident observer from one event boundary to the
next without the host deciding what the event means.
\`\`\`

That is the bridge from \`basis\` to the current machine.
`;export{e as default};
