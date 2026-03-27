import { dashboard } from '../dashboard.js'
import { scene } from './scene.js'

export default dashboard(
  { title: 'Tree',
    hint: 'Binary pairs only: `()` or `(a b)`. Reduce performs one collapse event.',
    kind: 'tree',
    scene })
