import { parse } from './parse.js'

const isSymbol = form =>
  typeof form === 'string'

const spelling = Symbol(JSON.stringify)

export const spellingOf = node =>
  Array.isArray(node) ? node[spelling] : undefined

const createAtom = name => {
  const cell = []
  cell[0] = cell
  cell[1] = cell
  cell[spelling] = name
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

const atom = (names, nodes, name) =>
  binding(names, nodes, name) ?? bind(names, nodes, name, createAtom(name))

const wire = (form, names, nodes) => {
  if (isSymbol(form))
    return atom(names, nodes, form)

  if (!Array.isArray(form) || !form.length)
    return atom(names, nodes, '()')

  return applyArgs(
    wire(form[0], names, nodes),
    form.slice(1).map(item => wire(item, names, nodes)))
}

export const compile = source => {
  const [[[name, ...args], body], focus] = parse(source)[0]
  const result = []
  const names = [name]
  const nodes = [result]
  const wiredArgs = focus.slice(1).map(arg => wire(arg, names, nodes))

  args.forEach((arg, i) => bind(names, nodes, arg, wiredArgs[i]))

  result[0] = result
  result[1] = wire(body, names, nodes)

  return applyArgs(result, wiredArgs)
}
