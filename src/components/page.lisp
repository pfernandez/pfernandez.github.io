((dashboard-initial
   (dashboard ((A B C) ink)))
 (machine-initial
   (machine machine))
 (page child
   (main
     (div (props (id sidebar))
       (div
         (props
           (id sidebar-panel)
           (class sidebar-panel))
         (header
           (h1 (text pfernandez.github.io)))
         (nav
           (section
             (h2 (text Graph Reduction))
             (ul
               (li
                 (a
                   (props
                     (href /graph-reduction)
                     (onclick
                       (page dashboard-initial)))
                   (text Dashboard)))
               (li
                 (a
                   (props
                     (href /graph-reduction/machine)
                     (onclick
                       (page machine-initial)))
                   (text Machine))))))))

     (div (props (id content))
       (component child)))))
