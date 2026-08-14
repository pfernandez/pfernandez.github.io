export const relay = ({ bytes, focus }, dispatch) => {
  const worker = new globalThis.Worker(new URL('./worker.js', import.meta.url),
                                       { type: 'module' })

  worker.onmessage = ({ data }) => dispatch(data)
  worker.postMessage({ bytes, focus })
  return worker
}
