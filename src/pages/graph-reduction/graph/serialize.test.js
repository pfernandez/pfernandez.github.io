import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  imageLegend,
  link,
  partsToConsole,
  partsToText,
  serialize,
  serializeAnsi,
  serializeConsole,
  serializeImage,
  serializeImageAnsi,
  serializeImageParts,
  serializeParts,
  step
} from './index.js'
import { image } from '../wasm/image.js'

const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

const imageView = graph => {
  const graphImage = image(graph)
  return {
    view: view(graphImage.bytes),
    focus: graphImage.focus,
    legend: imageLegend(graphImage)
  }
}

describe('serialize', () => {
  test('names repeated paths and cycles', () => {
    const root = []
    const shared = ['a', 'b']

    root[0] = root
    root[1] = [shared, shared]

    assert.equal(serialize(root), '($ ((a b) $.1.0))')
  })

  test('parts mark repeated cells with identity', () => {
    const root = []
    const shared = ['a', 'b']

    root[0] = root
    root[1] = [shared, shared]

    const parts = serializeParts(root)
    const stripAnsi = value => value.replace(/\x1b\[[0-9;]*m/g, '')

    assert.equal(partsToText(parts), '(() ((a b) ()))')
    assert.match(serializeAnsi(root), /\x1b\[38;5;/)
    assert.equal(stripAnsi(serializeAnsi(root, 'ink')), '(() ((a b) ()))')
    assert.match(serializeAnsi(root, 'pastel'), /\x1b\[38;2;255;95;175m/)
    assert.equal(serializeAnsi(root, 'plain'), '(() ((a b) ()))')
    assert.match(partsToConsole(parts, 'color')[0], /%c/)
    assert.match(serializeConsole(root, 'ink')[0], /%c/)
  })

  test('legend names linked graph identities', () => {
    const { graph, legend, error } = link(`
      ((I x x)
       (K x y x)
       (S x y z ((x z) (y z)))
       (S a b c))
    `)
    if (error) throw error

    assert.equal(
      serialize(step(step(graph)), { legend }),
      '((a c) (b c))')
    assert.equal(
      partsToText(serializeParts(step(step(graph)), { legend })),
      '((a c) (b c))')
    assert.match(serialize(graph, { legend }), /S/)
    assert.equal(
      serializeAnsi(step(step(graph)), { legend, scheme: 'plain' }),
      '((a c) (b c))')
  })

  test('images serialize identically to graphs', () => {
    const definitions = '(I (x x))\n(K ((x x) y))\n(S (((((x z) (y z)) x) y) z))'
    const forms = ['(I a)', '(K a b)', '(K a b c)', '(S K K a)', '(f a a)']

    for (const form of forms) {
      const graph = compile(`${definitions}\n${form}`)
      const graphImage = imageView(graph)

      assert.equal(
        serializeImage(graphImage.view, graphImage.focus, graphImage.legend),
        serialize(graph))
    }
  })

  test('image parts use the same presentation schemes', () => {
    const graph = compile('(K ((x x) y))\n(K a b c)')
    const graphImage = imageView(graph)
    const parts = serializeImageParts(
      graphImage.view,
      graphImage.focus,
      graphImage.legend)
    const stripAnsi = value => value.replace(/\x1b\[[0-9;]*m/g, '')

    assert.equal(partsToText(parts), partsToText(serializeParts(graph)))
    assert.equal(
      stripAnsi(serializeImageAnsi(
        graphImage.view,
        graphImage.focus,
        graphImage.legend,
        'ink')),
      partsToText(parts))
  })
})
