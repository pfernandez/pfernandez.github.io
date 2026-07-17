# Minimal Material Report

This report asks how little initial graph material is needed when the observer is conserved: it may recurse and select, but it may not allocate a fresh pair and it may not mutate links.

A non-empty pair node is counted as material. A shared empty leaf `()` and an atom `x` are optional slot values. The atom is only a dye marker; the pair-only rows are the important lower bound.

Cycle classes:

- Pointer cycle: the focus alternates by object identity, but the rooted graph shape is the same.
- Visible cycle: the focus alternates and the rooted graph shape changes.
- x cycle: a visible cycle whose cycle states all still reach `x`.

## Budget Search

### refs only

| pairs | connected | moved | pointer cycles | visible cycles | x cycles | errors |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2 | 12 | 4 | 1 | 0 | 0 | 5 |
| 3 | 432 | 152 | 10 | 18 | 0 | 248 |
| 4 | 31488 | 10728 | 336 | 1290 | 0 | 20550 |

### refs + empty

| pairs | connected | moved | pointer cycles | visible cycles | x cycles | errors |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 | 2 | 0 | 0 | 0 | 0 |
| 2 | 45 | 24 | 2 | 2 | 0 | 11 |
| 3 | 1632 | 864 | 28 | 132 | 0 | 632 |
| 4 | 121350 | 62436 | 1128 | 10152 | 0 | 57270 |

### refs + x

| pairs | connected | moved | pointer cycles | visible cycles | x cycles | errors |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 | 1 | 0 | 0 | 0 | 1 |
| 2 | 45 | 13 | 1 | 0 | 0 | 23 |
| 3 | 1632 | 484 | 14 | 30 | 12 | 1040 |
| 4 | 121350 | 35394 | 576 | 2610 | 1212 | 85158 |

### refs + empty + x

| pairs | connected | moved | pointer cycles | visible cycles | x cycles | errors |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 9 | 4 | 0 | 0 | 0 | 1 |
| 2 | 112 | 52 | 2 | 2 | 0 | 36 |
| 3 | 4400 | 2060 | 36 | 188 | 48 | 1976 |
| 4 | 349056 | 161100 | 1740 | 17508 | 6168 | 183168 |

## Smallest Examples

Strict one-node vacuum:

```js
const A = []
A[0] = A
A[1] = A
```

This is conserved and stable: `($ $) -> ($ $)`. A single self-reference does not unfold a distinguishable pattern.

- Smallest pair-only pointer cycle: 2 pair nodes, `($ ($[1] $))`, cycle, start 0, length 2.
  Orbit: `($ ($[1] $))` → `($ ($[1] $))` → `($ ($[1] $))`.
- Smallest pair-only visible cycle: 3 pair nodes, `($ ($[1] ($ $)))`, cycle, start 1, length 2.
  Orbit: `($ ($[1] ($ $)))` → `($ (($[1][0] $) $[1][0]))` → `(($[0] ($[0][1] $)) $[0])` → `($ (($[1][0] $) $[1][0]))`.
- Smallest dyed visible cycle without empty: 3 pair nodes, `(x ($[1] ($[1][1] $)))`, cycle, start 0, length 2.
  Orbit: `(x ($[1] ($[1][1] $)))` → `($ (x ($[1][1] $)))` → `(x ($[1] ($[1][1] $)))`.
- Smallest dyed visible cycle with empty allowed: 3 pair nodes, `(x ($[1] ($[1][1] $)))`, cycle, start 0, length 2.
  Orbit: `(x ($[1] ($[1][1] $)))` → `($ (x ($[1][1] $)))` → `(x ($[1] ($[1][1] $)))`.

One readable spelling of the smallest pair-only visible cycle is:

```js
const A = []
const B = []
const C = []

A[0] = A
A[1] = B

B[0] = B
B[1] = C

C[0] = A
C[1] = A
```

Its orbit is `A -> B -> C -> B ...`. The first tick enters the recurrent region; after that the observer alternates between two different rooted views of the same conserved material.

## Conclusion

- One pair node is enough for vacuum, but not for distinguishable recurrence.
- Two pair nodes are enough for a hidden clock if object identity counts, but not if only rooted shape counts.
- Three pair nodes are enough for visible pair-only recurrence. No `x` and no empty pair are required.
- A dye marker `x` does not make recurrence possible; it only makes carried identity easier to see.
- The minimal conserved substrate for observable pattern is therefore three non-empty pair nodes under the current left-self selector.
