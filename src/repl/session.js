import { link, parse } from '../graph/index.js'

const compile = (entries, imports) => {
  const linked = link({
    source: entries.map(([text]) => text).join('\n'),
    ast: entries.map(([, form]) => form)
  }, imports)

  if (linked.error) throw linked.error
  return { entries, ...linked }
}

/** Append one authored form and link the resulting program. */
export const submit = (session = { entries: [] }, source, imports = {}) =>
  compile([...session.entries, [source, parse(source)]], imports)

/** Remove one authored form and relink the preceding program. */
export const undo = (session, imports = {}) => session?.entries.length > 1
  ? compile(session.entries.slice(0, -1), imports)
  : undefined
