; Binary pairs only: () or (a b)
; Collapse rule: (() x) -> x
;
; 0 is identity at the build layer
; () is identity at the collapse layer
; S = (() (() (() ((0 2) (1 2)))))  ; index 2
;
; (() a)  ; I a -> a
; K is not representable in the "indices only" encoding if an argument is unused
; (because arity is inferred from the largest index referenced).
; (((((0 2) (1 2)) a) b) c)  ; S a b c -> ((a c) (b c))

(((((0 2) (1 2)) a) b) c)
