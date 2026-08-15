import { component, elements } from '@pfern/elements'
import { addressLegend, link } from './graph/index.js'
import { image } from './wasm/image.js'
import { relay } from './wasm/relay.js'

const capabilities = Object.fromEntries(
  Object.entries(elements).map(([name, element]) =>
    [name, ({ argument, left, properties, right, values }) => {
      const first = left(argument)
      const props = properties(first)

      return props
        ? element(props, ...values(right(argument)))
        : element(...values(argument))
    }]))

// The surrounding Elements component performs the actual DOM update. At the
// device boundary `render` exposes the graph-produced vnode to that host.
capabilities.render = ({ values }) => values()[0]
capabilities.text = ({ values }) => values().join(' ')
capabilities.alert = ({ values }) => globalThis.alert(values()[0])
capabilities.component = ({ argument, evaluate, left, observe, right }) => {
  const initial = right(argument)
  let app
  app = component((state = initial) => evaluate(left(state), app))
  observe(initial, app)
  return app
}

export const view = source => {
  const linked = link(source, Object.keys(capabilities))
  if (linked.error) throw linked.error

  const graphImage = image(linked.graph, linked.focus)
  const graph = new DataView(graphImage.bytes.buffer)
  const legend = addressLegend(graphImage)
  const left = address => graph.getUint32(address, true)
  const right = address => graph.getUint32(address + 4, true)
  const fixed = address =>
    left(address) === address && right(address) === address
  const imported = address => capabilities[legend.get(left(address))]

  const evaluate = (address, transition) => {
    const operation = left(address)
    const argument = right(address)

    if (operation === address && argument === address)
      return legend.get(address)

    const name = legend.get(operation)
    const capability = imported(address)
    if (!capability) throw new Error(`Unknown device identity: ${name}`)

    return capability({
      argument,
      evaluate: (node, next = transition) => evaluate(node, next),
      left,
      observe: (focus, transition) =>
        relay({ bytes: graphImage.bytes, focus }, transition),
      properties: properties(transition),
      right,
      transition,
      values: (node = argument) => args(node, transition)
    })
  }

  // An Elements call may carry a property tree as its first argument. Leaves
  // are `(name value)` entries; internal pairs collect entries without nil.
  const properties = transition => address => {
    if (fixed(address) || imported(address)) return

    const entries = address => fixed(left(address))
      ? [[legend.get(left(address)),
          property(legend.get(left(address)), right(address))]]
      : [...entries(left(address)), ...entries(right(address))]
    const property = (name, address) => {
      return name?.startsWith('on')
        ? () => transition(address)
        : evaluate(address, transition)
    }

    return Object.fromEntries(entries(address))
  }

  const args = (address, transition) => {
    const operation = left(address)
    const argument = right(address)

    return operation === address && argument === address || imported(address)
      ? [evaluate(address, transition)]
      : [evaluate(operation, transition), ...args(argument, transition)]
  }

  return evaluate(graphImage.focus)
}
