import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { schemeNames, serialize } from '../graph/index.js'
import { observe } from './observe.js'
import { submit, undo } from './session.js'

const { values } = parseArgs({ options: {
  format: { type: 'string', short: 'f' },
  help: { type: 'boolean', short: 'h' },
  labels: { type: 'boolean' },
  'no-labels': { type: 'boolean' },
  scheme: { type: 'string', short: 's' },
  steps: { type: 'boolean' },
  width: { type: 'string', short: 'w' }
} })

if (values.help) {
  console.log(`Usage: npm run repl -- [options]

  -f, --format text|ansi
  -s, --scheme ${schemeNames.join('|')}
  -w, --width columns
      --steps
      --labels | --no-labels`)
  process.exit(0)
}

const settings = {
  format: values.format ?? (process.stdout.isTTY ? 'ansi' : 'text'),
  labels: values.labels ?? !values['no-labels'],
  scheme: values.scheme ?? 'color',
  steps: values.steps ?? false,
  width: Number(values.width ?? process.stdout.columns ?? 24)
}

if (!['ansi', 'text'].includes(settings.format))
  throw new Error(`Unknown format: ${settings.format}`)
if (!schemeNames.includes(settings.scheme))
  throw new Error(`Unknown scheme: ${settings.scheme}`)
if (!(settings.width > 0)) throw new Error(`Invalid width: ${values.width}`)

const input = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

let session
let source = ''

const print = (node, legend = session?.legend) => node && console.log(
  serialize(node, { ...settings, legend }))

const walk = (all = settings.steps) => {
  const start = session?.result ?? session?.focus
  if (!start) return

  const observation = observe(start)
  if (all) observation.steps.forEach(step => print(step))
  else print(observation.focus)
}

const output = () => session?.result || settings.steps
  ? walk()
  : print(session?.focus)

const command = line => {
  const [name, value] = line.split(/\s+/, 2)

  if (name === ':format' && ['ansi', 'text'].includes(value))
    settings.format = value
  else if (name === ':scheme' && schemeNames.includes(value))
    settings.scheme = value
  else if (name === ':width' && Number(value) > 0)
    settings.width = Number(value)
  else if (name === ':labels' && ['on', 'off'].includes(value))
    settings.labels = value === 'on'
  else if (name === ':steps' && ['on', 'off'].includes(value))
    settings.steps = value === 'on'
  else if (line === ':steps') walk(true)
  else if (line === ':observe') walk(false)
  else if (line === ':focus') print(session?.focus)
  else if (line === ':result') print(session?.result)
  else if (line === ':undo') {
    session = undo(session)
    output()
  }
  else if (line === ':reset') session = undefined
  else if (line === ':source') console.log(session?.source ?? '')
  else if (line === ':ast') console.dir(session?.ast, { depth: null })
  else if (line === ':pairs') console.dir(session?.pairs, { depth: null })
  else if (line === ':connected')
    print(session?.connected.graph, session?.connected.legend)
  else if (line === ':graph') print(session?.graph)
  else if (line === ':help')
    console.log(
      ':format :scheme :width :labels :steps :observe :focus :result :source :ast :pairs :connected :graph :undo :reset :quit')
  else console.error(`Unknown command: ${line}`)
}

input.on('line', line => {
  if (!source && line === ':quit') return input.close()
  if (!source && line.startsWith(':')) command(line)
  else {
    source = source ? `${source}\n${line}` : line

    try {
      session = submit(session, source)
      output()
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
