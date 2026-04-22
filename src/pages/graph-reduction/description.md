# Graph Reduction

This page lowers a tiny Lisp surface syntax to *binary pairs*:

- `()` is the empty list
- `(a b)` is a pair (also used as an application node)
- `(f x y z)` is left-associated as `(((f x) y) z)`
- `(def name body)` and `(defn name (x y ...) body)` work like the Basis
  prelude and expand before stepping

The current mechanics are:

- The compiler lowers numeric `def` templates and fully applied
  parameter-only `defn` bodies to shared fixed-point argument closures.
- `serialize` shows those closures as folding instructions: remaining
  closures become dense slot numbers, and the staged argument payloads are
  appended in fill order.
- `observe` performs one leftmost-outermost step over a whole term
- `[self, value]` is the fixed-point motif, and observing it fires to `value`

Example motif (S kernel body):

```
((0 2) (1 2))
```

Applied as:

```
(((((0 2) (1 2)) a) b) c)
```

The folding projection exposes each staged step:

```
(((((0 2) (1 2)) a) b) c)
((((a 1) (0 1)) b) c)
(((a 0) (b 0)) c)
((a c) (b c))
```

The Lisp and tree views show this reversible projection. The lattice view is
a literal graph sketch of pair nodes, shared arguments, and fixed-point loops.

## Boundary

There are three layers in the current lab:

- `observe` is the machine. It sees only atoms, `()`, pairs, reference
  identity, and shared continuations. It does not know Lisp names, definitions,
  arity, substitution, or folding instructions.
- `compile` is the source loader. It expands the Lisp prelude, lowers n-ary
  application to pairs, and builds shared fixed-point closures when a complete
  source form gives it enough arguments.
- `serialize` is a projection. It can show the live graph as reversible
  folding instructions, or show passive compiler closures as their filled
  source values so settled expressions stay readable.

This is enough for `Z` to build contractive fixed points from named source
functions. For example, `(fix (K a))` exposes `(0 a)` and then `a`, and
`((fix (K a)) b)` exposes `((0 a) b)` and then `(a b)`.

It is not yet enough for an unbounded state loop. A transition such as
`(defn STEP (self state) (self (next state)))` can expose one transition:
`((Z STEP) seed)` becomes `(0 (next seed))` and then `(next seed)`. Observation
stops there because `next` is an atom boundary. A state-carrying machine will
need its transition function and state update represented as pair structure the
observer can keep entering, rather than as source names or atom-headed output.
