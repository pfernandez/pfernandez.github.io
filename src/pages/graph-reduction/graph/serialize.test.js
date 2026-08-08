import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  addressLegend,
  schemeNames,
  schemes,
  serialize,
  serializeWasm,
  trace,
  traceWasm
} from './index.js'
import { image } from '../wasm/image.js'

const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
const stripAnsi = value => value.replace(/\x1b\[[0-9;]*m/g, '')

const linkedAtom = () => {
  const atom = []
  atom[0] = atom[1] = atom
  atom.symbol = 'a'
  return { graph: [atom, atom] }
}

const imageView = ({ graph }) => {
  const graphImage = image(graph)
  const graphView = view(graphImage.bytes)
  return {
    view: graphView,
    focus: graphImage.focus,
    legend: addressLegend(graphImage)
  }
}

describe('serialize', () => {
  test('text names repeated paths and cycles', () => {
    const root = []
    const shared = ['a', 'b']

    root[0] = root
    root[1] = [shared, shared]

    assert.equal(serialize(root), '($ ((a b) $.1.0))')
  })

  test('presentation formats mark repeated identity', () => {
    const root = []
    const shared = ['a', 'b']

    root[0] = root
    root[1] = [shared, shared]

    assert.deepEqual(schemeNames, Object.values(schemes))
    assert.match(serialize(root, { format: 'ansi' }), /\x1b\[38;5;/)
    assert.equal(
      stripAnsi(serialize(root, { format: 'ansi', scheme: schemes.ink })),
      '(() ((a b) ()))')
    assert.match(
      serialize(root, { format: 'ansi', scheme: schemes.pastel }),
      /\x1b\[38;2;255;95;175m/)
    assert.equal(
      serialize(root, { format: 'ansi', scheme: schemes.plain }),
      '(() ((a b) ()))')
    assert.match(serialize(root, { format: 'console' })[0], /%c/)
  })

  test('replaces references with symbols in arbitrary sequences', () => {
    const x = []
    const y = []
    x[0] = x[1] = x
    y[0] = y[1] = y
    x.symbol = 'x'
    y.symbol = 'y'
    const graph = [x, [y, x], []]
    const expected = '(x (y x) ())'

    assert.equal(serialize(graph), expected)
    assert.equal(
      serialize(graph, { width: 10 }),
      '(x\n (y x)\n ())')
    assert.equal(stripAnsi(serialize(graph, {
      format: 'ansi',
      scheme: schemes.plain,
      width: 10
    })), '(x\n (y x)\n ())')
    assert.match(serialize(graph, {
      format: 'ansi'
    }), /\x1b\[38;5;/)
  })

  test('vdom format returns an elements-style array', () => {
    const root = []
    root[0] = root
    root[1] = 'a'

    assert.deepEqual(
      serialize(root, { format: 'vdom', scheme: schemes.plain }),
      [
        'pre',
        { class: 'output' },
        ['span', { class: 'identity', style: {} }, '('],
        ['span', { class: 'identity', style: {} }, '()'],
        ' ',
        'a',
        ['span', { class: 'identity', style: {} }, ')']
      ])
  })

  test('vdom colors are stable for the same cell across renders', () => {
    const root = []
    root[0] = root
    root[1] = 'a'

    const other = []
    other[0] = other
    other[1] = 'b'

    const first = serialize(root, { format: 'vdom', scheme: schemes.ink })
    serialize(other, { format: 'vdom', scheme: schemes.ink })
    const second = serialize(root, { format: 'vdom', scheme: schemes.ink })

    assert.deepEqual(second, first)
  })

  test('symbols use the color of their identity', () => {
    const transition = []
    const atom = []
    transition[0] = transition
    transition[1] = atom[0] = atom[1] = atom
    transition.symbol = 'T'
    atom.symbol = 'a'

    const output = serialize(transition, {
      format: 'vdom',
      scheme: schemes.color
    })

    assert.deepEqual(output[2][1].style, output[3][1].style)
  })

  test('trace writes an optional label and uses presentation defaults', () => {
    const linked = linkedAtom()
    const graphImage = imageView(linked)
    const write = console.log
    const output = []
    const countOptions = { count: true, label: 'count', scheme: schemes.plain }
    let firstTrace, wasmTrace
    console.log = (...args) => output.push(args.join(' '))

    try {
      firstTrace = trace(['a', 'b'], { label: 'result' })
      trace(['a', 'b'], { scheme: schemes.plain })
      trace(['a', 'b'], countOptions)
      trace(['c', 'd'], countOptions)
      trace(['a', 'b', 'c'], { scheme: schemes.plain, width: 5 })
      wasmTrace = traceWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend,
        label: 'wasm',
        scheme: schemes.plain
      })
      trace(['a', 'b'], { label: 'graph\n', scheme: schemes.plain })
    } finally {
      console.log = write
    }

    assert.equal(stripAnsi(output[0]), 'result (a b)\n')
    assert.equal(stripAnsi(firstTrace), 'result (a b)\n')
    assert.equal(output[1], '(a b)\n')
    assert.equal(output[2], '0 count (a b)\n')
    assert.equal(output[3], '1 count (c d)\n')
    assert.equal(output[4], '(a\n b\n c)\n')
    assert.equal(
      output[5],
      `wasm ${serializeWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend,
        format: 'ansi',
        scheme: schemes.plain
      })}\n`)
    assert.equal(wasmTrace, output[5])
    assert.equal(output[6], 'graph\n(a b)\n')
  })

  test('wasm serializes identically to graphs', () => {
    const linked = linkedAtom()
    const graphImage = imageView(linked)
    const text = serialize(linked.graph)

    assert.equal(
      serializeWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend
      }),
      text)
  })

  test('wasm presentation uses the same formats', () => {
    const linked = linkedAtom()
    const graphImage = imageView(linked)

    assert.equal(
      stripAnsi(serializeWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend,
        format: 'ansi',
        scheme: schemes.ink
      })),
      serialize(linked.graph, {
        format: 'ansi',
        scheme: schemes.plain
      }))
  })
})
