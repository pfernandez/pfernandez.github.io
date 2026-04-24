/**
 * @module graph
 *
 * Parsing, folding-template encoding, graph materialization, and serialization
 * for pair-encoded S-expressions.
 *
 * Surface S-expressions are read literally, then `encode` left-associates
 * application and rewrites definitions to one Lisp-facing folding projection.
 * `construct` is the public helper that turns dense numeric folding terms into
 * shared in-memory pair graphs.
 *
 * Supported:
 * - Lists and applications: `(f x y)` -> `['f', 'x', 'y']`
 * - Source programs with `(def ...)` / `(defn ...)` forms and one final
 *   expression
 * - Numbers: `42` -> `42`
 * - Symbols: everything else as strings
 * - Line comments starting with `;`
 * - Compiler encoding for definitions
 * - Folding instructions such as `(((((0 2) (1 2)) a) b) c)`
 *
 * Intentionally not supported: strings, quoting, dotted pairs, reader macros.
 */
export { compile, encode } from './compiler.js'
export { construct } from './construct.js'
export { parse } from './parse.js'
export { serialize } from './serialize.js'
