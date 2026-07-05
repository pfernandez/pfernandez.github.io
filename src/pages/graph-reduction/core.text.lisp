; Explicit names compile to unary bindings and enclosure-depth references.

(
 ((I ((I (x (() ()))) x))
  ((K (((K (x (() ()))) (y (() ()))) x))
   ((S ((((S (x (() ()))) (y (() ()))) (z (() ())))
        ((x z) (y z))))
    ((Y ((Y (f (() ()))) (f (Y f))))
     ((Zero (((Zero (f (() ()))) (x (() ()))) x))
      ((Succ ((((Succ (n (() ()))) (f (() ()))) (x (() ())))
              (f ((n f) x))))
       ()))))))
 ; (I (a (() ())))
 ; ((K (a (() ()))) (b (() ())))
 ; (((S (a (() ()))) (b (() ()))) (c (() ())))
 ; (Y I) ; repeats forever
 ; (Y (K (a (() ()))))
 ; ((Zero I) (a (() ())))
 ; (((Succ Zero) I) (a (() ())))
 (((S (a (() ()))) (b (() ()))) (c (() ())))
)
