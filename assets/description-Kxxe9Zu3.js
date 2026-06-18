const e=`# Graph Reduction

This page encodes a tiny Lisp surface syntax as binary pair graphs:

- \`()\` is the local root/identity pattern.
- \`(a b)\` is a pair, and application is ordinary pair structure.
- \`(f x y z)\` is left-associated as \`(((f x) y) z)\`.
- \`(define name body)\` creates a source alias.
- \`(define (name x y ...) body)\` creates a source function.

The source loader expands definitions into graph motifs before observation.
Fully applied function calls are compiled into structural wrappers: the wrapper
contains both the source argument shape and the graph that should be exposed
when the observer reaches the matching boundary.

The smallest runtime operation is still one observation step. A frame is:

\`\`\`
[observer, focus]
\`\`\`

Starting from \`focus\`, \`observe\` walks the left spine until it finds a pair
whose first slot is exactly \`observer\`, then returns that pair's second slot.
The walk does not allocate, mutate, normalize, or know Lisp names.

For example:

\`\`\`
(define (S a b c) ((a c) (b c)))
(S x y z)
\`\`\`

compiles to a self-rooted wrapper and one observation exposes:

\`\`\`
((x z) (y z))
\`\`\`

The two \`z\` positions are one shared graph value, not copied text. The tree view
duplicates that value for readability; the lattice view shows the sharing and
fixed-point loops directly.

## Boundary

There are three layers in the current lab:

- \`observe\` is the tiny machine step over pairs and reference identity.
- \`lisp.js\` is the source loader and graph builder.
- \`serialize\` is a projection from graph structure back to readable text.

The dashboard uses this same boundary. It compiles the source into an
observable graph, displays the current graph, and advances by applying the
current runtime's \`observe\` once.

The active compiler for this page is the observer-local Lisp compiler in
\`observer/lisp.js\`, which can target either JavaScript arrays or the WASM
pointer heap.
`;export{e as default};
