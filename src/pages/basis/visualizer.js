/**
 * Basis visualizer page (keep-alive).
 *
 * This boots the Three.js/Jolt visualizer from the sibling `basis` repo after
 * the DOM nodes exist. We intentionally load it dynamically:
 * - the module has side effects (it starts an animation loop),
 * - it expects `#app` and `#hud` to exist when it initializes.
 *
 * Note: the visualizer module currently runs continuously even when the page
 * is inactive (because keep-alive keeps the DOM mounted). We can add a pause/
 * resume protocol later if needed.
 */

import { component, div, pre } from '@pfern/elements'

const startBasisVis = async () => {
  // Import CSS first so the initial frame doesn’t flash unstyled.
  await import('./visualizer.css')

  // This page used to boot the Three.js visualizer from the separate `basis`
  // research repo. Vite blocks importing files outside the project root by
  // default, and we don’t want this site build to depend on external paths.
  //
  // Once the Basis visualizer is ported into `src/` (or published as a proper
  // package), this loader can be reinstated as a normal import.
  const hud = document.getElementById('hud')
  hud && (hud.textContent =
    'Basis visualizer is not yet ported into this repo. See /collapse/interpreter for the minimal collapse core.')
}

const bootOnce = component(
  () =>
    div({
      ontick: (_el, ctx = { started: false }) => {
        if (ctx.started) return ctx
        startBasisVis().catch(console.error)
        return { started: true }
      },
    }),
)

export default () =>
  div(
    { class: 'basis-vis' },
    // These ids are required by the visualizer module.
    div({ id: 'app' }),
    pre({ id: 'hud' }),
    bootOnce()
  )
