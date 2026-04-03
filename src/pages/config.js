import { render } from '@pfern/elements'

export default
{ title: 'pfernandez.github.io',
  pages: [{ path: 'graph-reduction',
            summary: 'Graph Reduction',
            items: [{ label: 'Tree',
                      file: 'visualizations/tree.js',
                      default: true },
                    { label: 'Symbolic Expressions',
                      file: 'visualizations/lisp.js' },
                    { label: 'Lattice',
                      file: 'visualizations/lattice.js' },
                    { label: 'Description',
                      file: 'description.md' }]}],
  markdownGlobals: () => ({ render }),
  keepAlive: true }
