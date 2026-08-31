import { render } from '@pfern/elements'

export default
{ title: 'pfernandez.github.io',
  pages: [{ path: 'graph-reduction',
            summary: 'Graph Reduction',
            items: [{ label: 'Dashboard',
                      route: '/graph-reduction',
                      source: '/src/pages/graph-reduction/dashboard.lisp',
                      default: true },
                    { label: 'Machine',
                      route: '/graph-reduction/machine',
                      source: '/src/pages/machine/machine.lisp' }] }],
  markdownGlobals: () => ({ render }) }
