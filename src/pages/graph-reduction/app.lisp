; Works:
; (article
;   (h1 (text This page was emitted from wasm)))

((fix x (fix x))
 (app message
      (fix
        (div
          (button
            (onclick (app Hello-component))
            (text Click me))
          (p message))))
 (component
   (app Hello-world)))
