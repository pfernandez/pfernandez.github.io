import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  addressLegend,
  link,
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
const I = '(I x x)'
const K = '(K x y x)'
const S = '(S x y z ((x z) (y z)))'
const withCore = expression =>
  `(${[I, K, S].join('\n')} ${expression})`

const linkedAtom = () => link(`((${I}) (I a))`)

const imageView = ({ graph, legend }) => {
  const graphImage = image(graph)
  const graphView = view(graphImage.bytes)
  return {
    view: graphView,
    focus: graphImage.focus,
    legend: addressLegend(graphImage, legend)
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

  test('expand shows named definition structure once', () => {
    const linked = link(withCore('(S a b c)'))
    const { legend } = linked
    const expanded = [
      '(((((I x) x)',
      '    (((K x) y) x))',
      '   ((((S x) y) z) ((x z) (y z))))',
      '  ((((S a) b) c) ((a c) (b c))))'
    ].join('\n')
    const presented = expanded

    assert.equal(serialize(linked.graph, {
      legend,
      expand: false
    }), [
      '(((I K) S) ((((S a) b) c) ((a c) (b c))))'
    ].join(''))
    assert.equal(
      serialize(linked.graph, { legend }),
      expanded)
    assert.equal(
      stripAnsi(serialize(linked.graph, {
        legend,
        format: 'ansi',
        scheme: schemes.plain
      })),
      presented)
    assert.match(serialize(linked.graph, {
      legend,
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
      wasmTrace = traceWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend,
        label: 'wasm',
        scheme: schemes.plain
      })
    } finally {
      console.log = write
    }

    assert.equal(stripAnsi(output[0]), 'result (a b)\n')
    assert.equal(stripAnsi(firstTrace), 'result (a b)\n')
    assert.equal(output[1], '(a b)\n')
    assert.equal(output[2], '0 count (a b)\n')
    assert.equal(output[3], '1 count (c d)\n')
    assert.equal(
      output[4],
      `wasm ${serializeWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend,
        format: 'ansi',
        scheme: schemes.plain
      })}\n`)
    assert.equal(wasmTrace, output[4])
  })

  test('wasm serializes identically to graphs', () => {
    const linked = linkedAtom()
    const graphImage = imageView(linked)
    const text = serialize(linked.graph, {
      legend: linked.legend,
      expand: false
    })

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
        legend: linked.legend,
        expand: false,
        format: 'ansi',
        scheme: schemes.plain
      }))
  })
})
