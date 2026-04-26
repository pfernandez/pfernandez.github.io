import { construct } from './construct.js'
import { expand } from './expand.js'
import { parse } from './parse.js'

/**
 * Compiles source text by running the graph pipeline.
 *
 * Source is parsed, expanded into a constructible symbolic term, and then
 * constructed as a live graph with shared identity, crossings, and fixed
 * points preserved.
 *
 * @param {string} source
 * @returns {*|{error: string}}
 */
export const compile = source => {
  try {
    return construct(expand(parse(source)))
  }
  catch (error) {
    console.error(error)
    return { error: String(error) }
  }
}
