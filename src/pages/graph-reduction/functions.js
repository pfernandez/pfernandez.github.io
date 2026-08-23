import { component, elements } from '@pfern/elements'
import { serialize } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]
const fixed = pair => left(pair) === pair && right(pair) === pair
const entry = pair => 'symbol' in pair && !fixed(pair)

const capability = (name, element) => Object.defineProperty(
  ({ argument, evaluate, values }) => element(
    ...entry(argument) ? [evaluate(argument)] : values()),
  'name',
  { value: name }
)

// Capabilities receive the raw argument graph as well as explicit evaluators.
// Most consume `values`; serialize and component deliberately retain identities.
export const functions = {
  ...Object.fromEntries(
    Object.entries(elements).map(([name, element]) =>
      [name, capability(name, element)])),
  text: ({ values }) => values().flat(Infinity).join(' '),
  source: ({ source }) => source,
  serialize: ({ argument, evaluate }) =>
    serialize(left(argument), {
      format: 'vdom',
      labels: true,
      scheme: evaluate(right(argument))
    }),
  component: ({ argument, evaluate }) =>
    component(() => evaluate(argument))
}
