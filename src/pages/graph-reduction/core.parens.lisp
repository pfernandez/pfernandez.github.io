; Parenthesis-only demonstration of the canonical program.
; This historical form is not part of the canonical linker input.
; In a binary form, () names the pair that directly contains it.
; (()) addresses the latest binding; each extra enclosure steps outward.
; Every other unary form binds its contents. Binary forms are ordinary pairs.

(
 (((((()) ((() ()))) (())))                         ; I
  ((((((()) ((() ()))) ((() ()))) ((()))))          ; K
   (((((((()) ((() ()))) ((() ()))) ((() ())))      ; S
        (((((()))) (())) (((())) (())))))
    (((((()) ((() ()))) ((()) (((())) (())))))       ; Y
     ((((((()) ((() ()))) ((() ()))) (())))          ; Zero
      (((((((()) ((() ()))) ((() ()))) ((() ())))   ; Succ
           (((())) (((((()))) ((()))) (())))))
       ()))))))
 ; (((((((())))))) (() ()))                          ; I
 ; (((((((()))))) (() ())) (() ()))                  ; K
 ; (((((((())))) (() ())) (() ())) (() ()))          ; S
 ; ((((()))) ((((((())))))))                         ; Y I, repeats forever
 ; ((((()))) ((((((()))))) (() ())))                 ; Y (K atom)
 ; ((((())) ((((((()))))))) (() ()))                 ; Zero I atom
 ; ((((()) ((()))) ((((((()))))))) (() ()))          ; Succ Zero I atom
 (((((((())))) (() ())) (() ())) (() ()))            ; S
)
