import{a as A,d as r,h as E,b as U,e as k,f as v,i as d,p as C}from"./index-Bob7fOwx.js";import{parse as R,resolve as T}from"./sexpr-DPe4j6DJ.js";import{collapse as _}from"./collapse-D0cOjRLY.js";const w=`; Binary pairs only: () or (a b)
; Collapse rule: (() x) -> x
;
; I = ()  ; index 0
; S = (() (() (() ((0 2) (1 2)))))  ; index 2
;
; (() a)  ; I a -> a
; K is not representable in the "indices only" encoding if an argument is unused
; (because arity is inferred from the largest index referenced).
; (((((0 2) (1 2)) a) b) c)  ; S a b c -> ((a c) (b c))

(((((0 2) (1 2)) a) b) c)
`,u=w,B=n=>_(T(n)),b=n=>{try{const e=R(n);return{source:n,pair:e,error:null,history:[],stable:!1}}catch(e){return{source:n,pair:null,error:String(e?.message||e),history:[],stable:!1}}},p=(n,e)=>n(b(e)),L=({title:n,hint:e,kind:f=null,scene:g})=>{const h=b(u);let s;return s=A(({source:t=u,pair:l=h.pair,error:c=null,history:a=[],stable:i=!1}={})=>{const m=["dashboard",f].filter(Boolean).join(" "),x=Array.isArray(e)?e:[e],S=()=>{if(i||!Array.isArray(l))return;const o=B(l);return s(o===l?{source:t,pair:l,error:null,history:a,stable:!0}:{source:t,pair:o,error:null,history:[...a,l],stable:!1})},y=()=>a.length?s({source:t,pair:a[a.length-1],error:null,history:a.slice(0,-1),stable:!1}):void 0;return r({class:m},r({class:"panel"},E(n),U({class:"hint"},...x),k("Program / expression",v({value:t,onchange:o=>p(s,String(o??"")),spellcheck:!1})),r({class:"row"},d({onclick:()=>p(s,u)},"Reset"),d({onclick:S,disabled:!!c||i},i?"Stable":"Reduce"),d({onclick:y,disabled:a.length===0},"Undo")),r({class:"hint"},`Steps: ${a.length}`),c?C({class:"expr"},`Error: ${c}`):null),r({class:"panel"},r({class:"scene"},g(l))))}),s};export{u as DEFAULT_SOURCE,L as dashboard};
