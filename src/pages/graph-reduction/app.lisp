; Works:
; (article
;   (h1 (text This page was emitted from wasm)))

((hold x (hold x))
 (app message
      (hold
        (div
          (button
            (onclick
              (hold (alert (text Hello component))))
            ; (onclick (app (text Hello component)))
            (text Click me))
          (p message))))
 (component
   (app (text Hello world))))

; ((app message
;       (button
;         (onclick (alert message))
;         (text Click me)))
;  (app (text Hello world)))
