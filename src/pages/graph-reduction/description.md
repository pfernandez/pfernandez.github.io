# Graph Reduction

This page uses a tiny S-expression surface syntax restricted to *binary pairs*:

- `()` is the empty list
- `(a b)` is a pair (also used as an application node)

The core pipeline is split into two small steps:

- `build` instantiates *motifs* expressed with non-negative integer indices.
  Indices are in **fill order**: in `(((f x) y) z)`, the environment is
  `[x, y, z]`, so `0 -> x`, `1 -> y`, `2 -> z`, etc.
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
