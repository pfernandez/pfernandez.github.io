import {
  component as createComponent,
  elements,
  render
} from '@pfern/elements'
import { markdown } from './markdown.js'
import { record } from './record.js'

const domCapabilities = functions => {
  const props = Object.defineProperty(
    // Completed applications may retain unnamed construction history between
    // entries. Only authored, named pairs are JavaScript properties.
    ({ args, evaluate, legend }) => record(
      args(),
      node => legend.has(node)
        ? evaluate(node)
        : undefined),
    'name',
    { value: 'props' }
  )
  const capability = (name, element) => Object.defineProperty(
    ({ args, evaluate }) => element(...args().map(evaluate)),
    'name',
    { value: name }
  )
  return {
    props,
    ...Object.fromEntries(
      Object.entries(functions).map(([name, fn]) =>
        [name, capability(name, fn)]))
  }
}

/** Adapt Elements functions to the uniform graph-capability interface. */
export const dom = domCapabilities({
  ...elements,
  component: observation =>
    createComponent(() => observation)(),
  markdown,
  render
})
