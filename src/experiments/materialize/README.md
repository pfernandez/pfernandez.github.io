# Static materialization experiment

This experiment keeps the primitive observer separate from construction. The
host may calculate identities while linking, but the completed graph contains
every transition and the observer only follows an existing right edge.

The graph uses two self-similar planes:

```text
observer frame = (observation next-frame)
observed pair  = (left right)
```

Their shapes are identical. Their roles come only from the observer's current
position. A pair-valued result can occupy a frame's left edge without its own
right edge being mistaken for the observer's future.

Application construction returns two compile-time facts: the history that made
a value available and the exact identity of that value. When another
application consumes it, generated history becomes earlier observer frames and
the consumer points directly to the value identity. No runtime `results` or
`selections` map is needed.

After a finite construction, the last frame returns to itself by identity. A
recurring construction can instead point it to an earlier equivalent frame.
The primitive operation `next` is exactly `frame[1]`. The diagnostic `observe`
helper remembers visited frame identities only so it can sample one finite
period. Neither operation knows about functions, data, arguments, definitions,
or application.

The JavaScript transition functions in the tests stand in for link-time
construction. They are not proposed runtime capabilities or a graph-authored
evaluator. The experiment proves a target topology; integrating it with source
requires the production linker to emit the same separation between retained
history and directly consumed values.

`link.js` performs that complete sequence for the finite unary source subset.
It connects ordinary source through the seed compiler, runs the contextual
reference evaluator during linking, and places every visited focus into a
static recurrent observer graph. Its returned runtime artifact contains only
`graph`, `focus`, and `legend`; the runtime observer needs no evaluator state,
`results`, or `selections`.

This does not yet replace production composition. Structured inputs, named
application results, and devices remain outside the subset.

Recurring reduction is handled during linking. Program identities compare by
reference; temporary stacks, environments, and closures compare by pair
structure. When a contextual state repeats, the last generated observer frame
points to the frame for its first occurrence. Ordinary self-application thus
produces a finite static orbit rather than making the linker enumerate an
unbounded history. A divergent reduction whose contextual state never repeats
remains divergent; detecting arbitrary nontermination is not claimed.

## Device edge

`project.js` reads only the observation on the current frame's left. If that
observation's left identity names a capability in the legend, it passes the
observation's right identity to the capability unchanged. A pair-valued
argument therefore remains one value without a generic flattening rule.

This adapter intentionally supports one raw argument. Arity and destructuring
would need to belong to the capability's authored interface or to a smaller
graph-authored adapter. They do not belong to the rightward observer, and the
device does not advance or search the graph.

The thin compiler can connect imported capabilities as fixed identities. When
link-time reduction reaches a capability call, it makes that call the final
recurrent observation instead of treating the capability identity as an
ordinary identity function. The resulting source-to-device path retains the
same runtime boundary: the graph is already static, `next` remains right-only,
and `project` receives the current observation without choosing its future.
