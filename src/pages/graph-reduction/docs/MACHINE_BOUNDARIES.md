# Machine boundaries

This note fixes vocabulary for the next phase. The word "observer" is useful
in conversation, but too broad for implementation. It can mean a tiny stable
cycle, a source-level lens, a dashboard, or a future graph-native agent. These
are not the same mechanism.

## Vocabulary

Use the sharper names when designing code or source forms:

```text
fixed point  self-consistent recurrence
cycle        repeated local structure
event        local interaction or actualization
state        constraint carried across events
lens         projection from structure to a readable frame
root         graph-local boundary carrying state and policy
agent        stateful loop with policy, memory, and I/O
read         privileged external inspection
step         substrate transition / pair potential
```

An electron-like structure may be a small stable cycle. A mind-like structure
is closer to an agent or OS. Calling both "observers" hides the scale and the
mechanism.

## External read vs internal step

The dashboard, CLI, serializer, and test helpers are privileged readers. They
can inspect JavaScript identity, print cycles, count depth, color structure,
and keep host-side history. That is instrumentation.

The internal machine is different. It can only move according to structure it
has been given.

So the rule is:

```text
read:
  non-creative, external, for visibility

step:
  graph-local, may actualize structure when pair potential and material permit
```

`observe` currently belongs to the `read` side. It follows structure to expose
a stable event. It should not grow into a hidden evaluator just to support a
theory.

But this does not mean the system can never create. It means creation belongs
to explicit substrate stepping, not privileged readout.

## Creation and annihilation

In this project, creation and annihilation should be read mechanically:

```text
creation     open possibility / create obligation / bind free material
annihilation repay obligation / close possibility / release or record material
```

This is not magical address creation. In a Von Neumann host, new addresses
ultimately come from host memory. To keep the simulation honest, the graph
machine should treat available memory as supplied vacuum potential:

```text
free bank      material not yet bound into the active history
active graph   material currently participating as cause
history bank   committed record, when the record itself is not causal
```

Creation moves material from free potential into active relation. Annihilation
closes an active obligation and may move material into history, free material,
or a settled result.

## When non-creative history is appropriate

History can live outside the causal graph only when it is for us:

```text
trace logs
dashboard history
test counters
serialized frames
debug records
```

These are measurement records. They are appropriate when they do not affect
what the graph can do next.

If history constrains future stepping, it must be graph state:

```text
If it only helps us see, host history is fine.
If it affects what can happen next, it belongs in the graph.
If it creates new causal structure, it must consume supplied material.
```

## Authored allocation

`counter.lisp` is the current smallest example of authored allocation policy.
The material is an encoded bit list. The policy is ordinary Lisp:

```lisp
(Inc bits done)
```

The increment operation does not name each bit. It walks supplied material and
passes a continuation when carry is required.

This is not unbounded graph growth. It is still compiled consequence structure.
But it proves an important design pattern:

```text
source supplies material
source authors policy
runtime/readout only exposes the result
```

That pattern should guide dynamic allocation later. The future runtime may
mutate or allocate inside a memory arena, but the arena and policy should be
explicit parts of the root, not invisible powers of the dashboard.

## Two target demonstrations

There are two separate things to show. Keeping them separate prevents us from
calling a compiled consequence graph a live machine too early.

### 1. Live source-authored 2-bit loop

Goal:

```text
After compilation, repeated `step` calls advance a source-authored root through
a 2-bit register sequence.
```

Acceptance criteria:

- one source program is compiled once;
- the source carries the register, step policy, and visible answer channel;
- the CLI and tests repeatedly step the same compiled graph/root;
- visible output changes as:

  ```text
  00 -> 01 -> 10 -> 11 -> 00 -> ...
  ```

- the host does not feed in a counter or choose the next state;
- the host may only call `step` and use passive readout/serialization;
- no runtime allocation is required for this milestone.

This may be implemented as a finite source-authored transition cycle. That is
acceptable. The point is not unbounded growth yet; the point is a live
post-compiled loop whose state change is carried by the graph/root rather than
by the dashboard.

This is distinct from `counter.lisp`. `counter.lisp` proves generic compiled
increment over supplied bit material. It does not yet prove a post-compiled
loop that increments the same root repeatedly.

### 2. Runtime allocation/freeing

Goal:

```text
`step` can bind and release memory during runtime by consuming graph-local
potential, not by hiding allocation in the dashboard/readout.
```

Open design question:

```text
Should the source name an explicit free bank/arena, or should the heap itself
act as the arena and expose usable addresses by adjacency?
```

This milestone is allowed to mutate or allocate in JS/WASM, but only as an
explicit substrate simulation. The root/source state must still decide what is
actualized. Host memory supplies the vacuum potential; host readout must not
choose the event.

Acceptance criteria:

- `read`/`observe` remains passive;
- `step` is the only runtime operation that may actualize memory;
- allocation consumes available material or address potential;
- freeing/annihilation closes an obligation and returns material to an explicit
  reusable or recorded state;
- dashboard history remains non-causal unless reintroduced into the graph.

## Next implementation scaffold

Recommended steps for the next branch:

1. Keep current `observe` as passive readout.

   Do not add evaluator logic to it.

2. Rename concepts in docs and comments before renaming code.

   Treat `observe` mentally as `read`. Treat `step` as the substrate
   transition under investigation.

3. Build the live 2-bit root loop first.

   This is the benchmark that proves the source can carry state through a
   post-compiled loop.

4. Then add a small root fixture with explicit banks:

   ```text
   Root(active free history policy question)
   ```

5. First model allocation without mutation.

   Use source-supplied material and continuations, as in `counter.lisp`.
   This keeps the current compiler honest.

6. Then model allocation with mutation in JS/WASM.

   Only after the source shape is clear, add a small `step` kernel that
   consumes cells from an explicit free bank. This is the Von Neumann
   simulation compromise: host memory exists, but graph state decides how it
   is actualized.

7. Keep dashboard history separate.

   Dashboard traces can remain host-side as long as they are only visibility.
   If the machine reads or depends on the record, move that record into the
   graph.

## Connection to the Catalan simulator

The Catalan-space simulator studies the possible paths directly. There,
creation and annihilation are legal prefix moves:

```text
open paren  = creation / opening obligation
close paren = annihilation / repayment
```

The Lisp machine authors one concrete causal record. The simulator studies the
frontier of possible continuations around records like it.

This keeps the two efforts aligned:

```text
Lisp machine:
  proof object and authoring layer

Catalan simulator:
  space of possible paths, shift operator, amplitudes, Born weights
```

The immediate goal is not to make the Lisp compiler secretly simulate all of
Catalan space. It is to finish the Lisp machine cleanly enough that its traces
can become selected paths inside the larger simulator.
