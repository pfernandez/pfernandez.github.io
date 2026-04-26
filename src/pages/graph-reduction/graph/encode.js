import { expand, isDefinitionForm } from './expand.js'
import { construct } from './construct.js'
import { applyArgs, isList, isPair } from './shared.js'
import { project } from './serialize.js'

const encodePlainExpression = expr => {
  if (!isList(expr)) return expr
  if (expr.length === 0) return []
  const [head, ...args] = expr
  return applyArgs(encodePlainExpression(head), args.map(encodePlainExpression))
}

const collectNumericSlots = (node, slots = new Set()) => {
  if (typeof node === 'number') slots.add(node)
  if (isPair(node)) {
    collectNumericSlots(node[0], slots)
    collectNumericSlots(node[1], slots)
  }
  return slots
}

const remapSlots = (node, slots) => {
  if (typeof node === 'number') return slots.get(node)
  if (isPair(node))
    return [remapSlots(node[0], slots), remapSlots(node[1], slots)]
  return node
}

const compactSlots = node => {
  if (!isPair(node)) return node
  const values = [...collectNumericSlots(node)].sort((a, b) => a - b)
  if (values.every((value, index) => value === index)) return node
  const slots = new Map(values.map((value, index) => [value, index]))
  return remapSlots(node, slots)
}

const encodeProgramProjection = forms => {
  const { graph, sequence } = construct(expand(forms))
  return compactSlots(project(graph, sequence))
}

const encodeProgram = forms =>
  !forms.length
    ? []
    : forms.length === 1 && !isDefinitionForm(forms[0])
      ? encodePlainExpression(forms[0])
      : encodeProgramProjection(forms)

/**
 * Compatibility projection helper.
 *
 * `encode` keeps the older tests and UI readouts stable by returning the
 * serialized constructible projection for a parsed program. The compiler
 * pipeline itself is now `parse -> expand -> construct`.
 *
 * @param {import('./parse.js').SourceForm[]} forms
 * @returns {*}
 */
export const encode = forms => encodeProgram(forms)
