#!/usr/bin/env node
/**
 * Build-time prerendering (SSG) for markdown pages (and optional JS shells).
 *
 * Goals:
 * - Produce fully-static HTML for `.md` routes so crawlers/agents get content
 *   without executing client JS.
 * - Preserve site structure (header/nav/layout) using the same config that the
 *   SPA uses at runtime.
 * - Optionally generate lightweight HTML shells for `.js` routes so direct
 *   navigation works without a 404 fallback.
 *
 * This script is intended to run *after* `vite build`, since it reuses
 * `/dist/index.html` to discover the built CSS/JS asset URLs.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MarkdownIt from 'markdown-it'
import { createMathjaxInstance, mathjax } from '@mdit/plugin-mathjax'

import config from '../src/pages/config.js'
import { content } from '../src/utils/site-content.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

const stripSlash = p => String(p || '').replace(/^\/+/, '').replace(/\/+$/, '')

const getRouteDir = route =>
  route === '/' ? distDir : path.join(distDir, stripSlash(route))

const needsMath = text =>
  typeof text === 'string'
  && (
    /\$[^$\n]+\$/.test(text)
    || /\\\(/.test(text)
    || /\\\[/.test(text)
  )

const extractTitle = (markdown, fallback) => {
  const m = String(markdown || '').match(/^\s*#\s+(.+?)\s*$/m)
  return (m?.[1] || fallback || config.title || '').trim()
}

const extractDescription = (markdown, fallback = '') => {
  const text = String(markdown || '')
    // Drop headings.
    .replace(/^\s*#{1,6}\s+.*$/gm, '')
    // Drop code blocks.
    .replace(/```[\s\S]*?```/g, '')
    // Drop inline code.
    .replace(/`[^`]+`/g, '')
    // Drop links but keep text.
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Collapse whitespace.
    .replace(/\s+/g, ' ')
    .trim()

  const desc = text || String(fallback || '').trim()
  return desc.length > 160 ? `${desc.slice(0, 157)}…` : desc
}

const escapeHtml = s =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const readDistIndexAssets = async () => {
  const indexPath = path.join(distDir, 'index.html')
  const html = await fs.readFile(indexPath, 'utf8').catch(() => null)
  if (!html) {
    throw new Error('Missing dist/index.html. Run `vite build` first.')
  }

  const cssLinks = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)]
    .map(m => m[0])

  const moduleScript =
    html.match(/<script[^>]+type="module"[^>]*><\/script>/)?.[0]
    || html.match(/<script[^>]+type="module"[^>]*src="[^"]+"[^>]*><\/script>/)?.[0]
    || null

  if (cssLinks.length === 0) {
    throw new Error('No stylesheet link found in dist/index.html.')
  }
  if (!moduleScript) {
    throw new Error('No module script found in dist/index.html.')
  }

  return { cssLinks, moduleScript }
}

const renderNavHtml = activeRoute =>
  `<aside>
  <nav>
    ${content.map(group =>
    `<section>
      <summary>${escapeHtml(group.summary || '')}</summary>
      <ul>
        ${group.items.map(item => {
    const href = item.publicPath
    const isActive = href === activeRoute
    const klass = isActive ? 'active' : ''
    const ariaCurrent = isActive ? ' aria-current="page"' : ''
    return `<li><a href="${href}" class="${klass}"${ariaCurrent}>${escapeHtml(item.label || '')}</a></li>`
  }).join('\n        ')}
      </ul>
    </section>`).join('\n    ')}
  </nav>
</aside>`

const renderMarkdownPageHtml = ({ cssLinks, route, title, description, bodyHtml }) => {
  const pageTitle = `${title} · ${config.title}`
  const metaDescription =
    description ? `<meta name="description" content="${escapeHtml(description)}">` : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <link rel="icon" href="data:x-icon">
    <title>${escapeHtml(pageTitle)}</title>
    ${metaDescription}
    ${cssLinks.join('\n    ')}
  </head>
  <body class="container">
    <header>
      <h1>${escapeHtml(config.title || '')}</h1>
    </header>
    <main class="grid">
      ${renderNavHtml(route)}
      <section class="content">
        <article>
${bodyHtml}
        </article>
      </section>
    </main>
  </body>
</html>
`
}

const renderJsShellHtml = ({ cssLinks, moduleScript, title, description }) => {
  const pageTitle = `${title} · ${config.title}`
  const metaDescription =
    description ? `<meta name="description" content="${escapeHtml(description)}">` : ''

  // Keep body empty: the SPA mounts here. This avoids duplicate DOM without
  // requiring hydration support in the library.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <link rel="icon" href="data:x-icon">
    <title>${escapeHtml(pageTitle)}</title>
    ${metaDescription}
    ${cssLinks.join('\n    ')}
    ${moduleScript}
  </head>
  <body></body>
</html>
`
}

const writeHtml = async (route, html) => {
  const dir = getRouteDir(route)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'index.html'), html)
}

const main = async () => {
  const { cssLinks, moduleScript } = await readDistIndexAssets()

  // Create Markdown renderers once (MathJax only if needed).
  const md = MarkdownIt()
  let mdMath = null

  const ensureMath = async () => {
    if (mdMath) return mdMath
    const mathjaxInstance = await createMathjaxInstance({
      output: 'svg',
      delimiters: 'all'
    })
    mdMath = MarkdownIt().use(mathjax, mathjaxInstance)
    return mdMath
  }

  /** @type {{ route: string, localPath: string, label: string, type: 'md' | 'js' }[]} */
  const routes = []
  for (const group of content) {
    for (const item of group.items) {
      if (!item?.publicPath || !item?.localPath) continue
      if (item.publicPath === '/') continue
      if (item.localPath.endsWith('.md')) {
        routes.push({
          route: item.publicPath,
          localPath: item.localPath,
          label: item.label || item.publicPath,
          type: 'md'
        })
      } else if (item.localPath.endsWith('.js')) {
        routes.push({
          route: item.publicPath,
          localPath: item.localPath,
          label: item.label || item.publicPath,
          type: 'js'
        })
      }
    }
  }

  for (const entry of routes) {
    if (entry.type === 'md') {
      const abs = path.join(rootDir, stripSlash(entry.localPath))
      const text = await fs.readFile(abs, 'utf8')
      const title = extractTitle(text, entry.label)
      const description = extractDescription(text)
      const renderer = needsMath(text) ? await ensureMath() : md
      const bodyHtml = renderer.render(text).trimEnd()

      await writeHtml(
        entry.route,
        renderMarkdownPageHtml({
          cssLinks,
          route: entry.route,
          title,
          description,
          bodyHtml
        })
      )
    } else {
      // Lightweight JS route shell so deep links don't require a 404 fallback.
      await writeHtml(
        entry.route,
        renderJsShellHtml({
          cssLinks,
          moduleScript,
          title: entry.label,
          description: ''
        })
      )
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})

