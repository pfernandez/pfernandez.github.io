export const text = ({ values }) => values().flat(Infinity).join(' ')

text.literal = true
