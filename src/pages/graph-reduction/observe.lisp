((identity x x)
 (rotate (x y z) (rotate (y z x)))
 (observe ((origin (history (focus next))) appearance)
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
                 (observe
                   ((origin (history (focus next))) ink)))
               Ink)
             (button
               (onclick
                 (observe
                   ((origin (history (focus next))) pastel)))
               Pastel)
             (button
               (onclick
                 (observe
                   ((origin (history (focus next))) color)))
               Color)
             (button
               (onclick
                 (observe
                   ((origin (history (focus next))) plain)))
               Plain)))))

     (div (class (text panel scene))
       (label (class row)
         (text Source)
         (textarea (value (source focus))))

       (div (class row)
         (button
           (onclick
             (observe ((origin (focus next)) appearance)))
           (text Next))
         (button (disabled true) (text Undo))
         (button
           (onclick
             (observe ((origin origin) appearance)))
           (text Reset)))

       (label (class (text row output))
         Previous
         (serialize history appearance))

       (label (class (text row output))
         Result
         (serialize focus appearance)))))
 (component
   (observe
     ((identity (rotate (C A B))) ink))))
