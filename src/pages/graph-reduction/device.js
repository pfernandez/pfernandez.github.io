import { component, elements } from '@pfern/elements'
import { addressLegend, link, serializeWasm } from './graph/index.js'
import { leftAddress, rightAddress } from './wasm/address.js'
import { image } from './wasm/image.js'
import { relay } from './wasm/relay.js'

const capabilities = Object.fromEntries(
  Object.entries(elements).map(([name, element]) =>
    [name, ({ argument, left, properties, right, values }) => {
      const first = left(argument)
      const firstProps = properties(first)
      const onlyProps = firstProps ? undefined : properties(argument)

      return firstProps
        ? element(firstProps, ...values(right(argument)))
        : onlyProps
          ? element(onlyProps)
          : element(...values(argument))
    }]))

// The surrounding Elements component performs the actual DOM update. At the
// device boundary `render` exposes the graph-produced vnode to that host.
capabilities.render = ({ values }) => values()[0]
capabilities.text = ({ values }) => values().join(' ')
capabilities.alert = ({ values }) => globalThis.alert(values()[0])
capabilities.source = ({ source }) => source
capabilities.serialize = ({ argument, graph, left, legend, right }) =>
  serializeWasm(graph, left(argument), {
    format: 'vdom',
    legend,
    scheme: legend.get(right(argument))
  })
capabilities.component = ({ argument, evaluate, left, observe, right }) => {
  const initial = right(argument)
  let observer
  let app
  const advance = state => {
    observer?.terminate()
    observer = observe(state, app)
  }

  app = component((state = initial) => evaluate(left(state), advance))
  advance(initial)
  return app
}

export const view = source => {
  const linked = link(source, Object.keys(capabilities))
  if (linked.error) throw linked.error

  const graphImage = image(linked.graph, linked.focus)
  const graph = new DataView(graphImage.bytes.buffer)
  const legend = addressLegend(graphImage)
  const left = address => leftAddress(graph, address)
  const right = address => rightAddress(graph, address)
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
      graph,
      left,
      legend,
      observe: (focus, transition) =>
        relay({ bytes: graphImage.bytes, focus }, transition),
      properties: properties(transition),
      right,
      source,
      transition,
      values: (node = argument) => args(node, transition)
    })
  }

  // An Elements call may carry a property tree as its first argument. Leaves
  // are `(name value)` entries; internal pairs collect entries without nil.
  const properties = transition => address => {
    if (fixed(address) || imported(address)) return

    const entries = address => {
      if (fixed(address) || imported(address)) return
      if (fixed(left(address))) {
        const name = legend.get(left(address))
        return [[name, property(name, right(address))]]
      }

      const before = entries(left(address))
      const after = entries(right(address))
      return before && after && [...before, ...after]
    }
    const property = (name, address) => {
      return name?.startsWith('on')
        ? imported(address)
          ? evaluate(address, transition)
          : () => transition(address)
        : evaluate(address, transition)
    }

    const found = entries(address)
    return found && Object.fromEntries(found)
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
