export default {
  trace: (focus, name, result = '') => {
    const _trace = (arr, path = '$', seen = new Map()) => {
      if (!Array.isArray(arr)) return arr
      if (seen.has(arr)) return `${seen.get(arr)}`
      seen.set(arr, path)
      return arr.map((item, index) => _trace(item, `${path}[${index}]`, seen))
    }
    console.log(
      name ? name + ' : ' : '........................',
      JSON.stringify(_trace(focus)),
      result ? '\n  -> ' : '',
      result ? JSON.stringify(_trace(result)) : '',
      '\n')
  }
}
