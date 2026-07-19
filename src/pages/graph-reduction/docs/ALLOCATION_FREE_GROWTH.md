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

The same request can now be written by source shape:

```lisp
((S a b c) ())
```

and run as a lens:

```sh
node cli.js --lens record.lisp 6
```

## Next implementation target

Use `--record` and `(form ())` as comparison harnesses while looking for a
more graph-native version of the same shape:

- the current harness records host-visible `observe` frames;
- the source shape avoids a magic word, but still records at build time;
- the target is a graph whose own next edge already carries those events;
- `step` should stay boring, because the motion should already be in the graph.

Do not use the `WeakMap` delayed-future path for this particular demo. That
path demonstrates on-demand materialization, not allocation-free replay.

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
