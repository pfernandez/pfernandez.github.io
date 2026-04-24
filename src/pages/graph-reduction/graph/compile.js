import { construct } from './construct.js'
import { encode } from './encode.js'
import { parse } from './parse.js'

/**
 * Compiles source text by running the public graph pipeline.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const compile = source => {
  const ast = parse(source)
  if (ast instanceof Error) return ast

  try {
    return construct(encode(ast))
  }
  catch (error) {
    console.error(error)
    return error
  }
}
