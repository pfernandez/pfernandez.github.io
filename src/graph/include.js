import { parse } from './parse.js'

const directive = form => Array.isArray(form) && form[0] === 'include'

// An include names source, not a graph identity. Replace it with the named
// file's outer forms before decomposition so lexical order remains ordinary.
export const include = (entry, files = {}) => {
  const included = []

  const expand = (source, ancestry = []) => {
    const ast = parse(source)
    if (!Array.isArray(ast))
      throw new Error('Included source must contain an outer sequence')

    return ast.flatMap(form => {
      if (!directive(form)) return [form]
      if (form.length !== 2)
        throw new Error('Expected (include file)')

      const name = form[1]
      if (!Object.hasOwn(files, name))
        throw new Error(`Missing include: ${name}`)
      if (ancestry.includes(name))
        throw new Error(
          `Circular include: ${[...ancestry, name].join(' -> ')}`)

      const forms = expand(files[name], [...ancestry, name])
      included.push(files[name])
      return forms
    })
  }

  const ast = expand(entry)

  return {
    source: [...included, entry].join('\n'),
    entry,
    files: { ...files },
    ast
  }
}
