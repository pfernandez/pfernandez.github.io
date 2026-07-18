import { compile, observe, serialize } from './graph/index.js'

let traceCount = 0
const trace = form =>
  console.log(traceCount++, serialize(form, { format: 'ansi' }), '\n')

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  observe(compile(readFileSync(file, 'utf-8')), trace)
}
