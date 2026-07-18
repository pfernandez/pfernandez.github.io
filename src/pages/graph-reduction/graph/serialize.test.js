import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  schemes,
  serialize,
  serializeWasm
} from './index.js'
import { imageLegend } from './serialize.js'
import { image } from '../wasm/image.js'

const view = bytes =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
const stripAnsi = value => value.replace(/\x1b\[[0-9;]*m/g, '')

const imageView = ({ graph, legend }) => {
  const graphImage = image(graph)
  return {
    view: view(graphImage.bytes),
    focus: graphImage.focus,
    legend: imageLegend(graphImage, legend)
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
    const vdom = serialize(root, { format: 'vdom', scheme: schemes.plain })

    assert.equal(vdom[0], 'pre')
    assert.deepEqual(vdom[1], { class: 'output' })
    assert.equal(vdom.flat(Infinity).filter(x => x === '()').length, 2)
  })

  test('wasm serializes identically to graphs', () => {
    const definitions = [
      '(I (x x))',
      '(K ((x x) y))',
      '(S (((((x z) (y z)) x) y) z))'
    ].join('\n')
    const forms = ['(I a)', '(K a b)', '(K a b c)', '(S K K a)', '(f a a)']

    for (const form of forms) {
      const compiled = compile(`${definitions}\n${form}`)
      const graphImage = imageView(compiled)

      assert.equal(
        serializeWasm(graphImage.view, graphImage.focus, {
          legend: graphImage.legend
        }),
        serialize(compiled.graph, { legend: compiled.legend }))
    }
  })

  test('wasm uses the same presentation schemes', () => {
    const graphImage = imageView(compile('(K ((x x) y))\n(K a b c)'))
    const text = serializeWasm(graphImage.view, graphImage.focus, {
      legend: graphImage.legend,
      format: 'ansi',
      scheme: schemes.plain
    })

    assert.equal(
      stripAnsi(serializeWasm(graphImage.view, graphImage.focus, {
        legend: graphImage.legend,
        format: 'ansi',
        scheme: schemes.ink
      })),
      text)
  })
})
