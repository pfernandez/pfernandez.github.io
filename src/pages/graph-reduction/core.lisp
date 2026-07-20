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

; Scott data: a constructor is a definition, a value is an inert
; partial application, and case analysis completes the arity.
; Branches not taken stay partial, so their bodies are not reduced.

(Zero ((z z) s))                  ; case n of zero -> z
(Succ ((((s m) m) z) s))          ;           succ m -> s m
(Nil ((n n) c))                   ; case l of nil -> n
(Cons (((((c h t) h) t) n) c))    ;           cons h t -> c h t

; Eliminators recurse on literal substructure, so they settle on
; closed data and stay symbolic on open data. Self-reference keeps
; a helper and its caller in the same active call.

(Head ((l no K) l))
(LastGo (((t h LastGo) h) t))
(Last ((l no LastGo) l))
(LenStep (((Succ (t Zero LenStep)) h) t))
(Length ((l Zero LenStep) l))
(FoldStep (((((f h (Fold f z t)) f) z) h) t))
(Fold ((((l z (FoldStep f z)) f) z) l))
(LenFold (((Succ t) h) t))

; Map takes the result cases explicitly. This computes through the list now;
; making (Map f l) itself a reusable list value is a sharper linker problem.

(MapStep ((((((c (f h) (Map f t n c)) f) n) c) h) t))
(Map (((((l n (MapStep f n c)) f) l) n) c))
(AddStep (((Succ (m2 n (AddStep n))) n) m2))
(Add (((m n (AddStep n)) m) n))
(MulStep (((Add n (m2 Zero (MulStep n))) n) m2))
(Mul (((m Zero (MulStep n)) m) n))

; Corecursion: repeated active calls share an answer, so an infinite
; structure is a finite cycle. Ask for only the piece you need.

(Repeat ((Cons x (Repeat x)) x))

; Closed data settles:
; (Head (Cons a (Cons b Nil)))
; (Length (Cons a (Cons b Nil)))
; (Fold LenFold Zero (Cons a (Cons b Nil)))
; (Map I (Cons a (Cons b Nil)) no K)
; (Add (Succ Zero) (Succ Zero))
; (Mul (Succ (Succ Zero)) (Succ (Succ Zero)))
; (Repeat a no K)

; Open data stays a residual form:
; (Add m (Succ Zero))
; (Length xs)

; (Last (Cons a (Cons b Nil)))

(S a b c)
