((dashboard ((origin first second) initialAppearance)
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
                  (props
                    (onclick
                      (continue
                        (observe (((history focus) next) ink)))))
                  Ink)
                (button
                  (props
                    (onclick
                      (continue
                        (observe (((history focus) next) pastel)))))
                  Pastel)
                (button
                  (props
                    (onclick
                      (continue
                        (observe (((history focus) next) color)))))
                  Color)
                (button
                  (props
                    (onclick
                      (continue
                        (observe (((history focus) next) plain)))))
                  Plain)))))

        (div (props (class (text panel scene)))
          (label (props (class row))
            (text Root Source)
            (textarea
              (props
                (readonly true)
                (value (source focus)))))

          (div (props (class row))
            (button
              (props
                (onclick
                  (continue
                    (observe (((focus next) history) appearance)))))
              (text Next))
            (button (props (disabled true)) (text Undo))
            (button
              (props
                (onclick
                  (continue
                    (observe (((origin first) second) appearance)))))
              (text Reset)))

          (label (props (class (text row output)))
            (text Previous)
            (serialize history appearance))

          (label (props (class (text row output)))
            (text Result)
            (serialize focus appearance)))))
    (observe (((origin first) second) initialAppearance)))))
