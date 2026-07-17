(((I x) x)                         ; identity
 (((K x y) x)                       ; constant
  (((S x y z) ((x z) (y z)))         ; substitution

   (((B f g x) (f (g x)))             ; compose
    (((C f x y) (f y x))               ; exchange arguments
     (((W f x) (f x x))                 ; duplicate argument
      (((M x) (x x))                     ; self-application

       (((Y f) (f (Y f)))                 ; named self-reference
        (((Loop step state)
          (step state (Loop step)))        ; pass continuation to step
         (((Yield state continue)
           (continue state))                ; continue with next state

          (((True x y) x)                    ; choose left
           (((False x y) y)                   ; choose right
            (((If p x y) (p x y))              ; choose by predicate
             (((Not p) (p False True))
              (((And p q) (p q False))
               (((Or p q) (p True q))

                (((Pair x y f) (f x y))            ; Church pair
                 (((First p) (p K))
                  (((Second p) (p False))
                   (()                                ; fixed focus
                    (True a b)

                    ; Fully supplied shapes:
                    ; (I a)
                    ; ((K a) b)
                    ; (S a b c)
                    ; (B I I a)
                    ; (C K a b)
                    ; (W K a)
                    ; (M I)
                    ; ((Y K) a)
                    ; (True a b)
                    ; (False a b)
                    ; (I ((K a) b))
                    ; ((K (I a)) b)
                    ; ((K (S a b c)) d)
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

                    ; Empty source forms only fix the following form:
                    ; (() x)

                    ; Rejected empty source forms:
                    ; ()
                    ; (I ())

                    ; Nullary definitions are rejected before connection:
                    ; (((Nullary) a) (() Nullary))
                    ))))))))))))))))))))
