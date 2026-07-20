# Graph compiler recommendations

These recommendations are deliberately separate from
`GRAPH_COMPILER_HISTORIES.md`. The history document is the map; this is my
judgment after walking it.

Related docs:

- `BASIS_TO_GRAPH_REDUCTION.md` explains why the event-boundary plan is also a
  lens/substrate problem.
- `ALLOCATION_FREE_GROWTH.md` records the constraint on finite graph-native
  growth.
- `CATALAN_HAMILTONIAN_PLAN.md` gives the handoff from the Lisp machine to the
  Catalan-space simulator.
- `MACHINE_BOUNDARIES.md` defines `read`, `step`, `lens`, `root`, `agent`,
  and the memory-bank boundary for future allocation work.
- `LINK_FRONTIER_KERNEL.md` records the first pair-local kernel-clock result
  and the remaining boundary around computed constructor state.
- `PHASE_ORBITS.md` introduces projected phase/orbit readout for live streams.

## Short version

Keep `main` as the canonical working system.

Do not abandon the July graph-native work, but do not replace `main` with it
yet. Treat it as the next research branch: valuable, close, but not yet a
complete replacement because it still completes ordinary calls in `link` and
uses host-side delayed-edge state for changed recursive futures.

The best next move is not another broad rewrite. It is one narrow experiment:

```text
compile a source-authored root that visibly steps a 2-bit register
```

If that works, the graph-native `step` path becomes much more credible because
state change has moved into the compiled root instead of the dashboard. The
older event-boundary question remains important, but the immediate benchmark
is clearer: compile once, then step/read `00 -> 01 -> 10 -> 11 -> 00`.

## Best current compiler

The best current compiler is the fable/true-shape compiler on `main`.

Why:

- it has the smallest complete semantic account;
- it supports SKI, partial application, recursive knots, Scott data,
  structural recursion, arithmetic, residual open programs, loops, and WASM;
- it preserves the pair-only runtime boundary;
- it has a tiny observer/reader;
- it now keeps names outside the machine through explicit legends;
- `the-program-that-already-happened.md` still describes it well.

Its limitation is also clear: the compiler is doing reduction before runtime.
That is not a bug in this model. It is the model. The runtime reads a record of
causes that already happened.

## Most promising research to revive

### 1. Passive machine ports

Revive from the May passive observer line:

- input events;
- output events;
- machine sockets;
- carried machine state;
- source-step boundary.

This is the strongest prior route toward a graph-native OS. It should not be
copied wholesale, but the tests and shapes are worth mining.

### 2. Graph-native event boundaries

Revive from `graph-native-link-from-main` and the old observe/select split.

The crucial distinction is:

```text
event/container != payload/value
```

In `main` this is external:

```js
const event = observe(graph)
const value = event[1]
```

In a pure-step graph, the distinction must be structural. A candidate event
shape could be something like a pair whose right edge loops or advances through
an explicit continuation, while its left edge exposes the payload. The exact
shape is still open, but the requirement is not.

### 3. Delayed futures

Keep the delayed-future idea from:

- `79331d1` Add delayed future contract
- `aaffb8a` Materialize delayed futures

This is the best answer so far to changed recursive arguments and unbounded
growth. But do not call it complete until the delayed edge is represented as
pair/memory structure rather than a JavaScript side table.

### 4. Trace corpus as an oracle

Use `research/debris/alt-compilers/traces` as history-shape tests.

Final-result tests are not enough. The traces encode whether the computation
still has a visible causal path. That matters for this project more than it
would in an ordinary compiler.

### 5. April phase boundaries as a thinking tool

Do not resurrect the full April pipeline unless needed. But when design gets
blurry, ask which phase owns the new idea:

```text
parse? expand? construct/link? materialize? observe? serialize?
```

That older branch is useful as a conceptual ruler.

## What I would not revive now

### Lazy `observe`

`lazy-stitch` proves something important, but it puts too much knowledge into
`observe`. It makes observation active: it searches calls, understands
definitions, completes applications, and mutates the graph.

That is a good prototype and a poor final machine.

### All-parentheses source

The all-parens experiment is beautiful, but it currently adds syntax pressure
before the engine is settled. If labels already live in the legend and can be
omitted in display, there is no need to introduce more syntax right now.

### Single-slot WASM atoms

Single-slot atoms may be right in a future flat-memory representation, but they
should wait until the address convention and event/delayed-future story are
settled. Otherwise it risks optimizing a memory shape that is still moving.

### A broad syntax layer

Keep parser/source convenience thin until the engine boundary is stable. The
source may eventually need a convenience layer, but it should not decide graph
semantics by accident.

## Suggested next branch

Create a narrow branch from `main`, not from the heavier research branches.

Possible name:

```text
live-root-register
```

Goal:

```text
Can a source-authored root carry a 2-bit register and advance it after
compilation without host-side counting?
```

Start with tests only, then the smallest code needed.

Acceptance criteria:

- the graph handed to the machine is still pair-only;
- names remain legend-only;
- current `main` behavior remains the oracle;
- the root is compiled once and then stepped repeatedly;
- CLI/test output shows `00 -> 01 -> 10 -> 11 -> 00`;
- the host does not choose the next state or feed in a counter;
- repeated reading does not accidentally consume the payload;
- a visible event can expose its payload while preserving a next/history edge;
- no arity, symbol, or definition logic moves into `observe`/`step`;
- WASM implications are written down before changing WASM.

## A possible sequence of work

1. Add tests that name the live loop.

   Do not start by changing compiler structure. First write tests that express:

   - one compiled root can be stepped repeatedly;
   - each step exposes the next 2-bit value;
   - repeated reading does not itself advance the state;
   - the same shape can be serialized and imaged.

2. Try the boundary in source before adding host machinery.

   This follows your intuition that much of the problem may be "writing the
   source correctly." If a source-level `Event`, `Yield`, or `Loop` can express
   the boundary, prefer that over compiler logic.

3. Only then revisit `link + step`.

   If the event boundary works structurally, bring back the graph-native
   linker tests from `graph-native-link-from-main`.

4. Delay WASM changes.

   Keep WASM as proof of the current pair-only machine until JS has a clear
   graph shape for events and delayed futures.

5. Update `the-program-that-already-happened.md` only after the model changes.

   Right now it describes `main`. A pure-step graph-native machine would be a
   different essay, or a new section.

## The deeper answer

I do not think the history shows that you lost a better complete compiler.

It shows that you found several partial truths:

- March found structural sharing and time-as-collapse.
- April found phase discipline and live recursive materialization.
- May found passive observation and graph-local machine ports.
- June found the compact fable compiler and fixed WASM reader.
- July found the pressure to move identity, history, and observation
  boundaries into source/graph structure.

The current `main` is the best whole system. The next better system is likely
not hiding as a prior branch. It is probably the composition of:

```text
main's true-shape compiler
+ May's graph-local machine/event intuition
+ July's graph-native event/delayed-future tests
```

That is the seam I would cut next.
