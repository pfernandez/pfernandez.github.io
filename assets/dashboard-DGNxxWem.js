import{a as S,d as i,h as H,b as L,e as P,f as Y,i as d}from"./index-DrIXz3UJ.js";import{compile as k,parse as z,init as q}from"./lisp-Tf8tAofi.js";import"./parse-CllDPKqS.js";import"./observe-Qu_JxUuU.js";import"./config.lisp-Dx6wIo7t.js";import"./wasm-QQxdonEW.js";const p=`; Basis-style program source.
; The compiler expands \`define\` and fully applied function calls into pair motifs
; that \`observe\` can expose one tick at a time.

(define (I x) x)
(define (K x y) x)
(define (S x y z) ((x z) (y z)))
(define (B f g x) (f (g x)))
(define (C f x y) ((f y) x))
(define (W f x) ((f x) x))

(define (true x y) x)
(define (false x y) y)

(define (const x y) x)
(define (if p th el) ((p th) el))
(define (not p x y) ((p y) x))
(define (and p q x y) ((p ((q x) y)) y))
(define (or p q x y) ((p x) ((q x) y)))

(define (pair a b f) (f a b))
(define (first p) (p true))
(define (second p) (p false))

(define (curry f x y) (f ((pair x) y)))
(define (uncurry f p) ((f (first p)) (second p)))

(define (left x y) x)
(define (right x y) y)
(define (self x) x)

(define (zero f x) x)
(define (one f x) (f x))
(define (two f x) (f (f x)))
(define (succ n f x) (f (n f x)))
(define (add m n f x) (m f (n f x)))
(define (mul m n f x) ((m (n f)) x))
(define (is-zero n a b) (n (K b) a))

(define (APPLY-SELF x v) ((x x) v))
(define (THETA f x) (f (APPLY-SELF x)))
(define apply-self APPLY-SELF)
(define theta THETA)

; Stateless fixed point: (lambda x. f (x x)) (lambda x. f (x x)).
(define (Y-THETA f x) (f (x x)))
(define (Y f) ((Y-THETA f) (Y-THETA f)))

(define (Z f) ((THETA f) (THETA f)))
(define fix Z)

(((S a) b) c)
`,x=q(),F=x.runtime.observe,l=e=>{try{const[n,f]=k(x,z(e));return{compiler:n,graph:f,error:null}}catch(n){return{compiler:x,graph:null,error:n.message}}},$=({graph:e,history:n,time:f=n.length,previous:o=n[f-1],stable:r=e===n[0]})=>({time:f,previous:o,stable:r}),s=S(e=>{const{graph:n,source:f,history:o,error:r,options:m}=e,{className:y,title:u,description:b,scene:h}=m,{time:a,previous:T,stable:t}=$(e),g=()=>s({...e,graph:F(n),history:[...o,e]}),E=c=>s({...e,...l(c),source:c,history:[]}),A=()=>s(T),v=()=>s(o[0]);return i({class:`dashboard ${y}`},i({class:"panel"},H(u),L({class:"description"},b),P("Program / expression",Y({value:f,onchange:E,spellcheck:!1})),i({class:"row"},d({onclick:g,disabled:t||r},t?"Stable":"Next"),d({onclick:A,disabled:a===0},"Undo"),d({onclick:v,disabled:a===0},"Reset")),i({class:"description"},`Steps: ${a}`)),i({class:"panel scene"},r||h(e)))}),R=e=>()=>s({...l(p),source:p,history:[],options:e});export{R as default};
