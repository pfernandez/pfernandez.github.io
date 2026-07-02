; Traversal via a single stack:
; - Stack height begins at 0: ().
; - Stack moves left to right, one step per recursion.
; - <string>* means ref.

                                  ; Example stack during traversal:
; (((I x) x)                        ; 0: () -> 1: () -> 2: ((I I*)) -> 3: ((I I*) (x x*)) -> 4: ((I I*) (x x*)) -> 3: ((I I*) (x x*)) -> 2: (I I*) done-> 1: (I I*)
;  ((((K x) y) x)                   ; 1: ((I I*)) -> 2: ((I I*)) -> 3: ((I I*)) 4: ((I I*) (K K*)) -> 5: ((I I*) (K K*) (x x*)) -> 6: ((I I*) (K K*) (x x*) (y y*)) -> 7: ((I I*) (K K*) (x x*) (y y*)) -> 6: ((I I*) (K K*) (x x*) (y y*)) -> 5: ((I I*) (K K*) (x x*))  -> 4: ((I I*) (K K*)) done-> 3: ((I I*) (K K*)) -> 2: ((I I*) (K K*)) -> 1: ((I I*) (K K*))
;   (((((S x) y) z) ((x z) (y z)))  ; 2: ((I I*) (K K*)) -> 3: ((I I*) (K K*)) -> 4: ((I I*) (K K*)) -> 5: ((I I*) (K K*)) -> 6: ((I I*) (K K*) (S S*)) -> 7: ((I I*) (K K*) (S S*) (x x*)) -> 8: ((I I*) (K K*) (S S*) (x x*) (y y*)) -> 9: ((I I*) (K K*) (S S*) (x x*) (y y*) (z z*)) -> 10: ((I I*) (K K*) (S S*) (x x*) (y y*) (z z*)) -> 11: ((I I*) (K K*) (S S*) (x x*) (y y*) (z z*)) -> 12: ((I I*) (K K*) (S S*) (x x*) (y y*) (z z*)) -> 13: ((I I*) (K K*) (S S*) (x x*) (y y*) (z z*)) -> 14: ((I I*) (K K*) (S S*) (x x*) (y y*) (z z*)) -> 15: ((I I*) (K K*) (S S*) (x x*) (y y*) (z z*)) -> 16: ((I I*) (K K*) (S S*) (x x*) (y y*) (z z*)) -> 9: ((I I*) (K K*) (x x*) (y y*)) -> 8: ((I I*) (K K*) (x x*)) done-> 7: ((I I*) (K K*) (S S*)) -> 6: ((I I*) (K K*) (S S*)) -> 5: ((I I*) (K K*) (S S*))-> 4: ((I I*) (K K*) (S S*)) -> 2: ((I I*) (K K*) (S S*))
;    (((S a) b) c))))               ; 3: ((I I*) (K K*) (S S*)) -> 4: ((I I*) (K K*) (S S*)) -> 5: ((I I*) (K K*) (S S*)) -> 6: ((I I*) (K K*) (S S*)) -> 7: ((I I*) (K K*) (S S*) (a a*)) -> 8: ((I I*) (K K*) (S S*) (a a*) (b b*)) -> 9: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) done-> 8: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) -> 7: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) -> 6: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) -> 5: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) -> 4: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) -> 3: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) -> 2: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) -> 1: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*)) -> 0: ((I I*) (K K*) (S S*) (a a*) (b b*) (c c*))

(((((I x) x)
  (((K x) y) x))
  ((((S x) y) z) ((x z) (y z))))
 ((K a) b))
