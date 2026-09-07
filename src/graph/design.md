# Graph machine

This is the working description of the machine, the browser architecture we
are building around it, and the plan for moving the site into the graph. It
contains both established behavior and design targets. Sections say which is
which; an intended property must not be mistaken for something the current
implementation already proves.

The immediate goal is literal:

> This web application is running entirely within the machine it describes.

JavaScript may load the machine and connect it to the browser, but application
structure, selection, state, and continuation should belong to the authored
graph.

## The present browser boundary

The document is now authored and rendered by the Lisp Root. `src/index.js`
assembles the available source, links it once, and projects the resulting graph
into its device capabilities:

```text
index.html
└─ src/index.js
   └─ link(program, capabilities)
      └─ project(graph)
         └─ Lisp Root
            └─ render(html(head, body(component(dashboard))))
```

The previous JavaScript page shell, generic loaders, and keep-alive cache have
been removed. Every authored page is now linked into the same Root. Route
selection remains one small temporary host responsibility: it chooses the
initial named page continuation before the one link operation.

The target ownership is now established:

```text
index.html
└─ minimal JavaScript entry
   └─ link once
      └─ project
         └─ Lisp Root
      └─ html
         ├─ head
         └─ body
            └─ site observer
               ├─ authored navigation
               └─ authored pages and components
```

The host now does approximately this and should remain this small:

```js
const graph = link(program(), capabilities())
project(graph)
```

The exact interface may still change, but its division of responsibility
should not: the graph produces the complete document observation and authors
the call to the browser's `render` capability.

`include` is source assembly, not a graph capability or module system. A Lisp
file names another available file with a top-level form:

```lisp
((include /src/pages/graph-reduction/dashboard.lisp)
 (root ...))
```

Each file contains an outer sequence of forms. Inclusion replaces the
directive with that file's outer forms and places them into one ordered AST
before decomposition and linking:

```text
dashboard.lisp ─┐
machine.lisp ───┴─ pages.lisp ─┐
page.lisp ─────────────────────┼─ include → decompose → link
root.lisp ─────────────────────┘
```

Inclusion position is causal order. A later form can use definitions introduced
by an earlier include; an earlier form cannot see a definition included later.
Files do not create namespaces or private scopes. Ordinary lexical nesting
inside each form still determines privacy. The directive creates no graph
identity and is absent from the linked AST. The host supplies available file
contents. The authored `pages.lisp` file includes each page at its causal
position and carries a `site` definition containing the title, routes, labels,
and source paths. The definition is visible to later source while identities
introduced inside its body remain local. Root includes that real library before
its shared page component. The assembled value also retains the original files
and their combined authored text for the `source` capability.

The browser assembler and build-time prerenderer both read the same `site`
definition as host data. A small record helper performs the structural
operation they share with authored DOM properties: named entries become one
JavaScript object. Graph projection and parsed-source projection still supply
their own representations and evaluation rules.

`page.lisp` names the completed initial application for each page, such as
`dashboard-initial`. This name identifies the application directly; it does not
introduce a dummy definition or argument. The authored manifest names its page
source. During assembly, the first identity in that source (`dashboard`)
selects the correspondingly named application. The assembler supplies its
small `start` application as a virtual include; there is no separate entry file
and the initial page construction is not duplicated outside the graph.

## Pairs, identities, and Root

The linked runtime graph contains pairs. Identity comes from reference, not
shape:

```text
pair = [left, right]
atom = [self, self]
```

Two pairs with the same shape may still be different identities. Sharing,
cycles, and recurrence are expressed by shared references.

The graph returned by the linker is the complete **Root**: the static outer
environment containing every causally connected observer and event. A focus is
one observer's position within Root. Many observers may choose many different
origins without changing the graph.

Three identities must remain distinct:

- **Root** is the complete static graph.
- An **observer origin** is a recurrent identity selected within Root.
- An **observation** is the value exposed from that origin to its environment.

The spelling `root` has no privilege. Any symbol in the outermost naming
position names Root by the same rule used at every other pair. Its position is
significant; its spelling is not.

A fixed atom is the smallest closed focus:

```text
I = (I I)
```

Its two edges are indistinguishable. Orientation first becomes meaningful when
a focus relates different identities. By convention, the left edge is current
or earlier and the right edge is the following focus:

```text
I
(I J)
(I (J K))
(I (J (K L)))
```

A right-only observer can walk the nested suffixes without changing the graph:

```text
(I (J K)) -> (J K) -> K -> K -> ...
```

Three orders must remain distinct:

- **Causal order:** `I`, then `J`, then `K`.
- **Observer order:** each focus followed by its right focus.
- **Linker order:** `I -> (I J) -> (I (J K))`.

Linker order describes successively constructed static graphs, not runtime
events. Extending `(I J)` as `((I J) K)` creates a different, left-nested
graph. Rightward continuation rebuilds the enclosing spine as `(I (J K))` and
may share identities with an earlier construction.

Calling this order causal means exactly that a reference cannot depend on an
identity not yet introduced in its visible history. A physical interpretation
may be suggested by the same structure, but is not established by the linker.

## Names and authored sequences

Names help authors and the compiler connect pairs. They are not runtime cells,
pair properties, or extra causal events. The final graph contains only arrays
and shared references. An identity-keyed legend retains authored names and
foreign capabilities for serializers and devices at the graph's edge; an
observer walking the graph itself does not need their spelling.

The same local naming rule applies at every sequence length:

```text
a                  means a = (a a)
(a b)              means a = (a b)
(a b c)            means a = (b c)
(a b c d)          means a = (b c), where c = (c d)
```

In words: **accumulate left; proceed right**.

A name may either annotate the enclosing pair or occupy one of its states as a
self-reference. Removing a label must preserve the authored sequence; retaining
it as a self-reference changes the graph and must be deliberate.

The linker currently applies these contextual forms:

- In `(F input output)`, a fresh `F` names the definition pair
  `(input output)`. The label is not a third runtime state.
- In `(F argument)`, a visible definition `F` begins an application. Its result
  is the anonymous transition `(argument result)`.
- A fresh name may identify an application that is already recognizable from
  its visible callable, as in `(first (F argument))`. The name identifies that
  application directly; it does not add a wrapper pair or dummy argument.
- A compound state can name itself. `(a b c)` may express `a = (b c)` without
  an additional wrapper pair.
- A fresh name followed by one state has no inner pair to label, so the name
  remains as a left self-reference: `(a b)` means `a = (a b)`.
- A lone fresh name closes into `a = (a a)`.

Root contains only ordinary pairs and shared identities; it is not a special
node type. Naming it must not add a wrapper, input, self-edge, or linker
exception, and must not reinterpret any identity already nested beneath it.

## Lexical visibility

Source visibility proceeds left to right even when a recursive implementation
walks in another order.

A connection is legal only to the current pair or an identity in its lexical
history:

- A later sibling can see definitions introduced before it.
- A definition cannot see a later sibling.
- A child inherits the visible identities of its enclosing branches.
- A sibling cannot see another sibling's private children.
- A nested transition's left branch may shadow an outer identity with the same
  spelling.

Right-first construction is permissible only when it is an implementation
technique: it may prepare a result before tying its name, but it must never make
a causally future identity visible to the past.

Identification cascades through each lexical frame. The first occurrence of a
spelling introduces an identity; following occurrences reuse the nearest visible
identity. A transition's left branch starts a local frame, so its identities
shadow matching outer spellings, flow into the right branch, and remain private
outside the transition.

An identity becomes a parameter only relative to an application: it lies in the
applied transition's left branch and is paired with an argument identity. It is
not a different kind of graph cell. Left patterns obey the same structural rules
as other pairs. In `(x y z)`, `x` can name the whole pattern while `y` and `z`
identify its left and right states.

Repeated identities are constraints. If one left identity occupies two paths,
both paths in the supplied argument must lead to the same identity. The linker
must not bind that one identity to two different arguments.

## Compilation layers

The construction/observation boundary is a design invariant. Compilation may
recognize source roles, resolve names, match arguments, allocate identities,
and connect recurrence. A completed runtime graph must already contain the
resulting transitions. Its primitive observer does not repeat any of that work:

```text
construction: source roles -> connected transition topology
observation:  next(pair) = pair.right
```

Moving stacks, lexical environments, application recognition, or result
construction into a host-language observer makes that host an evaluator. Such
an evaluator can be a useful executable specification, but it has not
simplified the machine by making its linker smaller; it has moved the semantic
boundary. A future graph-authored evaluator may express the same work as static
graph transitions while leaving the primitive observer unchanged.

Compilation is deliberately separated into inspectable transformations:

```text
source -> parse -> AST -> decompose -> pairs
       -> connect -> connected identities
       -> compose -> application graph
       -> finalize -> frozen Root
```

Each layer has one kind of knowledge:

- `parse(source)` recognizes source text and preserves authored sequences.
- `decompose(ast)` lowers every sequence to pairs without resolving names.
- `connect(pairs, imports)` returns a connected artifact that replaces
  spellings with lexically visible
  identities. It records definitions, inputs, applications, and ownership in
  identity-keyed compiler tables. It also distinguishes named application
  values from ordinary calls and records names and capabilities in the legend,
  but applies nothing.
- `compose(connected)` copies that artifact, matches argument identities,
  copies definition bodies through one explicit allocation boundary, exposes
  results, completes suspended applications, begins new applications from
  callable results, materializes each named application value once, and ties
  recurring configurations. Non-callable results do not absorb following
  siblings. Its `results` table identifies completed applications, while
  `selections` records which value a retained construction sequence exposes.
  The connected input remains unchanged.
- `finalize(composed)` closes every remaining one-edge construction frontier
  into a fixed atom and freezes the reachable Root.
- `link(program, imports)` only coordinates those layers and reports errors.

The AST, decomposed pairs, complete connected artifact, and final graph
therefore remain separately available for tests and future views. The
connected artifact keeps its own graph, legend, and compiler tables together;
its legend never describes a copied graph from another stage. Only the
finalized graph is a runtime graph. The connected artifact may contain
temporary `[self]` frontiers and compiler tables that have no runtime
representation.

Separating connection from composition also gives names a clean lifetime.
Only `connect` interprets source strings. `compose` works with identities and
its tables, while the device and serializer consult the legend without adding
names to graph cells.

The serializer may render a selected graph within its complete Root. Identities
encountered earlier in that context appear by name instead of being expanded
again inside the selection. This changes presentation only; it neither selects
a focus nor adds information to the graph.

## Program assembly

A program is an ordered history of authored forms. Files, includes, and REPL
submissions are sources of those forms; their boundaries do not become graph
structure. Assembly therefore happens before the first context-sensitive
stage:

```text
source units -> parsed forms -> one ordered AST -> decompose -> connect
```

Includes already follow this rule. Each file is parsed separately and its
outer forms replace the include directive at that causal position. The
combined source is retained for display, but the compiler receives the
assembled AST without reparsing it.

The initial REPL follows the same rule. Each successful submission contributes
one parsed form to the ordered AST, after which the complete program is linked
again. A failed submission leaves the preceding session unchanged. Successive
evaluations therefore produce successive static Roots with equivalent source
semantics but fresh JavaScript reference identities. Retaining connected
identities across submissions would be an incremental-linking feature, not a
different assembly rule.

## Linking and application

Linking is a pair-local construction walk. At each pair it distinguishes a
small set of contextual states:

```text
atom                   [self, self]
definition             [input, body]
suspended application  [definition, supplied]
completed application  [arguments, result]
```

These are not runtime node tags. They describe what the linker knows while it
connects the graph.

A lone identity may temporarily be an open construction frontier `[self]`. If
a later state arrives while linking, it fills that open right edge. After Root
is linked and frozen, identities and edges remain stable.

An application may remain suspended when the authored source has supplied only
a causal prefix. The linker must not invent a result containing a hidden hole.
If no further argument arrives, the last supplied state remains fixed and the
authored prefix is the observable structure that actually occurred.

A completed application retains its definition sequence as result history but
exposes that sequence's final value to an enclosing application. Exposure
reuses an existing identity and creates no additional graph cell.

Completion does not create an opening where none exists. A completed
application and the state following it remain siblings unless the exposed
result is itself callable. A callable result may begin a new, left-nested
application. If its argument is produced by another completed application,
that application's transition remains in Root while its exposed result becomes
the argument. A suspended application is different: its existing opening may
still be filled by the following state.

Composition preserves two related facts separately. A completed application
is one value when passed as an argument, even though it contains its argument
and result. A retained definition or application sequence remains available as
construction history, but exposes the focus it produced when projected. The
`results` and `selections` tables record those facts without adding runtime
tags or cells.

A named application value is a completed application retained in library
history. Composition materializes it once. Every later reference exposes that
same stored result identity rather than recomposing the application or
reattaching its construction history to the consuming call. `namedValues` and
the materialization table are compiler knowledge only; neither adds a tag or
cell to the finalized graph.

`link` preserves both sides of this distinction. `focus` is the complete final
application identity, including its history; `result` is the value it exposes.
The browser device currently starts from `result` when present and otherwise
from `focus`. This is an entrypoint convention, not a change to the graph.

Recurrence reuses a configuration only when the same definition identity is
reached with the same argument identities during one instantiation. This ties
cycles by identity; it is not structural deduplication.

An unnamed recurrence enters the existing configuration directly. A named
recurrence remains an observable continuation shaped `[self, target]`: its
name stays available to a device while its right edge enters the configuration
that already exists. This preserves the distinction between an authored event
boundary and the state selected when that event occurs.

A left-nested foreign application can apply a capability's returned function:

```lisp
((make input) argument)
```

Composition retains this pair because the capability result does not exist
until projection. The projector invokes the result only when it is a
JavaScript function and passes the right-hand sequence as arguments. This rule
uses pair position and the returned value's type; it does not know the
capability's name or require declared return metadata.

## Observation

The graph is static. Observation changes focus, not graph structure. A minimal
observer follows an existing right edge:

```text
next(pair) = pair.right
```

A self-edge is a period-one trajectory, not termination. Longer cycles are
longer repeating trajectories. Stopping, yielding, sampling, or displaying a
focus belongs to an observer or its environment rather than to pair semantics.

### Materialized observer frames

The static materialization experiment tests a normal form that keeps an
observed pair separate from the observer's temporal edge:

```text
observer frame = (observation next-frame)
observed pair  = (left right)
```

These are not different node types. Both are ordinary pairs; their roles come
from the current observer plane. The primitive transition remains exactly
`next(frame) = frame.right`, while a device or higher observer can inspect the
pair on `frame.left` without entering that pair's own right edge.

This separation lets an application retain its construction as an earlier
observation while a later application points directly to the exact result
identity. A pair-valued result therefore remains one value. After a finite
construction, the final frame can recur to itself. If a contextual
configuration repeats, its last constructed frame can instead point to the
earlier equivalent frame, producing a finite static orbit.

The experiment links a unary functional subset, materializes finite and
recurrent reductions before runtime, and passes one raw graph identity to a
device capability. Its runtime artifact needs only Root, an initial focus, and
the edge legend. It does not need runtime stacks, environments, `results`, or
`selections`.

This is not yet production behavior. Structured inputs, named application
values, and the current variadic device interface still rely on compiler
knowledge that the experiment omits. The normal form is useful only if those
roles can be compiled into the same topology without moving evaluation into
the runtime observer.

An observer may retain a value on its left while returning through its right:

```text
origin = (observation origin)
```

The origin and observation are different identities. Following the continuation
returns to the exact origin, while an ordinary authored selector can expose the
observation to an enclosing application:

```lisp
((root observation (root observation))
 (first (focus next) focus)
 (first (root view)))
```

Completion is therefore relative to an observer: it is the return to that
observer's origin identity, not an empty value, structural equality, or a
universal stopping state. More complicated excursions may visit other
identities before returning to the same origin.

### Minimal finite observers

The smallest closed graph contains one identity:

```text
I = [I, I]
```

Both edges return immediately. Two identities are enough to distinguish an
observation from the origin that carries it:

```text
A = [A, A]
O = [A, O]
```

The right observer remains at `O`, while its left edge identifies `A` as the
observation. Two identities can also produce a changing right orbit:

```text
A = [A, B]
B = [B, A]
```

The observed sequence is `A -> B -> A`. These are exact pointer graphs, not
claims that every useful observer has one of these forms.

The current symbolic source for a two-state permutation is larger:

```lisp
((swap (x y) (swap (y x)))
 (swap (a b)))
```

Its selected graph contains five reachable pair identities. It retains the two
argument configurations as well as the two recurrent states and their shared
identity. Constructing the same five identities directly with references gives
an isomorphic graph. Comparing this authored image with the two-identity orbit
separates compiler and history costs from the minimal observer substrate.

It may be useful to enumerate small finite observers and compare them. What
counts as a distinct observer remains open. We might classify pointer
structure, authored recurrence, pair nesting, observable orbit, or some
combination of them. These classifications need not produce the same sequence
or identify the same graphs. Any enumeration should therefore preserve the
generated structures and state its chosen equivalence explicitly, so that
other classifications can be applied later.

The source-authored dashboard demonstrates a richer observer: its recursive
calls carry history, focus, next, and appearance through preauthored
identities. The site navigation applies the same rule at a larger scale. Both
page definitions exist in Root, and each link returns an authored `page`
application around the selected page observation. Browser events select those
continuations; they do not relink, traverse the graph, or decide the next
application themselves.

## The capability frontier

`src/device/` is the current boundary between graph identities and foreign
JavaScript functions. `project.js` invokes capabilities already connected to a
linked graph; it does not parse, link, select applications, or own state. The
other device modules expose specific host mechanisms such as DOM construction,
Markdown, source files, text, and graph serialization. The authored site
manifest supplies route configuration to both browser assembly and static
prerendering. The initial pathname selects a named authored continuation during
source assembly; navigation is no longer a capability. This boundary may
temporarily grow so the Lisp Root can own the whole application immediately.
It must then contract as pure behavior moves into authored definitions.

Capabilities should expose mechanisms, not application policy:

```text
Prefer                         Avoid
pathname                       selectCurrentPage
navigate                       activateDashboard
load                           resolveSiteContent
component                      manageApplicationState
```

JavaScript may remain responsible for irreducible browser operations such as
DOM access, history, network loading, and translating external events into
known graph identities. It should not choose graph branches, advance an
observer, resolve source names, or own application state. The pathname still
chooses one named authored continuation at startup; after linking, page
selection is an ordinary graph continuation. Reflecting that selection back
into browser history remains future device work.

Moving a capability into Lisp means replacing one broad foreign operation with
authored composition over smaller device primitives. The final system need not
contain zero JavaScript; it should contain no JavaScript semantic authority that
the graph can express itself.

## `component` and events

`component` is an ordinary function from the graph's perspective. It receives
an authored observation and returns that VDOM marked as an Elements
reconciliation boundary. It has no graph node, linker rule, evaluator branch,
or calling syntax of its own.

Elements.js implements `component` as a JavaScript function that creates
another function. One small device function translates that foreign calling
convention into `observation -> boundary-marked observation`. It then passes
through the same capability wrapper as every element, Markdown, and `render`;
there is no special `component` branch in the adapter. No JavaScript function
escapes into the graph or page loader. General returned-function values remain
an open language question, but `component` does not require them.

Event properties use the same ordinary properties boundary as every other DOM
value. The source explicitly turns an authored observation into a host-callable
continuation:

```lisp
(button
  (props
    (onclick (continue observation)))
  label)
```

`continue` preserves the already-linked observation and evaluates it only when
the browser calls the resulting function. Neither `device/dom.js` nor
Elements.js recognizes `on*` names or knows how to advance the graph. Elements
only invokes the function and treats returned VDOM as the next component
observation. A fixed action has the form `(action self)`; its recurring right
edge preserves the continuation while its left edge is the observation to
perform.

The authored `props` call turns any sequence of entry pairs into an ordinary
JavaScript properties object. It has no list of HTML attributes, so custom,
`data-*`, SVG, and future properties use the same form. Its application also
keeps repeated entry names local instead of letting a first `class` pair name
later pairs elsewhere in the view. A fixed device action can now share `props`
with ordinary data. A completed authored application may retain unnamed
construction history between property entries. `props` projects only authored,
named entry pairs, so that history remains in the graph without becoming a
JavaScript property.

The document Root contains a component around the site page, and the authored
page contains another around its selected child. A navigation event updates the
site page boundary; a dashboard event updates the child boundary. This keeps
events local because Elements does not treat the special `html`, `head`, or
`body` nodes as local component roots. Those boundaries are Elements
constraints, not graph-language rules.

## Migration plan

The migration establishes the true Root once, then moves the foreign frontier
downward. It should not translate incidental JavaScript machinery when the
static graph makes that machinery unnecessary.

### 1. Establish the document Root

- [x] Author a site-level Lisp Root that produces the complete
      `html/head/body` observation.
- [x] Reduce `src/index.js` to assembling source, linking once, and projecting
      the graph into capabilities. Root authors the call to `render`.
- [x] Use one dashboard component until ordinary nested component calls are
      established.

### 2. Move the static site structure into Root

- [x] Author the title and navigation shell in Lisp.
- [x] Author the available pages and initial page identity in Lisp.
- [x] Run the Lisp dashboard beneath Root. Retain the unused JavaScript
      dashboard only as a migration reference.
- [x] Remove the superseded route caches and keep-alive structures.
- [ ] Keep CSS and other build assets outside the graph until representing them
      serves a semantic purpose.

### 3. Make functions uniformly composable

- [x] Demonstrate a returned function being called with graph-authored
      arguments without evaluator knowledge of its name.
- [x] Treat `component` exactly like every other imported function.
- [x] Demonstrate more than one graph-authored component boundary.
- [x] Express event continuation explicitly in Lisp and remove `on*` knowledge
      and graph-shaped property inference from the DOM and Elements adapters.

### 4. Contract the capability frontier

- [ ] Move initial route selection and browser-history synchronization into
      Lisp; page transitions are already authored continuations.
- [x] Move finite content composition and preauthored application state into
      Lisp.
- [ ] Determine how dynamic input and accumulated state extend a running
      graph.
- [ ] Replace broad temporary functions with the smallest browser operations
      the graph cannot perform internally.
- [x] Remove the superseded JavaScript page shell, generic loaders, and
      monolithic capability table rather than preserving parallel systems.

### 5. Continue toward the native machine

- [ ] Find the smallest self-calling graph that accepts new arguments and can
      acquire further behavior from source.
- [ ] Determine whether external input can always select preauthored identities
      or whether some applications require runtime graph construction.
- [ ] Move parsing, linking, libraries, and observation into graph-authored
      definitions where experiments show that it is possible and useful.
- [ ] Revisit a minimal address image or Wasm host only after the graph-native
      browser application makes the required substrate clear.

Each milestone should be demonstrated by a focused test or visible behavior.
The plan is a direction of travel, not permission to hide missing semantics in
the device layer.

## Open questions

- An authored definition returned by an application can be applied again by
  left nesting, and a foreign function can be applied at the projection
  boundary. What other graph identities, if any, should be callable without
  first being named as definitions?
- How should dynamic browser event arguments enter an authored continuation
  without giving the device authority to choose graph structure?
- Does route selection need any identity comparison not already authorable from
  a finite route library?
- Which parts of dynamic loading remain meaningful when the site is linked as
  one graph?
- Can arbitrary external input always select an existing graph identity, or is
  append-only runtime construction eventually necessary?
- Does unbounded remembered history live in observer state, persistent graph
  structure, or an external stream?
- What is the smallest device substrate needed once application policy is
  graph-authored?

These questions are intentionally unresolved. They must remain visible rather
than becoming accidental behavior in the linker, device, or browser host.
