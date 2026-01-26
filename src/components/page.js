import { a, article, aside,
         component, li, main, nav, summary, ul } from '@pfern/elements'
import { markdown } from './markdown.js'

const pages = [
  'home.md',
]

// TODO:
// `onclick` handles vdom arrays, but `.then` does not. It would be best to
// reload the component automatically wherever it is called when on the client
// side, if that's possible. It can still return vdom.

export const page = component(
  (name = 'home.md', text = '') => {
    const links = name => ul(
      ...pages.map(s => li(
        a({ class: s === name ? 'active': '',
          onclick: () => page(s) },
          // onclick: () => page(s, 'foo') },  // Works: component DOM shows foo
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
      .then(res => page(name, res))  // FIXME: Does not reload component DOM.

    console.log(text);  // Fetches md/home.md correctly

    return content(name, text || 'Loading...')})

