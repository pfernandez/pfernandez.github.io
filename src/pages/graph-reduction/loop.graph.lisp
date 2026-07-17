; A source-level loop experiment.
;
; Run:
;
;   env GRAPH_SCHEME=plain node cli.js loop.graph.lisp 12
;
; A Frame carries the visible value on the left and the next tick on the right.
; The host can keep calling step without deciding when computation is done.

((S x y z ((x z) (y z)))
 (Y f (f (Y f)))
 (Frame view next (view next))
 (Loop view self (Frame view self))

 (Y (Loop (S a b c)))
 )
