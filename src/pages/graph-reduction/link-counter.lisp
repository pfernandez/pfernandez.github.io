; Source-authored 2-bit counter for the pair-local linker experiment.
;
; This is intentionally written in the older `link` source shape:
;
;   (Name arg arg body)
;
; The source does not preauthor a sequence of event frames. `IncC` is a
; transition rule over four canonical register identities, and `Loop` feeds the
; computed next identity back into `Next`.

(Loop step state (step state (Loop step)))
(Yield continue state (continue state))

; Four canonical 2-bit states. Each state is also its own case eliminator.
(B00 b00 b01 b10 b11 b00)
(B01 b00 b01 b10 b11 b01)
(B10 b00 b01 b10 b11 b10)
(B11 b00 b01 b10 b11 b11)

; Continuation-style increment. The selected next state is handed directly to
; `done`, so the transition is consumed on the open frontier instead of being
; stored as a sealed answer.
(IncC bits done
  (bits
    (done B01)
    (done B10)
    (done B11)
    (done B00)))

(ContinueNext continue next
  (Yield continue next))

(Next state continue
  (IncC state (ContinueNext continue)))

(Loop Next B00)
