import config from './pages/config.js'
import './style.css'
import { body, h1, head,
         header, html, meta, onNavigate, render, title } from '@pfern/elements'
import { page } from './page.js'

onNavigate(() => page())

render(
  html(
    head(
      title(config.title),
      meta({ charset: 'utf-8' }),
      meta({ name: 'viewport',
             content: 'width=device-width, initial-scale=1' }),
      meta({ name: 'color-scheme', content: 'light dark' })),
    body({ class: 'container' },
         header(
           h1(config.title)),
         page())))
