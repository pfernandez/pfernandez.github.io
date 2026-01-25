import './style.css'
import { a, article, aside, body, div, h1, h2, head, header, html, li, main,
  meta, nav, render, section, summary, title, ul} from '@pfern/elements'
import { counter } from './components/counter.js'
import { todos } from './components/todos.js'

render(
  html(
    head(
      title('elements.js'),
      meta({ charset: 'utf-8' }),
      meta({ name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      meta({ name: 'color-scheme', content: 'light dark' })
    ),
    body({ class: 'container' },
      header(
        h1(undefined, 'Elements.js Demo')),
      main({ class: 'grid' },
        aside(
          nav( // Wrap summary & ul in `details()` to expand/collapse lists.
            summary('Posts'),
            ul(
              li(a({ href: '#' }, 'This is a link.')),
              li(a({ href: '#' }, 'This is a link.'))
            ))),
        article(
          section(
            h2('Todos'),
            todos()),
          section({ class: 'grid' },
            div(
              h2('Counter 1'),
              counter()),
            div(
              h2('Counter 2'),
              counter())))))))

