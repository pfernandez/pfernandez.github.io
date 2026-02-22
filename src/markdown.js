import { component, div } from '@pfern/elements'
import MarkdownIt from 'markdown-it'
import * as acorn from 'acorn'

const md = MarkdownIt({ html: true })

let mdMath = null
let mathInit = null

let renderSeq = 0
const tokenMeta = new Map()

const pageJsModules = import.meta.glob('/src/pages/**/*.js')

const bareImporters = {
  '@pfern/elements': () => import('@pfern/elements'),
  '@pfern/elements-x3dom': () => import('@pfern/elements-x3dom')
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
  if (typeof queueMicrotask === 'function') return queueMicrotask(fn)
  Promise.resolve().then(fn)
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

  if (spec in bareImporters) return bareImporters[spec]()

  if (spec.startsWith('.') && !basePath) {
    throw new Error(
      `Unsupported markdown import: ${spec} (relative imports require basePath)`)
  }

  const resolved = spec.startsWith('.')
    ? resolvePosix(dirname(basePath), spec)
    : spec

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

const importDeclToJs = node => {
  const source = node.source?.value
  if (typeof source !== 'string')
    throw new Error('Unsupported import: non-string module specifier.')

  const specifiers = Array.isArray(node.specifiers) ? node.specifiers : []

  if (specifiers.length === 0) return `await md.import(${JSON.stringify(source)});`

  const namespace = specifiers.find(s => s.type === 'ImportNamespaceSpecifier')
  const defaultSpec = specifiers.find(s => s.type === 'ImportDefaultSpecifier')
  const namedSpecs = specifiers.filter(s => s.type === 'ImportSpecifier')

  if (namespace) {
    const ns = namespace.local.name
    if (defaultSpec) {
      const def = defaultSpec.local.name
      return (
        `const ${ns} = await md.import(${JSON.stringify(source)});\n`
        + `const ${def} = ${ns}.default;`
      )
    }
    return `const ${ns} = await md.import(${JSON.stringify(source)});`
  }

  const props = []
  if (defaultSpec) props.push(`default: ${defaultSpec.local.name}`)

  for (const s of namedSpecs) {
    const imported = s.imported?.name
    const local = s.local?.name
    if (!imported || !local) continue
    props.push(imported === local ? imported : `${imported}: ${local}`)
  }

  return `const { ${props.join(', ')} } = await md.import(${JSON.stringify(source)});`
}

const transformModuleImports = code => {
  let ast
  try {
    ast = acorn.parse(code, { ecmaVersion: 2024, sourceType: 'module' })
  } catch (err) {
    const line = err?.loc?.line
    const col = err?.loc?.column
    const srcLine = Number.isInteger(line)
      ? String(code.split(/\r?\n/)[line - 1] || '')
      : ''
    const caret = Number.isInteger(col) ? ' '.repeat(col) + '^' : ''
    const context =
      Number.isInteger(line) && Number.isInteger(col)
        ? `\n${line}:${col}\n${srcLine}\n${caret}`
        : ''

    console.warn('Markdown script parse failed; imports may not work.', err, context)
    return code
  }

  const body = Array.isArray(ast.body) ? ast.body : []
  for (const node of body) {
    if (node.type.startsWith('Export'))
      throw new Error('Markdown scripts do not support `export`.')
  }

  const replacements = []
  for (const node of body) {
    if (node.type !== 'ImportDeclaration') continue
    replacements.push({
      start: node.start,
      end: node.end,
      text: importDeclToJs(node)
    })
  }

  if (!replacements.length) return code

  replacements.sort((a, b) => a.start - b.start)
  let out = ''
  let i = 0
  for (const r of replacements) {
    out += code.slice(i, r.start)
    out += r.text
    out += '\n'
    i = r.end
  }
  out += code.slice(i)
  return out
}

const runScripts = async token => {
  if (typeof document === 'undefined') return

  const meta = tokenMeta.get(token)
  tokenMeta.delete(token)
  const basePath = meta?.basePath || null
  const extracted = Array.isArray(meta?.scripts) ? meta.scripts : []

  const container =
    document.querySelector(`[data-md-render="${String(token)}"]`)

  if (!container) return

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
      const entry = extracted[idx]
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

  let code
  try {
    code = transformModuleImports(raw)
  } catch (err) {
    console.error('Failed to transform markdown module imports:', err)
    return
  }

  if (/^\s*import\b/m.test(code)) {
    console.error(
      'Markdown script contains ESM imports, but the import rewriter failed. ' +
      'Make sure the script body is valid JavaScript (not HTML-wrapped by markdown).')
    return
  }

  const md = Object.freeze({
    basePath,
    root: container,
    import: spec => mdImport(spec, { basePath })
  })

  try {

    const fn = new Function('md', `return (async () => {\n${code}\n})()`)
    await fn(md)
  } catch (err) {
    console.error('Markdown script error:', err)
  }
}

export const markdown = component((string, { basePath = null } = {}) => {
  const token = ++renderSeq
  const extracted = extractScriptsFromMarkdown(string)
  const rerender = () => markdown(string, { basePath })
  const { html, allowScripts } = render(extracted.text, rerender)

  if (allowScripts && (extracted.scripts.length || hasScriptTag(html))) {
    tokenMeta.set(token, { basePath, scripts: extracted.scripts })
    schedule(() => runScripts(token))
  }

  return div({ class: 'markdown',
               'data-md-render': String(token),
               innerHTML: html })
})

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
