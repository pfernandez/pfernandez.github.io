# Graph Reduction

This page encodes a tiny Lisp surface syntax as *binary pairs*:

- `()` is the empty list
- `(a b)` is a pair (also used as an application node)
- `(f x y z)` is left-associated as `(((f x) y) z)`
- `(def name body)` and `(defn name (x y ...) body)` work like the Basis
  prelude and expand before stepping

The current mechanics are:

- The compiler encodes numeric `def` templates and fully applied
  parameter-only `defn` bodies to shared fixed-point argument closures.
- `serialize` shows those closures as folding instructions: remaining
  closures become dense slot numbers, and the staged argument payloads are
  appended in fill order.
- Numeric atoms in serialized output name fixed pairs. In a fold they are
  ordered slots from one closure group; outside a fold they are traversal-local
  labels for raw fixed pairs.
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

The Lisp and tree views show this reversible projection. In the last line, the
two `c` positions are equal as text; in the live `S` graph they may also be one
shared event by reference identity. A 2D tree can repeat the label, but the
extra graph dimension is what represents sharing without copying. The lattice
view is a literal graph sketch of pair nodes, shared arguments, and fixed-point
loops.

## Design Principle

Potential is the space of admissible futures. Observation is a local boundary
event that reduces that space without inventing history. In this project, fixed
pairs are not substitutions or shortcuts: they are graph-local ways to keep
potential visible until `observe` reaches the boundary where one event may fire.
Shared continuations matter only when observation reaches the shared object;
forcing a hidden future early would invent history.

## Boundary

There are three layers in the current lab:

- `observe` is the machine. It sees only atoms, `()`, pairs, reference
  identity, and shared continuations. It does not know Lisp names, definitions,
  arity, substitution, or folding instructions.
- `compile` is the source loader. It expands the Lisp prelude, encodes n-ary
  application to pairs, and builds shared fixed-point closures when a complete
  source form gives it enough arguments.
- `serialize` is a projection. It can show the live graph as reversible
  folding instructions, or show passive compiler closures as their filled
  source values so settled expressions stay readable.

This is enough for `Z` to build fixed points from named source functions. For
example, `(fix (K a))` exposes `(0 a)` and then `a`, and
`((fix (K a)) b)` exposes `((0 a) b)` and then `(a b)`. The stateless `Y` form
can also tie an active fixed-point loop; `(Y I)` keeps producing observer steps
rather than settling.

There is no separate transition form in the compiler. A recursive-looking
function call such as:

```
(defn STEP (self state) (self (state tick)))
((STEP f) seed)
```

settles normally to `(f (seed tick))`; `self` is just a parameter bound to `f`.
State stays live only when the graph contains a fixed-point knot, as with:

```
(defn STEP (self state) (self (state tick)))
((Z STEP) seed)
```

That expression does not settle, and its projected frames keep both `seed` and
later `tick` events visible. Atom-headed updates are still observation
boundaries. A body such as `(self (next state))` can carry `seed`, but
observation stops at `next` because atoms are terminals.
