// X3DOM helpers.
//
// This stays intentionally small and defensive: we don't want the app to depend
// on X3DOM internals, only to nudge it to recalculate after visibility/layout
// changes.

let scheduled = false

export const scheduleX3DOMReload = () => {
  if (scheduled) return
  scheduled = true

  const raf = globalThis?.requestAnimationFrame
  const schedule = typeof raf === 'function' ? raf : (fn => setTimeout(fn, 0))

  schedule(() => {
    scheduled = false
    try { globalThis?.x3dom?.reload?.() }
    catch { /* best-effort */ }
  })
}

