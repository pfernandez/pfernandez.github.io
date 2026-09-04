/** Follow right edges until the focus becomes recurrent. */
export const observe = (focus, history = []) => {
  const steps = [...history, focus]

  return focus[1] === focus || history.includes(focus)
    ? { focus, steps }
    : observe(focus[1], steps)
}
