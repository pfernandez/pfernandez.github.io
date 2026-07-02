import { log, parse } from './parse.js'

export const compile = source => {
  const legend = [], defs = [], locals = []

  const link = (parent, root = parent) => {
    let left, right, signature

    const bind = (entry, form) => {
      entry[0] = form
      entry.slot[0][entry.slot[1]] = form
      return entry
    }

    parent.forEach((node, i) => {
      const [def] = defs.find(([_, symbol]) => node === symbol) ?? []
      const [arg] = locals.find(([_, symbol]) => node === symbol) ?? []

      if (Array.isArray(node)) {
        const child = link(node)
        if (i === 0) left = child
        else right = child
      } else if (def) {  // definition already cached
        parent[i] = def
      } else if (arg) {  // argument already cached
        parent[i] = arg
      } else if (i === 0 && parent.every(s => !Array.isArray(s))) {  // innermost signature
        const entry = [root, node]
        Object.defineProperty(entry, 'slot', { value: [parent, i] })
        defs.push(entry)
        legend.push(entry)
        signature = entry
        locals.length = 0
      } else {  // new argument
        const self = []
        parent[i] = self[0] = self[1] = self
        locals.push([self, node])
        legend.push([self, node])
      }
    })

    return left && !right ? bind(left, parent) : signature
  }

  try {
    const ast = parse(source)[0]
    link(ast)
    log({ graph: ast, legend })
    return { graph: ast, legend }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
