; Live source-authored 2-bit root loop.
;
; Run:
;
;   node cli.js --lens live-root.lisp 8
;
; Compile once, then repeatedly step the same root. The host calls `step`,
; observes the current event, and reads its output; the source provides the
; whole register cycle.

(True ((x x) y))
(False ((y x) y))

; Stable register values. The visible name is the value; the right side carries
; the actual two bits.
(B00 (B00 (False False)))
(B01 (B01 (True False)))
(B10 (B10 (False True)))
(B11 (B11 (True True)))

; Events carry `(previous output)`.
(E00 (E00 (Start B00)))
(E01 (E01 (E00 B01)))
(E10 (E10 (E01 B10)))
(E11 (E11 (E10 B11)))

; Root is the live machine state. A step follows the right edge. The last state
; returns to Root, making the register loop without host-side counting.
(Root (E00 (E01 (E10 (E11 Root)))))

Root
