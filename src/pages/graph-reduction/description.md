# Graph Reduction

This page lowers a tiny Lisp surface syntax to *binary pairs*:

- `()` is the empty list
- `(a b)` is a pair (also used as an application node)
- `(f x y z)` is left-associated as `(((f x) y) z)`
- `(def name body)` and `(defn name (x y ...) body)` work like the Basis
  prelude and expand before stepping

The core pipeline is split into two small steps:

- `buildOne` instantiates one input at a time into a motif expressed with
  non-negative integer indices. In `(((f x) y) z)`, the fill order is
  `[x, y, z]`, so `0 -> x`, `1 -> y`, `2 -> z`, etc.
- `build` still exists for full instantiation in one shot and is used in tests
- `observe` performs one leftmost-outermost step over a whole term
- `(() body)` is a stable binder-like pair, so `((() body) arg)` steps to
  `body`

Example motif (S kernel body):

```
((0 2) (1 2))
```

Applied as:

```
(((((0 2) (1 2)) a) b) c)
```

`build` produces that in one step:

```
((a c) (b c))
```
