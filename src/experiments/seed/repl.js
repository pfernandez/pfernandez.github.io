import { createInterface } from 'node:readline'
import { serialize } from '../../graph/index.js'
import { submit, undo } from './source.js'

const input = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

let state
let source = ''

const print = () => state && console.log(serialize(state.root, {
  format: process.stdout.isTTY ? 'ansi' : 'text',
  labels: true,
  legend: state.legend,
  width: process.stdout.columns ?? 40
}))

input.on('line', line => {
  if (!source && line === ':quit') return input.close()
  if (!source && line === ':undo') {
    state = undo(state)
    print()
  }
  else {
    source = source ? `${source}\n${line}` : line

    try {
      state = submit(state, source)
      source = ''
      print()
    } catch (error) {
      if (!String(error.message).startsWith('Missing )')) {
        console.error(error.message)
        source = ''
      }
    }
  }

  input.setPrompt(source ? '.. ' : '> ')
  input.prompt()
})

input.on('close', () => process.stdout.write('\n'))
input.prompt()
