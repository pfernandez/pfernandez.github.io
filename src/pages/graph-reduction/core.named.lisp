; Lists are folded left into pairs. The first list contains definitions.
; Names outside a signature become graph-native atoms.

(
 (((I x) x)
  ((K x y) x)
  ((S x y z) ((x z) (y z)))
  ((Y f) (f (Y f)))
  ((Zero f x) x)
  ((Succ n f x) (f (n f x))))
 ; (I a)
 ; (K a b)
 ; (S a b c)
 ; (Y I) ; repeats forever
 ; (Y (K a))
 ; (Zero I a)
 ; (Succ Zero I a)
 (S a b c))
