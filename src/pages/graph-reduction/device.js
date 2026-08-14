import { component, elements } from '@pfern/elements'
import { addressLegend, link } from './graph/index.js'
import { image } from './wasm/image.js'
import { emit, readLegend } from './wasm/module.js'

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
capabilities.alert = ({ values }) => alert(values()[0])

export const view = source => {
  const linked = link(source, Object.keys(capabilities))
  if (linked.error) throw linked.error

  const graphImage = image(linked.graph, linked.focus)
  const bytes = emit({
    ...graphImage,
    legend: addressLegend(graphImage)
  })
  const module = new WebAssembly.Module(bytes)
  const instance = new WebAssembly.Instance(module)
  const { focus, memory, step: right } = instance.exports
  const graph = new DataView(memory.buffer)
  const legend = readLegend(bytes)
  const left = address => graph.getUint32(address, true)
  const fixed = address => left(address) === address && right(address) === address
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
      evaluate: node => evaluate(node, transition),
      left,
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

  const application = component(address => evaluate(address, application))

  return application(focus.value)
}
