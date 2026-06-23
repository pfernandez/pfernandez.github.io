import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  addressLegend,
  compile,
  schemeNames,
  schemes,
  serialize,
  serializeWasm
} from './index.js'
import { image } from '../wasm/image.js'

const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
const stripAnsi = value => value.replace(/\x1b\[[0-9;]*m/g, '')

const imageView = ({ graph, legend }) => {
  const graphImage = image(graph)
  return {
    view: view(graphImage.bytes),
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

  test('wasm serializes identically to graphs', () => {
    const compiled = compile('(((I x) x) (I a))')
    const graphImage = imageView(compiled)

    assert.equal(
      serializeWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend
      }),
      serialize(compiled.graph, { legend: compiled.legend }))
  })

  test('wasm presentation uses the same formats', () => {
    const compiled = compile('(((I x) x) (I a))')
    const graphImage = imageView(compiled)

    assert.equal(
      stripAnsi(serializeWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend,
        format: 'ansi',
        scheme: schemes.ink
      })),
      serialize(compiled.graph, {
        legend: compiled.legend,
        format: 'ansi',
        scheme: schemes.plain
      }))
  })
})
