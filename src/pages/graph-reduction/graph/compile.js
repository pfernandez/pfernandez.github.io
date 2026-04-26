import { construct } from './construct.js'
import { encode, materializeProgram } from './encode.js'
import { parse } from './parse.js'

/**
 * Compiles source text by running the public graph pipeline.
 *
 * Single source expressions still travel through the ordinary encoded-term
 * construction path. Multi-form programs materialize directly so shared
 * continuations, crossings, and live recursive structure keep graph identity.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const compile = source => {
  try {
    const ast = parse(source)
    return ast.length === 1 ? construct(encode(ast)) : materializeProgram(ast)
  }
  catch (error) {
    console.error(error)
    return { error: String(error) }
  }
}
