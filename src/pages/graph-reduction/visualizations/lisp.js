import { serialize } from '../sexpr.js'
import { dashboard } from './dashboard.js'

export default dashboard(
  { title: 'S-expressions',
    hint: 'The same reducer as the tree view. Reduce performs one resolve+collapse tick.',
    kind: 'lisp',
    scene: pair => serialize(pair) })
