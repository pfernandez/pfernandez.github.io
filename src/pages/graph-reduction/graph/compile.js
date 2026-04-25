import { construct } from './construct.js'
import { encode, materializeProgram } from './encode.js'
import { parse } from './parse.js'

/**
 * Compiles source text into the graph consumed by `observe`.
 *
 * Single source expressions still travel through the public
 * `construct(encode(parse(source)))` path. Programs with definitions compile
 * directly to the materialized graph so live slots, shared continuations, and
 * recursive fixed points keep their object identities.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const compile = source => {
  const ast = parse(source)
  if (ast instanceof Error) return ast

  try {
    return ast.length === 1
      ? construct(encode(ast))
      : materializeProgram(ast)
  }
  catch (error) {
    console.error(error)
    return error
  }
}
