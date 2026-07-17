; A source-level successor stream.
;
; Run:
;
;   env GRAPH_SCHEME=plain node cli.js successor.graph.lisp 18
;
; Each time the suspended Grow future is stepped into, the linker materializes
; one more Frame. The stepper still moves to the right edge after that load.

((Zero f x x)
 (Succ n f x (f (n f x)))
 Slot
 (Frame view next ((Slot view) next))
 (Grow n (Frame n (Grow (Succ n))))

 (Grow Zero))
