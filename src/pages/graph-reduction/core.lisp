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
; closed data and stay symbolic on open data. Helpers may refer to
; their parent names before the parent is written below.

(Head ((l no K) l))
(LastGo (((t h LastGo) h) t))
(Last ((l no LastGo) l))
(LenStep (((Succ (t Zero LenStep)) h) t))
(Length ((l Zero LenStep) l))
(FoldStep (((((f h (Fold f z t)) f) z) h) t))
(Fold ((((l z (FoldStep f z)) f) z) l))
(LenFold (((Succ t) h) t))

; List transformers return new Scott lists. A later consumer can demand
; the computed list's cases, so these compose with Head and Length.

(MapStep (((((c (f h) (Map f t)) f) c) h) t))
(Map (((((l n (MapStep f c)) f) l) n) c))
(AppendStep (((((c h (Append t ys)) ys) c) h) t))
(Append (((((xs (ys n c) (AppendStep ys c)) xs) ys) n) c))
(FilterStep
  ((((((p h (c h (Filter p t)) (Filter p t n c)) p) n) c) h) t))
(Filter (((((l n (FilterStep p n c)) p) l) n) c))
(Partition (((Pair (Filter p l) (Filter (B Not p) l)) p) l))
(TakeCons ((((Cons h (Take m t)) m) h) t))
(TakeStep (((l Nil (TakeCons m)) l) m))
(Take (((n Nil (TakeStep l)) n) l))
(RevStep ((((((Rev t (Cons h acc) n c) acc) n) c) h) t))
(Rev (((((l (acc n c) (RevStep acc n c)) l) acc) n) c))
(Reverse ((((Rev l Nil n c) l) n) c))
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
; (Head (Map I (Cons a (Cons b Nil))))
; (Head (Append (Cons a Nil) (Cons b Nil)))
; (Head (Filter (K True) (Cons a (Cons b Nil))))
; (Head (Filter (K False) (Cons a (Cons b Nil))))
; (Head (Reverse (Cons a (Cons b Nil))))
; (Length (Filter (K True) (Cons a (Cons b Nil))))
; (Length (First (Partition (K True) (Cons a (Cons b Nil)))))
; (Length (Take (Succ (Succ Zero)) (Repeat a)))
; (Length (Reverse (Cons a (Cons b Nil))))
; (Add (Succ Zero) (Succ Zero))
; (Mul (Succ (Succ Zero)) (Succ (Succ Zero)))
; (Repeat a no K)

; Open data stays a residual form:
; (Add m (Succ Zero))
; (Length xs)

; (Last (Cons a (Cons b Nil)))

(S a b c)
