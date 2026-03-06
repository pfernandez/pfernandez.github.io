import config from './pages/config.js'
import './style.css'
import { body, head, html, meta, onNavigate, render, title }
  from '@pfern/elements'
import { page } from './components/page.js'
import { validateConfig } from './utils/validate-config.js'

import.meta.env?.DEV && validateConfig(config)
onNavigate(page)

render(
  html(
    head(
      title(config.title),
      meta({ charset: 'utf-8' }),
      meta({ name: 'viewport',
             content: 'width=device-width, initial-scale=1' }),
      meta({ name: 'color-scheme', content: 'light dark' })),
    body(
      page())))
