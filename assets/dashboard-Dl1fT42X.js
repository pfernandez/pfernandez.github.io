import{a as L,d as c,h as v,b as A,e as p,j as k,o as z,f as Z,i as d,p as y,k as w}from"./index-DrIXz3UJ.js";import{compile as N}from"./compile-B_R2F9w7.js";import{observe as q}from"./observe-ka5yeo88.js";import{s as M,a as R,n as F,b as G,i as K}from"./__vite-browser-external-i-njnD2X.js";import"./parse-BNMdztKu.js";const h=`(I (x x))                         ; identity
(K ((x x) y))                     ; constant
(S (((((x z) (y z)) x) y) z))     ; substitution

(B ((((f (g x)) f) g) x))         ; compose
(C ((((f y x) f) x) y))           ; exchange arguments
(W (((f x x) f) x))               ; duplicate argument
(M ((x x) x))                     ; self-application

(Y ((f (Y f)) f))                 ; named self-reference
(Loop (((step state (Loop step)) step) state))
(Yield (((continue state) state) continue))

(True ((x x) y))                  ; choose left
(False ((y x) y))                 ; choose right
(If ((((p x y) p) x) y))          ; choose by predicate
(Not ((p False True) p))
(And (((p q False) p) q))
(Or (((p True q) p) q))

(Pair ((((f x y) x) y) f))        ; Church pair
(First ((p K) p))
(Second ((p False) p))

; Scott data: a constructor is a definition, a value is an inert
; partial application, and case analysis completes the arity.
; Branches not taken stay partial, so their bodies are not reduced.

(Zero ((z z) s))                  ; case n of zero -> z
(Succ ((((s m) m) z) s))          ;           succ m -> s m
(Nil ((n n) c))                   ; case l of nil -> n
(Cons (((((c h t) h) t) n) c))    ;           cons h t -> c h t

; Eliminators recurse on literal substructure, so they settle on
; closed data and stay symbolic on open data. Self-reference keeps
; a helper and its caller in the same active call.

(Head ((l no K) l))
(LastGo (((t h LastGo) h) t))
(Last ((l no LastGo) l))
(LenStep (((Succ (t Zero LenStep)) h) t))
(Length ((l Zero LenStep) l))
(AddStep (((Succ (m2 n (AddStep n))) n) m2))
(Add (((m n (AddStep n)) m) n))
(MulStep (((Add n (m2 Zero (MulStep n))) n) m2))
(Mul (((m Zero (MulStep n)) m) n))

; Corecursion: repeated active calls share an answer, so an infinite
; structure is a finite cycle. Ask for only the piece you need.

(Repeat ((Cons x (Repeat x)) x))

; Application of a literal function. A computed answer in head
; position is inert: reduction never looks through answers.

(App (((p q) p) q))

; Closed data settles:
; (Head (Cons a (Cons b Nil)))
; (Length (Cons a (Cons b Nil)))
; (Add (Succ Zero) (Succ Zero))
; (Mul (Succ (Succ Zero)) (Succ (Succ Zero)))
; (Repeat a no K)

; Open data stays a residual form:
; (Add m (Succ Zero))
; (Length xs)

; (Last (Cons a (Cons b Nil)))

(S a b c)
`,E=["ink","pastel","color","plain"],O=(e,n)=>{const o=F(e);return y({class:"output"},...o.map(s=>s.identity===void 0?s.text:w({class:"identity",style:G(s.identity,n,K(o))},s.text)))},m=e=>{let n=[],o;try{n=N(e)}catch(s){o=s}return{graph:n,error:o}},T=({graph:e,history:n,time:o=n.length,previous:s=n[o-1],stable:a=e===n[0]})=>({time:o,previous:s,stable:a}),r=L((e={...m(h),source:h,history:[],scheme:"ink"})=>{const{graph:n,source:o,history:s,error:a,scheme:i}=e,{time:l,previous:f,stable:u}=T(e),x=()=>r({...e,graph:q(n,t=>console.log(M(t))),history:[...s,e]}),S=t=>r({...e,...m(t),source:t,history:[]}),b=t=>r({...e,scheme:t}),g=()=>r({...f,scheme:i}),C=()=>r({...s[0],scheme:i});return c({class:"dashboard"},c({class:"panel"},v("Graph Reduction"),A({class:"description"},"Expressions are converted directly to graph structure. ","Symbols and colors denote memory address"),p({class:"row"},"Color scheme",k({value:i,onchange:b},...E.filter(t=>R[t]).map(t=>z({value:t},t))))),c({class:"panel scene"},p({class:"row"},"Expression",Z({value:o,onchange:S,spellcheck:!1})),c({class:"row"},d({onclick:x,disabled:u||a},u?"Stable":"Next"),d({onclick:g,disabled:l===0},"Undo"),d({onclick:C,disabled:l===0},"Reset")),p({class:"row output"},"Result",a?y({class:"error"},String(a)):O(n,i)),c({class:"description row"},`Steps: ${l}`)))});export{r as default};
