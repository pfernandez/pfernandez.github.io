; Historical explicit-binding demonstration of the canonical program.
; This old enclosure notation is not part of the canonical linker input.
; An unknown name on the left binds its right side to the current scope.
; Any other new name becomes a graph-native atom.

(((I ((I (x (() ()))) x))
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
