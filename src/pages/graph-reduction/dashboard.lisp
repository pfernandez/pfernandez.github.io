((dashboard ((origin first second) initialAppearance)
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
    (observe (((origin first) second) initialAppearance)))))
