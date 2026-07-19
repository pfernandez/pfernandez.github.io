# Catalan Hamiltonian plan

This note captures the current bridge between the Lisp machine and the later
Catalan-space simulator. It is a working plan, not a physics claim.

## Core picture

The Catalan object has several equivalent views:

```text
S-expression
balanced parentheses
Dyck path
full binary tree
pair graph
```

The current Lisp machine uses the S-expression / pair-graph view. The future
simulator should expose the Dyck / Catalan-frontier view directly.

A legal prefix is a partial causal history. Its Dyck height is the number of
currently open obligations:

```text
open paren  = open possibility / create obligation
close paren = repay obligation / close possibility
height      = unresolved obligation
```

This makes "creation" and "annihilation" less mysterious. They are not magic
appearance and disappearance. They are local moves in the obligation ledger:

```text
creation    = open a legal continuation
annihilation = close a pending continuation
```

## Shift operator

At tier `n`, the basis states are legal Dyck prefixes of length `n`.

The possible next continuations are known by inspection:

```text
prefix -> prefix + "("
prefix -> prefix + ")"
```

subject to Dyck legality:

```text
"(" is allowed when the model permits another open obligation
")" is allowed only when height > 0
```

So the shift operator is the adjacency map from one tier to the next legal
tier. In physics language, the legal prefixes are the basis states/eigenstates
we are currently studying, and the shift operator moves amplitude across the
allowed edges.

The Hamiltonian candidate is therefore not arbitrary. It should be derived
from this adjacency structure, possibly with local weights from height, area,
turns, cycles, sharing, or other Catalan observables.

## Born-weighted paths

The current working hypothesis is:

```text
amplitudes live on legal Catalan continuations
Born weights identify the paths most likely to be observed
```

In that framing, mass and gravity may emerge as path-density effects:

```text
mass    = persistent local concentration of weighted paths
gravity = perceived attraction toward heavily travelled regions
```

This is speculative. The useful engineering version is simpler:

```text
build the lattice
define the shift
assign/derive amplitudes
apply the Born rule
look for attractors, stable cycles, and scaling laws
```

The lattice should be allowed to teach us which physical interpretation, if
any, survives.

## Large and small structures

A possible division of labor:

- small cycles and local interactions may correspond to boson/fermion-like
  behavior;
- heavy particles, such as proton-like structures, may appear only in a
  large-number or high-tier limit;
- gravity-like behavior may require statistics over many paths rather than a
  small local motif.

This is intentionally tentative. The next simulator should report structure
first and accept interpretation later.

## Relationship to the Lisp machine

The Lisp machine is not a distraction from the simulator. It is the authoring
and proof machine for one selected path through Catalan space.

Current facts:

- source writes pair structure;
- the compiler writes a causal record;
- `observe` reads by following graph structure;
- loops represent finite self-consistent recurrence;
- Scott data and continuations let source carry state;
- `counter.lisp` shows that source can provide material and author an
  allocation policy without naming each bit.
- `MACHINE_BOUNDARIES.md` separates privileged readout from graph-local
  evolution, and names where creation/annihilation should live.

The current machine still mostly precomputes consequences. That is acceptable
for now. It gives us a precise way to write and inspect causal structure before
building the full frontier simulator.

## Engineering plan

### 1. Finish the Lisp machine as the canonical authoring layer

Keep this narrow:

- preserve the tiny passive observer;
- keep names outside the machine in the legend;
- keep the compiler true-shape and understandable;
- keep WASM as proof that the machine reads graph bytes;
- improve CLI traces only where they clarify actual graph motion;
- avoid broad syntax or compiler rewrites until the boundary demands them.

The useful remaining Lisp fixtures are:

- root/world carrying dictionary and state;
- continuation-style observer questions;
- source-authored ledgers/material;
- clear examples of finite cycles, residuals, and closed reductions.

### 2. Build the Catalan frontier simulator

Start outside the Lisp compiler. The simulator should directly generate:

- legal prefixes by tier;
- height for each prefix;
- legal next continuations;
- parent/child adjacency;
- optional tree/S-expression projections.

The first benchmark is not physics. It is correctness:

```text
tier sizes match known Catalan-prefix counts
all edges preserve Dyck legality
all complete paths return to height zero
```

### 3. Add amplitudes and the shift operator

Represent a state as amplitudes over one tier:

```text
Psi_n[prefix] = complex amplitude
```

Then apply the shift:

```text
Psi_{n+1}[next] += weight(prefix -> next) * Psi_n[prefix]
```

Begin with simple local weights. Only add richer weights when the simulator
shows what information is missing.

### 4. Apply Born-rule measurements

For each tier or selected observable:

```text
probability(prefix) = |amplitude(prefix)|^2
```

Then inspect:

- which paths dominate;
- which heights dominate;
- which cycles or motifs recur;
- how distributions change with tier;
- whether attractors appear.

### 5. Connect Lisp traces to Catalan paths

Once both sides are stable, map a Lisp source/trace into the Catalan simulator:

```text
source S-expression -> Dyck path
compiled trace      -> selected causal path
simulator frontier  -> neighboring possible paths
```

This lets the Lisp machine remain the concrete proof object while the Catalan
simulator studies the surrounding space of possible continuations.

## Guardrails

- Do not hide physics assumptions in compiler behavior.
- Do not make `observe` smarter to rescue a theory.
- Do not treat names as runtime facts.
- Do not confuse finite cyclic unfolding with local accumulated history.
- Keep speculative interpretations separate from measured lattice structure.
- Keep privileged dashboard history separate from graph state unless that
  history constrains future evolution.

The near-term goal is to finish the Lisp machine just enough that it can author
and inspect causal records cleanly. Then move to the Catalan frontier, where
the shift operator and Born weights can be studied directly.
