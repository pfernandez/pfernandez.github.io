import { log, parse } from './parse.js'

export const compile = source => {
  const legend = [], defs = [], locals = []

  const link = (parent, root = parent) => {
    parent.forEach((node, i) => {
      const [def] = defs.find(([_, symbol]) => node === symbol) ?? []
      const [arg] = locals.find(([_, symbol]) => node === symbol) ?? []

      if (Array.isArray(node)) {
        link(node, i === 0 && !Array.isArray(parent[1]) ? root : node)
      } else if (def) {  // definition already cached
        parent[i] = def
      } else if (arg) {  // argument already cached
        parent[i] = arg
      } else if (parent.every(s => !Array.isArray(s))) {  // innermost signature
        parent[i] = root
        defs.push([root, node])
        legend.push([root, node])
        locals.length = 0
      } else {  // new argument
        const self = []
        parent[i] = self[0] = self[1] = self
        locals.push([self, node])
        legend.push([self, node])
      }
    })
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
