import './style.css'
import { onNavigate, render } from '@pfern/elements'
import root from './pages/graph-reduction/root.js'

const start = () => render(root())

onNavigate(start)
start()
