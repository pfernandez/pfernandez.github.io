# Pair-local frontier kernel

This note records the first kernel-shaped result from the revived `link`
experiment.

## What now works

`link-kernel.lisp` compiles a source-authored root loop:

```text
Loop Next K0
```

The root carries one kernel state. Each state stands for a mode plus active
and free banks:

```text
K0 = Allocating, active ANil, free F01
K1 = Allocating, active A0,   free F1
K2 = Allocating, active A10,  free FNil
K3 = Freeing,    active A10,  free FNil
K4 = Freeing,    active A0,   free F1
K5 = Freeing,    active ANil, free F01
```

Repeated right-edge stepping exposes:

```text
K0 -> K1 -> K2 -> K3 -> K4 -> K5 -> K0
```

The host does not choose the next state. The source authors the transition
policy:

```lisp
(Next state continue
  (state
    (Yield continue K1)
    ...
    (Yield continue K0)))
```

The CLI can show this with:

```sh
node cli.js --link link-kernel.lisp 48
```

The relevant test is:

```sh
node --test graph/link.test.js --test-reporter spec
```

## What changed in `link`

`link` now preserves cycles during body copies with a small copy map. Without
that, generated cyclic structure could make the copier chase the same graph
forever.

This is the same mechanical principle already present in `compile.js`
substitution:

```text
copy identity once, then reuse it when the source cycle is encountered again
```

## Why this is not yet a general allocator

I tried the more natural source first:

```text
Root(mode, active-list, free-list)
```

with Scott-list banks and generic `Alloc` / `Free` transitions. That exposed
two current `link` boundaries:

1. The proven live loop shape is one carried state:

   ```text
   Loop step state
   ```

   Multiple root arguments collapse toward partial loop structure instead of
   cleanly recurring at a root boundary.

2. Computed partial constructor values are not yet good live state identities.

   A generated value such as:

   ```lisp
   (Cons Cell0 active)
   ```

   can be carried as structure, but right-edge stepping tends to enter the
   constructor payload instead of returning to the next root frame.

So the working kernel uses canonical state identities. That is not cheating;
it is the finite-state version of the requirement:

```text
live recurrence needs stable identity
```

But it is not the final allocator/free-bank.

## The next real boundary

The next breakthrough would be one of these:

1. Make computed constructor values canonical live identities.

   This would let a generic source-level bank such as `(Cons Cell0 rest)` close
   back onto previous logical states when the same graph identity is reached.

2. Give the root an explicit arena/free-bank representation consumed by
   `step`.

   This would move from finite canonical state to runtime actualization of
   supplied material.

Until then, `link-kernel.lisp` should be read as the first source-authored
kernel clock, not as a full graph-native OS allocator.
