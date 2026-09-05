# Seed binding experiment

This experiment asks how little must exist before a graph can grow. It bypasses
decomposition, connection, composition, and finalization. The ordinary parser
only turns text into arrays; the binding machine connects each authored binding
directly to one pair identity.

The host begins without a graph. Its first ordinary binding can construct the
smallest closed graph:

```lisp
(I (I I))
```

The name belongs to the source adapter. The resulting graph is only the frozen
pair `I = [I, I]`.

## Binding

A binding is exactly `(name (left right))`. Both sides must name the new
identity itself or identities made visible by earlier bindings:

```lisp
(A (I I))
(B (A I))
```

The new name is reserved before its sides are connected, so creating another
atom is an ordinary authored choice:

```lisp
(A (A A))
```

After both sides are connected, the pair is frozen and becomes the new Root.
Earlier identities are never changed. The host adds no history wrapper and
performs no reachability check; source retains whatever past it needs by
reference.

Names must be unique within a session. The completed graph contains no names,
symbol table, definition records, or application metadata.

## Source and REPL

A source file places its sequential bindings in one outer expression, as shown
in `seed.lisp`.

Run the independent REPL with:

```sh
npm run repl:seed
```

The REPL begins empty. Enter `(I (I I))` to construct the seed, then add one
binding at a time. `:undo` restores the preceding published Root.

## Boundary of the proof

Repeated binding implicitly defines a space of possible graphs. Source selects
which bindings to materialize; a device event could later make another
selection through the same operation. The experiment does not allocate or walk
the unselected possibilities.

Every non-self edge produced here points backward in construction order.
Consequently, the experiment can construct sharing and any number of fixed
identities, but it cannot construct a new finite cycle containing more than one
identity. Simultaneous reservation is intentionally left as the first further
exploration.

This is not yet a replacement for the production compiler or browser. It shows
that ordinary causal growth needs no preauthored instruction vocabulary, while
making the additional capability required by longer finite cycles explicit.
