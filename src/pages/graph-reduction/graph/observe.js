export const observe = (graph, trace) => {
  const rotate = form =>
    (trace?.(form),
    form === graph ? form[1] : rotate(form[0]))

  return rotate(graph)
}
