((A
   (div
     (p "State A")
     (button
       (onclick
         (() (B (div (p "State B") (button (onclick (() A)) "Next")))))
       "Next")))

 (render
   (html
     (body
       ((observe (() A)) A)))))
