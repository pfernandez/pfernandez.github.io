import { dom } from './dom.js'
import { graph } from './graph.js'
import { text } from './text.js'

export { project } from './project.js'

export const capabilities = () => ({
  ...dom,
  ...graph,
  text
})
