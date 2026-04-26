import{a as g,d as f,h as v,b as H,e as L,f as P,i as x}from"./index-D7p00mHM.js";import{compile as c}from"./compile-CvKdgnas.js";import{observe as Y}from"./observe-DJVDzK5C.js";import"./construct-D8-8Ujuh.js";import"./expand-eDonBi6t.js";import"./template-DTPkhQDh.js";import"./shared-CLRPfav4.js";import"./materialize-D0wSvoPu.js";import"./parse-CllDPKqS.js";const i=`; Basis-style program source.
; The compiler expands \`def\` and fully applied \`defn\` forms into pair motifs
; that \`observe\` can expose one tick at a time.

(def I ())
(def id I)

(defn K (x y) x)
(def const K)

(defn S (x y z) ((x z) (y z)))
(def spread S)

(defn B (f g x) (f (g x)))
(def compose B)

(defn C (f x y) ((f y) x))
(def flip C)

(defn W (f x) ((f x) x))
(def split W)

(defn true (x y) x)
(defn false (x y) y)

(defn if (p th el) ((p th) el))
(defn not (p x y) ((p y) x))
(defn and (p q x y) ((p ((q x) y)) y))
(defn or (p q x y) ((p x) ((q x) y)))

(defn pair (a b f) ((f a) b))
(defn first (p) (p true))
(defn second (p) (p false))

(defn curry (f x y) (f ((pair x) y)))
(defn uncurry (f p) ((f (first p)) (second p)))

(defn left (x y) x)
(defn right (x y) y)
(defn self (x) x)

(defn zero (f x) x)
(defn one (f x) (f x))
(defn two (f x) (f (f x)))
(defn succ (n f x) (f ((n f) x)))
(defn add (m n f x) ((m f) ((n f) x)))
(defn mul (m n f x) ((m (n f)) x))
(defn is-zero (n) ((n (const false)) true))

(defn APPLY-SELF (x v) ((x x) v))
(defn THETA (f x) (f (APPLY-SELF x)))
(def apply-self APPLY-SELF)
(def theta THETA)

; Stateless fixed point: (lambda x. f (x x)) (lambda x. f (x x)).
(defn Y-THETA (f x) (f (x x)))
(defn Y (f) ((Y-THETA f) (Y-THETA f)))

(defn Z (f) ((THETA f) (THETA f)))
(def fix Z)

; Try:
; (((S a) b) c)
; (((pair a) b) left)
; ((((add one) two) f) x)
; ((I a) b)

(((S a) b) c)
`,k=({graph:n,history:s,time:o=s.length,previous:e=s[o-1],stable:a=e?.graph===n})=>({time:o,previous:e,stable:a}),d=g(n=>{const{graph:s,source:o,history:e,error:a,options:l}=n,{className:m,title:y,description:b,scene:h}=l,{time:r,previous:T,stable:t}=k(n),u=()=>d({...n,graph:Y(s),history:[...e,n]}),E=p=>d({...n,...c(p),source:p}),A=()=>d(T),S=()=>d(e[0]);return f({class:`dashboard ${m}`},f({class:"panel"},v(y),H({class:"description"},b),L("Program / expression",P({value:o,onchange:E,spellcheck:!1})),f({class:"row"},x({onclick:u,disabled:t||a},t?"Stable":"Next"),x({onclick:A,disabled:r===0},"Undo"),x({onclick:S,disabled:r===0},"Reset")),f({class:"description"},`Steps: ${r}`)),f({class:"panel scene"},a||h(n)))}),K=n=>()=>d({...c(i),source:i,history:[],options:n});export{K as default};
