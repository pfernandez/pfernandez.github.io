export const I = 0

const I32 = 0x7f
const FUNCTION = 0x60

const u32 = value => {
  const bytes = []
  let current = value

  do {
    const byte = current & 0x7f
    current >>>= 7
    bytes.push(current ? byte | 0x80 : byte)
  } while (current)

  return bytes
}

const text = value => [
  ...u32(value.length),
  ...[...value].map(character => character.charCodeAt(0))
]

const vector = items => [
  ...u32(items.length),
  ...items.flat()
]

const section = (id, data) => [
  id,
  ...u32(data.length),
  ...data
]

const functionType = (params, results = [I32]) => [
  FUNCTION,
  ...vector(params),
  ...vector(results)
]

const localGet = index => [0x20, ...u32(index)]
const localSet = index => [0x21, ...u32(index)]
const localTee = index => [0x22, ...u32(index)]
const globalGet = index => [0x23, ...u32(index)]
const globalSet = index => [0x24, ...u32(index)]
const call = index => [0x10, ...u32(index)]
const i32Const = value => [0x41, ...u32(value)]
const i32Load = offset => [0x28, ...u32(2), ...u32(offset)]
const i32Store = offset => [0x36, ...u32(2), ...u32(offset)]
const localDeclarations = declarations => vector(
  declarations.map(([count, type]) => [...u32(count), type])
)
const body = (locals, instructions) => {
  const bytes = [
    ...localDeclarations(locals),
    ...instructions,
    0x0b
  ]

  return [...u32(bytes.length), ...bytes]
}

const addressOf = pointerBytes => [
  ...pointerBytes,
  ...i32Const(3),
  0x74
]

const storeSlot = (pointerBytes, valueBytes, offset) => [
  ...addressOf(pointerBytes),
  ...valueBytes,
  ...i32Store(offset)
]

const loadSlot = (pointerBytes, offset) => [
  ...addressOf(pointerBytes),
  ...i32Load(offset)
]

const functions = [
  {
    name: 'alloc',
    type: 0,
    body: body([[1, I32]], [
      ...globalGet(0),
      ...localTee(2),
      ...i32Const(3),
      0x74,
      ...localGet(0),
      ...i32Store(0),
      ...globalGet(0),
      ...i32Const(3),
      0x74,
      ...localGet(1),
      ...i32Store(4),
      ...globalGet(0),
      ...i32Const(1),
      0x6a,
      ...globalSet(0),
      ...localGet(2)
    ])
  },
  {
    name: 'left',
    type: 1,
    body: body([], [
      ...localGet(0),
      0x45,
      0x04,
      I32,
      ...i32Const(0),
      0x05,
      ...loadSlot(localGet(0), 0),
      0x0b
    ])
  },
  {
    name: 'right',
    type: 1,
    body: body([], [
      ...localGet(0),
      0x45,
      0x04,
      I32,
      ...i32Const(0),
      0x05,
      ...loadSlot(localGet(0), 4),
      0x0b
    ])
  },
  {
    name: 'set_left',
    type: 0,
    body: body([], [
      ...storeSlot(localGet(0), localGet(1), 0),
      ...localGet(0)
    ])
  },
  {
    name: 'set_right',
    type: 0,
    body: body([], [
      ...storeSlot(localGet(0), localGet(1), 4),
      ...localGet(0)
    ])
  },
  {
    name: 'size',
    type: 2,
    body: body([], [
      ...globalGet(0),
      ...i32Const(1),
      0x6b
    ])
  },
  {
    name: 'observe',
    type: 1,
    body: body([[2, I32]], [
      ...localGet(0),
      ...localSet(1),
      0x02,
      0x40,
      0x03,
      0x40,
      ...localGet(1),
      0x45,
      0x0d,
      1,
      ...localGet(1),
      ...call(1),
      ...localTee(2),
      0x45,
      0x04,
      0x40,
      ...localGet(1),
      ...call(2),
      0x0f,
      0x0b,
      ...localGet(2),
      ...localSet(1),
      0x0c,
      0,
      0x0b,
      0x0b,
      ...i32Const(0)
    ])
  },
  {
    name: 'reset',
    type: 3,
    body: body([], [
      ...i32Const(1),
      ...globalSet(0)
    ])
  }
]

const types = [
  functionType([I32, I32]),
  functionType([I32]),
  functionType([]),
  functionType([], [])
]

const exportEntry = (name, kind, index) => [
  ...text(name),
  kind,
  ...u32(index)
]

const moduleBytes = () => new Uint8Array([
  0x00,
  0x61,
  0x73,
  0x6d,
  0x01,
  0x00,
  0x00,
  0x00,
  ...section(1, vector(types)),
  ...section(3, vector(functions.map(entry => u32(entry.type)))),
  ...section(5, vector([[0x00, ...u32(1)]])),
  ...section(6, vector([[
    I32,
    0x01,
    ...i32Const(1),
    0x0b
  ]])),
  ...section(7, vector([
    exportEntry('memory', 0x02, 0),
    ...functions.map((entry, index) => exportEntry(entry.name, 0x00, index))
  ])),
  ...section(10, vector(functions.map(entry => entry.body)))
])

export const wasmBytes = moduleBytes()

export const createWasmCore = async () => {
  const { instance } = await WebAssembly.instantiate(wasmBytes)
  const core = instance.exports

  return {
    I,
    memory: core.memory,
    alloc: core.alloc,
    left: core.left,
    right: core.right,
    setLeft: core.set_left,
    setRight: core.set_right,
    size: core.size,
    observe: core.observe,
    reset: core.reset
  }
}
