import { component, elements } from '@pfern/elements'
import { serialize } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]

const adaptElements = ({ component, ...elements }) => {
  const fixed = pair => left(pair) === pair && right(pair) === pair
  const entry = pair => 'symbol' in pair && !fixed(pair)
  const value = (node, evaluate) =>
    entry(node)
    && typeof node.symbol === 'string'
    && node.symbol.startsWith('on')
      ? [node.symbol, () => evaluate(right(node))]
      : evaluate(node)
  const capability = (name, element) => Object.defineProperty(
    ({ args, evaluate }) => element(
      ...args().map(node => value(node, evaluate))),
    'name',
    { value: name }
  )

  return {
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
  text: ({ values }) => values().flat(Infinity).join(' '),
  source: ({ source }) => source,
  serialize: ({ argument, evaluate }) =>
    serialize(left(argument), {
      format: 'vdom',
      labels: true,
      scheme: evaluate(right(argument))
    })
}
