import { compose } from './compose.js'
import { connect } from './connect.js'
import { decompose } from './decompose.js'
import { finalize } from './finalize.js'
import { parse } from './parse.js'

/**
 * Compile authored source through independently inspectable graph layers.
 *
 * Parsing retains authored sequences, decomposition lowers them to pairs,
 * connection replaces spellings with lexical identities, composition builds
 * application results, and finalization closes and freezes the graph.
 */
export const link = (program, imports = {}) => {
  let source

  try {
    source = typeof program === 'string' ? program : program.source
    const ast = typeof program === 'string' ? parse(source) : program.ast
    const pairs = decompose(ast)
    const connected = connect(pairs, imports)
    const composed = compose(connected)
    const finalized = finalize(composed)

    return {
      source,
      ast,
      pairs,
      connected: connected.graph,
      graph: finalized.graph,
      focus: finalized.focus,
      result: finalized.result,
      legend: finalized.legend
    }
  } catch (error) {
    const graph = []
    return {
      source,
      graph,
      focus: graph,
      result: undefined,
      legend: new Map(),
      error
    }
  }
}
