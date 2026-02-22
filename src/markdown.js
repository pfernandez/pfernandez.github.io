import { component, div } from '@pfern/elements'
import MarkdownIt from 'markdown-it'
import { parse } from 'acorn'

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
        `const ${ns} = await md.import(${JSON.stringify(source)});\n` +
        `const ${def} = ${ns}.default;`
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
    ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' })
  } catch {
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

  const container =
    document.querySelector(`[data-md-render="${String(token)}"]`)

  if (!container) return

  const scripts = Array.from(container.querySelectorAll('script'))
  if (!scripts.length) return

  const parts = []
  for (const s of scripts) {
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
    parts.push(String(s.textContent || ''))
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

  const md = Object.freeze({
    basePath,
    root: container,
    import: spec => mdImport(spec, { basePath })
  })

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('md', `return (async () => {\n${code}\n})()`)
    await fn(md)
  } catch (err) {
    console.error('Markdown script error:', err)
  }
}

export const markdown = component((string, { basePath = null } = {}) => {
  const token = ++renderSeq
  const rerender = () => markdown(string, { basePath })
  const { html, allowScripts } = render(string, rerender)

  if (allowScripts && hasScriptTag(html)) {
    tokenMeta.set(token, { basePath })
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
