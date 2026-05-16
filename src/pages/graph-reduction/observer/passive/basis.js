export const createBasis = ({ empty, pair, setLeft, setRight }) => {
  const application = pair

  const stable = value => pair(empty, value)

  const I = stable

  const keep = (kept, ignored) => pair(stable(kept), ignored)

  const chooseRight = (ignored, kept) => pair(stable(kept), ignored)

  const exposePair = (left, right) => stable(pair(left, right))

  const share = (first, second, argument) =>
    stable(pair(application(first, argument), application(second, argument)))

  const fix = (payload = empty) => {
    const root = pair(empty, empty)
    const cycle = pair(stable(root), payload)
    return setLeft(root, cycle)
  }

  const createRoot = (current = empty) => stable(current)

  const carry = (root, previous = empty) => pair(root, previous)

  const setCurrent = (root, current) => setRight(root, current)

  return {
    application,
    carry,
    chooseRight,
    createRoot,
    exposePair,
    fix,
    I,
    keep,
    setCurrent,
    share,
    stable
  }
}
