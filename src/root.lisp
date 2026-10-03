((include /src/pages/pages.lisp)
 (include /src/components/page.lisp)
 (root observation (root observation))
 (document content
   (html
     (head
       (title (text pfernandez.github.io)))
     (body
       (observe content))))
 (first (focus next) focus)
 (start state
   (render
     (first
       (root
         (document
           (page state))))))
 (include ./initial.lisp))

; Possible private-observer shapes
;
; 1. An included dashboard contains a private recursive observer. Root receives
; the dashboard's exposed value. Dashboard retains initial identities while
; transition carries frames.
;
; ((dashboard state
;    ((transition frame
;       (... (transition next)))
;     (transition state)))
;  (root initial
;    ((document content (... content))
;     (document (dashboard initial))))
;  (root source))
;
; 2. One recursive observe with a uniform argument shape. Every call carries
; the origin, current state, and appearance. This needs an initial pair identity
; that can be supplied twice without constructing two distinct copies.
;
; ((transition ((origin (x y z)) appearance)
;    ((rotate (x y z) (y z x))
;     (...
;       (transition ((origin (rotate (x y z))) appearance))
;       (transition ((origin origin) appearance)))))
;  (observe (transition ((initial initial) ink))))
;
; 3. A two-stage observe selected by explicit boot and run forms. This most
; directly expresses one observer bootstrapping and continuing itself, but it
; requires multiple clauses or pattern dispatch that the language does not yet
; define.
;
; ((transition (boot initial)
;    (... (transition (run ((identity (rotate initial)) ink)))))
;  (transition (run state)
;    (... (transition (run next))))
;  (observe (transition (boot (C A B)))))
