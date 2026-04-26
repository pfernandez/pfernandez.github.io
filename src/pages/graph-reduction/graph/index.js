/**
 * @module graph
 *
 * Pure graph helpers for pair-encoded S-expressions.
 *
 * The public compiler pipeline is:
 * `compile(source)` is `construct(expand(parse(source)))`.
 *
 * Supported:
 * - Lists and applications: `(f x y)`
 * - Source programs with `(def ...)` / `(defn ...)` forms and one final
 *   expression
 * - Numbers: `42` -> `42`
 * - Symbols: everything else as strings
 * - Line comments starting with `;`
 * - Numeric templates such as `(((((0 2) (1 2)) a) b) c)`
 *
 * Intentionally not supported: strings, quoting, dotted pairs, reader macros.
 */
export { compile } from './compile.js'
export { encode, expand } from './encode.js'
export { construct } from './construct.js'
export { parse } from './parse.js'
export { serialize } from './serialize.js'
