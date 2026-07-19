; Continuation-style bit ledger experiment.
;
; Bits are a Scott list, least-significant bit first:
;
;   Nil                         ; 0
;   (Cons True Nil)             ; 1
;   (Cons False (Cons True Nil)) ; 2
;
; `Inc bits done` increments the supplied material and immediately sends the
; result to `done`. The result is consumed on the same open frontier instead of
; reopening a settled computed list later.

(I (x x))

(True ((x x) y))
(False ((y x) y))

(Nil ((n n) c))
(Cons (((((c h t) h) t) n) c))

; Carry receives the incremented tail and restores a cleared bit in front.
(Carry
  (((done (Cons False tail)) done) tail))

; IncStep handles a non-empty list. If the head bit is True, clear it and
; increment the tail with a Carry continuation. If the head bit is False, set
; it and stop.
(IncStep
  ((((h
      (t (done (Cons False (Cons True Nil)))
         (IncStep (Carry done)))
      (done (Cons True t)))
     done)
    h)
   t))

; Nil increments to one. Cons delegates to IncStep.
(Inc
  (((bits (done (Cons True Nil)) (IncStep done)) bits) done))

; Try:
;
;   (Inc Nil I)                            ; 1
;   (Inc (Cons False Nil) I)               ; 1
;   (Inc (Cons True Nil) I)                ; 2
;   (Inc (Cons True (Cons True Nil)) I)    ; 4

(Inc (Cons True (Cons True Nil)) I)
