/**
 * @module collapse/utils
 *
 * Tiny shared helpers for the collapse interpreter.
 *
 * Keep this module small: it’s the “bottom” of the stack. Anything bigger
 * should move into a dedicated module.
 */

/**
 * Ensure a condition holds, otherwise throw with a message.
 * @param {unknown} condition
 * @param {string} message
 * @returns {asserts condition}
 */
export const invariant = (condition, message) => {
  if (!condition) throw new Error(message)
}

/**
 * Create a simple incremental ID generator.
 * @param {string} prefix
 * @returns {() => string}
 */
export const createIdGenerator = (prefix = 'n') => {
  let counter = 0
  return () => `${prefix}${counter++}`
}

/**
 * Replace a node record immutably.
 * @template {{ id: string }} T
 * @param {T[]} list
 * @param {string} id
 * @param {(node: T) => T} updater
 * @returns {T[]}
 */
export const replaceNode = (list, id, updater) =>
  list.map(node => node.id === id ? updater(node) : node)

