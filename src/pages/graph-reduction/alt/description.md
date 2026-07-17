# Graph Reduction

This page is a lab for expressing Lisp-like computation as binary pair graphs.
The current branch is moving from the older observer-local compiler toward a
smaller graph-native path:

```text
source text -> parse -> link -> graph + legend -> step -> view
```

The graph itself is pairs only. Source names are construction and display
handles; after linking, the machine should be able to run by identity and
pointer shape alone.

## Current branch path

The active graph-native experiment is:

- `graph/parse.js` reads source into plain syntax trees.
- `graph/link.js` links lexical identities into a pair-only graph.
- `graph/step.js` steps to the right edge: `pair => pair[1]`.
- `graph/serialize.js` projects graph structure back into readable text, using
  the legend only for display.

The default graph-native source is currently `core.graph.lisp`. It is not yet
canonical `core.lisp`; the older compiler path remains in place until the new
path carries the same important behavior.

## What the older paths are for

The old and alternate implementations are still useful, but they now have
specific roles:

- `graph/compile.js` is the behavior oracle. Its tests cover the Lisp behaviors
  we do not want to lose, including data constructors, structural recursion,
  arithmetic, open residuals, and active-call sharing.
- `alt/compilers/traces/` is the focus-shape oracle. Those saved traces show
  the application spine that should remain visible before an answer is reached.
- `alt/observer/` is the machine/root/future oracle. Its tests explore passive
  observation, closed machines, linked futures, IO ports, and carried history.

None of those paths is the target engine. They are references for deciding what
the graph-native path must preserve.

## The important boundary

The current `link` still completes known calls while building the graph. For
example, an `S` call can already contain the answer:

```lisp
((a c) (b c))
```

That is acceptable as a bridge only if the linked graph still preserves the
application focus shape that exposes where the answer came from. The saved
compiler traces show this older shape clearly:

```text
(((($ ((a c) (b c))) a) b) c)
```

The long-term goal is not to hide evaluation in the linker or the stepper. A
future event should be present as graph structure. With pure `step`, changed
recursive calls now tie back into the active linked answer. That gives a finite
orbit; unbounded count belongs to the path/history of observation, not to
host-side future materialization.

## Runtime rule

The branch keeps the runtime step small:

```js
return pair[1]
```

All machine-visible motion is ordinary right-edge stepping. If a source-level
loop needs to expose history, that history has to be carried by graph structure
or by the event path that observes the graph.

## Geometry and orientation

Right-stepping is a convention of the current graph shape. A mirrored machine
could step left if the source, linker, loops, and shared identities were all
built around that orientation.

The useful invariant is not that the right edge is special. The useful invariant
is that `step` follows the right edge and does nothing else. Once the graph is
linked, orientation is no longer arbitrary: it determines which identities are
adjacent, which cycles close, and which future is reachable next.

That makes successor-like behavior a graph-geometry problem. A finite graph can
contain a cyclic successor orbit; an unbounded count needs an unbounded
observation history or a graph-native allocation story.
