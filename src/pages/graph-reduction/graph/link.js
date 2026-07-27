Error.stackTraceLimit = 1

import { parse } from './parse.js'
import { log } from './serialize.js'

const isSymbol = node => typeof node === 'string'

const _link = (
  focus,
  context = { index: 0, parent: null, branch: focus, stack: [] }
) => {
  const { index, branch, stack, parent } = context
  let scope = branch

  if (isSymbol(focus)) {
    const ref = stack.find(entry => entry?.[0] === focus)?.[1]

    if (ref) {
      parent[index] = ref
    } else if (index === 0) {
      scope = parent
      stack.push(scope)
    } else {
      const atom = []
      parent[index] = atom[0] = atom[1] = atom
      scope.push([focus, atom])
    }
  }

  // log({ focus, index, scope, stack, parent })
  log({ focus, parent, stack })

  Array.isArray(focus) && focus.forEach((child, i) =>
    _link(child, {
      index: i, parent: focus, branch: i === 0 ? child : scope, stack
    }))

  return focus
}

export const link = source => {
  try {
    const tree = parse(source)
    const graph = _link(tree)
    log({ graph })
    return { graph, legend: [] }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}


/**
[
  [ 'K', [ [ <ref *1> [ [Circular *1], [Circular *1] ],
             <ref *2> [ [Circular *2], [Circular *2] ] ],
           <ref *1> [ [Circular *1], [Circular *1] ] ]
    [ 'x', <ref *1> [ [Circular *1], [Circular *1] ] ],
    [ 'y', <ref *2> [ [Circular *2], [Circular *2] ] ]
  ],
]

The overall shape of what I'd envisioned: A Dyck lattice we recurse through,
with the height as the stack depth and the zero point the current scope
boundary. The zero point of this Dyck stack moves along with the
lefmost-outermost recursion through the tree as we replace symbols with
identities; like to like, free variables remain atoms, and anything above the
scope is unreachable for the current branch. The first element is its own
enclosing pair, and thus remains in the parent scope of the spine.  The result
is like a crystal lattice of wirrors, or wormholes, arranged such that whatever
pairs with the crystal will undergo a deterministic transformation.

I wanted to know whether it was possible to use cycles within the structure to
project a Turing-complete language into an internal observer carried along in a
loop fixed to the graph; something like a chain and sprocket. It turns out,
almost, but we concluded that without growth the best you can do is cycle. I
still wonder whether a cycle would do the job, though. I mean, my laptop doesn't
get bigger the more that I use it. Maybe that's what a block universe is.
Regardless, the lattice can expand and/or make new associations (linkages)
immutably through structural sharing, and garbage collection is simply
unreachability.

My version also used `forEach` to walk through children to further emphasize
pair-locality, and because I suspect we don't actually need to curry everything
into pairs; that sequence is what matters. (Pairs are what you see when you look
at any point, and what `link` loops over.) With `forEach`, you're either looking
at the head or you're not, but have no concept of left vs. right.

I backtracked because I was getting discouraged with the progress on that
branch, and `main` had a more complete Lisp and was arguably more readable. What
we've shown here is invaluable, and you were aboslutely right to not want to
throw away the one with the essay by Fable 5 about the program that already
existed. It's very compelling. But the code is not elegant. Elegance matters
here because we must learn from the lattice itself to get the whole system to be
what it is, an unfolding revalation.

I don't think we need to include the "all parentheses" contract between the
syntax and linking layers that I added in
07c6beadeab364f99e42fbde5c6db7d9f319fddc, and we should discuss what the actual
source syntax should be. I'm considering a sort of purified Scheme that omits
`define` and maybe `let`. Scott encodings might be necessary in the core but
they're not very friendly. I actually wonder whether we can stop referencing the
work of others in this area and just grow by wrapping. All these extra arguments
feel imposed.

Along the same lines, in the other branch we did away with a definition wrapper:
The stack tracks `I: [x, x]`, not `I: [[I x] x]`, simplifying the lattice. The
serializer can pull the original back out of the legend. I also want to remove
all the added self-references from the compiler entirely and make it dumb. The
source Lisp should fully express the graph. () means self.

For the observer, I'm not sure we want to go as far as to make it a pure stepper
as we did in the final commit on that branch,
6c10fe7f9e3d7bb58a1d71bf503192cef5cac65e.  Maybe. We should definitely review
the other changes up to that point so that we don't miss any improvements,
though. One possibility is that we jump over to that branch, revert to b5bac38
and cherry-pick anything we like from later commits. Then we'd need to decide
about our current branch and main.

We could merge our current branch into main first, but I'd want a clean
separation between the syntax and graph layers, with only a single export from
syntax.js so we can write something similar to the `graph = link(tree)` concept.
Or we could pull the best parts of 'Simplfy compiler' into it and reoncile the
tests. Or the other way around.
*/
