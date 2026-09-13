((A
   (div
     (p State A)
     (button
       (onclick
         (() (B (div (p State_B) (button (onclick (() A)) Next)))))
       Next)))

 (render
   (html
     (body
       ((component (() A)) A)))))
