/**
 * Binary tree collapse page (keep-alive).
 *
 * This is the “small core” staging artifact:
 * - One binary pairs syntax.
 * - One local rewrite rule: `(() x) → x`.
 * - A deterministic schedule (leftmost-outermost).
 *
 * The point is to watch collapse happen on-screen without any heavy rendering
 * stack. This should stay small enough to port to WASM later.
 */
import { article, component, div, section } from '@pfern/elements'
import { DEFAULT_SOURCE, controlsPanel, readSource } from './collapse-panel.js'
import { observe } from '../collapse/utils/observe.js'
import { parse, serialize } from '../collapse/utils/sexpr.js'
import { renderBinaryTreeScene } from './binary-tree-scene.js'
import './binary-tree.css'

const initialPair = parse(DEFAULT_SOURCE)

const setSource = source => readSource(View, source)

const describeEvent = event => `Collapse at ${event.path}`

const View = component(({
  source = DEFAULT_SOURCE,
  pair = initialPair,
  error = null,
  history = [],
  event = null
} = {}) => {
  const observation = pair === null ? null : observe(pair)
  const isStable = !!observation && !observation.changed
  const treePanelKey = pair === null
    ? 'empty'
    : `${serialize(pair)}:${event?.path ?? 'none'}`

  const step = () => {
    if (pair === null || !observation?.changed) return

    return View({
      source,
      pair: observation.after,
      error: null,
      history: [...history, pair],
      event: observation.event
    })
  }

  const undo = () => {
    return history.length && View(
      { source,
        pair: history[history.length - 1],
        error: null,
        history: history.slice(0, -1),
        event: null })
  }

  const tree = renderBinaryTreeScene(pair, event)

  return article(
    section(
      { class: 'collapse-demo' },
      controlsPanel(
        { title: 'Binary tree',
          hint: 'Binary pairs only: `()` or `(a b)`. Reduce performs one collapse event.',
          source,
          history,
          error,
          onSource: setSource,
          onReset: () => setSource(DEFAULT_SOURCE),
          onReduce: step,
          onUndo: undo,
          reduceLabel: isStable ? 'Stable' : 'Reduce',
          canUndo: history.length > 0,
          status: event ? describeEvent(event) : null }),
      div({ class: 'panel', key: treePanelKey }, tree)))
})

export default () => div({ class: 'collapse-demo-root' }, View())
