import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import config from './config.lisp.js'
import {
  replState,
  replStep,
  sourceComplete
} from './repl.js'

describe.skip('passive Lisp REPL', () => {
  test('sourceComplete waits for balanced input', () => {
    assert.equal(sourceComplete('(define (I x)'), false)
    assert.equal(sourceComplete('(define (I x) x)'), true)
  })

  test('replStep keeps definitions in the returned state', () => {
    let state = replState({ kernel: false })
    const [nextState] = replStep(state, '(define (K a b) a)')
    state = nextState
    const [, output] = replStep(state, '(K x y)')

    assert.equal(output, 'x')
  })

  test('config trace records each walk argument', () => {
    const previousTrace = config.trace
    config.trace = true

    try {
      const state = replState({ kernel: false })
      const [, output, trace] = replStep(
        state,
        '(define (K a b) a) (K x y)'
      )

      assert.equal(output, 'x')
      assert.deepEqual(trace, [
        '(($ x) (x y))',
        '(($ (x y)) x)'
      ])
    } finally {
      config.trace = previousTrace
    }
  })

  test('batch CLI evaluates source from stdin', () => {
    const repl = fileURLToPath(new URL('./repl.cli.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [repl, '--empty'], {
      encoding: 'utf8',
      input: `
        (define (S a b c) ((a c) (b c)))
        (S x y z)
      `
    })

    assert.equal(result.status, 0)
    assert.equal(result.stderr, '')
    assert.equal(result.stdout.trim(), '((x z) (y z))')
  })

  test('batch CLI can print a walk trace', () => {
    const repl = fileURLToPath(new URL('./repl.cli.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [repl, '--empty', '--trace'], {
      encoding: 'utf8',
      input: `
        (define (K a b) a)
        (K x y)
      `
    })

    assert.equal(result.status, 0)
    assert.equal(result.stderr, '')
    assert.deepEqual(result.stdout.trim().split('\n'),
                     ['walk (($ x) (x y))', 'walk (($ (x y)) x)', 'x'])
  })
})
