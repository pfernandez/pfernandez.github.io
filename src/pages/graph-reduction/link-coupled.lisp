; Coupled live phase process.
;
; Run:
;
;   node cli.js --phase link-coupled.lisp 64
;
; The root carries one combined phase, but `Next` is factored into two local
; clocks. A toggles every tick. B toggles only when A was A1, so the combined
; process is a four-phase orbit produced by coupling two two-phase processes.

(Loop step state (step state (Loop step)))
(Yield continue state (continue state))

; Local A clock.
(A0 a0 a1 a0)
(A1 a0 a1 a1)

; Local B clock.
(B0 b0 b1 b0)
(B1 b0 b1 b1)

; Combined phases pass their local components to the selected branch.
(P00 p00 p01 p10 p11 (p00 A0 B0))
(P01 p00 p01 p10 p11 (p01 A0 B1))
(P10 p00 p01 p10 p11 (p10 A1 B0))
(P11 p00 p01 p10 p11 (p11 A1 B1))

; A local transition.
(NextA a done
  (a
    (done A1)
    (done A0)))

; B advances only when the old A phase was A1.
(NextB a b done
  (a
    (done b)
    (b
      (done B1)
      (done B0))))

; Recombine local phases into one projected process phase.
(Combine a b done
  (a
    (b
      (done P00)
      (done P01))
    (b
      (done P10)
      (done P11))))

(WithB oldA continue nextA nextB
  (Combine nextA nextB (Yield continue)))

(WithA oldA oldB continue nextA
  (NextB oldA oldB (WithB oldA continue nextA)))

(WithState continue oldA oldB
  (NextA oldA (WithA oldA oldB continue)))

(Next state continue
  (state
    (WithState continue)
    (WithState continue)
    (WithState continue)
    (WithState continue)))

(Loop Next P00)
