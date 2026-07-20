; Three-gear live odometer.
;
; Run:
;
;   node cli.js --phase link-odometer.lisp 240
;
; A toggles every tick. B toggles when A was A1. C toggles when both A and B
; were high. The projected orbit is an eight-phase odometer.

(Loop step state (step state (Loop step)))
(Yield continue state (continue state))

(A0 a0 a1 a0)
(A1 a0 a1 a1)
(B0 b0 b1 b0)
(B1 b0 b1 b1)
(C0 c0 c1 c0)
(C1 c0 c1 c1)

(P000 p000 p001 p010 p011 p100 p101 p110 p111 (p000 A0 B0 C0))
(P001 p000 p001 p010 p011 p100 p101 p110 p111 (p001 A0 B0 C1))
(P010 p000 p001 p010 p011 p100 p101 p110 p111 (p010 A0 B1 C0))
(P011 p000 p001 p010 p011 p100 p101 p110 p111 (p011 A0 B1 C1))
(P100 p000 p001 p010 p011 p100 p101 p110 p111 (p100 A1 B0 C0))
(P101 p000 p001 p010 p011 p100 p101 p110 p111 (p101 A1 B0 C1))
(P110 p000 p001 p010 p011 p100 p101 p110 p111 (p110 A1 B1 C0))
(P111 p000 p001 p010 p011 p100 p101 p110 p111 (p111 A1 B1 C1))

(NextA a done
  (a (done A1) (done A0)))

(NextB a b done
  (a
    (done b)
    (b (done B1) (done B0))))

(NextC a b c done
  (a
    (done c)
    (b
      (done c)
      (c (done C1) (done C0)))))

(Combine a b c done
  (a
    (b
      (c (done P000) (done P001))
      (c (done P010) (done P011)))
    (b
      (c (done P100) (done P101))
      (c (done P110) (done P111)))))

(WithC continue nextA nextB nextC
  (Combine nextA nextB nextC (Yield continue)))

(WithB oldA oldB oldC continue nextA nextB
  (NextC oldA oldB oldC (WithC continue nextA nextB)))

(WithA oldA oldB oldC continue nextA
  (NextB oldA oldB (WithB oldA oldB oldC continue nextA)))

(WithState continue oldA oldB oldC
  (NextA oldA (WithA oldA oldB oldC continue)))

(Next state continue
  (state
    (WithState continue)
    (WithState continue)
    (WithState continue)
    (WithState continue)
    (WithState continue)
    (WithState continue)
    (WithState continue)
    (WithState continue)))

(Loop Next P000)
