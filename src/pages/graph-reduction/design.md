# Machine design target

This document describes the machine we intend to build. It is a working design
target, not a specification of everything the current implementation already
supports. Established behavior remains documented separately in
`graph/semantics.md`.

## Purpose

The immediate goal is a web application authored in the Lisp and executed as a
pair graph in WebAssembly. JavaScript should eventually serve only as browser
firmware: starting the machine, relaying external input, and performing device
operations such as DOM updates.

The longer-term goal is a graph capable of carrying its own parser, linker,
library, application, and observers.

The opening claim of the site should eventually be literally true:

> This web application is running entirely within the machine it describes.

## The graph

The runtime graph contains only pairs. A pair is identified by its reference or
address, not by its shape.

```text
pair = [left, right]
atom = [self, self]
```

Two structurally identical pairs may be different identities. Shared
references, cycles, and recurrence are part of the graph's meaning.

Names do not belong to the runtime machine. They help construct, inspect, and
present identities. A legend associates graph identities with their authored
spellings without changing the graph itself.

The colored `()` used by the serializer remains a presentation glyph for an
edge returning to an identity expanded elsewhere. It is not source syntax or
nil.

## Source construction and identity

Source is initially authored as symbols and lists. Parsing preserves that
shape; decomposition lowers sequences into pairs.

Spelling and graph identity are different concerns, but they do not necessarily
require separate graph walks. Lexical introduction, reference, and application
all depend on the same position and visible history. The pair-local linking
walk may therefore construct identities while it constructs applications.

The reader may associate spellings with token identities and maintain an
external legend. The linking walk can then compare identities without
inspecting their spellings.

```text
source
-> authored AST
-> decomposed pairs
-> linked graph
-> address image
```

The linker should ultimately be spelling-blind. This does not require it to be
binding-blind: lexical identity construction may remain part of the same walk.

Three kinds of identity must remain distinct:

- A preauthored value identity may be shared everywhere.
- A parameter identity belongs to one lexical binding site.
- An argument identity may be shared by any number of applications.

Equal spelling does not imply equal binding identity. `F`'s `x` and `G`'s `x`
may share a spelling atom in the reader, but their lexical binders remain
distinct. Resolved uses point directly to the appropriate binder identity.

## Libraries

A library is any recursively visible collection of definitions and their uses.
It has no unique node type or privileged place in the graph. A core library is
only a set conventionally imported or authored before an application.

More than one library may be visible. Libraries may provide different device
vocabularies, alphabets, mathematical operations, author languages, or observer
conventions. Definitions such as `parse`, `link`, `observe`, and application
helpers should eventually be ordinary library definitions rather than
privileged runtime operations.

A definition carries its dependencies through lexical reference:

```text
observe -> link -> identity construction
                -> application
                -> recurrence
```

The observer therefore need not copy or explicitly carry the entire library. A
reference to `observe` transitively reaches the closed definitions it uses.

An explicit library reference may still be carried when the application needs
to replace or extend its visible definitions while running. A recursive library
definition may accept entries whose identities and meanings were not known when
that definition was authored.

## Fixed states and continuations

The source-defined `fix` constructs a period-one state:

```text
fix(x) = [x, fix(x)]
```

A fixed state is persistent, not necessarily terminal. It may represent a
stable view waiting for an external cause.

`fix` is not a thunk, lambda, event handler, or delayed application. Event
continuations are definitions that accept arguments dynamically:

```text
handler(input) -> nextState
```

A component may therefore have the conceptual form:

```text
dashboard(message)
  = fix(view(message, onclick: handler))

handler(input)
  = dashboard(result(message, input))
```

Each application of `dashboard` produces a stable state closed over its
argument. An event moves observation from one stable configuration to another.

## Input

The input alphabet may be preauthored as graph identities. An ASCII library
could contain distinct definitions with identity behavior:

```lisp
((ascii-a x x)
 (ascii-b x x)
 ...)
```

These definitions have equivalent transition behavior but different pair
identities. A more expressive encoding may later give each character an
authored bit representation or dispatch behavior.

The browser translates an external character into an existing alphabet
address. It does not need to construct or name a new atom.

A string can exist in several exact forms:

- As the observer path through successive character identities.
- As persistent pairs containing its successive prefixes.
- As an incrementally computed state that no longer retains the original text.

A finite static graph can admit infinitely many input paths. It cannot retain
an arbitrary path as an accessible value unless that history is carried by the
observer or materialized in persistent structure.

## Dynamic application

External input joins a waiting continuation:

```text
continuation + input -> application -> next state
```

An application may be present as a pair:

```text
[continuation, input]
```

In the machine image, that pair may also be the address from which observation
moves to `input`. Material structure and temporal transition are therefore not
necessarily competing representations of the application.

The open question is whether each newly observed transition requires a new pair
identity or can select an already-authored transition. Existing pairs remain
immutable either way. A new event extends the realized causal history rather
than changing the fixed state that preceded it.

## Machine image

The machine image makes every node a pointer to its next transition. For a
non-atomic pair addressed by `p`:

```text
memory[p - 4] = left
memory[p]     = right
step(p)       = memory[p]
```

An atom is one meaningful self-referential address:

```text
memory[a] = a
```

This is a lossless compression of `[self, self]`: the repeated edge carries no
additional information. It also lets one plain pointer load perform the machine
step. The representation must still distinguish atom addresses from addresses
of non-atomic pairs, for example through alignment.

The observer does not require left traversal. A serializer, linker, or device
may know how the rest of a pair is laid out without making that operation part
of the observer.

## Linking over time

A program definition is an intensional representation of its potentially
infinite application graph.

One possible implementation constructs configurations incrementally:

1. Receive an application whose identities are now known.
2. Construct its result topology.
3. Reuse an existing identity when the same configuration has already
   occurred.
4. Append a new immutable configuration when it has not.
5. Tie recurrence into cycles.

This is not yet assumed to be necessary. A finite recursive graph may instead
process an unbounded stream of preauthored identities, emit results, and receive
those results as later inputs. The growing information then resides in the
observer's history or input/output stream rather than newly allocated graph
cells.

For a finite state space and finite alphabet, all transitions may eventually be
expanded. For a Turing-complete system, the reachable configuration space may
be infinite, and termination for arbitrary inputs cannot generally be decided.
Experiments should determine whether persistent graph construction is required
before it becomes part of the substrate.

## Graph-resident observation

The present host-side result already suggests the eventual observer state:

```js
{ graph, focus }
```

A graph-resident form would conceptually carry:

```text
Observer = [World, Focus]
```

`World` is a shared root of everything visible to that observer. `Focus` is its
current position or continuation.

There need not be a special root node type. A root observer is special only
because:

- the host begins at its exported address;
- it initially possesses the device capabilities;
- its world reference reaches the initial library and application.

Child observers may receive narrower world references and fewer capabilities.
Being descended from the root should not automatically expose the private
children of sibling branches.

## Browser architecture

The application graph should be embedded directly in the Wasm module.

```text
main browser thread              worker and Wasm
-------------------              ---------------
DOM device functions   <------   device requests
browser input          ------>   input identities
                                 graph observer
                                 application
                                 parser and linker
```

The main thread retains browser functions because Workers cannot manipulate the
DOM and JavaScript functions cannot be transferred through worker messages.

The worker sends device identities and graph values, not function names. The
main thread maps those identities to Elements and browser capabilities.

JavaScript's eventual responsibilities are limited to:

- creating the Worker;
- instantiating the Wasm module;
- translating browser events into graph identities;
- translating device identities into browser operations.

JavaScript should not determine graph transitions, apply event handlers,
resolve names, or manage application state.

## Self-hosting

Self-hosting may not require placing a complete linker in the initial Wasm
image. The bootstrap may instead be the smallest recursive graph able to accept
an existing identity, let that argument affect its next transition, and call
itself with further arguments. Source can then supply progressively richer
libraries, lexical behavior, parsing, and linking.

The first bootstrap may be produced by the present JavaScript linker or written
directly as a pair image in Wasm bytes.

A direct-byte bootstrap would make the initial assumptions explicit:

- pair-cell width;
- address representation;
- byte order;
- graph root;
- initial focus;
- device import convention.

One eventual bootstrap fixed point is:

```text
hand-authored image
-> linker0
-> linker0 links its own source into linker1
-> linker1 links the same source into linker2
-> linker1 and linker2 are graph-isomorphic
```

The JavaScript loader then ceases to be a semantic authority. Whether the
minimal seed must already contain a linker is deliberately left open.

## Minimal substrate

The irreducible substrate should be discovered rather than prescribed. The
current candidate is approximately:

- pair-address memory;
- one pointer dereference for the next transition;
- an entrypoint;
- a device boundary through which identities may arrive and be emitted.

It remains open whether generic referential identity comparison belongs to this
substrate. Equality over an authored finite domain can be defined in source.
Distinguishing arbitrary opaque but structurally identical atoms requires
either observable addresses, observer history, or an authored discriminator.

The current result-feedback experiment requires no referential comparison in
the worker. Source carries an observer state `[current, future]`. An authored
event recursively re-enters the application with `future`. The current
dashboard demonstrates this with a three-state recursive orbit, so the complete
path reuses existing graph identities without constructing graph cells. This
establishes graph-authored progression without admitting device-provided
identities. Undo, Reset, and step counting remain absent or disabled until their
history can be represented without host-owned state or fictitious graph
transitions.

It also remains open whether input selection and pair construction belong to
the substrate. Source may be able to select among preauthored identities and
feed emitted identities back as later arguments without allocating new graph
cells.

## Milestones

These milestones are experiments, not architectural commitments. A milestone
is complete only when its behavior is demonstrated by focused tests.

- [x] Re-enter an authored component with a new preauthored argument on click.
- [x] Re-evaluate the single-slot pointer representation from `f46a776` against
      the current graph.
- [x] Select a preauthored application of an authored event continuation using
      an identity from a small authored input alphabet.
- [x] Feed existing result identities back as new inputs without constructing
      graph cells.
- [x] Author a recursive library definition that accepts entries it did not
      previously know.
- [ ] Find the smallest self-calling graph that can accept new arguments and
      acquire further behavior from source.
- [ ] Decide from those experiments whether runtime graph construction is
      necessary.
- [ ] Bootstrap the minimal graph directly from bytes.

## Open decisions

The design deliberately leaves these questions unresolved:

- Whether a newly observed application requires a new pair identity or selects
  an already-authored transition.
- Whether arbitrary input history belongs to the observer or persistent graph
  structure.
- How a continuously running Wasm observer yields to external input.
- Whether new pairs must be constructed at runtime at all.
- If they must, how new pairs are appended and previously constructed
  configurations interned.
- Whether character identities carry only distinct addresses or authored bit
  behavior.
- Whether generic reference equality is primitive or derived from an explicit
  identity representation.
- How the reader removes spelling knowledge while preserving one pair-local
  linking walk.

These are implementation and semantic choices still under investigation, not
meanings to hide in the device layer or silently assign to the linker.
