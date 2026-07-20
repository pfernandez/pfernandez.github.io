# Allocation-free growth

This note captures the mechanism found while reviewing the project history for
a CLI loop that shows internal growth without runtime allocation.

Related docs:

- `BASIS_TO_GRAPH_REDUCTION.md` gives the lens/substrate framing for this
  runtime-growth problem.
- `GRAPH_COMPILER_RECOMMENDATIONS.md` places this as a follow-on concern after
  the graph-native event boundary.

The useful ingredient is not in the later `delayed futures` implementation,
because that path uses a JavaScript `WeakMap` and materializes fresh graph
structure when the future is stepped into. That is valuable research, but it is
not allocation-free at runtime.

The closest historical mechanism is in the May passive-machine work:

- linked futures;
- next-only potential;
- graph-local machine roots;
- output events;
- prior-event history stored inside the graph;
- tests that count allocations and prove none occur while stepping.

The shape is:

```text
prelinked event/history states
+ local observer/root
+ runtime step = follow an already-existing next edge
```

The compiler or builder allocates a finite history before the loop starts. The
CLI loop then only moves through existing graph edges. If the visible output is
the event carried by each state, the displayed history can grow for each
prelinked state without allocating during the run.

## Why truly unbounded allocation-free growth is impossible

If the runtime graph is finite, deterministic, and does not allocate or mutate,
then it has only finitely many internal states. Repeated stepping must
eventually revisit a state. From the inside, the machine becomes periodic.

So there are only three honest options:

1. Prelinked finite growth.

   The graph contains a finite chain of history/events. Runtime stepping does
   not allocate. The visible history grows until the prebuilt history is
   exhausted, then the machine loops.

2. Cyclic generator with growing projection.

   The internal graph is finite and periodic, but an outside projection views
   the cycle at increasing depth. This can look like growth, but the growth is
   in the observer/view, not in the internal machine state.

3. Graph-internal allocation.

   The graph carries a free list, memory arena, or unused future cells. Runtime
   can consume those cells without host allocation. This is not
   allocation-free, but it can still be host-free and graph-native.

The first option is the best immediate CLI demonstration because it preserves
the current "program already happened" model: the compiler writes a causal
record, and the runtime only reads it.

## Cyclic successor result

The current Lisp can express an infinite successor view as a finite cycle:

```lisp
(Zero ((z z) s))
(Succ ((((s m) m) z) s))
(Forever (Succ Forever))
Forever
```

The compiled graph has only finite structure:

```text
(Succ Forever)
Forever -> (Succ Forever)
```

So a depth-limited reader can unfold it as:

```text
Zero-depth view: 0
One layer:       Succ ...
Eight layers:   Succ (Succ ... eight times ...)
```

That is real unboundedness as a tree projection of a cyclic graph. It is not
the same as local accumulation. The machine state repeats; the increasing
count lives in the reader's chosen unfolding depth.

A direct recursive accumulator shows the complementary boundary:

```lisp
(Root stream history)
  -> (Root stream (Succ history))
```

With the current compiler, each recursive call has a different `history`
argument. The active-call knot does not apply, so compile-time reduction tries
to materialize the endlessly growing successor chain. That is allocation moved
into compilation, not allocation-free runtime growth.

## Bounded ledger result

`counter.lisp` demonstrates the middle path: supply finite material as source
data and author the allocation policy in Lisp.

The material is a Scott list of bits, least-significant bit first:

```lisp
Nil                         ; 0
(Cons True Nil)             ; 1
(Cons False (Cons True Nil)) ; 2
```

The incrementer is generic over the list shape:

```lisp
(Inc bits done)
```

It does not name bit positions or prewrite a transition table. `Inc` consumes
the supplied list and sends the incremented result to `done` on the same open
frontier. When a carry is needed, the continuation itself carries the pending
work:

```lisp
(Carry done)
```

The test exercises:

```text
Nil        -> 1
False      -> 1
True       -> 01
False True -> 11
True True  -> 001
```

These strings are low-bit-first. The last line is binary `3 -> 4`.

This is not unbounded growth. The register grows only when the source has
supplied a tail to recurse through, or when the nil case appends the final
carry bit. But it is the first useful form of graph-authored allocation:

```text
material = encoded list cells
policy   = Inc / IncStep / Carry
runtime  = observe/select through the compiled consequence graph
```

The key lesson is that "allocate" need not begin as host mutation. It can first
mean: supply material in the root/source, then author the policy that
actualizes a new view of that material.

This result should not be confused with the next live-loop milestone.
`counter.lisp` proves generic compiled increment:

```text
compile (Inc bits done) -> linked consequence graph
read result             -> incremented bit list
```

The next milestone must compile once and then repeatedly step the same root:

```text
compile Root(register step ...)
step/read -> 00
step/read -> 01
step/read -> 10
step/read -> 11
step/read -> 00
```

That will demonstrate source-authored post-compiled state change. It may still
use a finite prelinked cycle; runtime allocation/freeing is a separate later
milestone.

`live-root.lisp` now demonstrates that milestone:

```text
Root -> B00
step -> B01
step -> B10
step -> B11
step -> B00
```

The source authors the whole register cycle. Compilation preserves the cycle,
and runtime stepping follows existing right edges. The host does not supply
the next count.

## Minimal mechanism

In the passive-machine tests, a state can carry an output event:

```text
state = [next-frame, output-event]
```

The output event can itself point to a prior event:

```text
event0 = [I, output0]
event1 = [event0, output1]
event2 = [event1, output2]
event3 = [event2, output3]
```

The states are prelinked:

```text
state0 -> state1 -> state2 -> state3 -> ...
```

A root-local observer selects the next state by following an existing edge. The
host does not build a new pair while stepping.

A CLI trace can then show:

```text
built pairs: 42
0 history depth 1
1 history depth 2
2 history depth 3
3 history depth 4
...
runtime allocations: 42
```

The important assertion is:

```js
assert.equal(allocations, built)
```

after every tick.

## Prototype result

A small hand-built prototype produced this shape:

```text
0 history 1
1 history 2
2 history 3
3 history 4
4 history 5
5 history 6
6 history 7
7 history 8
8 history 1
9 history 2
10 history 3
11 history 4
allocations 42 built 42
```

This demonstrates allocation-free runtime growth up to the prelinked history
length, followed by periodicity. That periodicity is not a failure; it is the
honest consequence of finite conserved material.

## Current branch result

The `graph-native-lens` branch now has two concrete demos.

The source fixture is hand-authored:

```sh
node cli.js --lens lens.lisp 3
```

It shows the intended lens shape directly:

```text
state = (event next)
event = (event (previous output))
step(state) = state[1]
```

The recorded fixture is closer to the current compiler:

```sh
node cli.js --record core.lisp 6
```

It compiles the program normally, records the actual passive `observe` frames,
wraps those existing frames in a prelinked lens, and then replays the lens by
following right edges. The replay does not allocate; the extra event/state
pairs are build-time structure, just like the compiled consequence graph.

This is still finite replay, not unbounded growth. Its value is that the
dynamic CLI view is now derived from the compiler's real causal record instead
of from a manually authored answer.

There is also a no-transposition view:

```sh
node cli.js --spine core.lisp 6
```

This follows the compiled graph's existing left spine. That path is exactly
the sequence `observe` visits. Non-stable states output themselves; the stable
answer outputs its right side. The motion rule itself has no condition:

```js
spineStep(state) = state[0]
```

When the state is already stable, its left edge points to itself, so the same
rule naturally stops there.

## Next implementation target

Use `--spine` as the primary harness and `--record` as the comparison harness
while looking for the graph-native version of the same shape:

- the spine view proves the compiled graph already carries a replay path;
- the record harness transposes host-visible `observe` frames;
- the target is to make the existing spine the machine's motion;
- `step` should stay boring, because the motion should already be in the graph.

Do not use the `WeakMap` delayed-future path for this particular demo. That
path demonstrates on-demand materialization, not allocation-free replay.

## Source observer experiment

`observer.lisp` asks whether the observer policy can be written in source. The
current answer is: partially, but not yet all the way down.

Source-level `First` and `Second` can project encoded `Pair` values:

```lisp
(First Frame0)   ; Out0
(Second Frame0)  ; Frame1
```

That lets source express the shape of a carried observer transition:

```lisp
(Tick (((Pair (Second focus) (Pair (First focus) history)) focus) history))
```

This says: move to the next encoded focus, and carry the current output in
history. The policy is authored in source, but it only sees values encoded as
source-level pairs. It does not inspect arbitrary substrate cells.

That distinction matters. `spineStep(state) = state[0]` and WASM
`step(p) = mem[p]` read raw graph geometry. `First` and `Second` are ordinary
Lisp functions over encoded pair values. Bridging those two levels without
compiler magic is now the next real question.

Two probes clarify the boundary:

- Applying `First` or `Second` to an encoded `(Pair a b)` returns `a` or `b`.
- Applying either one to a raw source application `(a b)` returns `a`.

The second case does not inspect the raw cell. It applies the raw cell as a
function, extends its left spine, and observation reaches the same leftmost
head.

A temporary transparent-head compiler patch also showed why the older
"computed answer in head position is inert" rule is load-bearing. Looking
through computed answers can make `((I I) a)` continue toward `a`, but the
same rule changes Scott arithmetic and rewrites authored lens structure. It is
not a small observer bridge; it changes the compiler's evaluation physics.

## Root as observer

`root.lisp` takes the more promising source-only path: make the graph root the
observer boundary, and let questions complete it.

```lisp
(Root ((((((question (Root)) K) S) state) state) question))
```

This gives `Root` two slots: `state` and `question`. When a question arrives,
the root passes it:

```text
Root K S state
```

The question is a continuation. It chooses what to expose from the carried
root identity, dictionary, and state:

```lisp
(AskState (((((k state done) root) k) s) state))
(Root seed AskState) ; seed
```

The same root can answer a more meaningful question by using the `S` carried
in its dictionary:

```lisp
(AskS (((((s a b c) root) k) s) state))
(Root seed AskS) ; ((a c) (b c))
```

This is not raw cell projection. It is more interesting: the root carries the
definitions, and the question decides how to use them. The library is inside
the observer boundary instead of the observer being outside the library.

## Recursion is already the context carrier

The correction after the root experiment is that an internal observer should
not need to inspect raw substrate cells. That would be a privileged external
view, not an observer inside the graph. Source-level observers should see
source-level values: whatever their root has encoded and made available.

Ordinary Lisp recursion already passes context:

```lisp
(Loop (((step state (Loop step)) step) state))
(Yield (((continue state) state) continue))
```

`Loop` calls `step` with the current `state` and the continuation
`(Loop step)`. `Yield` has the right raw shape to keep that continuation alive,
which is why `(Loop Yield seed)` is a finite period-two orbit.

The next observer shape should therefore not be "teach `First` and `Second` to
read arbitrary cells." It should be:

```text
root/dictionary/state/question as ordinary Lisp values
recursive step passes the next context explicitly
observable frames are encoded as source-level data when needed
```

If a future observer must see `(answer, continuation)`, that pair should be
authored as an observable value, not assumed from raw application geometry.

## Relationship to the current compiler

The current `main` compiler already writes a causal record and the WASM machine
only reads it. A prelinked-history fixture is a focused demonstration of that
same idea:

```text
compile/build time: allocate the causal history
runtime: traverse it without allocation
view: show the accumulated prior-event chain
```

This does not solve graph-native unbounded allocation. It gives us a clean,
visible, mechanically honest stepping stone.
