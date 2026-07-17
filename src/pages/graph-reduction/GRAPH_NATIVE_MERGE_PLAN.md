# Graph-native merge plan

This branch is a bridge from the working `main` compiler to a graph-native
engine. The goal is not to keep two systems. The goal is one small path:

```text
source text -> parse -> link -> graph + legend -> step -> view
```

This file is meant to be enough context to resume work after a context reset.

## Current branch state

Branch: `graph-native-link-from-main`

Commits on top of `main`:

- `2b9410a Add graph-native link contracts`
- `99b3fc5 Show linked graphs in the CLI`
- `0271aad Cover graph-native core source`
- `f31aad8 Document graph-native merge plan`
- `1c90231 Expand graph-native core`
- `a486f0b Cover graph-native call contracts`
- `3bdc3b1 Add graph-native loop fixture`
- `e96887d Fix CLI trace count`
- `30aa1f5 Add successor orbit fixture`

New files:

- `graph/link.js`: graph-native linker beside the existing `compile.js`
- `graph/step.js`: pure right-edge stepper
- `graph/link.test.js`: contract tests for pair-only linked graphs
- `core.graph.lisp`: graph-native source, not yet canonical `core.lisp`
- `loop.graph.lisp`: source-level loop fixture
- `successor.graph.lisp`: finite successor orbit fixture
- `GRAPH_NATIVE_MERGE_PLAN.md`: this plan

Existing files intentionally left in place:

- `graph/compile.js`
- `graph/observe.js`
- current `core.lisp`
- dashboard path using `compile + observe`
- wasm path using `observe + select`

The branch currently keeps `main` operational while making the new path runnable
from `node cli.js`.

## Research findings

The old and alternate implementations are useful in different ways, but none is
a drop-in replacement for `link + step`.

- `graph/compile.js` is the best behavior oracle. Its tests cover data
  constructors, structural recursion, arithmetic, open residuals, active-call
  sharing, and loops. It should stay until those behaviors have equivalent
  graph-native tests. It is not the target engine because it recursively reduces
  during compilation with a patience budget.
- `alt/compilers/traces/` is the best evidence for the desired compiled focus
  shape. The traces preserve an observable answer at the head of the original
  application spine, for example `S a b c` stages as roughly:

  ```text
  (((($ ((a c) (b c))) a) b) c)
  ```

  before exposing `((a c) (b c))`.
- `alt/compilers/` is stale as runnable code. Its `compile.test.mjs` imports a
  missing `compile.mjs`, and the latest numbered compiler no longer accepts the
  `(() focus)` source form its tests expect. Mine it for ideas, not code.
- `alt/observer/` is the best machine/root/IO theory lab. Its tests around
  closed machines, linked futures, next-only potential, and carried history are
  directly relevant to the delayed-future problem.

The current conclusion:

```text
compile.js          -> behavior oracle
alt/compilers/traces -> focus-shape oracle
alt/observer         -> machine/root/future oracle
link.js             -> branch engine path
```

## Invariants

These are the non-negotiable rules for the merge.

1. The runtime graph is pairs only.

   No raw source symbols may be reachable from the final linked graph. The
   regression for this is `assertPairs(graph)` plus `image(graph)`.

2. Names are not machine data.

   Names exist in the source and legend so humans can build and view the graph.
   The stepper, wasm machine, and eventual graph-native observer must not depend
   on symbol strings.

3. `step` stays boring.

   The current target is:

   ```js
   export const step = pair => pair[1]
   ```

   Do not move evaluator logic into `step`.

4. Do not lose the old observation boundary.

   The old `observe/select` split encoded two different things:

   ```js
   const found = observe(graph) // stable event/container
   select(found)                // payload/value
   ```

   Repeated observation was idempotent because `observe(found) === found`.
   If the new machine uses only `step(pair)`, this boundary must be represented
   in the graph itself. Otherwise stepping into `((a c) (b c))` continues into
   `(b c)` and then `c`.

5. Keep source linking separate from observation.

   `link` may construct the graph, scopes, identities, and explicit history
   structure. It should not grow into a hidden host observer. If a future event
   is needed, encode it structurally.

6. Prefer small, plain code over clever compression.

   The code should stay readable enough to explain mechanically in comments.

## Current concern

The current graph-native CLI output differs from `main`:

`main`:

```text
0 ((((() ((a c) (b c))) a) b) c)
1 (((() ((a c) (b c))) a) b)
2 ((() ((a c) (b c))) a)
3 (() ((a c) (b c)))
4 ((a c) (b c))
```

current branch:

```text
0 full linked source graph, including definitions
1 (((((S ((a c) (b c))) a) b) c) ())
2 ((a c) (b c))
```

This is not only a presentation difference.

The `main` trace is the internal left walk inside `observe`. The branch trace is
repeated right-edge stepping. But the branch also shows that `link` has already
copied the S body and placed `((a c) (b c))` in the graph during linking.

That means the new linker is still a bridge. It preserves more source shape and
uses a pure stepper, but it still performs compile-time call completion. The
final engine should push that causal/event boundary into graph structure rather
than relying on eager host-side reduction.

The trace corpus sharpens this concern: eager call completion is acceptable only
as long as it preserves the visible application focus shape. It must not turn
the linked graph into only the final answer, and it must not erase the path that
shows where the answer came from.

## Desired end state

Canonical files should eventually look like this:

```text
graph/
  parse.js       // text -> plain AST
  link.js        // AST/source -> pair-only graph + legend
  step.js        // pair -> pair[1]
  serialize.js   // human view; may use legend
  index.js

core.lisp        // graph-native canonical source
cli.js           // link + step trace
dashboard.js     // link + manual stepping/viewing
wasm/
  image.js       // pair-only graph image
  wasm.js        // exports step; no observe/select long-term
```

Files to remove or archive only after replacement is proven:

```text
graph/compile.js
graph/observe.js
```

## Implementation phases

### Phase 1: preserve and expand contract tests

Status: started.

Current tests already cover:

- bare atom links to self
- linked graph is pair-only
- linked graph can be imaged
- `S a b c` reaches `((a c) (b c))`
- partial calls remain visible until enough arguments arrive
- copied body calls work
- extra arguments remain after a completed call
- completed answers in head position keep reducing in the graph-native linker
- `B`, `C`, `W`, and `M`
- `True`, `False`, `If`, `Not`, `And`, `Or`, `Pair`, `First`, and `Second`
- root self-reference is pair-pure
- `core.graph.lisp` is image-safe
- `loop.graph.lisp` carries a source-level frame through a repeated orbit
- source-level observer state can be written
- a library can be carried through a source loop
- `Y I` ties a cycle
- `Zero` and `Succ` compose through stepping
- `successor.graph.lisp` exposes a finite dynamic successor orbit
- direct recursive calls with changed arguments report the missing delayed
  future boundary instead of overflowing the host stack
- trace-corpus-inspired focus staging for `(I a)`, `(K a b)`,
  `(S a b c)`, `(I (K a b))`, `(K (I a) b)`, `(K (S a b c) d)`,
  and `(S K K a)`

The trace-inspired tests intentionally do not assert exact serializer path
strings. They assert semantic identity, pair-only graph shape, and the important
staging fact: the application focus remains visible before the answer is
reached.

Next tests to port from `compile.test.js` before deleting `compile.js`:

- data constructors: `Nil`, `Cons`
- eliminators: `Head`, `Last`, `Length`
- arithmetic: `Add`, `Mul`
- open data stays symbolic/residual
- forward-reference behavior, or the intentional replacement rule if it changes

Intentional difference to review before deleting `compile.js`:

- The old compiler treated a computed answer in head position as inert in at
  least one `App (I I) a` case. The graph-native linker currently continues
  through that shape to `a`. This may be preferable, but it should be an
  explicit decision rather than an accidental incompatibility.

Do not require identical path strings from `main`. Require semantic identity
and pair-only graph shape.

### Phase 2: make observation boundaries explicit in the graph

Problem:

Pure `step(pair) = pair[1]` consumes the old stable wrapper. The old
`observe/select` design distinguished an event/container from its payload.

Target:

Represent observation events structurally. With `step(pair) = pair[1]`, the
minimal stable event shape is a fixed-right pair:

```js
event[0] === payload
event[1] === event
```

The view/select operation reads `event[0]`; the machine keeps stepping through
`event[1]`.

Current source-level observer tests can write a stable state such as:

```lisp
(Done payload Done)
```

That proves the boundary can live in source. It does not yet prove that source
can dynamically allocate a new stable event whose left edge is the exact
computed answer identity.

The first loop fixture is `loop.graph.lisp`:

```lisp
(Frame view next (view next))
(Loop view self (Frame view self))
(Y (Loop (S a b c)))
```

It makes a real repeated path: after setup, `step` returns to the same frame by
identity. This is useful as a visible loop, but it is still a bridge. Because
`link` eagerly completes calls, the frame contains the staged call structure
with the `S` answer visible inside it rather than a freshly allocated final
event whose left edge is only `((a c) (b c))`.

Rejected experiment:

- Wrapping every completed call as `[answer, self]` inside `link.finish` made
  final answers stable, but it froze intermediate calls such as `S K K a` before
  their copied bodies could compose. Event boundaries must be explicit in source
  or inserted only by a real observer/final-yield structure, not by every
  completed function call.

Still decide:

- how to build a fresh stable event for a computed payload without host-side
  observer logic
- whether the event also carries an explicit `next` state, or whether stability
  is enough for the current dashboard/CLI boundary
- Source-level observer definitions like `Observe`, `Loop`, and `Yield` should
  be the first place to express this, before adding host machinery.

Possible source-level shape to explore:

```lisp
(Observe x next (Event x next))
(Loop state question self (... self ...))
```

The exact names are not important; the structure is. The graph should contain
the boundary that the host currently simulates with `observe/select`.

The successor fixture records the boundary of the current bridge:

```lisp
(Grow n (Frame n (Grow (Succ n))))
(Grow Zero)
```

This is the shape we want eventually, but today it needs a real delayed future
edge. Without that edge, `link` can only build finite or already-cyclic futures
without hiding an evaluator in the host.

Acceptance tests:

- A repeated machine run can keep ticking without the dashboard deciding when to
  stop.
- The view can read the same stable payload repeatedly without stepping into
  `(b c)` and then `c`.
- The graph still images to pairs only.
- No string names are needed by `step` or wasm.

### Phase 3: reduce eager call completion in `link`

Problem:

`link` currently both:

1. links lexical identities, and
2. completes/copies calls when arity is satisfied.

That is why the CLI already contains `((a c) (b c))` in the linked graph.

Target:

Separate identity linking from event construction. Ideally, the linked source
should initially retain a visible application such as:

```text
(S a b c)
```

or the pair-folded equivalent, with enough graph structure for subsequent
stepping/observation to expose:

```text
((a c) (b c))
```

Approach:

- Keep the current eager linker as the baseline while adding tests.
- Identify the smallest structural marker needed for a redex/call event.
- Move body-copy construction from "during link" to "inside a graph event" if
  possible.
- If full graph-native body-copying is not yet possible, keep eager copying but
  make the event boundary explicit and documented as a bridge.

Do not make `step` inspect arity, symbols, or definitions.

### Phase 4: make graph-native source canonical

Only after phases 1-3 are stable:

1. Rename or replace `core.lisp` with graph-native source.
2. Keep the old source in `alt/` or a clearly named reference file if useful.
3. Update CLI and dashboard to read canonical `core.lisp`.
4. Keep `core.graph.lisp` only if it remains useful as a comparison fixture.

Acceptance:

- `node cli.js` on default source shows the graph-native trace.
- `npm test` passes.
- `npm run build` passes.
- wasm generation from canonical source succeeds.

### Phase 5: move dashboard to `link + step`

Current dashboard on `main` uses `compile + observe`.

Target:

- dashboard state contains the current graph focus, legend, source, history,
  and color scheme
- "Next" or "Step" calls `step(currentFocus)`
- if an event boundary is added, the dashboard views the event payload without
  deciding computation rules
- keep undo/reset simple

Avoid:

- autoplay/tick loops until the graph itself has a stable observer cycle worth
  watching
- external stability heuristics that become part of the semantics

### Phase 6: move wasm to pure step

Current wasm exports:

```text
observe(p)
select(p)
```

Target wasm exports:

```text
step(p) = mem[p]
```

This likely goes with right-edge addressing:

- pair address is its right word
- `mem[p]` is the right edge / next step
- left edge is at `p - 4`
- atoms may be single self-address words or padded/aligned cells; choose the
  simplest representation that keeps pair addresses distinguishable

Do this only after the JS graph path has a clear event boundary. Otherwise wasm
will faithfully reproduce the current "step into the payload" problem.

Acceptance:

- JS `step` and wasm `step` agree address-for-address
- generated module is source-independent except for data and legend sections
- canonical source images without raw symbols
- legend remains a display/debug artifact only

### Phase 7: remove old compiler path

Only delete `compile.js` and `observe.js` when all retained semantics have
ported tests under `link + step`.

Checklist before deletion:

- `compile.test.js` behavior has equivalent graph-native tests, or an explicit
  note explains why the behavior was intentionally dropped
- dashboard no longer imports `compile`, `observe`, or `select`
- wasm no longer imports/exports observe/select
- serializer no longer depends on `spellings` from `compile.js`, or that global
  map has been replaced by explicit legends
- `npm test`
- `npm run build`

## Commands to run during work

From `src/pages/graph-reduction`:

```sh
env GRAPH_SCHEME=plain node cli.js
env GRAPH_SCHEME=plain node cli.js loop.graph.lisp 12
node --test --test-reporter spec graph/link.test.js graph/serialize.test.js
npm test
env GRAPH_SCHEME=plain node wasm/wasm.js
npm run build
git diff --check
git status --short --branch
```

Use `git diff --stat main..HEAD -- src/pages/graph-reduction` to summarize the
branch for review.

## Known traps

- A serializer can hide raw strings. Always pair-check linked graphs and call
  `image(graph)` before trusting output.
- A test can pass by looking at a focus rather than the full graph. Keep testing
  full graph pair-purity.
- Repeated `step` is not the same thing as old `observe` tracing.
- A stable payload and a stable observation event are different things.
- Do not narrow the repo's default `npm test` to only graph-reduction tests
  unless that is an explicit separate decision.
- Do not replace canonical `core.lisp` until the graph-native path can carry
  the current examples with comparable clarity.

## Suggested next work

1. Return to the delayed-future/event-boundary problem with the trace shapes
   protected by tests.
2. Port the remaining `compile.test.js` behavior that matters before deleting
   `compile.js`.
3. Move the dashboard to `link + step` only after the event boundary is clear.

The next implementation target is still the old `observe/select` idempotence
distinction expressed as graph structure. The important point is to preserve the
old "found event vs selected payload" distinction without putting logic back
into `step`.
