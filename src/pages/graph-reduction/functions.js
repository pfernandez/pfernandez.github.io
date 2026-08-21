import { component, elements } from '@pfern/elements'
import { serialize } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]

export const functions = {
  ...Object.fromEntries(
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
      }])),
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
