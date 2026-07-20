; Pair-local root kernel experiment.
;
; Run:
;
;   node cli.js --link link-kernel.lisp 48
;
; The root carries one kernel state. Each state name below documents the
; mode, active bank, and free bank it represents:
;
;   K0 = Allocating, active ANil, free F01
;   K1 = Allocating, active A0,   free F1
;   K2 = Allocating, active A10,  free FNil
;   K3 = Freeing,    active A10,  free FNil
;   K4 = Freeing,    active A0,   free F1
;   K5 = Freeing,    active ANil, free F01
;
; Runtime stepping follows right edges only. The source authors the transition
; policy; the host only steps and reads.

(Loop step state (step state (Loop step)))
(Yield continue state (continue state))

(K0 k0 k1 k2 k3 k4 k5 k0)
(K1 k0 k1 k2 k3 k4 k5 k1)
(K2 k0 k1 k2 k3 k4 k5 k2)
(K3 k0 k1 k2 k3 k4 k5 k3)
(K4 k0 k1 k2 k3 k4 k5 k4)
(K5 k0 k1 k2 k3 k4 k5 k5)

(Next state continue
  (state
    (Yield continue K1)
    (Yield continue K2)
    (Yield continue K3)
    (Yield continue K4)
    (Yield continue K5)
    (Yield continue K0)))

(Loop Next K0)
