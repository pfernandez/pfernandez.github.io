export const step = state =>
  state[1]

export const event = state =>
  state[0]

export const previous = event =>
  event[1][0]

export const output = event =>
  event[1][1]

export const historyDepth = (event, root) =>
  event === root ? 0 : 1 + historyDepth(previous(event), root)

export const spineStep = state =>
  state[0] === state ? state : state[0]

export const spineOutput = state =>
  state[0] === state ? state[1] : state

export const record = (outputs, { legend = [] } = {}) => {
  let allocations = 0
  const pair = (left, right) => {
    allocations += 1
    return [left, right]
  }
  const end = pair(null, null)
  const nextLegend = [...legend, { node: end, symbol: 'End' }]
  const states = []
  let prior = end

  end[0] = end
  end[1] = end

  for (const [i, value] of outputs.entries()) {
    const item = pair(null, pair(prior, value))

    item[0] = item
    nextLegend.push({ node: item, symbol: `E${i}` })
    states.push(pair(item, null))
    prior = item
  }

  states.forEach((state, i) => { state[1] = states[i + 1] ?? end })

  return { graph: states[0] ?? end, legend: nextLegend, allocations }
}
