export const changes = dispatch => {
  let state

  return next => {
    if (next !== state) dispatch(next)
    state = next
  }
}
