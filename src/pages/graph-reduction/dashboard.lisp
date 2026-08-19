((fix x (fix x))
 (next (x y z) (y z x))
 (observe state (observe (next state)))
 (dashboard ((current future) appearance)
      (fix
        (div (class dashboard-view)
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
                    (onclick
                      (dashboard
                        ((current future) ink)))
                    Ink)
                  (button
                    (onclick
                      (dashboard
                        ((current future) pastel)))
                    Pastel)
                  (button
                    (onclick
                      (dashboard
                        ((current future) color)))
                    Color)
                  (button
                    (onclick
                      (dashboard
                        ((current future) plain)))
                    Plain)))))

          (div (class (text panel scene))
            (label (class row)
              (text Expression)
              (textarea (value (source current))))

            (div (class row)
              (button
                (onclick
                  (dashboard (future appearance)))
                (text Next))
              (button (disabled true) (text Undo))
              (button (disabled true) (text Reset)))

            (label (class (text row output))
              Result
              (serialize current appearance))))))
 (component
   (dashboard
     ((observe (a b c)) ink))))
