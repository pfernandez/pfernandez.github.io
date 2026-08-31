import { dom } from './dom.js'
import { graph } from './graph.js'
import { activeRoute, currentRoute } from './navigation.js'
import { text } from './text.js'

export { program } from './files.js'
export { project } from './project.js'

export const capabilities = (route = currentRoute()) => ({
  ...dom,
  ...graph,
  text,
  route: activeRoute(route)
})
