import { createInterface } from 'node:readline'
import { serialize } from '../graph/index.js'
import { submit } from './session.js'

const input = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

let session
let source = ''

const print = (node, legend = session?.legend) => node && console.log(
  serialize(node, { labels: true, legend, width: 80 }))

const command = line => {
  if (line === ':reset') session = undefined
  else if (line === ':source') console.log(session?.source ?? '')
  else if (line === ':ast') console.dir(session?.ast, { depth: null })
  else if (line === ':pairs') console.dir(session?.pairs, { depth: null })
  else if (line === ':connected')
    print(session?.connected.graph, session?.connected.legend)
  else if (line === ':graph') print(session?.graph)
  else if (line === ':help')
    console.log(':source :ast :pairs :connected :graph :reset :quit')
  else console.error(`Unknown command: ${line}`)
}

input.on('line', line => {
  if (!source && line === ':quit') return input.close()
  if (!source && line.startsWith(':')) command(line)
  else {
    source = source ? `${source}\n${line}` : line

    try {
      session = submit(session, source)
      print(session.result ?? session.focus)
      source = ''
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
