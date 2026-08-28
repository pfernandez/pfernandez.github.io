import { component, elements } from '@pfern/elements'
import { content, getActiveRoute } from '../../utils/site-content.js'
import { serialize } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]

const text = ({ values }) => values().flat(Infinity).join(' ')
text.literal = true

const adaptElements = ({ component, ...elements }) => {
  const fixed = pair => left(pair) === pair && right(pair) === pair
  const entry = (pair, legend) => legend.has(pair) && !fixed(pair)
  // A direct event continues right; a fixed event exposes its left action.
  const target = pair => right(pair) === pair ? left(pair) : right(pair)
  const value = (node, evaluate, legend) => {
    const name = legend.get(node)?.name
    return entry(node, legend)
    && name.startsWith('on')
      ? [name, () => evaluate(target(node))]
      : evaluate(node)
  }
  const props = Object.defineProperty(
    ({ args, evaluate, legend }) => Object.fromEntries(
      args().map(node => value(node, evaluate, legend))),
    'name',
    { value: 'props' }
  )
  const capability = (name, element) => Object.defineProperty(
    ({ args, evaluate, legend }) => element(
      ...args().map(node => value(node, evaluate, legend))),
    'name',
    { value: name }
  )
  const navigation = ({ values }) => {
    const activeRoute = getActiveRoute(values()[0])

    return elements.nav(...content.map(group =>
      elements.section(
        elements.h2(group.summary),
        elements.ul(...group.items.map(item => {
          const active = item.publicPath === activeRoute
          const props = {
            href: item.publicPath,
            class: active ? 'active' : ''
          }
          if (active) props['aria-current'] = 'page'
          return elements.li(elements.a(props, item.label))
        })))))
  }

  return {
    navigation,
    props,
    ...Object.fromEntries(
      Object.entries(elements).map(([name, element]) =>
        [name, capability(name, element)])),
    component: ({ argument, evaluate }) => {
      const observation = evaluate(argument)
      return component(() => observation)()
    }
  }
}

// Capabilities receive the raw argument graph as well as explicit evaluators.
// Most consume `values`; serialize and component deliberately retain
// identities.
export const functions = {
  ...adaptElements({ ...elements, component }),
  text,
  source: ({ source }) => source,
  serialize: ({ argument, evaluate, legend }) =>
    serialize(left(argument), {
      format: 'vdom',
      labels: true,
      legend,
      scheme: evaluate(right(argument))
    })
}
