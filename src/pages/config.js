import { render } from '@pfern/elements'

export default
{ title: 'pfernandez.github.io',
  pages: [{ path: 'graph-reduction',
            summary: 'Graph Reduction',
            items: [{ label: 'SKI',
                      file: 'ski.js',
                      default: true },
                    { label: 'Binary Tree',
                      file: 'binary-tree.js' },
                    { label: 'Lisp View',
                      file: 'lisp.js' }]},
          { path: 'nonplanar-polygons',
            summary: 'Nonplanar Polygons',
            items: [{ label: 'Visualization',
                      file: 'visualization.js' },
                    { label: 'Description',
                      file: 'description.md' }]}],
  markdownGlobals: () => ({ render }),
  keepAlive: true }
