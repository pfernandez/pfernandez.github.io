import { readFileSync } from 'fs'
import readline from 'readline'
import { compile } from '../compile.mjs'
import { serialize } from '../serialize.mjs'
import { observe } from '../observe.mjs'

const source = readFileSync(new URL('../source.lisp', import.meta.url), 'utf8')
const file = process.argv[2]

const withoutComments = text => text.replace(/;.*$/gm, '')

const parenDepth = text => {
  let depth = 0

  for (const char of withoutComments(text)) {
    if (char === '(') depth++
    if (char === ')') depth--
  }

  return depth
}

const run = program => {
  try {
    const fullSource = `${source}\n${program}`
    let state = compile(fullSource)

    if (state.error) {
      console.log('Error:', state.error)
      return
    }

    console.log('Initial:', serialize(state.graph))

    let i = 1
    while (true) {
      const nextGraph = observe(state.graph)
      if (nextGraph === state.graph) {
        console.log('Stable at step', i)
        break
      }
      state = { graph: nextGraph }
      console.log(`Step ${i}:`, serialize(state.graph))
      i++
      if (i > 64) {
        console.log('Reached step limit')
        break
      }
    }
  } catch (e) {
    console.error(e)
  }
}

if (file) {
  run(readFileSync(file, 'utf8'))
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'graph> '
  })

  console.log('Graph Reduction REPL. Type an expression or a definition to step through reduction.')
  let buffer = ''
  rl.prompt()

  rl.on('line', line => {
    if (!buffer && line.trim() === 'exit') {
      rl.close()
      return
    }

    buffer = buffer ? `${buffer}\n${line}` : line

    const depth = parenDepth(buffer)
    if (depth < 0) {
      console.log('Error: unexpected )')
      buffer = ''
    } else if (depth === 0 && withoutComments(buffer).trim()) {
      run(buffer)
      buffer = ''
    }

    rl.setPrompt(buffer ? '... ' : 'graph> ')
    rl.prompt()
  })
}
