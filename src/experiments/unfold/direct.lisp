; Direct-reference unfolding. Every expression except self and make is the
; exact identity it returns. Functions are therefore connected to their
; targets before they run.

((self self)
 (make self self)
 (pair self make)

 (A A)
 (return-A
   pair
   (make return-A A))
 (return-A-call return-A A)
 (return-A-root pair return-A-call)

 (remember-A
   pair
   (make remember-A (make self A)))
 (remember-A-call remember-A A)
 (remember-A-root pair remember-A-call))

; A cycle between separate functions additionally needs an enclosing scope
; that can introduce both identities together, or a way to delay construction
; of the second function's body. The forward-only raw assembler has neither.
