import { component, div } from '@pfern/elements'
import MarkdownIt from 'markdown-it'
import config from './pages/config.js'

const md = MarkdownIt({ html: true })

let mdMath = null
let mathInit = null

let renderSeq = 0
const tokenMeta = new Map()
const scriptsByBasePath = new Map()

const pageJsModules = import.meta.glob('/src/pages/**/*.js')

let markdownGlobalsCache = null
let markdownGlobalsCacheFn = null

const isPlainObject = x =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

const isValidIdentifier = name =>
  typeof name === 'string' && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(name)

const getMarkdownGlobals = async md => {
  const fn = config?.markdownGlobals
  if (typeof fn !== 'function') return {}

  const canCache = fn.length === 0
  if (canCache && fn === markdownGlobalsCacheFn && markdownGlobalsCache)
    return markdownGlobalsCache

  let globals
  try {
    globals = await fn({ md })
  } catch (err) {
    console.warn('markdownGlobals() failed:', err)
    return {}
  }

  const out = isPlainObject(globals) ? globals : {}
  if (canCache) {
    markdownGlobalsCacheFn = fn
    markdownGlobalsCache = Object.freeze(out)
    return markdownGlobalsCache
  }
  return Object.freeze(out)
}

const hasScriptTag = html => /<script[\s>]/i.test(html)

const extractScriptsFromMarkdown = markdownText => {
  const scripts = []

  const fenceStart = line => line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1] || null

  const normalizeType = t => String(t || '').trim().toLowerCase()
  const isExecutableType = t => {
    const type = normalizeType(t)
    return !type
      || type === 'module'
      || type === 'text/javascript'
      || type === 'application/javascript'
  }

  const getAttrValue = (attrs, key) =>
    attrs.match(new RegExp(`\\b${key}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')`, 'i'))?.[1]
    ?? attrs.match(new RegExp(`\\b${key}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')`, 'i'))?.[2]
    ?? null

  const renderChunk = chunk => {
    if (!chunk) return ''

    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
    let out = ''
    let last = 0
    for (const m of chunk.matchAll(re)) {
      const attrs = m[1] || ''
      const body = m[2] || ''

      const type = (getAttrValue(attrs, 'type') || '').trim()
      const src = (getAttrValue(attrs, 'src') || '').trim()

      out += chunk.slice(last, m.index)

      if (!isExecutableType(type)) {
        out += m[0]
      } else {
        const idx = scripts.length
        scripts.push({ type, body, src })
        out += `<script data-md-script="${idx}"${type ? ` type="${type}"` : ''}></script>`
      }

      last = m.index + m[0].length
    }
    out += chunk.slice(last)
    return out
  }

  const lines = String(markdownText || '').split(/\r?\n/)
  const outLines = []
  let chunkLines = []
  let inFence = false
  let fenceChar = null
  let fenceLen = 0

  const flushChunk = () => {
    if (chunkLines.length === 0) return
    const rendered = renderChunk(chunkLines.join('\n'))
    outLines.push(...rendered.split('\n'))
    chunkLines = []
  }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const marker = fenceStart(line)

    if (marker && !inFence) {
      flushChunk()
      inFence = true
      fenceChar = marker[0]
      fenceLen = marker.length
      outLines.push(line)
      continue
    }

    if (marker && inFence) {
      const rest = line.slice(line.indexOf(marker) + marker.length)
      const isCloser =
        marker[0] === fenceChar
        && marker.length >= fenceLen
        && rest.trim() === ''

      if (isCloser) {
        inFence = false
        fenceChar = null
        fenceLen = 0
        outLines.push(line)
        continue
      }
    }

    if (inFence) {
      outLines.push(line)
      continue
    }

    chunkLines.push(line)
  }

  flushChunk()

  return { text: outLines.join('\n'), scripts }
}

const schedule = fn => {
  if (typeof window === 'undefined') return
  if (typeof requestAnimationFrame === 'function')
    return requestAnimationFrame(() => fn())
  if (typeof queueMicrotask === 'function') return queueMicrotask(fn)
  return setTimeout(fn, 0)
}

const cssEscape = s => {
  const esc = globalThis?.CSS?.escape
  return typeof esc === 'function'
    ? esc(String(s))
    : String(s).replace(/[^a-zA-Z0-9_-]/g, ch =>
      `\\${ch.codePointAt(0).toString(16)} `)
}

const getContainerByTokenOrPath = (token, basePath) => {
  if (typeof document === 'undefined') return null
  const byToken =
    document.querySelector(`[data-md-render="${String(token)}"]`)
  if (byToken) return byToken
  if (!basePath) return null
  return document.querySelector(
    `[data-md-base-path="${cssEscape(basePath)}"]`)
}

const runScriptsInContainer = async (container, { basePath, extracted } = {}) => {
  const scripts = Array.from(container.querySelectorAll('script'))
  const placeholders = scripts.filter(s => s.hasAttribute('data-md-script'))

  // Only execute scripts that came from markdown extraction. Any other <script>
  // tags inside rendered markdown are removed (and ignored) for safety and to
  // avoid MarkdownIt-mangled script bodies.
  for (const s of scripts) {
    if (s.hasAttribute('data-md-script')) continue
    const src = s.getAttribute('src')
    console.warn('Ignoring markdown <script> tag. Use inline scripts only.', src ? { src } : {})
    s.remove()
  }

  if (!placeholders.length) return

  const scriptsForPath =
    basePath && scriptsByBasePath.get(basePath) || []
  const resolvedExtracted =
    Array.isArray(extracted) && extracted.length ? extracted : scriptsForPath

  const parts = []
  for (const s of placeholders) {
    const type = String(s.getAttribute('type') || '').trim().toLowerCase()
    if (type && type !== 'module'
      && type !== 'text/javascript'
      && type !== 'application/javascript') continue

    const src = s.getAttribute('src')
    if (src) {
      console.warn('Markdown <script src> is not supported:', src)
      s.remove()
      continue
    }

    const idxAttr = s.getAttribute('data-md-script')
    if (idxAttr != null) {
      const idx = Number(idxAttr)
      const entry = resolvedExtracted[idx]
      if (entry?.src) {
        console.warn('Markdown <script src> is not supported:', entry.src)
        parts.push('')
        s.remove()
        continue
      }
      const body = entry?.body
      parts.push(String(body || ''))
      s.remove()
      continue
    }

    s.remove()
  }

  const raw = parts
    .map((code, idx) => `\n/* markdown script ${idx + 1}/${parts.length} */\n${code}\n`)
    .join('\n')

  const code = raw

  // Markdown scripts run inside an async function, so ESM syntax is invalid.
  // Use `await md.import('...')` instead.
  const hasExport = /^\s*export\b/m.test(code)
  const hasStaticImport = /^\s*import\b(?!\s*\()/m.test(code)
  if (hasExport || hasStaticImport) {
    console.error(
      'Markdown scripts do not support `import ... from` or `export`. '
      + 'Use `await md.import("...")` instead.')
    return
  }

  const md = Object.freeze({
    basePath: basePath || null,
    root: container,
    import: spec => mdImport(spec, { basePath: basePath || null })
  })

  const makeScopedDocument = (doc, root) =>
    new Proxy(doc, {
      get(target, prop, receiver) {
        if (prop === 'getElementById') {
          // Prefer IDs within this markdown render root first. This prevents
          // keep-alive pages from clobbering each other when multiple markdown
          // routes (or demos) share the same `id=` values.
          return id => {
            const local =
              root?.querySelector?.(`#${cssEscape(id)}`) || null
            return local || target.getElementById(String(id))
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })

  try {
    const doc = container?.ownerDocument || globalThis.document
    const scopedDocument =
      doc ? makeScopedDocument(doc, container) : undefined

    const globals = await getMarkdownGlobals(md)
    const keys = Object.keys(globals).filter(k =>
      isValidIdentifier(k) && k !== 'md' && k !== 'document')
    const values = keys.map(k => globals[k])

    const fn = new Function(
      'md',
      'document',
      ...keys,
      `return (async () => {\n${code}\n})()`)

    await fn(md, scopedDocument, ...values)
  } catch (err) {
    console.error('Markdown script error:', err)
  }
}

const dirname = path => {
  if (typeof path !== 'string') return '/'
  const i = path.lastIndexOf('/')
  return i === -1 ? '/' : path.slice(0, i + 1)
}

const resolvePosix = (fromDir, rel) => {
  const base = dirname(fromDir.endsWith('/') ? `${fromDir}x` : fromDir)
  const parts = `${base}${rel}`.split('/')
  const out = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') out.length && out.pop()
    else out.push(part)
  }
  return `/${out.join('/')}`
}

const mdImport = async (spec, { basePath } = {}) => {
  if (typeof spec !== 'string' || !spec)
    throw new TypeError('md.import(spec) expects a non-empty string.')

  const isRelative = spec.startsWith('.')
  const isAbsolutePage = spec.startsWith('/src/pages/')

  if (!isRelative && !isAbsolutePage) {
    throw new Error(
      `Unsupported markdown import: ${spec} `
      + '(only relative /src/pages imports are supported; '
      + 'use config.markdownGlobals for shared libraries)')
  }

  if (isRelative && !basePath) {
    throw new Error(
      `Unsupported markdown import: ${spec} (relative imports require basePath)`)
  }

  const resolved = isRelative ? resolvePosix(dirname(basePath), spec) : spec

  const candidates = [resolved]
  if (!resolved.endsWith('.js')) {
    candidates.push(`${resolved}.js`)
    candidates.push(`${resolved}/index.js`)
  } else {
    candidates.push(resolved.replace(/\/index\.js$/, ''))
  }

  for (const c of candidates) {
    const loader = pageJsModules[c]
    if (loader) return loader()
  }

  const hint = spec.startsWith('.')
    ? ` (resolved to ${resolved} from ${basePath})`
    : ''
  throw new Error(`Unsupported markdown import: ${spec}${hint}`)
}

const runScripts = async token => {
  if (typeof document === 'undefined') return

  const meta = tokenMeta.get(token) || null
  const basePath = meta?.basePath || null
  const extracted = Array.isArray(meta?.scripts) ? meta.scripts : []

  const container = getContainerByTokenOrPath(token, basePath)

  if (!container) {
    // Navigation and async rerenders can re-tokenize markdown before the
    // scheduled run occurs. Retry briefly using the more stable basePath
    // selector when available.
    const attempt = Number(meta?.attempt || 0)
    if (attempt < 8) {
      tokenMeta.set(token, { ...meta || {}, attempt: attempt + 1 })
      schedule(() => runScripts(token))
      return
    }
    tokenMeta.delete(token)
    return
  }

  tokenMeta.delete(token)
  await runScriptsInContainer(container, { basePath, extracted })
}

export const runMarkdownScriptsForBasePath = basePath => {
  if (typeof document === 'undefined') return
  if (typeof basePath !== 'string' || !basePath) return
  const container = document.querySelector(
    `[data-md-base-path="${cssEscape(basePath)}"]`)
  if (!container) return
  schedule(() => runScriptsInContainer(container, { basePath }))
}

export const createMarkdown = () => {
  const markdown = component((string, { basePath = null } = {}) => {
    const token = ++renderSeq
    const extracted = extractScriptsFromMarkdown(string)
    const rerender = () => markdown(string, { basePath })
    const { html, allowScripts } = render(extracted.text, rerender)

    if (basePath) scriptsByBasePath.set(basePath, extracted.scripts)

    if (allowScripts && (extracted.scripts.length || hasScriptTag(html))) {
      tokenMeta.set(token, { basePath, scripts: extracted.scripts })
      schedule(() => runScripts(token))
    }

    const props = { class: 'markdown',
                    'data-md-render': String(token),
                    innerHTML: html }
    basePath && (props['data-md-base-path'] = basePath)
    return div(props)
  })

  return markdown
}

export const markdown = createMarkdown()

const needsMath = text =>
  typeof text === 'string' && (/\$[^$\n]+\$/.test(text)
      || /\\\(/.test(text)
      || /\\\[/.test(text))

const initMath = () => {
  mathInit ||= (async () => {
    const { createMathjaxInstance, mathjax } =
      await import('@mdit/plugin-mathjax')

    const mathjaxInstance = await createMathjaxInstance({
      output: 'svg', // or 'chtml' for dynamic
      delimiters: 'all' // supports both $...$ and \(...\)
    })

    mdMath = MarkdownIt({ html: true }).use(mathjax, mathjaxInstance)
  })()

  return mathInit
}

const render = (text, rerender) => {
  if (!needsMath(text)) return { html: md.render(text), allowScripts: true }
  if (mdMath) return { html: mdMath.render(text), allowScripts: true }

  typeof rerender === 'function' && initMath().then(rerender)
  // Avoid running scripts twice: this initial render is a temporary fallback
  // until MathJax is ready.
  return { html: md.render(text), allowScripts: false }
}
