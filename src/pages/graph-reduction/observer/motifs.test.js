import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

const fixedRoot = () => {
  const root = []
  root[0] = root
  root[1] = root

  return root
}

const I = fixedRoot()

describe('motifs', () => {
  const observation = (observer, focus) =>
    [observer, focus]

  const identity = (observer, next = observer, createPair) =>
    createPair ? createPair(observer, next) : [observer, next]

  describe('slot rewrites', () => {
    test('a collapse slot can be rewritten from context', () => {
      const left = [I, I]
      const right = [I, I]
      const form = [[I, left], right]
      const oldValue = form[0][1]

      form[0][0] = I
      form[0][1] = form[1]

      assert.equal(oldValue, left)
      assert.equal(form[0][1], right)
      assert.equal(observe(observation(I, form)), right)
    })

    test('a pair can be assembled from carried slots', () => {
      const left = [I, I]
      const right = [I, I]
      const result = [I, I]
      const form = [[[I, result], left], right]

      result[0] = form[0][1]
      result[1] = form[1]

      assert.equal(observe(observation(I, form)), result)
      assert.deepEqual(result, [left, right])
      assert.equal(result[0], left)
      assert.equal(result[1], right)
    })
  })


  describe('passive basis', () => {
    test('application is ordinary pair structure', () => {
      const operator = [I, I]
      const operand = [I, I]
      const application = [operator, operand]

      assert.equal(application[0], operator)
      assert.equal(application[1], operand)
    })

    test('I returns its argument by wiring an identity debt', () => {
      const root = [I, I]
      const IForm = [I, I]
      const argument = [I, I]
      const form = [IForm, argument]
      const result = identity(root, form[1])

      root[0] = result

      assert.equal(observe(observation(root, root)), argument)
      assert.equal(result[0], root)
      assert.equal(result[1], argument)
      assert.equal(form[1], argument)
    })

    test('K keeps the first argument from nested application structure', () => {
      const root = [I, I]
      const KForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const form = [[KForm, first], second]
      const result = identity(root, form[0][1])

      root[0] = result

      assert.equal(observe(observation(root, root)), first)
      assert.equal(result[1], first)
      assert.equal(form[0][1], first)
      assert.equal(form[1], second)
      assert.notEqual(result[1], second)
    })

    test('S shares the final argument between both applications', () => {
      const root = [I, I]
      const SForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const argument = [I, I]
      const form = [[[SForm, first], second], argument]
      const result = [[form[0][0][1], form[1]], [form[0][1], form[1]]]
      root[0] = identity(root, result)

      assert.equal(observe(observation(root, root)), result)
      assert.deepEqual(result, [[first, argument], [second, argument]])
      assert.equal(result[0][0], first)
      assert.equal(result[1][0], second)
      assert.equal(result[0][1], argument)
      assert.equal(result[1][1], argument)
      assert.equal(result[0][1], result[1][1])
    })

    test('B composes two applications', () => {
      const root = [I, I]
      const BForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const argument = [I, I]
      const form = [[[BForm, first], second], argument]
      const result = [form[0][0][1], [form[0][1], form[1]]]
      root[0] = identity(root, result)

      assert.equal(observe(observation(root, root)), result)
      assert.equal(result[0], first)
      assert.equal(result[1][0], second)
      assert.equal(result[1][1], argument)
    })

    test('C swaps the final two arguments', () => {
      const root = [I, I]
      const CForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const argument = [I, I]
      const form = [[[CForm, first], second], argument]
      const result = [[form[0][0][1], form[1]], form[0][1]]
      root[0] = identity(root, result)

      assert.equal(observe(observation(root, root)), result)
      assert.equal(result[0][0], first)
      assert.equal(result[0][1], argument)
      assert.equal(result[1], second)
    })

    test('W shares one argument in both slots', () => {
      const root = [I, I]
      const WForm = [I, I]
      const first = [I, I]
      const argument = [I, I]
      const form = [[WForm, first], argument]
      const result = [[form[0][1], form[1]], form[1]]
      root[0] = identity(root, result)

      assert.equal(observe(observation(root, root)), result)
      assert.equal(result[0][0], first)
      assert.equal(result[0][1], argument)
      assert.equal(result[1], argument)
      assert.equal(result[0][1], result[1])
    })

    test('true chooses the first branch', () => {
      const root = [I, I]
      const trueForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const form = [[trueForm, first], second]
      const result = identity(root, form[0][1])

      root[0] = result

      assert.equal(observe(observation(root, root)), first)
      assert.equal(result[1], first)
      assert.notEqual(result[1], second)
    })

    test('false chooses the second branch', () => {
      const root = [I, I]
      const falseForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const form = [[falseForm, first], second]
      const result = identity(root, form[1])

      root[0] = result

      assert.equal(observe(observation(root, root)), second)
      assert.equal(result[1], second)
      assert.notEqual(result[1], first)
    })

    test('not builds a choice with branches reversed', () => {
      const root = [I, I]
      const notForm = [I, I]
      const bool = [I, I]
      const trueBranch = [I, I]
      const falseBranch = [I, I]
      const form = [notForm, bool]
      const result = [[form[1], falseBranch], trueBranch]
      root[0] = identity(root, result)

      assert.equal(observe(observation(root, root)), result)
      assert.equal(result[0][0], bool)
      assert.equal(result[0][1], falseBranch)
      assert.equal(result[1], trueBranch)
    })

    test('and builds a choice with false as fallback', () => {
      const root = [I, I]
      const andForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const falseBranch = [I, I]
      const form = [[andForm, first], second]
      const result = [[form[0][1], form[1]], falseBranch]
      root[0] = identity(root, result)

      assert.equal(observe(observation(root, root)), result)
      assert.equal(result[0][0], first)
      assert.equal(result[0][1], second)
      assert.equal(result[1], falseBranch)
    })

    test('or builds a choice with true as fallback', () => {
      const root = [I, I]
      const orForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const trueBranch = [I, I]
      const form = [[orForm, first], second]
      const result = [[form[0][1], trueBranch], form[1]]
      root[0] = identity(root, result)

      assert.equal(observe(observation(root, root)), result)
      assert.equal(result[0][0], first)
      assert.equal(result[0][1], trueBranch)
      assert.equal(result[1], second)
    })

    test('first selector returns the first pair slot', () => {
      const root = [I, I]
      const firstForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const subject = [first, second]
      const form = [firstForm, subject]
      const result = identity(root, form[1][0])

      root[0] = result

      assert.equal(observe(observation(root, root)), first)
      assert.equal(result[1], first)
      assert.equal(form[1], subject)
    })

    test('second selector returns the second pair slot', () => {
      const root = [I, I]
      const secondForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const subject = [first, second]
      const form = [secondForm, subject]
      const result = identity(root, form[1][1])

      root[0] = result

      assert.equal(observe(observation(root, root)), second)
      assert.equal(result[1], second)
      assert.equal(form[1], subject)
    })
  })


  describe('active wiring', () => {
    test('I wires a root to the application argument', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return [first, next]
      }
      const root = countedPair()
      const IForm = countedPair()
      const argument = countedPair()
      const form = countedPair(IForm, argument)
      const built = allocations
      const result = countedPair(root, form[1])
      root[0] = result

      assert.equal(allocations, built + 1)
      assert.equal(root[0], result)
      assert.equal(result[0], root)
      assert.equal(result[1], argument)
      assert.equal(form[1], argument)
      assert.equal(observe(observation(root, root)), argument)
    })

    test('the same I form can be used under different roots', () => {
      const firstRoot = [I, I]
      const secondRoot = [I, I]
      const IForm = [I, I]
      const argument = [I, I]
      const form = [IForm, argument]
      const firstResult = [firstRoot, form[1]]
      const secondResult = [secondRoot, form[1]]

      firstRoot[0] = firstResult
      secondRoot[0] = secondResult

      assert.notEqual(firstResult, secondResult)
      assert.equal(firstResult[0], firstRoot)
      assert.equal(secondResult[0], secondRoot)
      assert.equal(firstResult[1], secondResult[1])
      assert.equal(observe(observation(firstRoot, firstRoot)), argument)
      assert.equal(observe(observation(secondRoot, secondRoot)), argument)
    })

    test('K wires a root to the first argument', () => {
      const root = [I, I]
      const KForm = [I, I]
      const first = [I, I]
      const second = [I, I]
      const form = [[KForm, first], second]
      const result = [root, form[0][1]]
      root[0] = result

      assert.equal(root[0], result)
      assert.equal(result[0], root)
      assert.equal(result[1], first)
      assert.equal(form[0][1], first)
      assert.equal(form[1], second)
      assert.equal(observe(observation(root, root)), first)
    })

    test('S wires a root to a shared application result', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return [first, next]
      }
      const root = countedPair()
      const SForm = countedPair()
      const first = countedPair()
      const second = countedPair()
      const argument = countedPair()
      const form = countedPair(
        countedPair(countedPair(SForm, first), second),
        argument
      )
      const built = allocations
      const leftApplication = countedPair(form[0][0][1], form[1])
      const rightApplication = countedPair(form[0][1], form[1])
      const shared = countedPair(leftApplication, rightApplication)
      const result = countedPair(root, shared)
      root[0] = result

      assert.equal(allocations, built + 4)
      assert.equal(root[0], result)
      assert.equal(result[0], root)
      assert.equal(observe(observation(root, root)), shared)
      assert.equal(shared[0][0], first)
      assert.equal(shared[1][0], second)
      assert.equal(shared[0][1], argument)
      assert.equal(shared[1][1], argument)
      assert.equal(shared[0][1], shared[1][1])
    })
  })


  describe('sharing', () => {
    test('a shared application pair can replace the collapsed value', () => {
      const x = [I, I]
      const y = [I, I]
      const z = [I, I]
      const form = [[[I, x], y], z]
      const oldValue = form[0][0][1]
      const result = [[form[0][0][1], form[1]], [form[0][1], form[1]]]

      form[0][0][0] = I
      form[0][0][1] = result

      assert.equal(oldValue, x)
      assert.equal(form[0][0][1], result)
      assert.deepEqual(observe(observation(I, form)), [[x, z], [y, z]])
      assert.equal(result[0][0], oldValue)
      assert.equal(result[0][1], z)
      assert.equal(result[1][0], y)
      assert.equal(result[1][1], z)
      assert.equal(result[0][1], result[1][1])
    })

    test('a shared application pair can also sit behind a left wrapper', () => {
      const x = [I, I]
      const y = [I, I]
      const z = [I, I]
      const form = [[[I, x], y], z]
      const oldValue = form[0][0][1]
      const result = [[form[0][0][1], form[1]], [form[0][1], form[1]]]

      form[0][0][0] = [I, result]

      assert.equal(form[0][0][1], oldValue)
      assert.equal(observe(observation(I, form)), result)
      assert.deepEqual(result, [[x, z], [y, z]])
      assert.equal(result[0][1], result[1][1])
    })

    test('shared value stays shared after another observation', () => {
      const x = [I, I]
      const y = [I, I]
      const z = [I, I]
      const result = [[x, z], [y, z]]
      const next = [I, result]

      assert.equal(observe(observation(I, next)), result)
      assert.equal(result[0][1], result[1][1])
    })

    test('result can carry a root forward', () => {
      const root = [I, I]
      const a = [I, I]
      const b = [I, I]
      const form = [[[I, a], b], root]
      const result = [[a, root], [b, root]]
      form[0][0][1] = result
      root[0] = I
      root[1] = form

      assert.deepEqual(observe(observation(I, form)), [[a, root], [b, root]])
      assert.equal(result[0][1], root)
      assert.equal(result[1][1], root)
      assert.equal(result[0][1], result[1][1])
      assert.equal(observe(observation(I, root)), form)
    })
  })


  describe('selectors', () => {
    test('left and right are collapse reads of pair slots', () => {
      const left = [I, I]
      const right = [I, I]
      const subject = [left, right]

      assert.equal(observe(observation(I, [I, subject[0]])), left)
      assert.equal(observe(observation(I, [I, subject[1]])), right)
    })
  })


  describe('depth', () => {
    test('succ', () => {
      const root = [I, I]
      root[0] = I
      root[1] = [I, root]

      const one = observe(observation(I, root))
      const two = observe(observation(I, one))
      const three = observe(observation(I, two))

      assert.deepEqual(one, [I, root])
      assert.deepEqual(two, [I, [I, root]])
      assert.deepEqual(three, [I, [I, [I, root]]])
    })

    test('depths share one fixed point', () => {
      const root = [I, I]
      root[0] = I
      root[1] = [I, root]

      const one = observe(observation(I, root))
      const two = observe(observation(I, one))
      const three = observe(observation(I, two))

      assert.equal(two, root)
      assert.equal(three, one)
      assert.deepEqual(one, two)
      assert.deepEqual(two, three)
    })

    test('finite depths keep distinct identity', () => {
      const zero = I
      const one = [I, zero]
      const two = [I, one]
      const three = [I, two]

      assert.notEqual(zero, one)
      assert.notEqual(one, two)
      assert.notEqual(two, three)
      assert.equal(observe(observation(I, one)), zero)
      assert.equal(observe(observation(I, two)), one)
      assert.equal(observe(observation(I, three)), two)
    })
  })


  describe('active selection as data', () => {
    test('a carried selection can become the root wrapper it describes', () => {
      const root = [I, I]
      const future = [I, I]
      const selection = [root, future]

      root[0] = I
      root[1] = selection

      assert.equal(observe(observation(I, root)), selection)
      assert.equal(selection[0], root)
      assert.equal(selection[1], future)

      selection[0][0] = selection

      assert.equal(root[0], selection)
      assert.equal(observe(observation(root, root)), future)
    })
  })

})
