import './style.css'
import { elements, render } from '@pfern/elements'
import source from './experiments/link/dashboard.lisp?raw'
import { link } from './experiments/link/link.js'
import { project } from './experiments/link/project.js'
import { decompose } from './graph/decompose.js'
import { parse } from './graph/parse.js'

project(link(decompose(parse(source)), { render, ...elements }))
