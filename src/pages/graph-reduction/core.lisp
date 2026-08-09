((I x x)
 (K (y z) (I y))  ; should allow nesting and copying of previous siblings,
                  ; replacing parameters with signature refs
 (S (x y z) ((x z) (y z)))
 (F (x) ((G (x) x) x))
 (Y f (f (Y f)))
 (S (a b c)))
