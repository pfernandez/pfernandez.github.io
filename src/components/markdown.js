import { component, div } from '@pfern/elements'
import MarkdownIt from 'markdown-it'

const md = MarkdownIt()

let mdMath = null
let mathInit = null

export const markdown = component(string =>
  div({ innerHTML: render(string) }))

const needsMath = text =>
  typeof text === 'string'
  && (
    /\$[^$\n]+\$/.test(text)
    || /\\\(/.test(text)
    || /\\\[/.test(text)
  )

const initMath = () => {
  mathInit ||= (async () => {
    const { createMathjaxInstance, mathjax } =
      await import('@mdit/plugin-mathjax')

    const mathjaxInstance = await createMathjaxInstance({
      output: 'svg', // or 'chtml' for dynamic
      delimiters: 'all' // supports both $...$ and \(...\)
    })

    mdMath = MarkdownIt().use(mathjax, mathjaxInstance)
  })()

  return mathInit
}

const render = text => {
  if (!needsMath(text)) return md.render(text)
  if (mdMath) return mdMath.render(text)

  initMath().then(() => markdown(text))
  return md.render(text)
}
