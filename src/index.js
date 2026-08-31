import './style.css'
import { capabilities, program, project } from './device/index.js'
import { link } from './graph/index.js'

const graph = link(program(), capabilities())

if (graph.error) throw graph.error

project(graph)
