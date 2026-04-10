; Binary pairs only: () or (a b)
;
; (() a)                     ; I a -> a
; ((() a) b)                 ; K a -> a
; (((((0 2) (1 2)) a) b) c)  ; S a b c -> ((a c) (b c))

(((((0 2) (1 2)) a) b) c)
