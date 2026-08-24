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

The site currently has one document render owned by `src/index.js`:

```text
index.html
└─ src/index.js
   └─ render(html(head, body(page())))
      └─ page.js
         └─ observe.js or observe.lisp.js
```

`page.js` currently owns routing, imports, loading states, module caches,
keep-alive slots, navigation, and the content boundary. The Lisp application is
only one page component beneath that shell. Its definition named `root` is
therefore not yet the Root of the site.

The target reverses that ownership:

```text
index.html
└─ minimal JavaScript start
   └─ Lisp Root
      └─ html
         ├─ head
         └─ body
            ├─ navigation
            └─ authored observers and components
```

The host should eventually do approximately this and no more:

```js
const root = view(source, functions)
render(root())
```

The exact interface may change, but its division of responsibility should not:
the graph produces the complete document observation; the browser mounts it.

## Pairs, identities, and Root

The linked runtime graph contains pairs. Identity comes from reference, not
shape:

```text
pair = [left, right]
atom = [self, self]
```

Two pairs with the same shape may still be different identities. Sharing,
cycles, and recurrence are expressed by shared references.

The graph has one Root containing every causally connected observer and event.
A focus is one observer's position within Root. Many observers may begin at
many foci without changing the static graph.

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

Names help authors, the linker, and the serializer identify pairs. They are not
runtime cells or extra causal events. Once linking is complete, the observer
does not need their spelling.

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
- A compound state can name itself. `(a b c)` may express `a = (b c)` without
  an additional wrapper pair.
- A fresh name followed by one state has no inner pair to label, so the name
  remains as a left self-reference: `(a b)` means `a = (a b)`.
- A lone fresh name closes into `a = (a a)`.

Root follows these same rules. It is not a special node type. If `root` is
authored as a label, it must name the outermost pair without adding a wrapper,
input, or self-edge merely because its spelling is new.

## Lexical visibility

Source visibility proceeds left to right even when a recursive implementation
walks in another order.

A connection is legal only to the current pair or an identity in its lexical
history:

- A later sibling can see definitions introduced before it.
- A definition cannot see a later sibling.
- A child inherits the visible identities of its enclosing branches.
- A sibling cannot see another sibling's private children.
- A nested parameter shadows an outer identity with the same spelling.

Right-first construction is permissible only when it is an implementation
technique: it may prepare a result before tying its name, but it must never make
a causally future identity visible to the past.

Parameter patterns obey the same structural rules as other pairs. In
`(x y z)`, `x` can name the parameter pair while `y` and `z` bind its left and
right states. It is not necessarily a flat collection of three unrelated
parameters.

## Linking and application

Linking is a pair-local construction walk. At each pair it distinguishes a
small set of contextual states:

```text
atom                   [self, self]
definition             [parameters, body]
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

Recurrence reuses a configuration only when the same definition identity is
reached with the same argument identities during one instantiation. This ties
cycles by identity; it is not structural deduplication.

## Observation

The graph is static. Observation changes focus, not graph structure. A minimal
observer follows an existing right edge:

```text
next(pair) = pair.right
```

A self-edge is a period-one trajectory, not termination. Longer cycles are
longer repeating trajectories. Stopping, yielding, sampling, or displaying a
focus belongs to an observer or its environment rather than to pair semantics.

The source-authored dashboard demonstrates a richer observer: its recursive
calls carry history, focus, next, and appearance through preauthored
identities. Browser events select authored continuations; they should not
perform graph traversal or decide the next application themselves.

## The capability frontier

`functions.js` is the current boundary between graph identities and foreign
JavaScript functions. During migration, that boundary may temporarily grow so
the Lisp Root can own the whole application immediately. It must then contract
as pure behavior moves into authored definitions.

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
observer, resolve source names, or own application state.

Moving a capability into Lisp means replacing one broad foreign operation with
authored composition over smaller device primitives. The final system need not
contain zero JavaScript; it should contain no JavaScript semantic authority that
the graph can express itself.

## `component` and events

`component` is an ordinary function from the graph's perspective. It must not
receive a special graph node, linker rule, evaluator branch, or calling syntax.
Its present implementation is foreign because Elements.js associates a
returned component function with a DOM reconciliation boundary.

Two operations are currently easy to conflate:

1. Creating a component function from an authored observation.
2. Calling that function with arguments to obtain its current VDOM.

The JavaScript page loader presently performs the second operation for the
top-level exported component. Before the graph authors nested components, it
needs an ordinary and general way for one returned function to be called by
another expression. This is a function-value question, not justification for a
special `component` form.

Event properties are a related boundary. The Elements capability adapter in
`functions.js` preserves an `on*` continuation until the browser event occurs.
The device evaluates named pairs uniformly and has no knowledge of event names.
Elements.js already wraps event functions and treats a returned VDOM as the
next component observation. We should revisit whether the remaining callback
conversion can live in Elements.js without making it depend on this graph
evaluator. No event rule should be hidden in the linker or device.

The initial Root migration can use one top-level component and defer nested
component calls. That is a migration limit, not a language rule.

## Migration plan

The migration establishes the true Root once, then moves the foreign frontier
downward. It should not translate incidental JavaScript machinery when the
static graph makes that machinery unnecessary.

### 1. Establish the document Root

- [ ] Author a site-level Lisp Root that produces the complete
      `html/head/body` observation.
- [ ] Reduce `src/index.js` to loading the source, connecting capabilities,
      obtaining the initial Root observation, and calling `render`.
- [ ] Use one top-level component until ordinary nested component calls are
      established.

### 2. Move the static site structure into Root

- [ ] Author the title, navigation, available pages, and initial page identity
      in Lisp.
- [ ] Place the current JavaScript and Lisp observers beneath that Root while
      the migration is in progress.
- [ ] Determine which caches and keep-alive structures disappear because all
      page identities already exist in one linked graph.
- [ ] Keep CSS and other build assets outside the graph until representing them
      serves a semantic purpose.

### 3. Make functions uniformly composable

- [ ] Demonstrate a returned function being called with graph-authored
      arguments without evaluator knowledge of its name.
- [ ] Treat `component` exactly like every other imported function.
- [ ] Demonstrate more than one graph-authored component boundary.
- [ ] Revisit `on*` property wrapping in Elements.js and remove corresponding
      event knowledge from the device where possible.

### 4. Contract the capability frontier

- [ ] Move route selection and navigation policy into Lisp.
- [ ] Move content composition and application state into Lisp.
- [ ] Replace broad temporary functions with the smallest browser operations
      the graph cannot perform internally.
- [ ] Remove superseded responsibilities from `page.js`, `config.js`, loaders,
      and `functions.js` rather than preserving parallel implementations.

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

- What is the general representation and application rule for a function value
  returned by a foreign or authored function?
- Can event continuations and their dynamic arguments be handled entirely by
  ordinary Elements.js property behavior?
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
