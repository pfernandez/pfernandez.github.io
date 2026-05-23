import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import {
  init,
  kernelSource,
  serialize,
  sourceStep,
} from './lisp.js'

const commands = new Set(['.exit', '.quit'])

const stripComments = source =>
  source.replace(/;.*$/gm, '')

/**
 * Returns true when source has balanced parentheses.
 *
 * The parser is still the authority for syntax. This helper only lets the
 * interactive prompt know whether to keep collecting lines.
 *
 * @param {string} source
 * @returns {boolean}
 */
export const sourceComplete = source => {
  let depth = 0
  for (const char of stripComments(source)) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (depth < 0) return true
  }

  return depth === 0
}

/**
 * Creates the initial state for the CLI REPL.
 *
 * The REPL starts with the source kernel loaded by default so common basis
 * names are available immediately. Pass `{ kernel: false }` for an empty
 * source state.
 *
 * @param {{ kernel?: boolean }} [options]
 * @returns {import('./lisp.js').CompilerState}
 */
export const replState = (options = {}) => {
  if (options.kernel === false) return init()

  return sourceStep(init(), kernelSource)[0]
}

/**
 * Runs one REPL source entry and returns the next state plus printable text.
 *
 * Definitions update the returned state. The final expression, when present,
 * is compiled, observed once, and serialized.
 *
 * @param {import('./lisp.js').CompilerState} state
 * @param {string} source
 * @returns {[import('./lisp.js').CompilerState, string]}
 */
export const replStep = (state, source) => {
  const [nextState, graph] = sourceStep(state, source)

  return [nextState, serialize(nextState, graph)]
}

const runSource = (state, source, write) => {
  if (!source.trim()) return state

  const [nextState, output] = replStep(state, source)
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

const runBatch = async ({ kernel, path, write }) => {
  const source = path
    ? await readFile(path, 'utf8')
    : await readStdin()

  runSource(replState({ kernel }), source, write)
}

const runInteractive = async ({ kernel, write }) => {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  let state = replState({ kernel })
  let pending = ''

  write('passive> ')
  for await (const line of input) {
    const source = pending ? `${pending}\n${line}` : line
    const trimmed = source.trim()

    if (commands.has(trimmed)) break

    if (!sourceComplete(source)) {
      pending = source
      write('......> ')
      continue
    }

    pending = ''
    try {
      state = runSource(state, source, write)
    } catch (error) {
      write(`${error.message}\n`)
    }
    write('passive> ')
  }

  input.close()
}

const optionsFrom = args => ({
  kernel: !args.includes('--empty'),
  path: args.find(arg => !arg.startsWith('-')),
})

/**
 * Runs the passive Lisp CLI.
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
