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

A future identity-construction phase should resolve lexical names before
linking. Its output should contain shared references rather than strings. It
should also produce an external legend.

```text
source
-> authored AST
-> decomposed pairs
-> lexically identified graph
-> linked graph
-> address image
```

The linker should ultimately operate only on pairs and identity equality.

Three kinds of identity must remain distinct:

- A preauthored value identity may be shared everywhere.
- A parameter identity belongs to one lexical binding site.
- An argument identity may be shared by any number of applications.

Equal spelling does not imply equal binding identity. `F`'s `x` and `G`'s `x`
may share a spelling atom in the reader, but their lexical binders remain
distinct. Resolved uses point directly to the appropriate binder identity.

## Library

The machine begins with an authored library in its visible history.
Definitions such as `parse`, `link`, `observe`, and application helpers should
eventually be ordinary library definitions rather than privileged runtime
operations.

A definition carries its dependencies through lexical reference:

```text
observe -> link -> identity construction
                -> application
                -> recurrence
```

The observer therefore need not copy or explicitly carry the entire library. A
reference to `observe` transitively reaches the closed definitions it uses.

An explicit library reference may still be carried when the application needs
to replace or extend its library while running.

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
app(message)
  = fix(view(message, onclick: handler))

handler(input)
  = app(result(message, input))
```

Each application of `app` produces a stable state closed over its argument. An
event moves observation from one stable configuration to another.

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

Two encodings remain under consideration.

Materialized application:

```text
[continuation, input]
```

Temporal application:

```text
continuation -> input
```

In the temporal form, the ordered observer history constitutes the application.
This could avoid allocating a pair merely to record two consecutive causal
arrivals, but it makes observer history part of the machine's semantic state.

Whichever representation is chosen, existing pairs remain immutable. A new
event extends the realized causal future rather than changing the fixed state
that preceded it.

## Incremental linking

A program definition is an intensional representation of its potentially
infinite application graph.

The linker should not attempt to enumerate every possible input and result
eagerly. It should construct configurations incrementally:

1. Receive an application whose identities are now known.
2. Construct its result topology.
3. Reuse an existing identity when the same configuration has already
   occurred.
4. Append a new immutable configuration when it has not.
5. Tie recurrence into cycles.

For a finite state space and finite alphabet, all transitions may eventually be
expanded. For a Turing-complete system, the reachable configuration space may
be infinite, and termination for arbitrary inputs cannot generally be decided.

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

The first graph-resident linker may be bootstrapped by the present JavaScript
linker or written directly as a pair image in Wasm bytes.

A direct-byte bootstrap would make the initial assumptions explicit:

- pair-cell width;
- address representation;
- byte order;
- graph root;
- initial focus;
- device import convention.

The bootstrap target is:

```text
hand-authored image
-> linker0
-> linker0 links its own source into linker1
-> linker1 links the same source into linker2
-> linker1 and linker2 are graph-isomorphic
```

The JavaScript loader then ceases to be a semantic authority.

## Minimal substrate

The intended irreducible machine substrate is approximately:

- pair-address memory;
- left and right traversal;
- an entrypoint;
- external input selection;
- device dispatch;
- append-only construction or interning of pair identities.

It remains open whether generic referential identity comparison belongs to this
substrate. Equality over an authored finite domain can be defined in source.
Distinguishing arbitrary opaque but structurally identical atoms requires
either observable addresses, observer history, or an authored discriminator.

## Open decisions

The design deliberately leaves these questions unresolved:

- Whether applications arriving through events are materialized pairs or
  observer-history transitions.
- Whether arbitrary input history belongs to the observer or persistent graph
  structure.
- How a continuously running Wasm observer yields to external input.
- How new pairs are appended and previously constructed configurations
  interned.
- Whether character identities carry only distinct addresses or authored bit
  behavior.
- Whether generic reference equality is primitive or derived from an explicit
  identity representation.
- How the current linker's construction and application walk separates into
  symbol-aware construction followed by a symbol-blind linker.

These are implementation and semantic choices still under investigation, not
meanings to hide in the device layer or silently assign to the linker.
