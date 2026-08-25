import { render } from '@pfern/elements'

export default
{ title: 'pfernandez.github.io',
  pages: [{ path: 'graph-reduction',
            summary: 'Graph Reduction',
            items: [{ label: 'Dashboard',
                      file: 'root.js',
                      source: 'dashboard.lisp',
                      publicPath: '/graph-reduction',
                      default: true },
                    { label: 'Machine',
                      file: 'root.js',
                      source: 'machine.lisp',
                      publicPath: '/graph-reduction/machine' }] }],
  markdownGlobals: () => ({ render }),
  keepAlive: true }
