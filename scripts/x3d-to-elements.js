#!/usr/bin/env node
/**
 * Convert an X3D (.x3d XML) file into an Elements.js component that uses
 * `@pfern/elements-3d` tag helpers.
 *
 * Usage:
 *   node scripts/x3d-to-elements.js src/components/NonplanarPolygons.x3d
 *   node scripts/x3d-to-elements.js input.x3d output.js \
 *                                   --export nonplanarPolygons
 *
 * Notes:
 * - Ignores <head> (metadata) and converts <Scene> only.
 * - Preserves attribute names/values as strings.
 * - Generates camelCase helper calls (e.g. IndexedFaceSet -> indexedFaceSet).
 */

import fs from 'node:fs'
import path from 'node:path'

const usage = () => {
  console.log(
    [
      'x3d-to-elements',
      '',
      'Usage:',
      '  node scripts/x3d-to-elements.js <input.x3d> [output.js] [--export name]',
      '',
      'Examples:',
      '  node scripts/x3d-to-elements.js src/components/NonplanarPolygons.x3d',
      '  node scripts/x3d-to-elements.js in.x3d out.js --export nonplanarPolygons',
      ''
    ].join('\n')
  )
}

const parseArgs = argv => {
  const args = [...argv]
  const out = { input: null, output: null, exportName: null }

  while (args.length) {
    const a = args.shift()
    if (a === '--help' || a === '-h') return { help: true }
    if (a === '--export') {
      out.exportName = args.shift() || null
      continue
    }
    if (!out.input) { out.input = a; continue }
    if (!out.output) { out.output = a; continue }
  }

  return out
}

const stripProlog = xml =>
  xml
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')

const isWhitespaceText = s => !s || /^\s+$/.test(s)

const parseAttributes = attrText => {
  const attrs = {}
  const re =
    /([A-Za-z_:\-][A-Za-z0-9_:\-]*)\s*=\s*("([^"]*)"|'([^']*)')/g
  let match
  while (match = re.exec(attrText)) {
    const key = match[1]
    const value = match[3] ?? match[4] ?? ''
    attrs[key] = value
  }
  return attrs
}

const parseXml = xmlText => {
  const xml = stripProlog(xmlText)

  const root = { type: 'element', name: '__root__', attrs: {}, children: []}
  const stack = [root]

  const tagRe = /<!--[\s\S]*?-->|<[^>]+>|[^<]+/g
  let match
  while (match = tagRe.exec(xml)) {
    const token = match[0]

    if (token.startsWith('<!--')) continue

    if (token.startsWith('<')) {
      if (token.startsWith('</')) {
        stack.pop()
        continue
      }

      const selfClosing = /\/>\s*$/.test(token)
      const inner = token.slice(1, token.length - (selfClosing ? 2 : 1)).trim()

      // Skip processing instructions / declarations
      if (!inner || inner.startsWith('!') || inner.startsWith('?')) continue

      const spaceIdx = inner.search(/\s/)
      const name = (spaceIdx === -1 ? inner : inner.slice(0, spaceIdx)).trim()
      const attrText = spaceIdx === -1 ? '' : inner.slice(spaceIdx).trim()
      const attrs = attrText ? parseAttributes(attrText) : {}

      const el = { type: 'element', name, attrs, children: []}
      stack[stack.length - 1].children.push(el)
      if (!selfClosing) stack.push(el)
      continue
    }

    if (!isWhitespaceText(token)) {
      stack[stack.length - 1].children.push({ type: 'text', value: token })
    }
  }

  return root
}

const findFirst = (node, predicate) => {
  if (!node) return null
  if (node.type === 'element' && predicate(node)) return node
  if (!node.children) return null
  for (const child of node.children) {
    const found = findFirst(child, predicate)
    if (found) return found
  }
  return null
}

const toKebab = value =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

const toCamel = kebab =>
  kebab
    .split('-')
    .filter(Boolean)
    .map((s, i) => i === 0 ? s : s[0].toUpperCase() + s.slice(1))
    .join('')

const lowerFirst = s => s ? s[0].toLowerCase() + s.slice(1) : s

const toHelperName = tagName => {
  if (!tagName) return tagName
  const n = tagName.replace(/^x3d:/i, '')
  if (n === 'X3D') return 'x3d'
  // X3D is case-sensitive in XML, but helper exports are camelCase.
  // e.g. IndexedFaceSet -> indexedFaceSet
  return lowerFirst(n)
}

const safePropKey = key =>
  /^[A-Za-z_\$][A-Za-z0-9_\$]*$/.test(key) ? key : JSON.stringify(key)

const jsString = value => {
  const s = String(value)
  const canUseSingleQuotes =
    !s.includes('\n')
    && !s.includes('\r')
    && !s.includes('\t')
    && !s.includes('\'')
    && s !== '\u2028'
    && s !== '\u2029'

  return canUseSingleQuotes
    ? `'${s}'`
    : JSON.stringify(s)
}

const propsToJs = attrs => {
  const keys = Object.keys(attrs || {})
  if (!keys.length) return null
  const parts = keys
    .sort()
    .map(k => `${safePropKey(k)}: ${jsString(attrs[k])}`)
  return `{ ${parts.join(', ')} }`
}

const normalizeText = t => t.replace(/\s+/g, ' ').trim()

const nodeToJs = (node, indent, usedHelpers) => {
  if (node.type === 'text') return jsString(normalizeText(node.value))

  const helper = toHelperName(node.name)
  usedHelpers.add(helper)

  const props = propsToJs(node.attrs)
  const kids = (node.children || [])
    .filter(c => c.type !== 'text' || !isWhitespaceText(c.value))

  if (!kids.length) {
    return props ? `${helper}(${props})` : `${helper}()`
  }

  const childExprs =
    kids.map(child => nodeToJs(child, indent + '  ', usedHelpers))

  const head = props ? `${helper}(${props},` : `${helper}(`
  const lines = [head]
  for (let i = 0; i < childExprs.length; i++) {
    const suffix = i === childExprs.length - 1 ? ')' : ','
    lines.push(`${indent}  ${childExprs[i]}${suffix}`)
  }
  return lines.join('\n')
}

const dropRootNamespaceAttrs = attrs => {
  const out = {}
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'xmlns' || k.startsWith('xmlns:')) continue
    if (k.includes(':')) continue
    out[k] = v
  }
  return out
}

const generateComponent = ({ x3dNode, sceneNode, exportName }) => {
  const usedHelpers = new Set()

  const x3dProps =
    propsToJs(dropRootNamespaceAttrs(x3dNode?.attrs || {}))
  const sceneJs = nodeToJs(sceneNode, '', usedHelpers)

  usedHelpers.delete('scene')
  usedHelpers.delete('x3d')

  const importNames = ['x3d', 'scene', ...[...usedHelpers].sort()]

  const indentLines = (text, prefix) =>
    String(text)
      .split('\n')
      .map(line => line.length ? prefix + line : line)
      .join('\n')

  const lines = []
  const importBody =
    importNames.length <= 6
      ? `{ ${importNames.join(', ')} }`
      : `{\n  ${importNames.join(',\n  ')}\n}`
  lines.push(`import ${importBody} from '@pfern/elements-3d'`)
  lines.push('')
  lines.push(`export const ${exportName} = () =>`)
  lines.push(x3dProps ? `  x3d(${x3dProps},` : '  x3d(')
  lines.push(indentLines(sceneJs, '    '))
  lines.push('  )')
  lines.push('')
  return lines.join('\n')
}

const main = () => {
  const { help, input, output, exportName } = parseArgs(process.argv.slice(2))
  if (help || !input) return usage()

  const inPath = path.resolve(process.cwd(), input)
  const xmlText = fs.readFileSync(inPath, 'utf8')
  const ast = parseXml(xmlText)

  const x3dNode = findFirst(ast, n => n.name === 'X3D')
  const sceneNode = findFirst(x3dNode || ast, n => n.name === 'Scene')

  if (!x3dNode) {
    console.error('Could not find <X3D> root element.')
    process.exit(1)
  }
  if (!sceneNode) {
    console.error('Could not find <Scene> element.')
    process.exit(1)
  }

  const baseName = path.basename(inPath, path.extname(inPath))
  const defaultExport = toCamel(toKebab(baseName))
  const outPath = path.resolve(
    process.cwd(),
    output || path.join(path.dirname(inPath), `${toKebab(baseName)}.js`)
  )

  const js = generateComponent({
    x3dNode,
    sceneNode,
    exportName: exportName || defaultExport
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, js, 'utf8')
  console.log(`Wrote: ${path.relative(process.cwd(), outPath)}`)
}

main()
