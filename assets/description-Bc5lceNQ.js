const e=`<script type="module">
  const { default: vis } = await md.import('./visualizations/lattice.js')
<\/script>

# Lattice

This scene keeps an XY grid fixed as the observer plane and suspends the
current pair graph above it. The root stays anchored at the origin while the
rest of the structure re-expresses itself around that contact point after each
collapse event.

See the [interactive lattice](/graph-reduction/visualizations/lattice).

<div id="lattice-demo" class="demo3d"></div>
<script>render(vis(), document.getElementById('lattice-demo'))<\/script>
`;export{e as default};
