import './style.css'
import { elements, observe as component, render } from '@pfern/elements'
import { program } from './device/files.js'
import {
  capabilities,
  project as projectFull
} from './device/index.js'
import source from './experiments/link/dashboard.lisp?raw'
import { link as linkExperiment } from './experiments/link/link.js'
import {
  decompose,
  link as linkFull,
  parse
} from './graph/index.js'

const isArray = Array.isArray
const isPair = x => isArray(x) && x.length === 2

const dom = el => {
  const { entries, fromEntries } = Object

  const isNamed = x => isPair(x) && typeof x[0] === 'string'
  const isObject = x => typeof x === 'object' && x !== null && !isArray(x)
  const isVdom = x => isArray(x) && isObject(x[1])
  const isProperty = x => isNamed(x) && !isVdom(x)

  const args = x =>
    isPair(x) && !isVdom(x) && !isProperty(x) ? [x[0], ...args(x[1])] : [x]

  const adapt = fn => x => {
    const [first, ...rest] = args(x)
    return fn(isProperty(first) ? fromEntries([first]) : first, ...rest)
  }

  return fromEntries(entries(el).map(([name, fn]) => [name, adapt(fn)]))
}

const projectExperiment = ({ graph, legend }) => {
  const isFunction = x => typeof x === 'function'
  const isContinuation = x => isPair(x) && x[0] === x

  const lookup = (node, legend) => {
    const entry = legend.get(node)
    return entry && Object.hasOwn(entry, 'value')
      ? entry.value
      : entry?.name
  }

  const next = node => isContinuation(node) ? node[1] : node

  const suspend = (node, visit) =>
    argument => {
      const result = visit(next(node))
      return isFunction(result) ? result(argument) : result
    }

  const visit = node => {
    const known = lookup(node, legend)
    if (known !== undefined) return known

    if (isContinuation(node)) return suspend(node[1], visit)

    const pair = node.map(visit)
    return isFunction(pair[0]) ? pair[0](pair[1]) : pair
  }

  return visit(graph)
}

const imports = { component, render, onclick: 'onclick', ...dom(elements) }

const experiment = () => projectExperiment(
  linkExperiment(decompose(parse(source)), imports)
)

const full = () => {
  const graph = linkFull(program(), capabilities())

  if (graph.error) throw graph.error
  projectFull(graph)
}

let run = experiment
run = full // Comment out this line to run the experiment.
run()
