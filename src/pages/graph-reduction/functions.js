import { component, elements } from '@pfern/elements'
import { serialize } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]
const entry = pair =>
  !('symbol' in pair) && typeof left(pair)?.symbol === 'string'

// Capabilities receive the raw argument graph as well as explicit evaluators.
// Most consume `values`; serialize and component deliberately retain identities.
export const functions = {
  ...Object.fromEntries(
    Object.entries(elements).map(([name, element]) =>
      [name, ({ argument, evaluate, values }) => element(
        ...(entry(argument) ? [evaluate(argument)] : values()))])),
  text: ({ values }) => values().join(' '),
  source: ({ source }) => source,
  serialize: ({ argument, evaluate }) =>
    serialize(left(argument), {
      format: 'vdom',
      scheme: evaluate(right(argument))
    }),
  component: ({ argument, evaluate }) =>
    component(() => evaluate(right(argument)))
}
