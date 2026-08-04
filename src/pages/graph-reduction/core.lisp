(((I x) x)
  (((K y) z) (I y))  ; should allow nesting and copying of previous siblings,
                     ; replacing parameters with signature refs
  ((S x y z) ((x z) (y z)))
  ((Y f) (f (Y f)))
  ((S a b c) ((a c) (b c))))  ; ((a c) (b c)) should have been inserted via
                             ; copying of the definition, same as in K
