import config from './pages/config.js'
import './style.css'
import { body, h1, head,
	         header, html, meta, onNavigate, render, title } from '@pfern/elements'
import { page } from './page.js'
import { getActiveItem } from './utils/site-content.js'
import { scheduleX3DOMReload } from './utils/x3dom.js'
import { validateConfig } from './utils/validate-config.js'

validateConfig()

const handleNavigate = () => {
  page()

  // If we’re switching back to an X3DOM keep-alive view, nudge X3DOM to
  // recalculate canvas sizing after any layout/visibility changes.
  const item = getActiveItem(window.location.pathname)
  item?.keepAlive
    && item.localPath?.endsWith('.js')
    && scheduleX3DOMReload()
}

onNavigate(handleNavigate)

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
