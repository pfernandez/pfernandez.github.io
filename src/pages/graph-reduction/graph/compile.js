import { construct } from './construct.js'
import { encode } from './encode.js'
import { parse } from './parse.js'

/**
 * Compiles source text by running the public graph pipeline.
 *
 * @param {string} source
 * @returns {*|{error: string}}
 */
export const compile = source => {
  try {
    return construct(encode(parse(source)))
  }
  catch (error) {
    console.error(error)
    return { error: String(error) }
  }
}
