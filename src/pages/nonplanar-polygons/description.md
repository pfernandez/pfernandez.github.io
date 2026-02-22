<script type="module">

  import { render } from '@pfern/elements'
  import vis from './visualization.js'

</script>

# Nonplanar Polygons

Triangles and quadrilaterals are fundamental geometry representations that are
typically created by authoring tools to build complex polygonal meshes and
shapes.

Low-level high-performance nodes for geometry definition and fast rendering
include TriangleSet, TriangleFanSet, TriangleStripSet, IndexedTriangleSet,
IndexedTriangleFanSet, IndexedTriangleStripSet, QuadSet and IndexedQuadSet.
Special definition rules apply to each node in order to best match underlying
graphics hardware requirements. Each is placed individually inside a Shape node.

See the [visualization](/nonplanar-polygons/visualization)

# Features

**This section is to verify that the markdown is processed correctly.**

Inline math: $E=mc^2$

Inline code: `console.log('foo')`

Code block:

```js
console.log('foo')
```

Inline script:
<div id="demo" class="demo3d"></div>

<script type="module">

  render(vis(), document.getElementById('demo'))

</script>

Back to [home](/) using the sidebar link.
