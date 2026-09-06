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

## Reference application

`apply.js` asks whether these bindings can describe reusable transitions without
the production linker. A transition is simply `(input body)`. Application
recursively associates identities in the input with identities in an argument,
then reads the body through those associations.

The reference operation knows no names, scopes, legends, or definition tags.
It returns an existing identity when it can. When the body requires new pairs,
it calls an explicit `construct(left, right)` boundary. This host construction
is an executable comparison point, not a decision that application must work
by copying. Recursive construction remains with the separate knot experiment.

## Concrete transitions and contextual observation

`transitions.lisp` authors the I, K, and S examples again as explicit events:
each event is `(before after)`, and a left-growing history retains the events in
their authored order. No operation derives an event's result; source includes
both sides of every transition.

`context.js` explores reuse without materializing a result. Its small inner
observer enters a definition body with an environment made from the supplied
arguments. Each pair-local selection carries the environment into another
observation and resolves its current identity without changing the body.

This gives two structural interpretations of familiar source words. A
definition can simply be the pair `(input body)`; its name remains external. A
local binding can be a pair `(parameter value)` retained in the observation's
left-growing environment. In that sense the contextual state acts like
`let`: it is `(environment body)`, rather than a copied body. Both this state
and the concrete transition history accumulate context on the left and proceed
into the current observation on the right.

The example also authors that S environment directly. In the binding language,
`(name (left right))` already acts as a minimal `define`: it makes one pair
identity available to later forms. An authored `(environment body)` context is
the corresponding structural `let`; no parser keyword is required for either.

The `enter` convenience still assembles its environment in JavaScript, while
the explicit example shows the same environment can already be authored. The
remaining question is whether the inner observer that enters, selects, and
resolves can also be authored as transitions. Contextual observation is not
yet declared to be the final execution model.

`machine.js` expands structured input matching into explicit
`(environment (work focus))` frames. K requires three matching transitions and
S requires five; resolving a parameter likewise visits one carried binding per
transition. A repeated-input check still performs an internal environment
search, so this is not a fully graph-authored matcher. Its main result is to
make the cost of structured native inputs visible.

## Pair-local reduction

`combinators.lisp` and `reduce.js` test a local way to distinguish definitions
from returned applications without a global definition table:

1. `x = (x x)` is a fixed identity and the primitive identity function.
2. `F = (F (input body))` is a definition enclosed by its own identity.
3. Every remaining pair is an application.

The reducer carries only a left-growing argument stack and a contextual term.
An application places its right side on the stack and enters its left side. A
fixed identity consumes one argument by returning it. A definition associates
one input identity with one argument and enters its unchanged body. The S
example therefore visits its authored `((x z) (y z))` body as an intermediate
state before the chosen fixed arguments eventually reduce to `c`.

A definition body may itself be another application. The reducer evaluates
its left side, retains its right side on the argument stack, and continues
without copying either expression. When the final identity is fixed, it is a
period-one observation rather than a separate terminal category.

An immediately applied self-enclosed definition has the ordinary structural
meaning of `let`. This convention adds one pair to each definition, but the
pair is not an external tag: its left edge is the definition's own identity.

`combinators.lisp` expresses curried S and K by returning self-enclosed
definitions that retain their observed environments. The unary convention
removes structured input matching from the reducer: more arguments are simply
more transitions. The reducer evaluates `S K K a` to the exact identity `a`.
This is a focused composition check, not by itself a new proof of combinatory
completeness.

The same source also authors ordinary self-application. Its finite graph was
built by strictly sequential bindings, yet its contextual observer continues
indefinitely. A simultaneous knot is therefore necessary for some finite
multi-identity pointer cycles, but not for recurrent computation. Repeated
observer states can unfold temporally from an acyclic definition body.

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
identity. `TIES.md` treats simultaneous reservation as the first further
exploration without adding it to this minimal binder.

This is not yet a replacement for the production compiler or browser. It shows
that ordinary causal growth needs no preauthored instruction vocabulary, while
making the additional capability required by longer finite cycles explicit.
