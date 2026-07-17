(I (x x))                         ; identity
(K ((x x) y))                     ; constant
(S (((((x z) (y z)) x) y) z))     ; substitution

(B ((((f (g x)) f) g) x))         ; compose
(C ((((f y x) f) x) y))           ; exchange arguments
(W (((f x x) f) x))               ; duplicate argument
(M ((x x) x))                     ; self-application

(Y ((f (Y f)) f))                 ; named self-reference
(Loop (((step state (Loop step)) step) state))
(Yield (((continue state) state) continue))

(True ((x x) y))                  ; choose left
(False ((y x) y))                 ; choose right
(If ((((p x y) p) x) y))          ; choose by predicate
(Not ((p False True) p))
(And (((p q False) p) q))
(Or (((p True q) p) q))

(Pair ((((f x y) x) y) f))        ; Church pair
(First ((p K) p))
(Second ((p False) p))

; Fully supplied shapes:
; (I a)
; (K a b)
(S a b c)
; (B I I a)
; (C K a b)
; (W K a)
; (M I)
; (Y K a)
; (True a b)
; (False a b)
; (I (K a b))
; (K (I a) b)
; (K (S a b c) d)
; (S K K a)
; (S (K a) (K b) c)
; (S I I a)

; Composed shapes usually need repeated observations:
; (If True a b)
; (First (Pair a b))
; (Second (Pair a b))

; Partial data and recursive shapes:
; K
; (K a)
; (Pair a b)
; (Loop I seed)
; (Yield seed continue)
; (Loop Yield seed)
