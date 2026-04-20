const e=`# Graph Reduction

This page lowers a tiny Lisp surface syntax to *binary pairs*:

- \`()\` is the empty list
- \`(a b)\` is a pair (also used as an application node)
- \`(f x y z)\` is left-associated as \`(((f x) y) z)\`
- \`(def name body)\` and \`(defn name (x y ...) body)\` work like the Basis
  prelude and expand before stepping

The current mechanics are:

- The compiler lowers numeric \`def\` templates and fully applied
  parameter-only \`defn\` bodies to shared fixed-point argument closures.
- \`serialize\` shows those closures as folding instructions: remaining
  closures become dense slot numbers, and the staged argument payloads are
  appended in fill order.
- \`observe\` performs one leftmost-outermost step over a whole term
- \`[self, value]\` is the fixed-point motif, and observing it fires to \`value\`

Example motif (S kernel body):

\`\`\`
((0 2) (1 2))
\`\`\`

Applied as:

\`\`\`
(((((0 2) (1 2)) a) b) c)
\`\`\`

The folding projection exposes each staged step:

\`\`\`
(((((0 2) (1 2)) a) b) c)
((((a 1) (0 1)) b) c)
(((a 0) (b 0)) c)
((a c) (b c))
\`\`\`

The Lisp and tree views show this reversible projection. The lattice view is
a literal graph sketch of pair nodes, shared arguments, and fixed-point loops.
`;export{e as default};
