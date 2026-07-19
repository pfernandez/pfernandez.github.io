; Root-as-observer experiment.
;
; Run:
;
;   node cli.js root.lisp
;
; `Root` is written as the outer observer/world. It carries its own identity,
; a tiny dictionary, and state. A question completes the root by receiving:
;
;   Root K S state
;
; This keeps the observer policy in source. The host still observes/selects to
; view the answer, but the choice of what the root exposes is made by the
; source-authored question.

(K ((x x) y))
(S (((((x z) (y z)) x) y) z))

(Root ((((((question (Root)) K) S) state) state) question))

; AskState uses the carried K to choose state.
(AskState (((((k state done) root) k) s) state))

; AskRoot uses the carried K to choose the root identity.
(AskRoot (((((k root done) root) k) s) state))

; AskS uses the carried S from the root dictionary.
(AskS (((((s a b c) root) k) s) state))

; Try these at the bottom:
;
;   (Root seed AskState) ; seed
;   (Root seed AskRoot)  ; Root
;   (Root seed AskS)     ; ((a c) (b c))

(Root seed AskS)
