import { render } from '@pfern/elements'

export default
{ title: 'pfernandez.github.io',
  pages: [{ path: 'graph-reduction',
            summary: 'Graph Reduction',
            items: [{ label: 'Dashboard',
                      file: 'dashboard.js',
                      default: true }] }],
  markdownGlobals: () => ({ render }),
  keepAlive: true }
