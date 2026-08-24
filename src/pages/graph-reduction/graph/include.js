import { parse } from './parse.js'

// File boundaries do not create graph boundaries. Each file contains an outer
// sequence; including it places that sequence's forms into one ordered scope.
export const include = (...sources) => ({
  source: sources.join('\n'),
  ast: sources.flatMap(source => parse(source))
})
