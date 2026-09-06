; Definitions are ordinary (input body) pairs.

((Ix (Ix Ix))
 (I (Ix Ix))

 (Kx (Kx Kx))
 (Ky (Ky Ky))
 (Kinput (Kx Ky))
 (K (Kinput Kx))

 (Sx (Sx Sx))
 (Sy (Sy Sy))
 (Sz (Sz Sz))
 (Syz (Sy Sz))
 (Sinput (Sx Syz))
 (Sxz (Sx Sz))
 (Syz-body (Sy Sz))
 (Sbody (Sxz Syz-body))
 (S (Sinput Sbody))

 (a (a a))
 (b (b b))
 (c (c c))
 (bc (b c))

; Each event contains the authored state before and after its transition.

 (I-call (I a))
 (I-event (I-call a))

 (Kargs (a b))
 (K-call (K Kargs))
 (K-event (K-call a))

 (Sargs (a bc))
 (S-call (S Sargs))
 (ac (a c))
 (Sresult (ac bc))
 (S-event (S-call Sresult))

; A local environment can also be authored as accumulated bindings.

 (Empty (Empty Empty))
 (Sx-a (Sx a))
 (Environment-x (Empty Sx-a))
 (Sy-b (Sy b))
 (Environment-y (Environment-x Sy-b))
 (Sz-c (Sz c))
 (Environment (Environment-y Sz-c))
 (S-observation (Environment Sbody))

; History accumulates left while new events arrive on the right.

 (History (History History))
 (I-history (History I-event))
 (K-history (I-history K-event))
 (Root (K-history S-event)))
