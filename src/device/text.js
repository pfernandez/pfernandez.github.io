/** Convert a literal graph sequence into one host string. */
export const text = ({ values }) => values().flat(Infinity).join(' ')

text.literal = true
