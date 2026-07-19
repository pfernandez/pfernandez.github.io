; Source-authored recorded observation lens.
;
; Run:
;
;   node cli.js --lens record.lisp 6
;
; Record is build-time syntax: it compiles the expression, records the passive
; observation path, and writes that path as ordinary lens structure.

(S (((((x z) (y z)) x) y) z))

(Record (S a b c))
