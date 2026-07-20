; Live source-authored Fibonacci register bank.
;
; Run:
;
;   node cli.js --lens fibonacci-root.lisp 8
;
; This is intentionally a bounded material bank, not a hidden evaluator. The
; source supplies a ring of event/register frames. Runtime `step` only follows
; the right edge; the host does not choose the next value or allocate cells.
;
; The visible register is three bits, least-significant bit first. The sequence
; below is Fibonacci modulo 8:
;
;   0 1 1 2 3 5 0 5 ...
;
; This is the shape we want a graph-local allocator/free-bank to actualize
; dynamically later: supplied material, source-authored policy, passive readout.

(True ((x x) y))
(False ((y x) y))

; Stable 3-bit register values. The name is for us; the right side is the
; actual bit structure.
(B000 (B000 (False (False False))))
(B001 (B001 (True (False False))))
(B010 (B010 (False (True False))))
(B011 (B011 (True (True False))))
(B101 (B101 (True (False True))))

; The event bank. Each event points to the previous event and exposes one
; register value. Reusing B001 and B101 preserves identity for repeated values.
(E0 (E0 (Start B000)))
(E1 (E1 (E0 B001)))
(E2 (E2 (E1 B001)))
(E3 (E3 (E2 B010)))
(E4 (E4 (E3 B011)))
(E5 (E5 (E4 B101)))
(E6 (E6 (E5 B000)))
(E7 (E7 (E6 B101)))

; Root is the live machine state. Stepping consumes the next supplied frame.
(Root (E0 (E1 (E2 (E3 (E4 (E5 (E6 (E7 Root)))))))))

Root
