((root ((origin first second) initialAppearance)
   ((observe (((history focus) next) appearance)
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
                    (observe (((history focus) next) ink)))
                  Ink)
                (button
                  (onclick
                    (observe (((history focus) next) pastel)))
                  Pastel)
                (button
                  (onclick
                    (observe (((history focus) next) color)))
                  Color)
                (button
                  (onclick
                    (observe (((history focus) next) plain)))
                  Plain)))))

        (div (class (text panel scene))
          (label (class row)
            (text Source)
            (textarea (value (source focus))))

          (div (class row)
            (button
              (onclick
                (observe (((focus next) history) appearance)))
              (text Next))
            (button (disabled true) (text Undo))
            (button
              (onclick
                (observe (((origin first) second) appearance)))
              (text Reset)))

          (label (class (text row output))
            (text Previous)
            (serialize history appearance))

          (label (class (text row output))
            (text Result)
            (serialize focus appearance)))))
    (observe (((origin first) second) initialAppearance))))
 (component (root ((A B C) ink))))

; Possible private-observer shapes
;
; 1. A root scope with a private recursive observer. This is the form used
; above. Root retains the initial identities while observe carries each frame.
;
; ((root initial
;    ((observe state
;       (... (observe next)))
;     (observe initial)))
;  (component (root source)))
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
