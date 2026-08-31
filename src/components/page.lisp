((page child
   (main
     (div (props (id sidebar))
       (div
         (props
           (id sidebar-panel)
           (class sidebar-panel))
         (header
           (h1 (text pfernandez.github.io)))
         (navigation route)))

     (div (props (id content))
       (component child)))))
