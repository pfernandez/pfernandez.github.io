# Graph compiler histories

This is an archaeological map of the graph-reduction work as preserved in Git.
It is based on the full path history for `src/pages/graph-reduction` across
all local and remote branches, plus selected milestone snapshots.

The project has not followed one straight line. It has repeatedly circled the
same boundary:

```text
How much computation belongs in source structure,
how much belongs in the compiler,
and how little can the observer/machine know?
```

Related docs:

- `BASIS_TO_GRAPH_REDUCTION.md` connects this history to the older `~/basis`
  research program.
- `GRAPH_COMPILER_RECOMMENDATIONS.md` turns this history into a current plan.
- `ALLOCATION_FREE_GROWTH.md` focuses on the runtime-growth constraint.

## Current branch map

`main`
: The current lean system. It keeps the fable/true-shape compiler, explicit
  legends, serializer, dashboard, and the pair-only WASM image/machine.

`graph-compiler-research`
: The archive branch. It preserves the graph-native branch artifacts and the
  copied `~/.dotfiles/debris` research under `research/debris/`.

`Simplify-compiler`
: The radical July linker branch. It explores source-shaped graph linking,
  pure right-edge stepping, source-level identities, and the removal of
  observer conditionals.

`graph-native-link-from-main`
: A bridge branch from `main` toward a graph-native `link + step` engine. It
  keeps `compile.js` as behavior oracle while adding `graph/link.js`,
  graph-native source files, event/history fixtures, and delayed futures.

`lazy-stitch`
: A June branch that moves reduction into observation: `observe` walks,
  completes calls on demand, and mutates the graph as it goes.

`finish-live-recursive-compiler`
: The late-April live recursive compiler. It developed hidden witness/crossing
  materialization, source tests, and coverage around recursive graph identity.

`unify-graph-compiler-pipeline`
: The late-April pipeline consolidation. It reduced `compile` to a public
  `parse -> encode -> construct` pipeline and returned richer encoded graph
  terms.

`origin/clarify-graph-compiler-phases`
: The explicit compiler-phase branch. It split responsibilities into parse,
  expand, construct, materialize, serialize/projection, and documentation.

`origin/observe-local-step-strategy`
: The April local-step branch. It separated local contraction from reduction
  search and used `step` for dashboard progression.

## Path 1: visual collapse and structural sharing

Representative commits:

- `dd6cd28` Added collapse interpreter/visualizer
- `d4118fc` Treat collapse as time step
- `7df6963` True structural sharing
- `fecf110` Note on collase order/causality
- `9994fd4` Expose stable trace to UI
- `2791cfb` Initial focus implementation
- `88cc8fd` Focus as fixed observer
- `1531396` Stationary observer plane

This was the earliest graph-reduction shape in this repo. The language was
still close to a visual reducer: collapse, stable traces, binary tree views,
and explicit UI snapshots.

The first important discovery was that sharing had to be real reference
identity, not a repeated printed label. The commit `7df6963 True structural
sharing` is an early milestone because later designs keep returning to the
same point: if two future branches share a cause, they should share an object.

The second discovery was temporal: `d4118fc Treat collapse as time step` and
the causality note around `fecf110` show the move from "reduce this term" to
"observe a causal transition." That vocabulary eventually becomes the
`observe/select` boundary and later the question of graph-native history.

What survived:

- reference identity matters more than printed equality;
- traces are not just debugging, they are the observer's path;
- the UI is valuable when it shows structure, not when it invents semantics.

What was left behind:

- too much visual/proof scaffolding;
- too much model abstraction around what later became ordinary pair identity.

## Path 2: link stacks, de Bruijn indices, and binder pairs

Representative commits:

- `41f7815` Link stack with tests
- `570e64a` Build graphs from De Brujin indices
- `dbf4f08` Stop precomputing "stable"
- `2e2f6ab` Binder pairs
- `9f64002` Binder pairs at slots rather than arguments
- `39570da` Step graph reduction one input at a time
- `b4ce4f4` Parse Basis-style graph reduction programs
- `2b42516` Simplify graph reduction runtime

This path tried to get names, binding, and application into the graph without
depending on a conventional evaluator. The important branch-point was where
binder identity lived. The messages show a correction:

```text
Binder pairs
Binder pairs at slots rather than arguments
```

That is a precursor to the current slot model. A variable is not just a symbol;
it is a place in a graph, and its identity is determined by how it points back
to its definition.

The de Bruijn experiment also matters. It was an attempt to erase source names
and make binding positional/structural. The later system rejected De Bruijn
indices as the primary source model, but kept the deeper lesson: names are not
runtime facts.

What survived:

- slots are the natural home of binding identity;
- source names are construction aids, not machine data;
- stepping one input at a time is the right shape for observation.

What was left behind:

- De Bruijn encoding as the canonical user-facing/compiler shape;
- binder-specific machinery once slot geometry could say the same thing.

## Path 3: explicit compiler phases and hidden witnesses

Representative commits:

- `6324d7c` Document observer semantics
- `571fd75` Prepare graph reduction compiler tests
- `8e84e33` Add folding instruction serialization
- `54ee695` Render tree as folding projection
- `4a80f0a` Cover source Lisp prelude
- `304d4ea` Add stateless Y loop
- `106073f` Carry unchanged Z state
- `e55c1f1` Support structural Z state loops
- `ddafcd8` Separate Lisp construction pipeline
- `70a4955` Prove S wiring with one active identity
- `5713d28` Failing test for Y, Z
- `e6e93a8` Preserve live graph identity while compiling programs
- `c5ed17d` Expose direct program materialization for live graphs
- `c2b9851` Cover nested hidden witness payload projection
- `d178ed9` Return rich encoded graph terms
- `2b5e617` Document graph compiler architecture and plan

This was the most compiler-engineering-heavy line. It introduced a clearer
pipeline and a more elaborate representation:

```text
parse -> expand/encode -> construct -> materialize -> project/serialize
```

The branch documentation says the machine sees only atoms, empty lists, pairs,
reference identity, and shared continuations. Compiler and serializer carry the
rest. That boundary is excellent and still matches the current direction.

The milestone `70a4955 Prove S wiring with one active identity` is especially
important. It isolates the `S` combinator as a structural-sharing proof rather
than only as a reduction result. The live-recursive commits then test whether
Y/Z-style recursion can preserve identity through materialization.

The cost was complexity. The system had hidden witnesses/crossings, numeric
templates, compatibility projection, and phase machinery. Some of that was
real discovery, but much of it is now superseded by the fable compiler's
smaller geometry:

```text
atom        left=self, right=self
slot        left=self, right=definition
answer      left=self, right=result
definition  pending pair whose right edge is a slot pointing home
application everything else
```

What survived:

- phase clarity;
- cycle-aware application/template search as a useful idea;
- materialization tests as a guard against false visibility;
- the insistence that `observe` not know Lisp names or compiler metadata.

What was left behind:

- numeric template slots as primary syntax;
- hidden witness/crossing terminology;
- compatibility projection as a central mechanism.

## Path 4: passive observer and graph-local machines

Representative commits:

- `7ee96b7` Atomless collapse, passive observer experiment
- `47f6bb7` Extract minimal observer
- `d6afe2f` Move toward structural observer
- `c2e0b55` Structural identity and history preservation
- `7f98b51` Add passive observer core
- `1bd7efa` WebAssembly core
- `e92b4ba` Encode passive observer probes
- `a4d80a9` Expose carried observation frame
- `a4823ac` Use I as graph root
- `ba6af50` Fold graph root into observe
- `b39063f` Probe linked passive futures
- `ba40709` Probe passive future selection
- `8799cd3` Expose output from closed orbit
- `8ac3a66` Probe closed machine ports
- `8333979` Probe closed machine composition
- `ace5bbd` Separate causal events from IO ports
- `af5093a` Probe graph memory and IO
- `f22ce07` Make passive observation relative
- `69afcc4` Add passive Lisp compiler
- `12c951b` Support recursive passive definitions
- `b335195` Use runtime observe directly
- `ee907c9` Pass passive functions as values
- `b889b6f` Add passive Lisp kernel source
- `7a6d9fa` Document passive graph theory
- `49ac2d9` Add step-shaped passive machine target
- `deea6b9` Chain passive machine states
- `5ab0ef3` Add passive machine IO helpers
- `317232c` Add passive machine ports
- `d16361a` Pair input events with machine sockets
- `4283d61` Carry machine output events
- `bc120b8` Add machine source step
- `683a161` Prove source step definitions
- `1aa0932` Add passive Lisp REPL

This was the strongest exploration of a graph-resident machine. The passive
README describes the core step as:

```text
[observer, focus] -> selected future
```

The observer walks the left spine of the focus until it finds a pair whose
first slot is the observer, then returns that pair's next slot. Observation
does not allocate, mutate, normalize, or consult global state.

The later machine commits add ports, input events, output events, state chains,
and source stepping. This is where the "OS" direction first becomes concrete:
not just a compiler that writes a graph, but a graph that can carry a machine
state and communicate at structural boundaries.

This line was not kept as `main` because it still had host-side machine helpers
and more framework than the fable compiler needed. But it may contain the best
prior work for the future graph-native observer/root problem.

What survived:

- observation should be passive;
- machine state can be ordinary graph structure;
- IO can be modeled as graph events at ports;
- a source kernel can define booleans, pairs, and numerals without primitives.

What was left behind:

- observer-root ceremony that did not yet remove host interpretation;
- REPL and machine wrappers before the core compiler was settled.

## Path 5: fable/true-shape compiler

Representative commits:

- `0d4a732` Simplified compiler + pair local
- `60dedba` Return the pair instead of next
- `0794179` flat vs spine
- `29f9f86` Tie option
- `164c76e` Tie is not optional
- `82c7769` Refactor; use select and step functions
- `4acd84d` Eliminate scope tracking during stitching
- `937598d` Atoms as interned self-loops
- `40e0c61` Wasm
- `b79f70c` Throw on divergence; clean up/add comments
- `05f2d13` Flesh out core Lisp functions
- `098ae29` Split graph modules
- `6009d53` Separate wasm presentation
- `ba170dd` Create graph legend during compile
- `552a68b` Legend-based serialzer

This is the line that became current `main`.

The fable compiler made a major simplification: instead of carrying explicit
phase objects or observer machines, it treats definitions as graph pictures of
their own application. Slots are self-left cells pointing back to their
definition. A completed call creates an answer cell, substitutes argument
identities into a copied body, and leaves the original application spine as the
observable path to the answer.

The key conceptual milestones are:

- `60dedba Return the pair instead of next`
  - `observe` returns the stable event/container, not the payload.
  - `select` reads the right side afterward.
  - This makes observation idempotent.

- `164c76e Tie is not optional`
  - recursive tying becomes normal structure, not a compiler mode.

- `4acd84d Eliminate scope tracking during stitching`
  - once definitions and slots have enough identity, stitching can read shape.

- `937598d Atoms as interned self-loops`
  - atoms become graph-native identity cells.

- `b79f70c Throw on divergence; clean up/add comments`
  - recognizes that the compiler may diverge even when the machine cannot.

- `40e0c61 Wasm`
  - proves the emitted runtime can be a fixed reader over pair memory.

This line is also where `the-program-that-already-happened.md` belongs. It
accurately describes the main machine: compile writes a causal record;
runtime observes/selects by following pointers.

What survived:

- the strongest complete compiler;
- recursive knots;
- Scott-style data, arithmetic, lists, and residual open programs;
- WASM equivalence;
- explicit legend as display/debug metadata.

What remains unresolved:

- the compiler still performs reduction before runtime;
- computed answers in head position are inert by design;
- unbounded growth needs either compiler history or graph-native allocation;
- `observe/select` is still an external reader, not a graph-resident observer.

## Path 6: lazy stitching

Representative commits:

- `da16773` Lazy step: reduce on demand, one rewrite at a time
- `01e5d85` Observation reduces: fold search into observe

This branch starts from the true-shape compiler and asks whether evaluation can
move from compile-time into observation. It succeeds in an operational sense:
`observe` walks, discovers definitions, completes calls, and mutates the graph
on demand.

The branch is important because it proves that not all consequences need to be
precomputed. It points toward a real live graph machine.

But it violates a later standard: `observe` becomes smart. It knows about
definitions, slots, app stacks, and completion. For the current philosophy,
that makes it a useful rejected experiment rather than a replacement.

What survived:

- on-demand reduction is possible;
- a graph can be advanced without compiling all reachable futures first.

What was rejected:

- putting arity/call/reduction logic inside `observe`.

## Path 7: radical source/link simplification

Representative commits:

- `8297b62` Preserve source structure during wiring
- `523542a` Define graph identities in source
- `ccfc782` Make graph wiring pair-local
- `b23fd7f` Wire left-spine graph definitions
- `88dc0ff` Let roots introduce identities
- `472de66` Resolve bare symbols to enclosing pairs
- `e8d366c` Let empty parens reference the root
- `f2751fe` Repair pair-first compiler sketch
- `f38960f`, `a9a497f`, `2d7b141` desired shape with S
- `a97421e` Link parsed tree in place
- `6597869` Simplify definition walk
- `62bbd25` Link variables backward
- `856fb81` Use atoms for variables
- `9c34650` Successful S call via copied def
- `1e69c1d` Tie recursive calls
- `a4b6a23` Y, Zero, Succ
- `92cea7f` Move identity creation and nested spine into source
- `07c6bea` All parentheses
- `9b390a2` Derive definitions from graph
- `b5bac38` Add basic syntax layer
- `94d8d4a` Single agnostic encapsulated parser
- `1a0b0f7` Remove () from allowed syntax
- `d41df4d` Simplify source forms
- `6c10fe7` Replace conditional observation with pure stepper
- `9217206` Remove self-referential function label wrapper pairs
- `f46a776` Single-slot wasm atoms

This is the most intense simplification loop. It keeps asking:

```text
Can source itself carry enough identity that the linker gets smaller?
Can observation become only a step?
Can the graph preserve the original source shape?
Can definitions be derived from pair position instead of syntax?
```

Several ideas were tried and then backed away from:

- `()` as root/enclosing pair;
- all-parentheses source;
- self-referential label wrapper pairs;
- single-slot atoms in WASM;
- parser hooks and syntax layers;
- left/right symbol rules;
- definitions as leftmost/earliest source forms.

The strongest result of this branch is not the final code. It is the set of
constraints it clarified:

- source shape matters;
- labels should name graph identities but not enter the machine;
- automatic syntax should not hide the core engine;
- `step(pair) = pair[1]` is attractive only if the graph itself contains the
  old observation boundary.

What survived into `main`:

- explicit `{ graph, legend }`;
- serializer receives legend as an option;
- source syntax can be simplified later without changing the machine;
- caution around `()` as extra syntax.

What remains research:

- pure `step` replacing `observe/select`;
- single-slot WASM atoms;
- using source position alone to define all identities;
- deriving definitions fully from graph shape.

## Path 8: graph-native bridge from main

Representative commits:

- `2b9410a` Add graph-native link contracts
- `99b3fc5` Show linked graphs in the CLI
- `0271aad` Cover graph-native core source
- `f31aad8` Document graph-native merge plan
- `1c90231` Expand graph-native core
- `a486f0b` Cover graph-native call contracts
- `3bdc3b1` Add graph-native loop fixture
- `30aa1f5` Add successor orbit fixture
- `266eac5` Cover graph-native trace shapes
- `f684883` Document graph orientation
- `79331d1` Add delayed future contract
- `aaffb8a` Materialize delayed futures
- `53d72cc` Add event history stepping

This branch begins from working `main` and tries to reincorporate the radical
`link + step` discoveries safely.

It introduces:

- `graph/link.js`;
- `graph/step.js`;
- `graph/event.js`;
- graph-native source fixtures;
- tests for pair-only linked graphs;
- loop and successor fixtures;
- delayed recursive futures.

Its documentation correctly names the central issue: repeated right-edge
stepping is not the same as old `observe/select`. The old system distinguishes
between:

```text
observe(graph)  -> found stable event/container
select(found)   -> payload/value
```

If `step` only follows the right edge, that event/payload distinction must be
represented in the graph. Otherwise stepping into a result such as
`((a c) (b c))` continues into `(b c)` and then `c`.

The delayed-futures work is the best concrete attempt at unbounded growth so
far. It shows that changed recursive calls can remain finite until stepped
into. But in JavaScript it uses a side table of delayed edges, so it is still a
bridge, not the final pair-only machine.

What survived:

- graph-native test contracts;
- orientation as a construction/gauge choice;
- delayed futures as a model of on-demand history growth;
- the old `observe/select` boundary translated into an event-shape problem.

What remains research:

- delayed edges need a pair/memory representation;
- `link` still completes ordinary calls eagerly;
- pure `step` needs graph-native event boundaries before it can replace
  `observe/select`.

## Path 9: research consolidation and lean main

Representative commits:

- `92e1a95` Record pure step research
- `c8ad39f` Consolidate graph compiler research
- `5e234a6` Add program-that-happened essay
- `b79f7dc` Trim graph reduction main
- `8644f12` Clean graph serialization
- `552a68b` Legend-based serialzer

This is the current consolidation.

`graph-compiler-research` became the lab notebook branch. It preserves:

- graph-native branch artifacts;
- `alt/description.md`;
- old `alt/compilers` as `research/debris/alt-compilers`;
- copied debris from `~/.dotfiles/debris`;
- `graph-fable-5`;
- reports and runnable exploratory files.

`main` became the lean answer:

```text
graph/parse.js
graph/compile.js
graph/observe.js
graph/serialize.js
wasm/image.js
wasm/wasm.js
core.lisp
cli.js
dashboard.js
the-program-that-already-happened.md
```

The final API cleanup matters. The current compiler returns explicit display
metadata:

```js
const { graph, legend } = compile(source)
serialize(graph, { legend })
```

That keeps the machine graph pair-only while letting humans see names.

## Milestones that look like breakthroughs

These commits stand out as "crossed a boundary" moments rather than ordinary
cleanup:

`7df6963` True structural sharing
: Printed equality becomes insufficient. Object identity becomes semantic.

`d4118fc` Treat collapse as time step
: Reduction starts becoming causal observation.

`41f7815` Link stack with tests
: Binding becomes a tested graph-wiring process.

`9f64002` Binder pairs at slots rather than arguments
: Slot identity emerges.

`70a4955` Prove S wiring with one active identity
: `S` becomes the sharing proof.

`304d4ea` Add stateless Y loop
and `e55c1f1` Support structural Z state loops
: Recursion/fixed points become graph phenomena.

`c2b9851` Cover nested hidden witness payload projection
: The April materializer reaches a serious live-recursive milestone.

`1aa0932` Add passive Lisp REPL
: Passive observation becomes usable as a small language/machine boundary.

`0d4a732` Simplified compiler + pair local
: The fable compiler arrives as a compact replacement line.

`60dedba` Return the pair instead of next
: The idempotent observe/select split becomes explicit.

`164c76e` Tie is not optional
: Recursive tying becomes part of the universe, not an option.

`937598d` Atoms as interned self-loops
: Atom identity becomes pair-native.

`40e0c61` Wasm
: The pair machine is proven outside JavaScript objects.

`9c34650` Successful S call via copied def
: The July linker proves source-shaped copied-definition calls.

`92cea7f` Move identity creation and nested spine into source
: Source syntax starts carrying more graph meaning.

`6c10fe7` Replace conditional observation with pure stepper
: The radical pure-step experiment reaches its cleanest form.

`79331d1` Add delayed future contract
and `aaffb8a` Materialize delayed futures
: Changed recursive calls become finite until observed.

`552a68b` Legend-based serialzer
: Names are fully pushed to explicit edge metadata.

## Ideas that may have been lost

1. The passive machine port model.

   The May line had concrete tests around input events, output events, machine
   sockets, and carried source steps. That is probably the best prior work for
   a future graph-native OS/root.

2. The April phase discipline.

   The current compiler is smaller, but the April branch's explicit phase
   boundaries are useful when deciding where a new concept belongs. If a future
   change feels muddy, compare it against `parse`, `expand`, `construct`,
   `materialize`, and `project`.

3. Cycle-aware application search.

   The April construct/materialize code had to search applications without
   getting confused by fixed graph points. This may matter again if computed
   function heads become live.

4. The trace corpus.

   `research/debris/alt-compilers/traces` preserves expected compiled focus
   shapes for `I`, `K`, `S`, `Y`, nested calls, and `S K K a`. Those traces are
   valuable because they encode not just final answers, but histories.

5. Event-vs-payload distinction.

   The current main still has it as `observe` then `select`. The graph-native
   branches repeatedly rediscover that the distinction cannot just vanish; it
   must either remain in the reader or move into graph structure.

6. The source-as-breadboard idea.

   July's source experiments may have gone too far syntactically, but they
   preserve a strong idea: source can be a wiring diagram, not merely text that
   translates to a separate representation.

7. "Unbounded growth needs history."

   The successor/delayed-future experiments show that a graph cannot out-count
   its own history without either carrying that history or having an allocation
   rule. That is likely fundamental, not a temporary implementation detail.
