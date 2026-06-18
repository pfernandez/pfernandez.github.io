import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  imageLegend,
  partsToConsole,
  partsToText,
  serialize,
  serializeAnsi,
  serializeConsole,
  serializeImage,
  serializeImageAnsi,
  serializeImageParts,
  serializeParts
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

  test('images serialize identically to graphs', () => {
    const graph = compile('(((I x) x) (I a))')
    const graphImage = imageView(graph)

    assert.equal(
      serializeImage(graphImage.view, graphImage.focus, graphImage.legend),
      serialize(graph))
  })

  test('image parts use the same presentation schemes', () => {
    const graph = compile('(((I x) x) (I a))')
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
