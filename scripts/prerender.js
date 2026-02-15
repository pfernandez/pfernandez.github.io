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

import {
  a,
  article,
  aside,
  body,
  head,
  header,
  h1,
  html,
  li,
  link,
  main as mainTag,
  meta,
  nav,
  script,
  section,
  summary,
  title as titleTag,
  toHtmlString,
  ul
} from '@pfern/elements'

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

const parseAttributes = tagText => {
  const attrs = {}
  const open = String(tagText || '').match(/^<\w+\s*([^>]*)>/i)?.[1] || ''

  const re =
    /([A-Za-z_:\-][A-Za-z0-9_:\-]*)\s*(?:=\s*("([^"]*)"|'([^']*)'))?/g

  let match
  while (match = re.exec(open)) {
    const key = match[1]
    const value = match[3] ?? match[4]
    attrs[key] = value == null ? true : value
  }

  return attrs
}

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

  const moduleScriptOpen =
    moduleScript.match(/<script\b[^>]*>/i)?.[0] || moduleScript

  return {
    cssLinks: cssLinks.map(parseAttributes),
    moduleScript: parseAttributes(moduleScriptOpen)
  }
}

const renderNavVNode = activeRoute =>
  aside(
    nav(...content.map(group =>
      section(
        summary(group.summary || ''),
        ul(...group.items.map(item => {
          const href = item.publicPath
          const isActive = href === activeRoute
          const props = {
            href,
            class: isActive ? 'active' : ''
          }
          isActive && (props['aria-current'] = 'page')
          return li(a(props, item.label || ''))
        }))
      )
    ))
  )

const renderDocument = ({
  route,
  title,
  description,
  cssLinks,
  moduleScript,
  bodyVNode
}) => {
  const pageTitle = `${title} · ${config.title}`

  const headVNode = head(
    meta({ charset: 'utf-8' }),
    meta({ name: 'viewport', content: 'width=device-width, initial-scale=1' }),
    meta({ name: 'color-scheme', content: 'light dark' }),
    link({ rel: 'icon', href: 'data:x-icon' }),
    titleTag(pageTitle),
    description ? meta({ name: 'description', content: description }) : null,
    ...cssLinks.map(props => link(props)),
    moduleScript ? script(moduleScript) : null
  )

  return toHtmlString(
    html(
      { lang: 'en' },
      headVNode,
      bodyVNode
    ),
    { doctype: true }
  ) + '\n'
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
        renderDocument({
          cssLinks,
          route: entry.route,
          title,
          description,
          moduleScript: null,
          bodyVNode: body(
            { class: 'container' },
            header(h1(config.title || '')),
            mainTag(
              { class: 'grid' },
              renderNavVNode(entry.route),
              section(
                { class: 'content' },
                article({ innerHTML: bodyHtml })
              )
            )
          )
        })
      )
    } else {
      // Lightweight JS route shell so deep links don't require a 404 fallback.
      await writeHtml(
        entry.route,
        renderDocument({
          cssLinks,
          moduleScript,
          title: entry.label,
          description: '',
          route: entry.route,
          bodyVNode: body()
        })
      )
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
