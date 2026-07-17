# Conserved Material Report

This report tests the stronger rule that observation may select existing graph material but may not create a new pair after the initial structure is built.

The candidate observer used for the extracted machine is the conserved selector:

```js
if the focus is not a non-empty pair, return it
if the left slot is empty or self, return the right slot
otherwise observe the left slot
if that selected something, return it directly
otherwise observe the right slot
if that selected something, return it directly
otherwise return the focus
```

It never returns `[left, right]`. It either returns the current focus or an already-existing node reachable from the initial graph.

## Hand-Built Forms

| observer | form | expected | conserved | cycle | carries x | last seen |
| --- | --- | --- | --- | --- | --- | --- |
| conserved selector | I | x | cycle/true | 1 | true | `x` |
| conserved selector | K | x | cycle/true | 1 | true | `x` |
| conserved selector | S | ((x z) (y z)) | cycle/true | 1 | true | `((x z) (y z))` |
| conserved selector | Z | periodic x carrier | cycle/true | 2 | true | `(x (() (() $)))` |
| conserved rewire | I | x | cycle/true | 1 | true | `x` |
| conserved rewire | K | x | cycle/true | 1 | true | `(x y)` |
| conserved rewire | S | ((x z) (y z)) | cycle/true | 1 | true | `((x z) (y z))` |
| conserved rewire | Z | periodic x carrier | error/true |  | true | `(x $)` |
| allocating observe | I | x | cycle/true | 1 | true | `x` |
| allocating observe | K | x | escaped/false |  | true | `(x y)` |
| allocating observe | S | ((x z) (y z)) | cycle/true | 1 | true | `((x z) (y z))` |
| allocating observe | Z | periodic x carrier | escaped/false |  | true | `(x (() (x (() $[1]))))` |

## Minimal Recurrent Search

The search enumerated every connected rooted graph through 3 non-empty pair nodes. Slots may contain the shared empty pair, atom `x`, or a reference to any pair node. The observer is the conserved selector.

| pair nodes | raw candidates | connected candidates | periodic x carriers |
| --- | --- | --- | --- |
| 1 | 9 | 9 | 0 |
| 2 | 256 | 112 | 0 |
| 3 | 15625 | 4400 | 48 |

A smallest periodic carrier with `x` visible at the root:

- pairs: 3
- form: `(x (() (() $)))`
- cycle: start 0, length 2
- orbit: `(x (() (() $)))` → `(() (x (() $)))` → `(x (() (() $)))`

One readable spelling of the same graph is:

```js
const A = []
const D = []
const B = []

A[0] = 'x'
A[1] = D
D[0] = empty
D[1] = B
B[0] = empty
B[1] = A
```

Observation alternates `A → B → A`. The second state does not have `x` in the left slot, but `x` is still reachable through `A`, so the payload is conserved rather than copied.

## Interpretation

- The allocating observer is a history-producing rule: it can preserve context by creating a fresh parent pair.
- The conserved rewire observer preserves material, but it changes existing links and tends to collapse recurrence into a normal form.
- The conserved selector is the smallest pure version: it treats observation as choosing a reachable history rather than building a new one.
- Finite computation must be latent in the initial graph. `S` therefore contains the shared result shape `((x z) (y z))` before observation.
- Infinite behavior cannot be an expanding list of new states. In a conserved finite graph, `Z` becomes a periodic orbit through existing states.
- This makes double-slit-style selection plausible: alternatives are not manufactured by observation, and recombination is shared topology.
- This also makes entanglement topological: separated observations can correlate only by sharing conserved substructure.
