import { render } from '@pfern/elements'

export default
{ title: 'pfernandez.github.io',
  pages: [{ path: 'graph-reduction',
            summary: 'Graph Reduction',
            items: [{ label: 'Tree',
                      file: 'visualizations/tree/index.js',
                      default: true },
                    { label: 'Symbolic Expressions',
                      file: 'visualizations/lisp.js' },
                    { label: 'Lattice',
                      file: 'visualizations/lattice/index.js' },
                    { label: 'Description',
                      file: 'description.md' },
                    { label: 'Proofs',
                      file: 'visualizations/proofs.js' }]}],
  markdownGlobals: () => ({ render }),
  keepAlive: true }
