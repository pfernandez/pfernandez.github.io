import { parse } from '../../graph/index.js'
import { bind } from './bind.js'

const isBinding = form => typeof form?.[0] === 'string'

/** Apply one authored binding to an existing state. */
export const submit = (state, source) => bind(state, parse(source))

/** Apply an outer sequence of bindings in source order. */
export const load = (source, state) => {
  const program = parse(source)
  const forms = isBinding(program) ? [program] : program
  return forms.reduce(bind, state)
}

export const undo = state => state?.previous
