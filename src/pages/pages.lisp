((include /src/pages/graph-reduction/dashboard.lisp)
 (include /src/pages/machine/machine.lisp)

 (site self
   ((title (text pfernandez.github.io))
    (pages
      (((path graph-reduction)
        (summary (text Graph Reduction))
        (items
          (((label Dashboard)
            (route /graph-reduction)
            (source /src/pages/graph-reduction/dashboard.lisp)
            (default true))
           ((label Machine)
            (route /graph-reduction/machine)
            (source /src/pages/machine/machine.lisp))))))))))
