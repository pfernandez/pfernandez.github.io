; A source-level successor orbit.
;
; Run:
;
;   env GRAPH_SCHEME=plain node cli.js successor.graph.lisp 18
;
; This is a finite dynamic loop: the visible state advances from Zero to
; Succ Zero to Succ (Succ Zero), then returns to the first frame. The unbounded
; Grow form below documents the next target, but it needs a real delayed future
; boundary before link can build it. The executable TODO in graph/link.test.js
; asks only for the first Grow step: what creates the next relation when the
; recursive call changes arguments?

((Zero f x x)
 (Succ n f x (f (n f x)))
 Slot
 (Frame view next ((Slot view) next))

 (Loop
   (Frame Zero
     (Frame (Succ Zero)
       (Frame (Succ (Succ Zero)) Loop))))

 ; This is the shape we want eventually:
 ;
 ; (Grow n (Frame n (Grow (Succ n))))
 ; (Grow Zero)

 Loop)
