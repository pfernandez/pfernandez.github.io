; A new name points to the complete form on its right.
; (x (x x)) creates an identity whose two sides point to itself.
; Definitions form a right spine. () means the pair that directly encloses it.

(
 ((I ((I (x (x x))) x))
  ((K (((K (x (x x))) (y (y y))) x))
   ((S ((((S (x (x x))) (y (y y))) (z (z z)))
        ((x z) (y z))))
    ((Y ((Y (f (f f))) (f (Y f))))
     ((Zero (((Zero (f (f f))) (x (x x))) x))
      ((Succ ((((Succ (n (n n))) (f (f f))) (x (x x)))
              (f ((n f) x))))
       ()))))))
 ; (I (a (a a)))
 ; ((K (a (a a))) (b (b b)))
 ; (((S (a (a a))) (b (b b))) (c (c c)))
 ; (Y I) ; repeats forever
 ; (Y (K (a (a a))))
 ; ((Zero I) (a (a a)))
 ; (((Succ Zero) I) (a (a a)))
 (((S (a (a a))) (b (b b))) (c (c c)))
)
