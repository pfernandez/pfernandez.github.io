const isBinding = form => typeof form?.[0] === 'string'

const inspect = knot => {
  const forms = isBinding(knot) ? [knot] : knot

  if (!Array.isArray(forms)
      || !forms.length
      || forms.some(form =>
        !Array.isArray(form)
        || typeof form[0] !== 'string'
        || form.length !== 2
        || !Array.isArray(form[1])
        || form[1].length !== 2
        || !form[1].every(reference => typeof reference === 'string')))
    throw new TypeError('Expected (name (left right)) bindings')
  return forms
}

/** Reserve a closed knot, connect it, then publish its final pair. */
export const tie = (state, knot) => {
  const forms = inspect(knot)
  const identities = new Map(state?.identities)
  const pairs = forms.map(([name]) => {
    if (identities.has(name))
      throw new ReferenceError(`Identity already exists: ${name}`)

    const pair = []
    identities.set(name, pair)
    return pair
  })
  const reference = name => {
    if (!identities.has(name))
      throw new ReferenceError(`Unknown identity: ${name}`)
    return identities.get(name)
  }

  forms.forEach(([, [left, right]], index) => {
    pairs[index][0] = reference(left)
    pairs[index][1] = reference(right)
  })

  const legend = new Map(state?.legend)
  forms.forEach(([name], index) => {
    Object.freeze(pairs[index])
    legend.set(pairs[index], { name })
  })

  return {
    identities,
    legend,
    previous: state,
    root: pairs.at(-1)
  }
}
