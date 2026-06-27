import { parse } from './parse.js'

const identityOf = (form, frames) =>
  frames
    .map(frame => frame.find(([name]) => name === form))
    .find(Boolean)?.[1]
const isSymbol = form => typeof form === 'string'
const uniqueNames = entries =>
  entries.filter(([name], index) =>
    entries.findIndex(([other]) => other === name) === index)

const leftSpine = (form, params = []) =>
  isSymbol(form[0])
    ? {
        name: form[0],
        params: uniqueNames(params.filter(([name]) => isSymbol(name)))
      }
    : leftSpine(form[0], [[form[0][1], form[0]], ...params])

const identityIntroducedBy = (form, frames) => {
  const identity = leftSpine(form)

  if (identityOf(identity.name, frames)) return

  return identity
}

const graphify = ast => {
  const legend = []
  const frames = []
  const enter = () =>
    frames.unshift([])
  const leave = () =>
    frames.shift()
  const push = (name, identity) =>
    frames[0].unshift([name, identity])
  const pushParams = params =>
    [...params]
      .reverse()
      .forEach(([param, node]) => push(param, node))
  const record = (name, identity) =>
    legend.push([identity, name])

  const wire = form => {
    if (isSymbol(form)) return identityOf(form, frames) ?? form

    enter()

    const [left, right] = form
    const identity = identityIntroducedBy(form, frames)

    if (identity) {
      push(identity.name, form)
      pushParams(identity.params)

      console.dir({ identity, frames, legend }, { depth: null })

      form[0] = wire(left)
      form[1] = wire(right)

      identity.params.forEach(([param, node]) => record(param, node))
      record(identity.name, form)
    } else {
      form[0] = wire(left)
      form[1] = wire(right)
    }

    leave()

    return form
  }

  const graph = wire(ast)
  console.dir({ graph, legend }, { depth: null })
  return { graph, legend }
}

export const compile = source => {
  try {
    const ast = parse(source)[0]
    console.dir({ ast }, { depth: null })
    return graphify(ast)
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
