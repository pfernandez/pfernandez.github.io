# Phase orbits

The current project now has two complementary views:

```text
computer  the pair graph and its tiny step/read operations
language  projections that describe the graph's dynamics
```

`graph/phase.js` is the first small piece of the second view. It does not
change the machine. It samples a stepped stream and projects recognizable
phases from it.

## Vocabulary

```text
phase       a distinguishable position in a live stream
projection  a readout from graph structure to a phase
orbit       the projected phase sequence produced by repeated steps
period      the length of a recurring projected orbit
gap         raw substrate steps between projected phases
transition  a projected phase-to-phase edge
```

This is deliberately external, like a bra applied to a ket. The graph still
contains only pairs. The projection is how a viewer, test, CLI, or dashboard
describes what passes through it.

## Current benchmark

`link-kernel.lisp` authors a finite kernel clock. Repeated right-edge stepping
passes through internal transition structure, but the projected phases are:

```text
K0 K1 K2 K3 K4 K5 K0 ...
```

Run:

```sh
node cli.js --phase link-kernel.lisp 80
```

Expected shape:

```text
phases K0 K1 K2 K3 K4 K5 K0 ...
period 6
gaps 4 4 4 4 4 ...
transitions K0->K1 K1->K2 ...
```

The value is not one static frame. The value is the recurring signature seen
by the projection.

`link-counter.lisp` gives a second rhythm:

```sh
node cli.js --phase link-counter.lisp 40
```

It projects the four register phases:

```text
B00 -> B01 -> B10 -> B11 -> B00
```

with a different raw tick spacing than the kernel clock. So the phase language
can already distinguish two systems that both look like simple cycles at the
macro level.

## Why this matters

The computed-constructor experiment failed when it tried to make a partial
constructor behave like a static live value. The phase view asks a better
question:

```text
What orbit does this source produce under step?
```

That lets us distinguish:

- a stable fixed point;
- a small local trap;
- a productive cycle;
- a stream whose macro-signature is stable even while its micro-state changes.

This is the bridge to the Catalan/Dyck simulator: there, phases can be Dyck
words or legal prefixes, and the shift operator moves among allowed
continuations. Here, phases are projected from pair-graph dynamics.
