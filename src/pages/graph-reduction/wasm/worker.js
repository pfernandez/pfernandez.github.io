const { WebAssembly } = globalThis
const worker = globalThis
const machine = fetch(new URL('./runner.wasm', import.meta.url))
  .then(response => response.arrayBuffer())
  .then(WebAssembly.compile)

worker.onmessage = async ({ data: { bytes, focus } }) => {
  const pages = Math.max(1, Math.ceil(bytes.length / 65536))
  const memory = new WebAssembly.Memory({ initial: pages })
  const graph = new Uint8Array(memory.buffer, 0, bytes.length)
  graph.set(bytes)

  const instance = await WebAssembly.instantiate(await machine, {
    host: {
      memory,
      dispatch: address => worker.postMessage(address)
    }
  })

  instance.exports.run(focus)
}
