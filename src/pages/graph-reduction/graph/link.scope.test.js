import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link } from './index.js'

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

test('shares S identities between its parameters, body, and use', () => {
  const { graph } = linked(`
  ((S (x y z) ((x z) (y z)))
   (S (a b c)))
  `)

  const definition = graph[0]
  const focus = graph[1]
  const parameters = definition[0]
  const body = definition[1]

  assert.equal(definition['symbol'], 'S')
  assert.equal(body[0][0], parameters)
  assert.equal(body[0][1], parameters[1])
  assert.equal(body[1][0], parameters[0])
  assert.equal(body[1][1], parameters[1])

  const c = focus[0][1]
  assert.equal(c[0], c)
  assert.equal(c[1], c)
})

test('does not reinterpret a branch when its enclosing pair is named', () => {
  const unnamed = linked('((I x x) (K (x y) x))').graph
  const named = linked('(Root (I x x) (K (x y) x))').graph

  assert.equal(named['symbol'], 'Root')
  assert.equal(unnamed[0][0], unnamed[0][1])
  assert.equal(named[0][0], named[0][1])
})

test('cascades a new identity through following occurrences', () => {
  const { focus, result } = linked(`
  ((same (pair x x) x)
   (same (value a a)))
  `)
  const args = focus[0]

  assert.equal(args[0], args[1])
  assert.equal(result, args[0])
})

test('does not bind one repeated identity to distinct arguments', () => {
  const { graph, result } = linked(`
  ((same (pair x x) x)
   (a a)
   (b b)
   (same (value a b)))
  `)
  const application = graph[1][1][1]
  const args = application[1]

  assert.notEqual(args[0], args[1])
  assert.equal(result, undefined)
})

test('shares Y identities with its recursive body', () => {
  const { graph } = linked(`
  ((Y f (f (Y f)))
   (Y a))
  `)

  const definition = graph[0]
  const f = definition[0]
  const body = definition[1]

  assert.equal(definition['symbol'], 'Y')
  assert.equal(body[0], f)
  assert.equal(body[1][0], definition)
  assert.equal(body[1][1], f)
})

test('does not resolve a symbol to a later definition', () => {
  const { graph } = linked(`
  ((F x G)
   (G y y))
  `)

  const F = graph[0]
  const G = graph[1]

  assert.equal(F[1]['symbol'], 'G')
  assert.equal(F[1][0], F[1])
  assert.equal(F[1][1], F[1])
  assert.notEqual(F[1], G)
})

test('does not expose a sibling definition\'s parameters', () => {
  const { graph } = linked(`
  ((F x
      ((G (y) y)
       (H z y))))
  `)

  const F = graph
  const sequence = F[1]
  const G = sequence[0]
  const H = sequence[1]

  assert.equal(H[1]['symbol'], 'y')
  assert.equal(H[1][0], H[1])
  assert.equal(H[1][1], H[1])
  assert.notEqual(H[1], G[0])
})

test('introduces a bare parameter before resolving an outer identity', () => {
  const { graph } = linked(`
  ((F x
      ((G x x)
       x)))
  `)

  const F = graph
  const outer = F[0]
  const sequence = F[1]
  const G = sequence[0]
  const following = sequence[1]

  assert.notEqual(G[0], outer)
  assert.equal(G[0][1], G[0])
  assert.equal(following, outer)
})

test('does not treat a parameter identity as a definition', () => {
  const { graph } = linked('((F (x y z) (x z)))')
  const F = graph
  const parameters = F[0]
  const body = F[1]

  assert.equal(body[0], parameters)
  assert.equal(body[1], parameters[1])
})

test('keeps a bare parameter separate from its definition', () => {
  const { graph, focus } = linked(`
  ((P x (x x))
   (P a))
  `)
  const P = graph[0]
  const x = P[0]
  const [args, result] = focus

  assert.notEqual(P, x)
  assert.equal(x[0], x)
  assert.equal(x[1], x)
  assert.notEqual(focus[0], P)
  assert.equal(result[0], args)
  assert.equal(result[1], args)
})

test('instantiates a local definition before applying it', () => {
  const { focus } = linked(`
  ((F x
      ((G y x)
       (G b)))
   (F a))
  `)
  const [args, result] = focus
  const [G, application] = result

  assert.equal(G['symbol'], 'G')
  assert.equal(G[1], args)
  assert.equal(application[0]['symbol'], 'b')
  assert.equal(application[1], args)
})

test('keeps a nested definition inside its parent body', () => {
  const { graph } = linked(`
  ((F x (G y x))
   (G z z))
  `)
  const nested = graph[0][1]
  const following = graph[1]

  assert.equal(nested['symbol'], 'G')
  assert.equal(following['symbol'], 'G')
  assert.notEqual(following, nested)
})

test('applies a visible definition inside an instantiated body', () => {
  const { focus } = linked(`
  ((I x x)
   (F x (I x))
   (F a))
  `)
  const [args, result] = focus

  assert.equal(result[0], args)
  assert.equal(result[1], args)
})
