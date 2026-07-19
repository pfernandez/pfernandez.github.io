; Graph-native lens fixture.
;
; Run:
;
;   node cli.js --lens lens.lisp 4
;
; A state is `(event next)`. The event is stable, so passive observation of the
; state reaches that event, and a machine step can be the plain right edge.
; Each event carries `(previous output)` on its right edge.

(S (((((x z) (y z)) x) y) z))

(End (End End))

; Program-shaped outputs carried by the lens events.
(Question (S a b c))
(Answer ((a c) (b c)))

(E0 (E0 (End Question)))
(E1 (E1 (E0 Answer)))

(S1 (E1 End))
(S0 (E0 S1))

S0
