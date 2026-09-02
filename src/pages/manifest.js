import { record } from '../device/record.js'
import { parse } from '../graph/index.js'

const text = node => node.slice(1).flat(Infinity).join(' ')

const value = node => {
  if (!Array.isArray(node)) {
    if (node === 'true') return true
    if (node === 'false') return false
    return node
  }

  if (node[0] === 'text') return text(node)

  const entries = node.every(entry =>
    Array.isArray(entry)
    && entry.length === 2
    && typeof entry[0] === 'string')

  return entries
    ? record(node, ([name, content]) => [name, value(content)])
    : node.map(value)
}

/** Read the `site` definition from an authored page library. */
export const manifest = source => {
  const ast = parse(source)
  const site = ast.find(form => Array.isArray(form) && form[0] === 'site')

  if (!site || site.length !== 3)
    throw new Error('Missing site manifest')

  return value(site[2])
}
