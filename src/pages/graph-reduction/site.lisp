((site child
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
                    (class active)
                    (aria-current page))
                   (text Dashboard))))))))

     (div (props (id content))
       (component child)))))
