import { serialize } from '../sexpr.js'
import dashboard from './dashboard.js'

export default dashboard(
  { className: 'lisp',
    title: 'S-expressions',
    description: ['Folding projection of the current graph.',
                  'Observation performs one tick.'].join(' '),
    scene: pair => serialize(pair) })
