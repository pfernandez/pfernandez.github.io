const e=`# Passive Graph Reduction

This directory is a small prototype for a pair-only computational substrate.
The practical target is a WebAssembly-ready core. The theory target is more
ambitious: test whether Lisp-like computation can be expressed as direct graph
structure, with observation selecting prepared futures instead of an external
evaluator rewriting syntax.

The code is deliberately small. The important tests are not only checking an
implementation; they are probes for what kinds of structure can be represented.

## Core Idea

The machine starts with one constructor:

\`\`\`text
pair(first, next)
\`\`\`

In JavaScript this is a two-slot array. In WebAssembly it is two \`i32\` slots in
linear memory. A pair is treated as potential: it can carry a present focus, a
future value, a wrapper, a fixed point, or a link to another part of the graph.

Observation is one passive step:

\`\`\`text
[observer, focus] -> selected future
\`\`\`

The observer walks the left spine of \`focus\` until it finds a pair whose first
slot is exactly the observer. It then returns that pair's next slot.

Observation does not allocate, mutate, normalize, or consult global state. If a
future is selected in one step, that future was already present in the graph.

## Why Pairs Are Enough

The working chain of ideas is:

1. Lambda calculus and Turing machines describe the same computable processes.
2. Lambda expressions can be represented as unary function structure.
3. Unary function structure can be encoded as binary pair structure.
4. Fixed points and reentry turn trees into graphs.
5. SKI shows that substitution and named variables are not fundamental.
6. Lisp shows that symbolic computation can be built around \`cons\`.
7. Direct graph references let combinators compute by sharing structure.
8. A pair can be treated as potential, with observation selecting a future.

This does not mean all computation is free. It means the cost has to live
somewhere: in source structure, graph construction, prior graph history, or a
closed machine that already contains the legal future.

## One Step And Many Steps

Any finite transform can be observed in one step if its input, observer, and
output relation already exist in the graph.

That does not erase internal structure. A one-step result may still contain a
deep nested form:

\`\`\`lisp
(f (g x))
\`\`\`

The step selects that form. It does not necessarily record every intermediate
event that would have led to it under a smaller-step evaluator.

This gives two useful views:

\`\`\`text
global: origin -> result
local:  origin -> ... -> intermediate -> ... -> result
\`\`\`

The current compiler mostly uses the global view. It instantiates known Lisp
definition bodies as output templates, then the runtime observes the prepared
frame once.

The future graph-resident evaluator would use the local view. It would preserve
function boundaries as graph structure and let composition unfold through
repeated observation.

Both views may be valid. The distinction matters because we do not want to add
runtime steps merely to see motion. We should add steps only when intermediate
states are values the machine must expose, reuse, remember, branch on, or send
through an IO boundary.

## Lisp Compilation

The source compiler currently follows this shape:

\`\`\`text
parse(source) -> compile(state, forms) -> runtime.observe(graph)
\`\`\`

A Lisp definition is treated as an output template:

\`\`\`lisp
(define (compose f g x) (f (g x)))
\`\`\`

The body already contains the output shape. A call supplies bindings for the
holes:

\`\`\`text
f -> first function
g -> second function
x -> input
\`\`\`

The compiler connects those bindings into the body. If all function definitions
are known, composed calls usually become one observable graph frame. Unknown
function values remain visible as ordinary pair structure.

\`sourceStep(state, source)\` is the source-evaluator checkpoint for REPL-like
use: definitions update the compiler state, the final expression is compiled
and observed once, and callers serialize the returned graph.

The CLI wrapper runs that boundary interactively:

\`\`\`sh
node src/pages/graph-reduction/observer/repl.cli.mjs
\`\`\`

Use \`.exit\` or \`.quit\` to leave. Pass \`--empty\` to start without the source
kernel preloaded. Pass \`--trace\`, or set \`trace: true\` in \`config.lisp.js\`, to
print each graph passed to the JavaScript observer's internal \`walk\` function
before the reduced result.

Recursive value definitions are handled by reserving a pair, binding the name
to that pair while compiling the body, and then filling the reserved pair:

\`\`\`lisp
(define I (I I))
\`\`\`

That produces a real graph knot in both JavaScript and WebAssembly.

## Compiled Machine Shape

The machine compiler builds a graph that can be advanced by following \`right\`.
The host does not evaluate the graph; it only reads ports and moves the root's
current pointer.

\`\`\`text
machine     = [ports, current]
ports       = [input-event, source-frame]
input-event = [input, value]
input       = stable socket
state       = [carried, next-state]
carried     = [[machine, next-state], output-event]
output-event = [output, frame]
output      = stable socket
\`\`\`

Input is structural. The socket is stable; writing input creates a fresh event
\`[input, value]\` and moves \`ports[0]\` to it. The initial event carries \`I\` as
its value, so the machine does not need to clear or rewrite the socket.

Output is also structural. Each current state carries an output event
\`[output, frame]\`; \`machineOutput(state, machine)\` observes that frame once.
Static output frames resolve to their compiled values.

The smallest host step is:

\`\`\`text
output = machineOutput(state, machine)
machineStep(state, machine)
\`\`\`

\`machineStep\` mutates only \`machine[1]\`, replacing the current state with the
right child of that state. This is the current CPU/WASM boundary: the graph
contains the next relation, but the host still moves the pointer.

\`machineSourceStep(state, machine, source)\` is the smallest REPL-shaped
boundary around that protocol. It compiles source text into a graph value,
connects that value as an input event, reads the current output, and advances
the machine once.

## Kernel Source

The kernel is ordinary Lisp source, not a table of runtime primitives:

\`\`\`lisp
(define (I x) x)
(define (K a b) a)
(define (S a b c) ((a c) (b c)))
(define (true a b) a)
(define (false a b) b)
(define (not p a b) (p b a))
(define (and p q a b) (p (q a b) b))
(define (or p q a b) (p a (q a b)))
(define (pair a b f) (f a b))
(define (first p) (p true))
(define (second p) (p false))
(define (zero f x) x)
(define (one f x) (f x))
(define (two f x) (f (f x)))
(define (succ n f x) (f (n f x)))
(define (add m n f x) (m f (n f x)))
(define (mul m n f x) (m (n f) x))
(define (is-zero n a b) (n (K b) a))
\`\`\`

The tests show that this source works on both runtimes. The compiler does not
special-case booleans, pairs, or numerals as syntax. They are source forms that
compile into graph structure.

## Memory And History

A value does not need to remember every cause that produced it. A hydrogen atom
does not locally carry its whole past. Its past can be recorded in a larger
structure, such as a crystal, a sensor, or a mind.

The same principle should hold here:

- ordinary values can be just values,
- machines can carry state,
- memory graphs can record selected transitions,
- IO boundaries can exchange graph forms with the outside world.

History should be explicit structure when a program needs it, not hidden
metadata attached to every value.

## Current Status

Implemented and tested:

- passive one-step observation,
- local roots for JavaScript and WebAssembly runtimes,
- pair allocation and slot mutation in both runtimes,
- recursive value definitions,
- source-level closures and partial calls,
- first-class function values in the source compiler,
- source kernel with SKI, booleans, pairs, and Church numerals,
- a minimal \`sourceStep(state, source)\` boundary for REPL-like use.
- a compiled machine target with current, input, output, and step helpers.

Open next questions:

- How should memory be represented as ordinary graph structure?
- When should composition remain graph-resident instead of compiled through?
- Can graph-resident composition reproduce the same results as template
  compilation?
- Which parts of the compiler are true structure, and which are temporary help
  for the current CPU/WASM medium?

## Running The Tests

From this directory:

\`\`\`sh
node --test ./observe.test.js ./wasm.test.js ./lisp.test.js
\`\`\`

From the repo root:

\`\`\`sh
npm test
npm run build
\`\`\`
`;export{e as default};
