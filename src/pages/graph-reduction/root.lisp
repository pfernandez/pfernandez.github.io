((root initial
   ((document content
      (html
        (head
          (title (text pfernandez.github.io)))
        (body
          (component content))))
    (document (dashboard initial))))
 (root ((A B C) ink)))

; Possible private-observer shapes
;
; 1. An included dashboard contains a private recursive observer. Root receives
; the dashboard's exposed value. Dashboard retains initial identities while
; observe carries frames.
;
; ((dashboard state
;    ((observe frame
;       (... (observe next)))
;     (observe state)))
;  (root initial
;    ((document content (... content))
;     (document (dashboard initial))))
;  (root source))
;
; 2. One recursive observe with a uniform argument shape. Every call carries
; the origin, current state, and appearance. This needs an initial pair identity
; that can be supplied twice without constructing two distinct copies.
;
; ((observe ((origin (x y z)) appearance)
;    ((rotate (x y z) (y z x))
;     (...
;       (observe ((origin (rotate (x y z))) appearance))
;       (observe ((origin origin) appearance)))))
;  (component (observe ((initial initial) ink))))
;
; 3. A two-stage observe selected by explicit boot and run forms. This most
; directly expresses one observer bootstrapping and continuing itself, but it
; requires multiple clauses or pattern dispatch that the language does not yet
; define.
;
; ((observe (boot initial)
;    (... (observe (run ((identity (rotate initial)) ink)))))
;  (observe (run state)
;    (... (observe (run next))))
;  (component (observe (boot (C A B)))))
