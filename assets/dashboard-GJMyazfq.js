import{c as L,d as c,h as A,p as Z,l as d,s as k,o as w,t as z,b as u,a as N}from"./index-WBhtgHz1.js";import{c as q}from"./__vite-browser-external-Y2sFf2SH.js";import{observe as M}from"./observe-XoBxMiV3.js";import{schemes as R,serialize as m,schemeNames as F}from"./serialize-B4paFIzI.js";import"./parse-BNMdztKu.js";const f=`(I (x x))                         ; identity
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
`,x=e=>{let n=[],o=[],t;try{({graph:n,legend:o}=q(e))}catch(a){t=a}return{graph:n,legend:o,error:t}},G=({graph:e,history:n,time:o=n.length,previous:t=n[o-1],stable:a=e===n[0]})=>({time:o,previous:t,stable:a}),r=L((e={...x(f),source:f,history:[],scheme:R.ink})=>{const{graph:n,legend:o,source:t,history:a,error:i,scheme:l}=e,{time:p,previous:y,stable:h}=G(e),S=()=>r({...e,graph:M(n,s=>console.log(m(s,{legend:o}))),history:[...a,e]}),b=s=>r({...e,...x(s),source:s,history:[]}),g=s=>r({...e,scheme:s}),v=()=>r({...y,scheme:l}),C=()=>r({...a[0],scheme:l});return c({class:"dashboard"},c({class:"panel"},A("Graph Reduction"),Z({class:"description"},"Expressions are converted directly to graph structure. ","Symbols and colors denote memory address"),d({class:"row"},"Color scheme",k({value:l,onchange:g},...F.map(s=>w({value:s},s))))),c({class:"panel scene"},d({class:"row"},"Expression",z({value:t,onchange:b,spellcheck:!1})),c({class:"row"},u({onclick:S,disabled:h||i},h?"Stable":"Next"),u({onclick:v,disabled:p===0},"Undo"),u({onclick:C,disabled:p===0},"Reset")),d({class:"row output"},"Result",i?N({class:"error"},String(i)):m(n,{legend:o,format:"vdom",scheme:l})),c({class:"description row"},`Steps: ${p}`)))});export{r as default};
