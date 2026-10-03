import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { decompose, parse, schemeNames, serialize } from '../../graph/index.js'
import { link } from './link.js'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    format: { type: 'string', short: 'f' },
    help: { type: 'boolean', short: 'h' },
    scheme: { type: 'string', short: 's' },
    width: { type: 'string', short: 'w' }
  }
})

const usage = `Usage: npm run cli:link -- [file ...] [options]

  -f, --format text|ansi
  -s, --scheme ${schemeNames.join('|')}
  -w, --width columns

Enter one Lisp expression at a time.
Commands: :load file :graph :source :ast :pairs :names
          :undo :reset :help :quit`

if (values.help) {
  console.log(usage)
  process.exit(0)
}

const settings = {
  format: values.format ?? (process.stdout.isTTY ? 'ansi' : 'text'),
  scheme: values.scheme ?? 'color',
  width: Number(values.width ?? process.stdout.columns ?? 40)
}

if (!['ansi', 'text'].includes(settings.format))
  throw new Error(`Unknown format: ${settings.format}`)
if (!schemeNames.includes(settings.scheme))
  throw new Error(`Unknown scheme: ${settings.scheme}`)
if (!(settings.width > 0)) throw new Error(`Invalid width: ${values.width}`)

let session
let pending = ''

const submit = source => {
  const entry = { source, form: parse(source) }
  const entries = [...session?.entries ?? [], entry]
  const ast = entries.map(({ form }) => form)
  const tree = ast.length === 1 ? ast[0] : ast
  const pairs = decompose(tree)
  const linked = link(pairs)

  session = {
    ...linked,
    ast,
    entries,
    pairs,
    previous: session
  }
}

const print = graph => graph && console.log(serialize(graph, {
  ...settings,
  context: session.graph,
  legend: session.legend
}))

const names = (graph, found = [], seen = new Set()) => {
  if (!Array.isArray(graph) || seen.has(graph)) return found
  seen.add(graph)

  const name = session.legend.get(graph)?.name
  if (name) found.push(name)
  graph.forEach(node => names(node, found, seen))

  return found
}

const load = file => {
  submit(readFileSync(file, 'utf8'))
  print(session.graph)
}

const command = line => {
  const [name] = line.trim().split(/\s+/, 1)
  const value = line.trim().slice(name.length).trim()

  if (name === ':load' && value) load(value)
  else if (name === ':load') console.error('Missing file')
  else if (name === ':graph') print(session?.graph)
  else if (name === ':source')
    console.log(session?.entries.map(entry => entry.source).join('\n') ?? '')
  else if (name === ':ast') console.dir(session?.ast, { depth: null })
  else if (name === ':pairs') console.dir(session?.pairs, { depth: null })
  else if (name === ':names') console.log(session ? names(session.graph).join(' ') : '')
  else if (name === ':undo') {
    session = session?.previous
    print(session?.graph)
  }
  else if (name === ':reset') session = undefined
  else if (name === ':help') console.log(usage)
  else if (name === ':quit') input.close()
  else console.error(`Unknown command: ${line}`)
}

const input = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

input.on('line', line => {
  if (!pending && !line.trim()) input.prompt()
  else if (!pending && line.trim().startsWith(':')) {
    try {
      command(line)
    } catch (error) {
      console.error(error.message)
    }
    if (!input.closed) input.prompt()
  }
  else {
    pending = pending ? `${pending}\n${line}` : line

    try {
      submit(pending)
      pending = ''
      print(session.graph)
    } catch (error) {
      const message = String(error.message)
      if (!message.startsWith('Missing )')
          && !message.startsWith('Missing "')) {
        console.error(message)
        pending = ''
      }
    }

    input.setPrompt(pending ? '.. ' : '> ')
    input.prompt()
  }
})

input.on('close', () => process.stdout.write('\n'))

try {
  positionals.forEach(load)
} catch (error) {
  console.error(error.message)
}

input.prompt()
