import { readFileSync } from 'node:fs'
import { compile } from './compile.mjs'
import { serialize } from './serialize.mjs'

const file = process.argv[2] ?? './source.lisp'
const source = readFileSync(file, 'utf8')
const state = compile(source)

if (state.error) {
  console.error(state.error)
  process.exitCode = 1
} else {
  console.log(serialize(state.graph))
}
