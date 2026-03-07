/**
 * Shared type definitions for the collapse AST.
 *
 * Kept in a `.d.ts` file so TypeScript can model the recursive structure
 * without tripping over JSDoc recursion edge-cases in `checkJs` mode.
 */

export type AtomAst = string | number | PairAst

export type PairAst = [] | [AtomAst, AtomAst]
