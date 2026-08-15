import { view } from './device.js'
import lisp from './app.lisp?raw'

const app = view(lisp)

console.log({ app })

export default app
