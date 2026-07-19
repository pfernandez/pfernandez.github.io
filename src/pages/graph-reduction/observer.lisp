; Source-authored observer experiment.
;
; Run:
;
;   node cli.js observer.lisp
;
; This fixture asks how much of observation can be moved into source using
; ordinary encoded pairs. `First` and `Second` project a source-level `Pair`;
; they do not inspect arbitrary substrate cells.
;
; The transition below says:
;
;   Tick focus history
;     -> Pair (Second focus) (Pair (First focus) history)
;
; In words: move to the next focus, and carry the previous output in history.
; This works as source algebra over encoded pairs, but the computed `Pair`
; result is still a value, not a fresh graph event that can keep running by
; itself.

(K ((x x) y))
(False ((y x) y))

(Pair ((((f x y) x) y) f))
(First ((p K) p))
(Second ((p False) p))

(Tick (((Pair (Second focus) (Pair (First focus) history)) focus) history))

(End (End End))
(Frame2 (Pair Out2 End))
(Frame1 (Pair Out1 Frame2))
(Frame0 (Pair Out0 Frame1))

; Try these at the bottom:
;
;   (First Frame0)        ; Out0
;   (Second Frame0)       ; Frame1
;   (Tick Frame0 End)     ; one observer transition

(First Frame0)
