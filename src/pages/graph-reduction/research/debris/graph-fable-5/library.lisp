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
; Branches not taken stay partial, so their bodies never stitch.

(Zero ((z z) s))                  ; case n of zero -> z
(Succ ((((s m) m) z) s))          ;           succ m -> s m
(Nil ((n n) c))                   ; case l of nil -> n
(Cons (((((c h t) h) t) n) c))    ;           cons h t -> c h t

; Eliminators recurse on literal substructure, so they settle on
; closed data and stay symbolic on open data. Self-reference only:
; a helper that needs its caller is fused into one step function.

(Head ((l no K) l))
(LastGo (((t h LastGo) h) t))
(Last ((l no LastGo) l))
(LenStep (((Succ (t Zero LenStep)) h) t))
(Length ((l Zero LenStep) l))
(AddStep (((Succ (m2 n (AddStep n))) n) m2))
(Add (((m n (AddStep n)) m) n))
(MulStep (((Add n (m2 Zero (MulStep n))) n) m2))
(Mul (((m Zero (MulStep n)) m) n))

; Corecursion: the knot ties self-similar calls, so an infinite
; structure is a finite cycle. Consume it fused, on one spine.

(Repeat ((Cons x (Repeat x)) x))

; Application of a literal function. A computed answer in head
; position is inert: stitch never looks through answers.

(App (((p q) p) q))

; Closed data settles:
; (Head (Cons a (Cons b Nil)))
; (Length (Cons a (Cons b Nil)))
; (Add (Succ Zero) (Succ Zero))
; (Mul (Succ (Succ Zero)) (Succ (Succ Zero)))
; (Repeat a no K)

; Open data stays a residual record:
; (Add m (Succ Zero))
; (Length xs)

(Last (Cons a (Cons b Nil)))
