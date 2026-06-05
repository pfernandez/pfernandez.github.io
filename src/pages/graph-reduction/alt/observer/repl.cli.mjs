import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { config } from './config.lisp.js'
import {
  replState,
  replStep,
  sourceComplete,
} from './repl.js'

const commands = new Set(['.exit', '.quit'])

const runSource = (state, source, write, options) => {
  if (!source.trim()) return state

  const [nextState, output, trace] = replStep(state, source, options)
  trace.forEach(entry => write(`walk ${entry}\n`))
  write(`${output}\n`)

  return nextState
}

const readStdin = async () => {
  process.stdin.setEncoding('utf8')
  let source = ''
  for await (const chunk of process.stdin) {
    source += chunk
  }

  return source
}

const runBatch = async ({ kernel, path, trace, write }) => {
  const source = path
    ? await readFile(path, 'utf8')
    : await readStdin()

  runSource(replState({ kernel }), source, write, { trace })
}

const runInteractive = async ({ kernel, trace, write }) => {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  let state = replState({ kernel })
  let pending = ''

  write('graph> ')
  for await (const line of input) {
    const source = pending ? `${pending}\n${line}` : line
    const trimmed = source.trim()

    if (commands.has(trimmed)) break

    if (!sourceComplete(source)) {
      pending = source
      write('.....> ')
      continue
    }

    pending = ''
    try {
      state = runSource(state, source, write, { trace })
    } catch (error) {
      write(`${error.message}\n`)
    }
    write('graph> ')
  }

  input.close()
}

const optionsFrom = args => ({
  kernel: !args.includes('--empty'),
  path: args.find(arg => !arg.startsWith('-')),
  trace: args.includes('--trace') || config.trace,
})

/**
 * Runs the graph-reduction Lisp CLI.
 *
 * With a TTY, this starts an interactive prompt. With piped stdin or a file
 * path argument, it evaluates the whole source as one entry and prints one
 * serialized result.
 *
 * @param {string[]} [args]
 * @param {(text: string) => void} [write]
 * @returns {Promise<void>}
 */
export const main = async (
  args = process.argv.slice(2),
  write = text => process.stdout.write(text)
) => {
  const options = optionsFrom(args)

  if (options.path || !process.stdin.isTTY) {
    await runBatch({ ...options, write })
    return
  }

  await runInteractive({ ...options, write })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exitCode = 1
  })
}
