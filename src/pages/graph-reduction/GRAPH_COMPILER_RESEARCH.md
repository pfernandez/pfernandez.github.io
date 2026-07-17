# Graph compiler research

This branch preserves the compiler and observer research that led to the
current graph-reduction engine. It is intentionally broader than `main`.

`main` should stay small: the true-shape compiler, the tiny `observe/select`
reader, the serializer, and the WASM image/machine that prove the graph handed
to the machine is only pair structure.

This branch is the lab notebook.

## Current recommendation

Keep the fable compiler as the canonical working system:

```text
source text -> parse -> compile -> pair graph -> observe/select -> view
```

The important boundary is that the machine receives only structure. Names,
scopes, legends, parser nodes, and compiler bookkeeping stay outside the graph
that `observe`, `select`, and the WASM reader traverse.

The graph-native `link/step` work remains valuable research, but it explores a
different machine:

```text
source text -> parse -> link -> pair graph + legend -> step -> view
```

That path tries to move more observation, history, and future structure into
the graph itself. It is not yet as complete or as semantically settled as the
fable compiler.

## The main fork

The sharpest design fork is whether computed answers in head position are
live causes.

In the fable compiler, they are inert. For example:

```lisp
(App I a)       ; settles to a
(App (I I) a)   ; does not settle to a
```

This gives a coherent sealed-past model: a settled answer may be cited, but
the compiler does not reopen the answer's payload as a new function cause.
That wall protects recursive knots from reading an answer before its payload
exists.

The graph-native linker has explored the other branch, where computed answer
heads can continue. That is more powerful, but it requires a clearer account of
unfinished answers, recursive knots, and graph-native history before it should
replace the fable machine.

## Artifact map

### Canonical working model

- `graph/compile.js`
- `graph/observe.js`
- `graph/serialize.js`
- `wasm/image.js`
- `wasm/wasm.js`
- `core.lisp`

This is the "program that already happened" model: the compiler writes a
causal record, and the runtime reader only follows pointers.

### Graph-native experiment

- `graph/link.js`
- `graph/step.js`
- `graph/event.js`
- `core.graph.lisp`
- `loop.graph.lisp`
- `successor.graph.lisp`
- `history.graph.lisp`
- `graph/link.test.js`
- `graph/event.test.js`

This path keeps the final graph pair-only, but tries to make repeated
right-edge stepping sufficient. Changed recursive calls currently tie into a
finite orbit; unbounded counting belongs to observation history or to a future
graph-native allocation story.

### Intermediate observer-local system

- `alt/observer/`
- `alt/graph/`
- `alt/visualizations/`
- `alt/source.lisp`
- `alt/description.md`

This was a working system between the older observer-local Lisp compiler and
the current true-shape compiler. Keep it for context, but do not treat it as
the target engine.

### Debris and compiler lineage

- `research/debris/`
- `research/debris/alt-compilers/`

This is the archaeological record copied from `~/.dotfiles/debris`, plus the
old `alt/compilers` directory that originally came from that line of work.
These files include reports, runnable experiments, trace corpora, and the
flat `graph-fable-5` bundle.

Two old CommonJS archive tests are kept with a `.test.cjs` suffix so the live
project test command, which finds `*.test.js`, does not accidentally treat
archival experiments as part of the current suite.

## What survived the research

1. A pair-only machine boundary is the best invariant.

   Whatever the compiler does, the graph handed to the machine must be only
   pairs. The machine must not need symbols, legends, parser state, closures,
   maps, or JavaScript-side metadata.

2. The fable compiler is the best current `main`.

   It supports combinators, partial application, recursive knots, Scott data,
   structural recursion, arithmetic, symbolic residuals, WASM replay, and a
   fixed reader whose code does not depend on the program.

3. `link/step` is still research.

   It is useful because it asks whether the observer/history/future can be
   written into the graph itself. It should be judged against the fable
   compiler's behavior before becoming canonical.

4. Orientation is a construction choice, not a runtime feature.

   A left-step machine could exist if the source shape and linker were mirrored.
   The current graph-native experiment chooses right-edge stepping. Once the
   graph is built, that choice determines which futures are adjacent.

5. Unbounded growth needs history.

   A finite graph can contain a finite orbit or a compact recursive knot. A
   count larger than the history already traversed needs either an explicit
   history path or a graph-native allocation story.

## How to use this branch

Use this branch to recover ideas, compare semantics, and mine tests. Do not
use it as the deployment target.

Use `main` when the question is:

> What is the smallest complete system we currently trust?

Use this branch when the question is:

> What paths have we explored, and what might the next graph-native machine be?
