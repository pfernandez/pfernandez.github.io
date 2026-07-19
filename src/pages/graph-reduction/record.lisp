; Source-authored recorded observation lens.
;
; Run:
;
;   node cli.js --lens record.lisp 6
;
; A top-level `(form ())` is build-time syntax by shape: it compiles `form`,
; records the passive observation path, and writes that path as ordinary lens
; structure.

(S (((((x z) (y z)) x) y) z))

((S a b c) ())
