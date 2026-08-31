import { serialize as print } from '../graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]

export const graph = {
  source: ({ source }) => source,
  serialize: ({ argument, evaluate, legend }) =>
    print(left(argument), {
      format: 'vdom',
      labels: true,
      legend,
      scheme: evaluate(right(argument))
    })
}
