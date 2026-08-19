((fix x (fix x))
 (app (current appearance)
      (fix
        (div (class dashboard)
          (div (class panel)
            (h2 (text Graph Reduction))
            (p (class description)
              (text
                The expression defines an observer whose left side is its
                present configuration and whose right side is its following
                configuration. Symbols and colors denote memory address))

            (div (class (text row colors))
              (text Color scheme)
              (details
                (summary appearance)
                (div (class choices)
                  (button
                    (onclick (app (current ink)))
                    Ink)
                  (button
                    (onclick (app (current pastel)))
                    Pastel)
                  (button
                    (onclick (app (current color)))
                    Color)
                  (button
                    (onclick (app (current plain)))
                    Plain)))))

          (div (class (text panel scene))
            (label (class row)
              (text Expression)
              (textarea (value (source current))))

            (div (class row)
              (button (disabled true) (text Next))
              (button (disabled true) (text Undo))
              (button (disabled true) (text Reset)))

            (label (class (text row output))
              Result
              (serialize current appearance))

            (div (class (text description row))
              (text Steps: 0))))))
 (component
   (app ((a b) ink))))
