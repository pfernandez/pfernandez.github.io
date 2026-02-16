Content MathML gives you a standard-shaped AST container, and Elements.js gives you a pure→DOM evaluator with cheap “replace this subtree” updates—
  perfect for stepwise reduction demos.

  Here’s a more concrete outline that surfaces the real tradeoffs (weight, collisions, docs posture).

  1) Three separate concerns (so you can stage them)

  - (A) Runtime correctness (must-have): MathML namespace in renderTree so native MathML nodes are created with createElementNS(mathNS, tag) when inside <math>.
  - (B) Authoring ergonomics (optional): some MathML tag helpers, like mrow(...), apply(...).
  - (C) “Comprehensive source + docs” (optional): lots of helpers + lots of JSDoc + big .d.ts.

  You can do A now without committing to B/C.

  2) Why MathML helpers are trickier than HTML/SVG helpers
  If MathML helpers are exported from the root @pfern/elements, you immediately hit name collisions with existing exports:

  - Example: SVG already exports set (the SVG <set> animation element). Content MathML also has <set>. You can’t export both as set.

  So a “comprehensive” MathML surface almost forces one of these API shapes:

  - A subpath entrypoint: @pfern/elements/mathml (best ergonomics, avoids collisions cleanly).
  - A namespace object: import { mathml } from '@pfern/elements' then mathml.set(...) (no collisions, but slightly less Lisp-y).
  - Prefixing/aliasing lots of tags (I wouldn’t).

  This is independent of runtime namespace support.

  3) Curated MathML v1 (focused on your SKI/content goals)
  I’d pick a set that covers:

  - “Render something readable” (Presentation core)
  - “Represent application/binding/semantics” (Content structural)
    …and skip the massive operator dictionaries.

  Presentation-core (small + high ROI):

  - math, mrow, mi, mo, mn
  - mfenced, msup, msub, msubsup
  - mfrac, msqrt, mroot
  - munder, mover, munderover
  - mtable, mtr, mtd
  - mtext, mspace, mstyle, menclose

  Content-structural (what you’ll actually emit for SKI/lambda-ish trees):

  - apply, ci, cn, csymbol
  - bind, bvar, lambda
  - semantics, annotation, annotationXml (for annotation-xml)

  Operators: don’t export 200 of them. For SKI you can treat combinators/functions as identifiers:

  - Use csymbol({ cd: 'ski' }, 'S') etc, then apply(S, x, y, z).

  4) The “best of both” MathML pattern for your use-case
  Use semantics(presentation, annotationXml(content)) so you can:

  - Show a human-friendly presentation tree
  - Carry the exact Content MathML tree (or even XHTML/JSON) alongside it for inspection, stepping, tooling, copying, etc.

  Conceptually:

  - presentation(expr) is what you see
  - content(expr) is what you evaluate
  - x3d(expr) is what you understand spatially

  All three are just views of the same underlying AST snapshot.

  5) How the X3D + MathML combo fits Elements.js perfectly
  You probably don’t want to literally embed X3D inside MathML; instead you want a shared model:

  - One expression graph with stable node IDs
  - Two renderers:
      - toMathML(expr) emits MathML with data-node-id attributes
      - toX3D(expr) emits X3DOM shapes with the same data-node-id
  - Then interactions can cross-highlight:
      - click a MathML node → highlight/zoom the corresponding 3D node (and vice versa)
      - “step reduction” event returns the next vnode for the whole visualizer component (Elements replaces the boundary)

  ontick can animate layout/forces/selection (and your X3DOM readiness gating is already built-in).

  6) Keeping library weight aligned with your philosophy
  If you want “Elements is comprehensive” without bloating the default import:

  - Ship A in core (correctness).
  - Ship B as optional entrypoint (@pfern/elements/mathml) so people opt into extra helpers/docs (and you dodge collisions cleanly).
  - Document that even without helpers, any MathML tag works as a raw vnode: ['apply', {}, ...].
