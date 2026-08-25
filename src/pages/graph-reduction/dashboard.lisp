((screen ((origin first second) initialAppearance)
   ((observe (((history focus) next) appearance)
      (div (props (class dashboard-view))
        (div (props (class panel))
          (h2 (text Graph Reduction))
          (p (props (class description))
            (text
              The observer carries its previous, present, and following
              configurations. Symbols and colors denote memory addresses))

          (div (props (class (text row colors)))
            (text Color scheme)
            (details
              (summary appearance)
              (div (props (class choices))
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

        (div (props (class (text panel scene)))
          (label (props (class row))
            (text Source)
            (textarea (props (value (source focus)))))

          (div (props (class row))
            (button
              (onclick
                (observe (((focus next) history) appearance)))
              (text Next))
            (button (props (disabled true)) (text Undo))
            (button
              (onclick
                (observe (((origin first) second) appearance)))
              (text Reset)))

          (label (props (class (text row output)))
            (text Previous)
            (serialize history appearance))

          (label (props (class (text row output)))
            (text Result)
            (serialize focus appearance)))))
    (observe (((origin first) second) initialAppearance)))))
