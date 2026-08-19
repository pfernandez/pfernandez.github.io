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

  // A value-bearing event selects one branch from an authored table of
  // `(identity transition)` entries. The table contains the possible
  // applications; the device only relates an external spelling to one of its
  // existing identities.
  const select = (address, value) => {
    const key = left(address)

    if (fixed(key))
      return legend.get(key) === value ? right(address) : undefined

    return select(key, value) ?? select(right(address), value)
  }

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

    const entries = address => fixed(left(address))
      ? [[legend.get(left(address)),
          property(legend.get(left(address)), right(address))]]
      : [...entries(left(address)), ...entries(right(address))]
    const property = (name, address) => {
      return name?.startsWith('on')
        ? value => {
          const selected = typeof value === 'string'
            ? select(address, value)
            : address

          if (selected === undefined)
            throw new Error(`Unknown authored input identity: ${value}`)

          return transition(selected)
        }
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
