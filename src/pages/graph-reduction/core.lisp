((I x x)
 (K (y z) (I y))  ; should allow nesting and copying of previous siblings,
                  ; replacing their parameters with argument identities
 (S (x y z) ((x z) (y z)))
 (F x ((G x x) x))
 (Y f (f (Y f)))
 (P f (f c))
 (Q a (P (S (a b))))
 (S (a b c)))
