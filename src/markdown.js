import { component, div } from '@pfern/elements'
import MarkdownIt from 'markdown-it'

const md = MarkdownIt({ html: true })

let mdMath = null
let mathInit = null

let renderSeq = 0

const hasScriptTag = html => /<script[\s>]/i.test(html)

const schedule = fn => {
  if (typeof window === 'undefined') return
  if (typeof queueMicrotask === 'function') return window.queueMicrotask(fn)
  Promise.resolve().then(fn)
}

const runScripts = token => {
  if (typeof document === 'undefined') return

  const container =
    document.querySelector(`[data-md-render="${String(token)}"]`)

  if (!container) return

  const scripts = container.querySelectorAll('script')
  for (const oldScript of scripts) {
    if (oldScript.dataset?.mdExecuted === 'true') continue

    const script = document.createElement('script')
    script.dataset.mdExecuted = 'true'

    for (const { name, value } of oldScript.attributes) {
      if (name === 'data-md-executed') continue
      script.setAttribute(name, value)
    }

    if (!oldScript.src) script.textContent = oldScript.textContent
    oldScript.replaceWith(script)
  }
}

export const markdown = component(string => {
  const token = ++renderSeq
  const { html, allowScripts } = render(string)

  if (allowScripts && hasScriptTag(html)) schedule(() => runScripts(token))

  return div({ class: 'markdown',
               'data-md-render': String(token),
               innerHTML: html })
})

const needsMath = text =>
  typeof text === 'string' && (/\$[^$\n]+\$/.test(text)
      || /\\\(/.test(text)
      || /\\\[/.test(text))

const initMath = () => {
  mathInit ||= (async () => {
    const { createMathjaxInstance, mathjax } =
      await import('@mdit/plugin-mathjax')

    const mathjaxInstance = await createMathjaxInstance({
      output: 'svg', // or 'chtml' for dynamic
      delimiters: 'all' // supports both $...$ and \(...\)
    })

    mdMath = MarkdownIt({ html: true }).use(mathjax, mathjaxInstance)
  })()

  return mathInit
}

const render = text => {
  if (!needsMath(text)) return { html: md.render(text), allowScripts: true }
  if (mdMath) return { html: mdMath.render(text), allowScripts: true }

  initMath().then(() => markdown(text))
  // Avoid running scripts twice: this initial render is a temporary fallback
  // until MathJax is ready.
  return { html: md.render(text), allowScripts: false }
}
