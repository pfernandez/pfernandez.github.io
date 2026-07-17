; A finite graph whose count lives in observer history.
;
; Run:
;
;   env GRAPH_SCHEME=plain node cli.js --events history.graph.lisp 12
;
; The focus repeats, but the event history grows by one cell each tick.

((Zero f x x)
 (Loop Zero Loop))
