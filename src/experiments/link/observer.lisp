; Every state needed to apply I to A is authored before observation begins.
; x is visible here so the binding can share I's parameter identity. A live
; observer would instead reach x by entering I.

((x x)
 (I x x)
 (A A)

 (Empty Empty)
 (Environment Empty (x A))

 (Application I A)
 (Entered Environment x)
 (Returned Environment A)

; Each right step exposes the next carried state on the left. The final state
; returns to Observer, so the authored observation repeats without allocation.
 (Observer
   (Application
     (Entered
       (Returned Observer)))))
