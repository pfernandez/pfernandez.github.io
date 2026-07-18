const e=`# The Program That Already Happened

*Notes on a compiler that writes causality, and a machine that only remembers it.*

Here is the entire runtime of a programming language:

\`\`\`
while (mem[p] != p)
    p = mem[p]
return p
\`\`\`

Follow a pointer until it points at itself; report where you stopped. There is one more function, for afterward — \`mem[p + 4]\` — and there is no third. Compiled to WebAssembly, the two of them total thirty-nine bytes, and those bytes never change: not for a larger program, not for a recursive one, not for an infinite one.

This machine cannot add. It cannot branch, allocate, call, or run forever. It can only walk left until the road ends, then read what is lying there. And yet the files it runs contain identity and composition, booleans, pairs, arithmetic, lists, recursion, and infinite structures — all of which it evaluates correctly, in the sense that walking and reading produce exactly the answers the program means.

The trick is not in the machine. The trick is that by the time the machine starts, everything has already happened. Compilation here is not translation; it is execution. The compiler takes Lisp source and reduces it — completely, at compile time — into a graph of consequences. What ships is not a program in the usual sense. It is a record of a computation that already occurred, and the runtime is not an evaluator but a reader.

Which raises the question this essay circles: if all the computing happens before the program runs, what exactly is *running*? The system's answer, which I believe a little more each time I trace it: running is remembering, in order. Time is what observation does to a finished record.

## A world made of pairs

Everything in this system — every value, function, variable, and program — is a cell of two pointers. Eight bytes. There are no tags, no types, no headers, and at runtime no names. Whatever a cell is, it is by geometry: by where its two pointers aim.

The left pointer answers one question: *are you settled?* A cell whose left pointer aims at itself is done — a fact. A cell whose left pointer aims elsewhere is pending — a question deferring to something further left.

The right pointer answers a second question: *what kind of thing are you?* Here is the identity program, \`(I a)\`, as the machine receives it:

\`\`\`
addr   cell           reading
  0    (  8,  16)     the focus — pending
  8    (  8,  16)     the answer — settled, holding a payload
 16    ( 16,  16)     a — an atom, entirely itself
\`\`\`

Notice that addresses 0 and 8 hold identical contents. Settledness is not a property of what a cell contains; it is a relation between a field and the cell's own location. You cannot tell the question from its answer by reading them — only by asking each one where it lives. The atom takes this relation to its fixed point: a cell that is entirely its own address, a fact whose only property is its identity. The spelling \`a\` is not in the cell. It rides outside, in a legend stapled to the file — a custom section the machine has no instructions for reading. Names belong to our ledger, not to the world.

Five readings fall out of two pointers. Settled, with the payload being itself: an atom. Settled, with the payload pointing home into a definition: a slot — because a variable here is not a name but a place. Settled, payload elsewhere: an answer. Pending, with its right edge being a slot that points home: a definition. Pending otherwise: an application. That is the complete type system, and nobody wrote it down anywhere; it is just where the arrows go.

The geometry is so eager to mean things that it once almost meant too much. An atom — both pointers home — *satisfies the definition shape*: it is a pair whose right side is a settled cell pointing back at it. For one afternoon, every unbound symbol was a tiny one-slot definition of itself, and \`(let x)\` quietly reduced to \`x\`. One clause repaired the universe — a definition must not itself be settled — and the taxonomy held. I have come to enjoy that bug. It is what you get when meaning is load-bearing.

## Five moves

The whole compiler is five moves you can draw on a whiteboard.

*Read.* Parentheses become trees. No cleverness.

*Define.* A definition is the picture of its own application. The source \`(K ((x x) y))\` says "K, given x and then y, is x" — and the compiled node is literally that shape: the authored spine, built, with each variable becoming a slot, a dot that loops to itself and points home. The compiler does not translate definitions; it traces them. The test suite calls this a true-shape compiler, and the name is earned twice over: serialize a compiled definition and your own source comes back.

*Stitch* — the only real rule. To call something, slide down the left edge of the call collecting arguments, and slide down the left edge of the definition collecting slots. The two spines have the same shape: two rails of a ladder. Sew rungs across — this slot gets that argument — then mint a fresh dot, loop it to itself, hang on it a copy of the body with every slot swapped for its rung-mate, and let the call site keep pointing at the dot. The call has become an answer, trailing the arguments that produced it.

*Knot.* If, mid-copy, you find yourself making the very call you are already making — same definition, same argument cells, identical down to the pointer — do not copy again. Draw an arrow back to the dot you already minted. That one rule is all of recursion.

*Observe.* Put a finger on a node, follow left pointers to a self-loop, read what it holds.

Two of these moves are secretly the same move run in opposite directions. The walk that peels variable names off a source definition and the walk that peels slot cells off a compiled one stop on the same three conditions — not a fresh name, not an unclaimed slot, not unseen before. Define zips; stitch unzips. When a system hands you a symmetry like that, it is usually telling you that the cut was made in the right place.

## The knot

The knot deserves its own section, because it is where the project's two ambitions — an engine and a metaphysics — turn out to be one ambition.

Operationally, it is a memo. Every in-progress call sits on a list, and a call identical to one in progress returns the existing answer instead of expanding again. Take \`(Y f)\`: Y's body mentions \`(Y f)\`, the inner call ties back to the outer answer, and the famously infinite combinator compiles into a finite graph that contains itself.

Physically, it is Novikov's self-consistency principle with an implementation. A closed causal loop is admitted exactly when the loop agrees with itself — the same event, with the same causes, standing in for its own derivation. The compiler does not forbid time travel. It forbids inconsistent time travel.

And it gives divergence a shape. \`(M M)\` — the term that classically reduces to itself forever — compiles to a tight orbit: an answer whose payload is the question that produced it. Step it and you get it back, exactly, every time. Omega, the lambda calculus's black hole, becomes a fixed point of time: perfectly settled, never finished. \`(Loop Yield seed)\` is the productive cousin — a period-two orbit, a film of two frames the observer can watch forever, stored in a handful of bytes. Infinity, in this system, is not length. It is curvature.

One honesty, before the poetry gets away from me: the *compiler* can still diverge. Recursion whose arguments grow never repeats, never knots, and stitches forever. The machine cannot run away; the compiler absolutely can. All the danger in this universe is concentrated into the moment before time starts.

## What time is

Observation — the runtime's entire job — has a pleasing algebra. \`observe\` follows left pointers to a self-loop and returns the loop itself, not its contents. That makes it idempotent: observing an answer yields the answer. Observation is a projection onto the settled; facts are its fixed points. Programmers will recognize union-find's \`find\`, with answers as roots.

Reading is a second, separate act. \`select\` takes a settled cell and returns its right half. First you locate the event; then you extract the effect. An atom, being its own payload, answers both questions with itself.

Now watch a clock assemble itself. \`(S K K a)\` is the identity function built the long way around, and the compiler writes its whole derivation, two layers deep. Observe: you arrive at the first answer. Select: its payload is another pending question. Observe, select: \`a\`. Two ticks — because two layers were written. The program does not take two steps to compute; it took zero, or rather it took them all before the file was saved. It takes two steps to *unwrap*. Duration is depth. Time, here, is not when computation happens. It is the order in which a finished record can be read, and sequence is what observation does to structure.

## Every program is the same machine

When the graph becomes a file, the metaphysics becomes measurable. The compiler emits a complete WebAssembly module by hand — no toolchain, just bytes. The exact module size depends on the record and legend being shipped, but the machine code stays fixed: the observe loop and the select load. The focus is exported as an address, and the legend of names rides along in a custom section the machine cannot read.

The test suite asserts, on every run, the sentence the whole design walks toward: *every program is the same machine.* Type, function, memory, global, export, and code sections — byte-for-byte identical between the identity function and an infinite loop. Programs differ only in their data segment. Programs *are* data segments. A compiled file is a causal record with a reader stapled to its forehead, and the reader is so small and so fixed that shipping a program is, almost entirely, shipping its past.

## How to live before time

What is a standard library like, in a language where all computation precedes the program? Stranger and nicer than expected.

The native idiom turns out to be Scott encoding — and the original core, charmingly, was already speaking it without knowing: its booleans and pairs are Scott values, its Loop is the stream discipline. The recipe: constructors are definitions; a value is a partial application, a constructor still waiting for its case handlers; and pattern matching is simply finishing the call. \`(Cons a Nil)\` fills two of Cons's four slots. Asking "nil or cons?" supplies the other two, and the constructor itself routes you to the right branch.

This dissolves, almost by accident, the problem that should have killed recursion. The stitcher is strict — it reduces arguments before bodies — so a naive conditional would expand both branches and the recursive one forever. But a Scott branch is a partial application, and a partial's body never stitches. A branch not taken is a question never asked. Laziness, in this system, is not an evaluation strategy. It is an arity.

Given that discipline, the library genuinely computes. Addition and multiplication on numerals, lengths and last-elements of lists — all settled at compile time, all replayed by the thirty-nine bytes. Recursion descends literal substructure, so on closed data it terminates; on open data — a variable where a number should be — it simply stops, leaving a residual graph: the program, specialized as far as its known inputs allow. The compiler is a partial evaluator without trying, and residuals are themselves shippable records. An infinite list is two cells of curvature, courtesy of the knot, consumed by keeping producer and consumer on one spine.

The price is a totality discipline. Recursion must hide behind constructors. Mutual recursion must be fused into single self-referential step functions, since a name used before its definition stays an atom forever. You cannot even name a plain value without giving it a slot. These feel like fitting prices for a place where everything happens before time starts. This library does not run. It happened.

## The fork

One wall the idiom routes around rather than removes, and it marks the deepest unmade decision in the system. Stated as an asymmetry: **the observer can see through answers; the compiler cannot.**

Concretely: \`(App I a)\` — apply the literal identity function — settles at \`a\`. \`(App (I I) a)\` — apply the *computed* identity function — freezes forever. The stitcher finds function positions by walking left until it reaches something settled, and if the settled thing is an answer rather than a definition, it stops, politely, and leaves the application as sculpture. The observer, pointed at the sculpture, falls through the answer to the \`I\` inside and never applies it. In this universe the past is citable — the knot depends on citing answers by pointer — but it is closed. You may point at a settled event. You may not reopen it and use what is inside as the cause of something new.

The fork is one rule: should stitch look through settled answers into their payloads?

Take that branch and you get true normalization. Computed functions apply; \`(App (I I) a)\` is \`a\`; pipelines compose by value instead of by spine; the compiler graduates from specializer toward supercompiler. It is, plainly, the more powerful universe.

But the rule has a hole in it, and the hole is the knot. Mid-compilation, a cited answer may not be finished — its payload is written as the recursion unwinds, and a knotted cycle is precisely a place where an answer is in use before its contents exist. Citing an unfinished event is fine; that is what self-consistency *means*. Opening one is reading the unwritten. Naive transparency therefore crashes into the very mechanism that makes recursion finite. And the repairs all cost something true. Look through only already-filled answers, and the order of compilation becomes part of the language's meaning. Re-stitch to a fixpoint after the knots close, and more programs compute — and more programs diverge, because the wall, it turns out, was also a guardrail.

What I like about the fork is that its branches are not two features. They are two theories of the past. In the current universe, settled events are facts: they exist, they can be referenced, their existence can cause — but their interiors are sealed, and new computation composes only along the still-open frontier. In the other universe, the contents of the past are live causes, which demands that the past be complete before anything leans on it. Choose your physics. The diff is small either way.

There is a smaller knob nearby, worth a sentence. The observe loop can compress paths as it walks — three more instructions, near-constant re-observation — at the cost that the record is no longer pristine afterward. Whether observation may disturb what it observes is, in this system, literally an optimization flag.

## Coda

I keep returning to the atom: eight bytes, both pointers home, a cell whose only property is its own location. The system stores no name for it; the name rides outside, in a legend the machine cannot read. Inside the record there are only facts, and the questions that lead to them. What we call them is our business.

That is the proposal, in the end. A program is not a procedure but a record of causes, written all at once, outside of time. A value is an event that points at itself. Recursion is a loop the universe permits because it agrees with itself. And running — the thing we thought was the whole point — is a finger, walking left, remembering in order.
`;export{e as default};
