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
root/world   graph-local boundary carrying state and policy
agent        stateful loop with policy, memory, and I/O
read         privileged external inspection
evolve       substrate transition / pair potential
```

An electron-like structure may be a small stable cycle. A mind-like structure
is closer to an agent or OS. Calling both "observers" hides the scale and the
mechanism.

## External read vs internal evolution

The dashboard, CLI, serializer, and test helpers are privileged readers. They
can inspect JavaScript identity, print cycles, count depth, color structure,
and keep host-side history. That is instrumentation.

The internal machine is different. It can only move according to structure it
has been given.

So the rule is:

```text
read:
  non-creative, external, for visibility

evolve:
  graph-local, may actualize structure when pair potential and material permit
```

`observe` currently belongs to the `read` side. It follows structure to expose
a stable event. It should not grow into a hidden evaluator just to support a
theory.

But this does not mean the system can never create. It means creation belongs
to explicit substrate evolution, not privileged readout.

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

If history constrains future evolution, it must be graph state:

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
explicit parts of the root/world, not invisible powers of the dashboard.

## Next implementation scaffold

The next branch should answer one question:

```text
Can root/world carry material, policy, and a question clearly enough that
dynamic allocation becomes an authored graph operation rather than a host trick?
```

Recommended steps:

1. Keep current `observe` as passive readout.

   Do not add evaluator logic to it.

2. Rename concepts in docs and comments before renaming code.

   Treat `observe` mentally as `read`. Treat `step`/`evolve` as the substrate
   transition under investigation.

3. Add a small root/world fixture with explicit banks:

   ```text
   World(active free history policy question)
   ```

4. First model allocation without mutation.

   Use source-supplied material and continuations, as in `counter.lisp`.
   This keeps the current compiler honest.

5. Then model allocation with mutation in JS/WASM.

   Only after the source shape is clear, add a small `evolve` kernel that
   consumes cells from an explicit free bank. This is the Von Neumann
   simulation compromise: host memory exists, but graph state decides how it
   is actualized.

6. Keep dashboard history separate.

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
