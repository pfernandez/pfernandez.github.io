const isAtom = node => !Array.isArray(node)
const isEmpty = node => Array.isArray(node) && node.length === 0


// /**
//  * @param {*} root
//  * @returns {*} pair
//  */
export const observe = root => {
  if (isAtom(root)) return root

  const [first, rest] = root

  if (first && isEmpty(first)) return rest

  const next = observe(first)

  // If the left side moved, rebuild the pair to keep 'rest' attached
  if (next !== first) return [next, rest]

  return root
}


// export const observe = root => {
//   if (isAtom(root) || isEmpty(root)) return root

//   const [first, rest] = root

//   // FIX: Explicitly check for the empty array, even though it's falsy
//   if (Array.isArray(first) && isEmpty(first)) return rest

//   const next = observe(first)

//   // If the left side moved, rebuild the pair to keep 'rest' attached
//   if (next !== first) return [next, rest]

//   return root
// }
