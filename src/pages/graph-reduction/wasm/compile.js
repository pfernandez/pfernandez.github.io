import { readFileSync, writeFileSync } from 'node:fs'
import wabtFactory from 'wabt'

const features = { tail_call: true }

export const compile = async (source, filename = 'runner.wat') => {
  const wabt = await wabtFactory()
  const module = wabt.parseWat(filename, source, features)

  try {
    module.resolveNames()
    module.validate()
    return Uint8Array.from(module.toBinary({
      canonicalize_lebs: true,
      write_debug_names: false
    }).buffer)
  } finally {
    module.destroy()
  }
}

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const source = new URL('./runner.wat', import.meta.url)
  const output = new URL('./runner.wasm', import.meta.url)
  const bytes = await compile(readFileSync(source, 'utf8'), source.pathname)

  writeFileSync(output, bytes)
  console.log(output.pathname, '—', bytes.length, 'bytes')
}
