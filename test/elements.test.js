import { button, div, form, input, span } from '@pfern/elements'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

describe('Elements.js example tests', () => {
  test('div() returns a vnode with tag "div"', () => {
    const vnode = div({ id: 'test' }, 'hello')
    assert.deepEqual(vnode, ['div', { id: 'test' }, 'hello'])
  })

  test('button with onclick handler returns new vnode', () => {
    const handler = () => span('clicked')
    const b = button({ onclick: handler }, 'Click Me')
    const result = b[1].onclick(null)
    assert.deepEqual(result, ['span', {}, 'clicked'])
  })

  test('form onsubmit handler receives elements and event', () => {
    let receivedElements, receivedEvent
    const handler = (elements, event) => {
      receivedElements = elements
      receivedEvent = event
      return div('submitted')
    }

    const fakeElements = { task: { value: 'buy milk' }}
    const fakeEvent = /** @type {SubmitEvent} */ ({ type: 'submit' })
    const f = form({ onsubmit: handler }, input({ name: 'task' }))
    const result = f[1].onsubmit(fakeElements, fakeEvent)

    assert.equal(receivedElements, fakeElements)
    assert.equal(receivedEvent, fakeEvent)
    assert.deepEqual(result, ['div', {}, 'submitted'])
  })
})
