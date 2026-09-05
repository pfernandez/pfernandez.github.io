# Graph unfolding experiments

These experiments ask what must remain dynamic after the compiler has connected
a graph. They do not define production language semantics.

Both walks receive a complete root whose right side is a current function and
argument. Both allocate fresh pairs while following an excursion back to its
origin. Neither runtime knows source symbols.

## Path-selected functions

`path.js` treats a function as a reusable description. Its expressions contain
relative paths into the current root, so one function can act on arguments it
did not know when it was authored. Pair construction and path selection happen
during the walk.

This is compact, but it makes the runtime interpret a second addressing
language. `path.lisp` shows how verbose that language becomes when written out.

## Directly connected functions

`direct.js` treats ordinary expressions as their exact target identities. It
retains only two relative operations:

- `self` returns the current root.
- `make` constructs a fresh pair.

The compiler must connect a function to its argument or expand every possible
transition before the walk. `expand.js` performs that expansion for a finite
right orbit which returns to its starting focus. Its result follows exactly the
same configuration sequence as the passive REPL observer while retaining each
visit in graph structure.

Direct connection uses more transition identities when an orbit has multiple
configurations, but removes general path interpretation. Structural sharing
retains the original configurations.

## Source assembly

`assemble.js` exists only to make both raw graphs readable as Lisp. It gives
each leading name a pair identity and resolves later occurrences to identities
already visible. It is deliberately separate from the production linker.

## Still unresolved

- A direct target beginning with `make` is indistinguishable from construction
  unless it is delayed or quoted.
- A raw cycle between separate direct functions needs an enclosing scope that
  introduces both identities together, or delayed construction of one body.
- An origin outside a later attractor does not recur to itself. `expand` assumes
  a recurrent origin rather than deciding how such transients should return.
- The experiments do not yet show whether `self` and `make` are minimal, or how
  either operation would be authored by a graph-resident linker.
