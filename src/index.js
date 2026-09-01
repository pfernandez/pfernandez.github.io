import './style.css'
import { program } from './device/files.js'
import { capabilities, project } from './device/index.js'
import { link } from './graph/index.js'

const graph = link(program(), capabilities())

if (graph.error) throw graph.error

project(graph)
