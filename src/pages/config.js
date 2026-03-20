import { render } from '@pfern/elements'

export default
{ title: 'pfernandez.github.io',
  pages: [{ path: 'graph-reduction',
            summary: 'Graph Reduction',
            items: [{ label: 'SKI',
                      file: 'visualizations/ski.js',
                      default: true },
                    { label: 'Binary Tree',
                      file: 'visualizations/binary-tree.js' },
                    { label: 'Symbolic Expressions',
                      file: 'visualizations/lisp.js' },
                    { label: 'Proofs',
                      file: 'visualizations/proofs.js' }]},
          { path: 'nonplanar-polygons',
            summary: 'Nonplanar Polygons',
            items: [{ label: 'Visualization',
                      file: 'visualization.js' },
                    { label: 'Description',
                      file: 'description.md' }]}],
  markdownGlobals: () => ({ render }),
  keepAlive: true }
