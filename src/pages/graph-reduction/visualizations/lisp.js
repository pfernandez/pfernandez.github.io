import { span } from '@pfern/elements'
import { dashboard } from './dashboard.js'

const renderPair = (pair, event = null, path = 'root') => {
  const content = Array.isArray(pair)
    ? pair.length === 0
      ? '()'
      : span('(',
             renderPair(pair[0], event, `${path}0`),
             ' ',
             renderPair(pair[1], event, `${path}1`),
             ')')
    : String(pair)

  if (!event || event.path !== path) return content

  return span({ class: 'focus focus-collapse' }, content)
}

export default dashboard(
  { title: 'S-expressions',
    hint: 'The same reducer as the tree view. Reduce performs one collapse event.',
    kind: 'lisp',
    scene: (pair, event) => pair === null ? null : renderPair(pair, event) })
