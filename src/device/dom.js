import { component, elements, render } from '@pfern/elements'
import { markdown } from './markdown.js'
import { activeRoute, groups } from './navigation.js'

const left = pair => pair[0]
const right = pair => pair[1]

const domCapabilities = ({ component, ...elements }) => {
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
    const current = activeRoute(values()[0])

    return elements.nav(...groups.map(group =>
      elements.section(
        elements.h2(group.summary),
        elements.ul(...group.items.map(item => {
          const active = item.route === current
          const props = {
            href: item.route,
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

export const dom = domCapabilities({ ...elements, component, markdown, render })
