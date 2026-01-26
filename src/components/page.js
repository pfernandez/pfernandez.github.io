import { a, article, aside,
         component, li, main, nav, summary, ul } from '@pfern/elements'
import { markdown } from './markdown.js'

const pages = [
  'home.md',
  'test.md',
]

export const page = component(
  (name = 'home.md', text = '') => {
    const links = name => ul(
      ...pages.map(s => li(
        a({ class: s === name ? 'active': '',
          onclick: () => page(s) },
          s.split('.')[0]))))

    const content = (name, text) =>
      main({ class: 'grid' },
        aside(
          nav(
            summary('Posts'),  // Wrap with `details()` to
            links(name))),     // expand/collapse with pico.css.
        article(markdown(text)))

    !text.length && fetch('md/' + name)
      .then(res => res.text())
      .then(res => page(name, res))

    return content(name, text || 'Loading...')})
