((observe initial
   ((identity x x)
    (rotate (x y z) (rotate (y z x)))
    (screen ((origin (history (focus next))) appearance)
      (div (class dashboard-view)
        (div (class panel)
          (h2 (text Graph Reduction))
          (p (class description)
            (text
              The observer carries its previous, present, and following
              configurations. Symbols and colors denote memory addresses))

          (div (class (text row colors))
            (text Color scheme)
            (details
              (summary appearance)
              (div (class choices)
                (button
                  (onclick
                    (screen
                      ((origin (history (focus next))) ink)))
                  Ink)
                (button
                  (onclick
                    (screen
                      ((origin (history (focus next))) pastel)))
                  Pastel)
                (button
                  (onclick
                    (screen
                      ((origin (history (focus next))) color)))
                  Color)
                (button
                  (onclick
                    (screen
                      ((origin (history (focus next))) plain)))
                  Plain)))))

        (div (class (text panel scene))
          (label (class row)
            (text Source)
            (textarea (value (source focus))))

          (div (class row)
            (button
              (onclick
                (screen ((origin (focus next)) appearance)))
              (text Next))
            (button (disabled true) (text Undo))
            (button
              (onclick
                (screen ((origin origin) appearance)))
              (text Reset)))

          (label (class (text row output))
            Previous
            (serialize history appearance))

          (label (class (text row output))
            Result
            (serialize focus appearance)))))
    (screen ((identity (rotate initial)) ink))))
 (component (observe (C A B))))

; Possible private-observer shapes
;
; 1. A bootstrap scope with a private recursive screen. This is the form used
; above. It preserves the origin, history, and reset identities, but the
; recurring function is named screen rather than observe.
;
; ((observe initial
;    ((identity x x)
;     (rotate (x y z) (rotate (y z x)))
;     (screen state
;       (... (screen next)))
;     (screen ((identity (rotate initial)) ink))))
;  (component (observe (C A B))))
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
