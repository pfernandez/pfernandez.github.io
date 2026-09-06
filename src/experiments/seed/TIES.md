# Further exploration: knots

The minimal binder publishes one pair at a time. Since every non-self edge must
refer to the visible past, it cannot construct a new finite cycle containing
multiple identities.

`tie.js` treats one or more recursive equations uniformly. It reserves every
identity in a private knot, connects their sides, and publishes the final pair
only after the knot is closed.

The seed is the one-equation case:

```lisp
(I (I I))
```

A period-two orbit requires two equations:

```lisp
((A (I B))
 (B (I A)))
```

The host must allocate addresses in some order, but no incomplete pair is
visible in the resulting graph. The experiment therefore distinguishes host
construction order from graph-internal connection and observer order.

## Exact observations

The accompanying tests establish four structural facts:

1. `bind` and a one-equation `tie` both produce one self-referential identity.
2. A two-equation knot can produce a period-two observer orbit.
3. A knot can make left and right lead to distinguishable identities.
4. Two identities suffice for `left(right(x))` and `right(left(x))` to differ.

The fourth property is path-order dependence in a deterministic graph. Calling
it noncommutativity is an algebraic description; it does not by itself imply a
quantum observable or an uncertainty relation.

## Open interpretation

If the graph is treated as a closed logical system, only a completed knot has
an internal meaning. Its private allocation history belongs to the host used to
represent it. Whether a larger knot is foundational, emergent from the seed, or
a finite representation of an indefinitely unfolding history remains open.

The sequential binder remains unchanged so these alternatives can be compared
without silently building simultaneous reservation into the minimal machine.
