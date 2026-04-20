import{a as T,d as f,h as A,b as E,e as v,f as L,i as o}from"./index-DnI1bM8t.js";import{compile as c}from"./sexpr-Bl81dlLc.js";import{observe as P}from"./observe-DbHS6TdD.js";const l=`; Basis-style program source.
; The compiler expands \`def\` and fully applied \`defn\` forms into pair motifs
; that \`observe\` can expose one tick at a time.

(defn I (x) x)
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

(defn Z (f) ((THETA f) (THETA f)))
(def fix Z)

; Try:
; (((S a) b) c)
; (((pair a) b) left)
; ((((add one) two) f) x)
; ((I a) b)

(((S a) b) c)
`,w=({className:i,title:y,description:m,scene:b})=>{const e=T(({source:s=l,graph:h=c(s),history:d=[]}={})=>{const n=h,a=d.length,t=d[a-1],r=typeof n=="object"&&!Array.isArray(n)&&String(n),x=!!a&&t===n,u=()=>e({source:s,graph:P(n),history:[...d,n]}),g=()=>e({source:s,graph:t,history:d.slice(0,-1)}),S=()=>e({source:l});return f({class:`dashboard ${i}`},f({class:"panel"},A(y),E({class:"description"},m),v("Program / expression",L({value:s,onchange:p=>e({source:p,graph:c(p)}),spellcheck:!1})),f({class:"row"},o({onclick:u,disabled:x||!!r},x?"Stable":"Next"),o({onclick:g,disabled:a===0},"Undo"),o({onclick:S},"Reset")),f({class:"description"},`Steps: ${a}`)),f({class:"panel scene"},r||b(n)))});return e};export{w as default};
