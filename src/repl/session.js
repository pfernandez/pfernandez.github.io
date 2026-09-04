import { link, parse } from '../graph/index.js'

/** Append one authored form and link the resulting program. */
export const submit = (session = { entries: [] }, source, imports = {}) => {
  const entries = [
    ...session.entries,
    [source, parse(source)]
  ]
  const linked = link({
    source: entries.map(([text]) => text).join('\n'),
    ast: entries.map(([, form]) => form)
  }, imports)

  if (linked.error) throw linked.error
  return { entries, ...linked }
}
