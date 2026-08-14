import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { image } from './image.js'
import { compile } from './compile.js'

const source = readFileSync(new URL('./runner.wat', import.meta.url), 'utf8')
const bytes = await compile(source)

const fixed = () => {
  const graph = []
  graph[0] = graph[1] = graph
  return Object.freeze(graph)
}

const cycle = () => {
  const atom = fixed()
  const first = [atom]
  const second = [atom, first]
  first[1] = second
  return Object.freeze(first)
}

const observe = (graph, count, visit) => {
  const graphImage = image(graph)
  const pages = Math.max(1, Math.ceil(graphImage.bytes.length / 65536))
  const memory = new WebAssembly.Memory({ initial: pages })
  const view = new Uint8Array(memory.buffer, 0, graphImage.bytes.length)
  view.set(graphImage.bytes)

  const stop = new Error('observation complete')
  const seen = []
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    host: {
      memory,
      dispatch: address => {
        seen.push(address)
        visit?.(address)
        if (seen.length === count) throw stop
      }
    }
  })
  const before = view.slice()

  assert.throws(
    () => instance.exports.run(graphImage.focus),
    error => error === stop)

  return { before, graphImage, instance, memory, seen, view }
}

describe('the recursive runner', () => {
  test('the checked-in binary is generated from the WAT source', () => {
    assert.equal(WebAssembly.validate(bytes), true)
    assert.deepEqual(
      bytes,
      new Uint8Array(readFileSync(new URL('./runner.wasm', import.meta.url))))
  })

  test('dispatches a fixed state repeatedly', () => {
    const { graphImage, seen } = observe(fixed(), 4)

    assert.deepEqual(seen, Array(4).fill(graphImage.focus))
  })

  test('dispatches a graph-authored cycle', () => {
    const { graphImage, seen } = observe(cycle(), 4)
    const view = new DataView(graphImage.bytes.buffer)
    const second = view.getUint32(graphImage.focus + 4, true)

    assert.deepEqual(seen, [graphImage.focus, second,
                            graphImage.focus, second])
  })

  test('uses the supplied memory without changing the graph', () => {
    const { before, instance, memory, view } = observe(cycle(), 4)

    assert.equal(instance.exports.memory, memory)
    assert.deepEqual(view, before)
  })

  test('tail-recurses without accumulating call frames', () => {
    let visits = 0
    observe(fixed(), 100_000, () => visits++)

    assert.equal(visits, 100_000)
  })
})
