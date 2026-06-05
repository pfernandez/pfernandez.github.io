import { serialize } from '../observer/lisp.js'
import dashboard from '../observer/dashboard.js'

/**
 * @module lisp
 *
 * Folding-instruction projection view.
 */

/**
 * Displays `serialize` output for the current focus graph.
 *
 * @returns {Function}
 */
export default dashboard(
  { className: 'lisp',
    title: 'S-expressions',
    description: ['Folding projection of the current graph.',
                  'Observation performs one tick.'].join(' '),
    scene: ({ compiler, graph }) =>
      graph ? serialize(compiler, graph) : '' })
