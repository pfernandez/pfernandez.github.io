; A source-level successor orbit.
;
; Run:
;
;   env GRAPH_SCHEME=plain node cli.js --events successor.graph.lisp 18
;
; The linked graph is finite and step only moves to the right edge. The focus
; repeats, while event history records how many times the orbit has been taken.

((Zero f x x)
 (Succ n f x (f (n f x)))
 Slot
 (Frame view next ((Slot view) next))
 (Grow n (Frame n (Grow (Succ n))))

 (Grow Zero))
