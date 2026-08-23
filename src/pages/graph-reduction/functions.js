import { component, elements } from '@pfern/elements'
import { serialize } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]
const fixed = pair => left(pair) === pair && right(pair) === pair
const entry = pair => 'symbol' in pair && !fixed(pair)

const words = (node, evaluate, seen = []) => {
  if (seen.includes(node)) return []
  if (fixed(node)) return [evaluate(node)]

  seen.push(node)
  if ('symbol' in node)
    return [node.symbol, ...words(right(node), evaluate, seen)]

  return [
    ...words(left(node), evaluate, seen),
    ...words(right(node), evaluate, seen)
  ]
}

// Capabilities receive the raw argument graph as well as explicit evaluators.
// Most consume `values`; serialize and component deliberately retain identities.
export const functions = {
  ...Object.fromEntries(
    Object.entries(elements).map(([name, element]) =>
      [name, ({ argument, evaluate, values }) => element(
        ...entry(argument) ? [evaluate(argument)] : values())])),
  text: ({ argument, evaluate }) =>
    words(argument, evaluate).join(' '),
  source: ({ source }) => source,
  serialize: ({ argument, evaluate }) =>
    serialize(left(argument), {
      format: 'vdom',
      scheme: evaluate(right(argument))
    }),
  component: ({ argument, evaluate }) =>
    component(() => evaluate(argument))
}
