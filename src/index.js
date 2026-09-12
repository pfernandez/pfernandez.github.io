import './style.css'
import { elements, render } from '@pfern/elements'
import source from './experiments/link/dashboard.lisp?raw'
import { link } from './experiments/link/link.js'
import { decompose } from './graph/decompose.js'
import { parse } from './graph/parse.js'

const isElement = array =>
  typeof array[0] === 'string'
    && typeof array[1] === 'object'
    && array[1] !== null
    && !Array.isArray(array[1])

const isEntry = value =>
  Array.isArray(value)
    && value.length === 2
    && typeof value[0] === 'string'
    && !isElement(value)

const adapt = fn => value => {
  const args = Array.isArray(value) && !isElement(value)
    ? value
    : [value]
  const [first, ...rest] = args

  return isEntry(first)
    ? fn(Object.fromEntries([first]), ...rest)
    : fn(first, ...rest)
}

const imports = {
  alert: window.alert.bind(window),
  render,
  onclick: 'onclick',
  ...Object.fromEntries(
    Object.entries(elements).map(([name, fn]) =>
      [name, adapt(fn)]))
}

const project = ({ graph, legend }) => {
  const enter = node => visit(node[0] === node ? node[1] : node)

  const visit = node => {
    const known = legend.get(node)
    if (known) return known.capability ?? known.name

    // An anonymous left-self pair holds its right side until it is called.
    if (node[0] === node) return () => enter(node[1])

    const pair = node.map(visit)
    return typeof pair[0] === 'function' ? pair[0](pair[1]) : pair
  }

  return visit(graph)
}

project(link(decompose(parse(source)), imports))
