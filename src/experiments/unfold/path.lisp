; Raw pair assembly. A name identifies the pair made from everything after it.
; With one following value, its missing left side refers to itself. A form's
; name is visible within itself; every other name must have appeared above it.

((left left)
 (right left left)
 (pair left right)
 (focus focus)
 (origin focus)
 (recurrence
   (left left)
   (pair
     (right left left)
     (pair
       (right right left)
       (right right right right left))))
 (call recurrence origin)
 (machine pair call)

 (value value)
 (known
   (left left)
   (pair
     (right right left left)
     (pair
       (right left left)
       (right right right left))))
 (argument known value)
 (construct
   (left left)
   (pair
     (pair
       (right right left left left)
       (right right left right left))
     (pair
       (right left left)
       (right right right left))))
 (construction-call construct argument)
 (construction pair construction-call)

 ; Native functions receive (return value).
 (identity
   (left left)
   (pair
     (right right left left)
     (right right right left)))
 (first
   (left left)
   (pair
     (right right left left)
     (right right right left left)))
 (second
   (left left)
   (pair
     (right right left left)
     (right right right right left)))
 (duplicate
   (left left)
   (pair
     (right right left left)
     (pair
       (right right right left)
       (right right right left))))
 (swap
   (left left)
   (pair
     (right right left left)
     (pair
       (right right right right left)
       (right right right left left))))

 (A A)
 (B B)
 (AB A B)
 (identity-argument identity A)
 (identity-call identity identity-argument)
 (identity-root pair identity-call)
 (first-argument first AB)
 (first-call first first-argument)
 (first-root pair first-call)
 (second-argument second AB)
 (second-call second second-argument)
 (second-root pair second-call)
 (duplicate-argument duplicate A)
 (duplicate-call duplicate duplicate-argument)
 (duplicate-root pair duplicate-call)
 (swap-argument swap AB)
 (swap-call swap swap-argument)
 (swap-root pair swap-call))
