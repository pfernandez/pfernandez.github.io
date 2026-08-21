import { component, elements } from '@pfern/elements'
import { link, serialize } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]
const fixed = pair => left(pair) === pair && right(pair) === pair

const capabilities = Object.fromEntries(
  Object.entries(elements).map(([name, element]) =>
    [name, ({ argument, properties, values }) => {
      const first = left(argument)
      const firstProps = properties(first)
      const onlyProps = firstProps ? undefined : properties(argument)

      return firstProps
        ? element(firstProps, ...values(right(argument)))
        : onlyProps
          ? element(onlyProps)
          : element(...values(argument))
    }]))

capabilities.text = ({ values }) => values().join(' ')
capabilities.source = ({ source }) => source
capabilities.serialize = ({ argument, evaluate }) =>
  serialize(left(argument), {
    format: 'vdom',
    scheme: evaluate(right(argument))
  })
capabilities.component = ({ argument, evaluate }) => {
  let app

  app = component(
    (application = argument) => evaluate(right(application), app))
  return app
}

export const view = source => {
  const linked = link(source, Object.keys(capabilities))
  if (linked.error) throw linked.error

  const imported = pair => capabilities[left(pair)?.symbol]

  const evaluate = (pair, transition) => {
    if (fixed(pair)) return pair.symbol

    const capability = imported(pair)
    if (!capability)
      throw new Error(`Unknown device identity: ${left(pair)?.symbol}`)

    const argument = right(pair)
    return capability({
      argument,
      evaluate: (node, next = transition) => evaluate(node, next),
      properties: properties(transition),
      source,
      values: (node = argument) => args(node, transition)
    })
  }

  // An Elements call may carry a property tree as its first argument. Leaves
  // are `(name value)` entries; internal pairs collect entries without nil.
  const properties = transition => pair => {
    if (fixed(pair) || imported(pair)) return

    const entries = pair => {
      if (fixed(pair) || imported(pair)) return
      if (fixed(left(pair))) {
        const name = left(pair).symbol
        return [[name, property(name, right(pair))]]
      }

      const before = entries(left(pair))
      const after = entries(right(pair))
      return before && after && [...before, ...after]
    }
    const property = (name, pair) => name?.startsWith('on')
      ? imported(pair)
        ? evaluate(pair, transition)
        : () => transition(pair)
      : evaluate(pair, transition)

    const found = entries(pair)
    return found && Object.fromEntries(found)
  }

  const args = (pair, transition) =>
    fixed(pair) || imported(pair)
      ? [evaluate(pair, transition)]
      : [evaluate(left(pair), transition),
         ...args(right(pair), transition)]

  return evaluate(linked.focus)
}
