import { parse } from './parse.js'

const isSymbol = form =>
  typeof form === 'string'

const createAtom = (name, legend) => {
  const cell = []
  cell[0] = cell
  cell[1] = cell
  legend.push([cell, name])
  return cell
}

const applyArgs = (head, args) =>
  args.reduce((node, arg) => [node, arg], head)

const binding = (names, nodes, name) => {
  const index = names.indexOf(name)
  return index === -1 ? undefined : nodes[index]
}

const bind = (names, nodes, name, node) => {
  names.push(name)
  nodes.push(node)
  return node
}

const atom = (names, nodes, legend, name) =>
  binding(names, nodes, name)
    ?? bind(names, nodes, name, createAtom(name, legend))

const wire = (form, names, nodes, legend) => {
  if (isSymbol(form))
    return atom(names, nodes, legend, form)

  if (!Array.isArray(form) || !form.length)
    return atom(names, nodes, legend, '()')

  return applyArgs(
    wire(form[0], names, nodes, legend),
    form.slice(1).map(item => wire(item, names, nodes, legend)))
}

export const compile = source => {
  let graph = [], legend = [], error
  try {
    const [[[name, ...args], body], focus] = parse(source)[0]
    const result = []
    const names = [name]
    const nodes = [result]
    const wiredArgs = focus.slice(1).map(arg => wire(arg, names, nodes, legend))

    args.forEach((arg, i) => bind(names, nodes, arg, wiredArgs[i]))

    result[0] = result
    result[1] = wire(body, names, nodes, legend)
    graph = applyArgs(result, wiredArgs)
  } catch (e) {
    graph = []
    legend = []
    error = e
  }

  return { graph, legend, error }
}
