import './style.css'
import { body, h1, head,
        header, html, meta, render, title } from '@pfern/elements'
import { page } from './components/page.js'

render(
  html(
    head(
      title('elements.js'),
      meta({ charset: 'utf-8' }),
      meta({ name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      meta({ name: 'color-scheme', content: 'light dark' })),
    body({ class: 'container' },
      header(
        h1('My Blog')),
      page())))

