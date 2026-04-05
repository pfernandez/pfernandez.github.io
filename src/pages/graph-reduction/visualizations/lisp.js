import { serialize } from '../sexpr.js'
import dashboard from './dashboard.js'

export default dashboard(
  { className: 'lisp',
    title: 'S-expressions',
    description: ['The same build/observe pipeline as the tree view.',
                  'Observation performs one tick.'].join(' '),
    scene: pair => serialize(pair) })
