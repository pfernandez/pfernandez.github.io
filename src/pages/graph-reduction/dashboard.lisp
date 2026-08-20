((fix x (fix x))
 (rotate (x y z) (y z x))
 (observe state (observe (rotate state)))
 (dashboard ((history (focus next)) appearance)
      (fix
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
                      (dashboard
                        ((history (focus next)) ink)))
                    Ink)
                  (button
                    (onclick
                      (dashboard
                        ((history (focus next)) pastel)))
                    Pastel)
                  (button
                    (onclick
                      (dashboard
                        ((history (focus next)) color)))
                    Color)
                  (button
                    (onclick
                      (dashboard
                        ((history (focus next)) plain)))
                    Plain)))))

          (div (class (text panel scene))
            (label (class row)
              (text Source)
              (textarea (value (source focus))))

            (div (class row)
              (button
                (onclick
                  (dashboard ((focus next) appearance)))
                (text Next))
              (button (disabled true) (text Undo))
              (button (disabled true) (text Reset)))

            (label (class (text row output))
              Previous
              (serialize history appearance))

            (label (class (text row output))
              Result
              (serialize focus appearance))))))
 (component
   (dashboard
     ((seed (observe (a b c))) ink))))
