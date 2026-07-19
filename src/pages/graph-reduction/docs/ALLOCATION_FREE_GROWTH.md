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
through computed answers can make `(App (I I) a)` continue toward `a`, but the
same rule changes Scott arithmetic and rewrites authored lens structure. It is
not a small observer bridge; it changes the compiler's evaluation physics.

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
