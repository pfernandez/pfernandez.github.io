/** Invoke the capability observed on the current frame's left. */
export const project = (focus, legend) => {
  const observation = focus[0]
  const capability = legend.get(observation[0])?.capability
  if (!capability) throw new TypeError('Observation is not a capability call')
  return capability(observation[1])
}
