import { err, parse } from './parse.js'
import { createReducer } from './graph.js'
import {
  bindForm,
  buildGraph,
  createScope,
  isBindingForm,
  planBindings,
  predeclareDefinitions
} from './syntax.js'

// Definitions extend the scope; the last remaining form is the focus.
export const compile = source => {
  const forms = parse(source)
  const scope = createScope()
  const reduce = createReducer()
  const reduceForm = form =>
    reduce(buildGraph(form, [scope.names], scope))

  const plans = planBindings(forms)
  let focus

  predeclareDefinitions(scope, plans)

  forms.forEach((form, i) => {
    if (i < forms.length - 1 && isBindingForm(form))
      bindForm(form, scope, plans[i]?.parameterNames)
    else focus = reduceForm(form)
  })

  if (focus === undefined) err('Missing focus')
  return { graph: focus, legend: scope.legend }
}
