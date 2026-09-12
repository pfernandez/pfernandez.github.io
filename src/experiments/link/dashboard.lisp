((A
   (div
     (p A)
     (button
       (onclick
         (() (B (div (p B) (button (onclick (() A)) Next)))))
       Next)))

 (render
   (html
     (body
       ((component (() A)) A)))))
