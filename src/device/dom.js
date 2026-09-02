import { component, elements, render } from '@pfern/elements'
import { markdown } from './markdown.js'
import { record } from './record.js'

const left = pair => pair[0]
const right = pair => pair[1]

const domCapabilities = ({ component, ...elements }) => {
  const fixed = pair => left(pair) === pair && right(pair) === pair
  const entry = (pair, legend) => legend.has(pair) && !fixed(pair)
  // Repeated property labels form a chain. Follow it to the authored action;
  // a fixed event exposes its left branch and any other event its right.
  const target = (pair, legend) => {
    const next = right(pair) === pair ? left(pair) : right(pair)
    return next !== pair
      && legend.get(next)?.name === legend.get(pair)?.name
      ? target(next, legend)
      : next
  }
  // A device call produces its value directly. An authored application keeps
  // its arguments on the left and exposes its observable result on the right.
  const observation = (pair, legend) =>
    typeof legend.get(left(pair))?.capability === 'function'
      ? pair
      : right(pair)
  const value = (node, evaluate, legend) => {
    const name = legend.get(node)?.name
    return entry(node, legend)
      && name.startsWith('on')
      ? [name, () => evaluate(observation(target(node, legend), legend))]
      : evaluate(node)
  }
  const props = Object.defineProperty(
    // Completed applications may retain unnamed construction history between
    // entries. Only authored, named pairs are JavaScript properties.
    ({ args, evaluate, legend }) => record(
      args(),
      node => legend.has(node)
        ? value(node, evaluate, legend)
        : undefined),
    'name',
    { value: 'props' }
  )
  const capability = (name, element) => Object.defineProperty(
    ({ args, evaluate, legend }) => element(
      ...args().map(node => value(node, evaluate, legend))),
    'name',
    { value: name }
  )
  return {
    props,
    ...Object.fromEntries(
      Object.entries(elements).map(([name, element]) =>
        [name, capability(name, element)])),
    component: ({ argument, evaluate }) => {
      const observation = evaluate(argument)
      return component(() => observation)()
    }
  }
}

/** Adapt Elements functions to the uniform graph-capability interface. */
export const dom = domCapabilities({ ...elements, component, markdown, render })
