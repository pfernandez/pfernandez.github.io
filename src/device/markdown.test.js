import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createMarkdown,
  extractScriptsFromMarkdown,
  importMarkdownModule,
  runScriptsInContainer
} from './markdown.js'

const script = attributes => {
  const values = { ...attributes }
  return {
    removed: false,
    getAttribute: name => values[name] ?? null,
    hasAttribute: name => Object.hasOwn(values, name),
    remove() { this.removed = true }
  }
}

test('renders Markdown with an optional source path', () => {
  const rendered = createMarkdown()('# Hello', {
    basePath: '/src/pages/hello.md'
  })

  assert.equal(rendered[0], 'div')
  assert.equal(rendered[1].class, 'markdown')
  assert.equal(rendered[1]['data-md-base-path'], '/src/pages/hello.md')
  assert.equal(rendered[1].innerHTML, '<h1>Hello</h1>\n')
})

test('extracts executable scripts without touching fenced examples', () => {
  const source = [
    '<script>plain()</script>',
    '```html',
    '<script>example()</script>',
    '```',
    '<script type="application/json">{"value": 1}</script>',
    '<script type="module">module()</script>',
    '<script src="./external.js"></script>'
  ].join('\n')

  const extracted = extractScriptsFromMarkdown(source)

  assert.deepEqual(extracted.scripts, [
    { type: '', body: 'plain()', src: '' },
    { type: 'module', body: 'module()', src: '' },
    { type: '', body: '', src: './external.js' }
  ])
  assert.match(extracted.text, /<script data-md-script="0"><\/script>/)
  assert.match(extracted.text, /<script>example\(\)<\/script>/)
  assert.match(extracted.text, /type="application\/json"/)
  assert.match(extracted.text, /data-md-script="2"/)
})

test('imports only page modules from explicit source identities', async () => {
  const modules = {
    '/src/pages/demo/tool.js': async () => ({ answer: 42 }),
    '/src/pages/demo/widget/index.js': async () => ({ name: 'widget' })
  }

  assert.deepEqual(
    await importMarkdownModule('./tool', {
      basePath: '/src/pages/demo/page.md',
      modules
    }),
    { answer: 42 })
  assert.deepEqual(
    await importMarkdownModule('./widget', {
      basePath: '/src/pages/demo/page.md',
      modules
    }),
    { name: 'widget' })
})

test('rejects unsupported and unresolved Markdown imports', async () => {
  await assert.rejects(
    importMarkdownModule('package', { modules: {} }),
    /only relative \/src\/pages imports are supported/)
  await assert.rejects(
    importMarkdownModule('./tool', { modules: {} }),
    /relative imports require basePath/)
  await assert.rejects(
    importMarkdownModule('./missing', {
      basePath: '/src/pages/demo/page.md',
      modules: {}
    }),
    /resolved to \/src\/pages\/demo\/missing/)
})

test('runs extracted scripts inside their Markdown root', async () => {
  const placeholder = script({ 'data-md-script': '0' })
  const container = {
    ownerDocument: {},
    querySelectorAll: () => [placeholder]
  }
  const modules = {
    '/src/pages/demo/tool.js': async () => ({ answer: 42 })
  }

  await runScriptsInContainer(container, {
    basePath: '/src/pages/demo/page.md',
    extracted: [{
      type: '',
      src: '',
      body: [
        'md.root.base = md.basePath',
        'md.root.answer = (await md.import("./tool")).answer'
      ].join('\n')
    }],
    modules
  })

  assert.equal(container.base, '/src/pages/demo/page.md')
  assert.equal(container.answer, 42)
  assert.equal(placeholder.removed, true)
})

test('removes scripts not extracted from authored Markdown', async t => {
  const raw = script({ src: './external.js' })
  const container = { querySelectorAll: () => [raw] }
  const warning = t.mock.method(console, 'warn', () => {})

  await runScriptsInContainer(container)

  assert.equal(raw.removed, true)
  assert.equal(warning.mock.callCount(), 1)
})

test('rejects static module syntax in Markdown scripts', async t => {
  const placeholder = script({ 'data-md-script': '0' })
  const container = { querySelectorAll: () => [placeholder] }
  const error = t.mock.method(console, 'error', () => {})

  await runScriptsInContainer(container, {
    extracted: [{
      type: 'module',
      src: '',
      body: 'import value from "./tool.js"'
    }]
  })

  assert.equal(placeholder.removed, true)
  assert.equal(error.mock.callCount(), 1)
  assert.match(error.mock.calls[0].arguments[0], /await md\.import/)
})

test('scopes document lookup to the current Markdown root', async () => {
  const placeholder = script({ 'data-md-script': '0' })
  const local = { location: 'local' }
  const outside = { location: 'outside' }
  const ownerDocument = {
    getElementById: () => outside
  }
  const container = {
    ownerDocument,
    querySelector: selector => selector === '#shared' ? local : null,
    querySelectorAll: () => [placeholder]
  }

  await runScriptsInContainer(container, {
    extracted: [{
      type: '',
      src: '',
      body: [
        'md.root.local = document.getElementById("shared")',
        'md.root.outside = document.getElementById("missing")'
      ].join('\n')
    }]
  })

  assert.equal(container.local, local)
  assert.equal(container.outside, outside)
})
