# Graph Reduction

This page lowers a tiny Lisp surface syntax to *binary pairs*:

- `()` is the empty list
- `(a b)` is a pair (also used as an application node)
- `(f x y z)` is left-associated as `(((f x) y) z)`
- `(def name body)` and `(defn name (x y ...) body)` work like the Basis
  prelude and expand before stepping

The runtime has one stepping rule:

- `defn` lowers to nested wrapper pairs around a body with non-negative
  integer slots. In `(((f x) y) z)`, the fill order is `[x, y, z]`, so
  `0 -> x`, `1 -> y`, `2 -> z`, etc.
- `observe` performs one leftmost-outermost step over a whole term
- `(() body)` is a stable wrapper, and `((() body) arg)` feeds one argument
  into `body` without forcing the rest of the term

Example motif (S kernel body):

```
((0 2) (1 2))
```

Applied as:

```
((((() (() (() ((0 2) (1 2))))) a) b) c)
```

Three `observe` steps instantiate that to:

```
((a c) (b c))
```
