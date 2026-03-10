/**
 * Shared type definitions for collapse pairs.
 *
 * Kept in a `.d.ts` file so TypeScript can model the recursive structure
 * without tripping over JSDoc recursion edge-cases in `checkJs` mode.
 */

export type EmptyPair = []

export type Pair = string | number | EmptyPair | [Pair, Pair]
