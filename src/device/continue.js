/** Expose an authored graph continuation as a host-callable function. */
export const continuation = ({ argument, evaluate }) =>
  () => evaluate(argument[1] === argument ? argument[0] : argument)
