import { elements } from '@pfern/elements'
import { addressLegend, link } from './graph/index.js'
import { image } from './wasm/image.js'
import { emit, readLegend } from './wasm/module.js'

const capabilities = {
  ...elements,
  // The surrounding Elements component performs the actual DOM update. At the
  // device boundary `render` exposes the graph-produced vnode to that host.
  render: value => value,
  text: (...words) => words.join(' ')
}

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
  const { focus, memory, step } = instance.exports
  const graph = new DataView(memory.buffer)
  const legend = readLegend(bytes)
  const left = address => graph.getUint32(address, true)
  const imported = address => capabilities[legend.get(left(address))]

  const evaluate = address => {
    const operation = left(address)
    const argument = step(address)

    if (operation === address && argument === address)
      return legend.get(address)

    const name = legend.get(operation)
    const capability = imported(address)
    if (!capability) throw new Error(`Unknown device identity: ${name}`)

    return capability(...args(argument))
  }

  const args = address => {
    const operation = left(address)
    const argument = step(address)

    return operation === address && argument === address || imported(address)
      ? [evaluate(address)]
      : [evaluate(operation), ...args(argument)]
  }

  return evaluate(focus.value)
}
