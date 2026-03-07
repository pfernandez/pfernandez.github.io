/**
 * @module collapse
 *
 * Minimal collapse interpreter entrypoint. The core logic is exported here;
 * ancillary code for parsing, serializing, layout, and shared helpers can be
 * found in ./utils/.
 */

export { createGraph } from './graph'
export { applyCollapse, findNextCollapse } from './machine'

