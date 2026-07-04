export const observe = (pair, trace) =>
  (trace?.(pair),
  pair[0] === pair ? pair[1] : observe(pair[0], trace))

// Observation could normalize recursively, but that hides steps and divergence;
// it could copy here, but then observation creates structure; or it could
// follow a prebuilt history, which needs more structure. Link currently builds
// answers, so observe only follows the left edge to a self-left pair and
// returns its right.  This keeps observation logic-free and makes partial calls
// return themselves.
