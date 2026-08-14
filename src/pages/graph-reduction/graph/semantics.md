# Linker semantics

This document describes the behavior currently established by the linker and
its tests. It is a specification of the machine as implemented, not yet a
claim about every graph that the language may eventually express.

## Source and pairs

A source contains one expression made from symbols and nonempty lists. `()` is
not source syntax: an atom is constructed by the linker, not written as nil.

Parsing preserves the authored list shape. Decomposition then prepares the
linker's input:

- `(a b c)` becomes `(a (b c))`;
- `(a (b c))` has the same decomposed form;
- `((a b) c)` retains its authored left nesting;
- `(x)` becomes `x`.

The result of decomposition contains only symbols and pairs. `link` returns the
authored `ast`, the decomposed `pairs`, the linked `graph`, and the observation
`focus` separately.

## Identity and names

An atom is a fixed pair whose two edges return to itself:

```text
atom = [self, self]
```

A source symbol names an identity while the graph is being linked. Repeated
uses of a visible name receive the same pair identity. The name remains as an
annotation for presentation, but observation does not inspect it.

The host may import named identities into the outermost lexical scope. Imported
identities obey the same visibility rules as source identities; their names let
the host associate their final addresses with device operations.

Two nodes with the same shape are not thereby the same identity. Sharing and
recurrence are represented by shared references, not by structural equality.

## Sequence and visibility

`fold` reads a decomposed sequence left to right. At each pair:

- a fresh leftmost symbol names a definition;
- an already visible leftmost symbol reuses that identity;
- reusing a definition begins an application, while reusing a parameter does
  not turn the parameter into a definition;
- a following sibling can see identities introduced by its lexical ancestors;
- a definition cannot see a later sibling;
- a sibling cannot see identities private to another sibling's children.

All parameter identities are introduced before the definition body is linked.
An inner parameter with the same name as an outer identity is a new identity and
shadows it within that definition.

These are lexical visibility rules and a construction order. Calling them
causal means specifically that a reference cannot depend on an identity that
has not yet been introduced along its visible history; it does not by itself
establish a physical interpretation.

## Structural states

The linker constructs four contextual states from pairs:

```text
atom                   [self, self]
definition             [parameters, body]
suspended application  [definition, supplied]
completed application  [arguments, result]
```

These roles are not runtime node tags. They are distinguished during linking by
identity, position, and the name annotations used by the linker.

A completed application no longer contains its definition. It records the
arguments that arrived followed by the result constructed from them. One
machine step therefore moves from arguments to result.

## Application

Parameter shape is significant. A parameter atom captures an entire argument
branch; a parameter pair matches its argument recursively. If the argument does
not yet have enough structure to match the parameters, the application remains
suspended.

A later sibling may supply the next missing argument. If linking ends first,
`focus` is the supplied causal prefix rather than a fabricated result. For
example, `(S a b)` can crystallize as `(a b)` without asserting that `a` and `b`
are the result of an `S` transition whose final argument never arrived.

Flat excess source belongs to the final parameter's right-nested branch. Thus,
with parameters `(x y z)`, arguments `(a b c d)` bind `z` to `(c d)`. Explicit
left nesting instead continues from a completed result: `((S a b c) d)` applies
`d` after the `S` transition.

Constructing a result substitutes argument identities for parameter identities.
The copy preserves sharing and cycles. A nested definition whose body refers to
an outer parameter is copied as a lexical closure; a closed definition retains
its existing identity.

## Recurrence

During one instantiation, reaching the same definition identity with the same
argument identities denotes the same configuration. The linker reuses the
unfinished result pair, tying the repeated configuration into a cycle.

This is identity recurrence, not structural deduplication. Structurally equal
configurations with different identities or histories remain distinct. A
recursion that continually creates new configurations is constructed eagerly
and is not made finite by this rule.

## Observation and current boundary

The observer's primitive operation is:

```text
step(pair) = pair.right
```

Selection, branching, repetition, and eventual return must already be encoded
in the graph. The observer neither resolves names nor reduces source forms.

A continuously running observer may expose the current address and recursively
apply `step`. It does not interpret `step(pair) === pair` as termination: a
self-edge is a persistent period-one trajectory, while a longer cycle remains a
longer repeating trajectory. Stopping, yielding, or coalescing repeated states
belongs to the observing environment rather than to the pair graph.

The current machine can construct finite linked pair graphs, including finite
cycles representing repeated configurations. It does not yet provide:

- lazy construction of an unbounded sequence of unique configurations;
- allocation of new graph identities from browser input, network data, or
  storage;
- source locations and semantic diagnostics for failed linking;
- a proof that the lexical graph rules are equivalent to a physical causal
  model.

Those are boundaries of the present implementation, not additional meanings
silently assigned to its pairs.

An Elements call may receive property data as its first argument. One property
is a `(name value)` pair; internal pairs collect multiple entries without
requiring nil. The browser device converts the entries into an Elements property
object. An event property such as `onclick` retains its value as a graph address
until the external event occurs. The device then selects that prelinked
continuation; it does not construct or choose the next application state.
