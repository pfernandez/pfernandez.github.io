# Passive frames

This note captures the old `collapse` line that may still be useful.

The passive frame shape is:

```text
[observer, focus]
```

The observer follows the left edge of `focus` until it encounters itself:

```text
focus[0] === observer
```

Then the right edge of that pair is the next visible value.

This is close to the Dyck-path intuition. Descending the left path is moving
inside a parenthesized prefix. Encountering the observer identity is the local
return-to-zero boundary for that observer. The important change is that "zero"
is not a global empty marker; it is the identity carried by the frame.

That makes observation relative. The same focus can be an answer for one
observer and an unfinished prefix for another.

## Pair locality

The rule is still pair-local if the observer identity is part of the frame.
Each step only asks:

```text
does this pair's left edge equal my observer identity?
```

If not, the next focus is the left edge. No symbol, arity, definition, or
source information is consulted.

## The fork

There are two honest machine shapes.

Prelinked:

```text
[observer, [focus, future]]
```

If `focus` has returned to the observer, expose its right edge. Otherwise take
the carried `future`. This is allocation-free because the graph already
contains the next frame.

Creative:

```text
[observer, focus] -> [observer, focus[0]]
```

If the future is not prelinked, the stepper must create the next observer
relation. This gives live growth, but the stepper is no longer only a reader.

The lesson is not that one fork is universally correct. The lesson is that
creation is exactly the difference between a compiled causal record and a
runtime causal-growth machine.
