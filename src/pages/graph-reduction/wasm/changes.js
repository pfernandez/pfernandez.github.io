export const changes = (dispatch, state) =>
  next => {
    if (next !== state) dispatch(next)
    state = next
  }
