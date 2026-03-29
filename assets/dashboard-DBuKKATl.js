import{n as k,g as t,e as y,b as A,o as O,q as R,r as g,p as j}from"./index-CAPcTyoS.js";import{layout as D}from"./layout-DtoNJd_r.js";import{build as T,materialize as S,collapse as w}from"./links-4og7zZO3.js";import{parse as z}from"./sexpr-CAJ7STJM.js";/* empty css              */const B=`; Binary pairs only: () or (a b)
; Collapse rule: (() x) -> x

; I = (() #0)
; K = (() (() #1))
; S = (() (() (() ((#2 #0) (#1 #0)))))
; I a = ((() #0) a)
; K a b = (((() (() #1)) a) b)
; S a b c = ((((() (() (() ((#2 #0) (#1 #0))))) a) b) c)

((() #0) a)
`,c=B,I=e=>`Collapse at ${e.path}`,K=e=>D(e),L=e=>{const n=T(z(e)),l=S(...n);return{model:n,pair:l}},P=e=>{let n=null;const l=w(...e,i=>{n=i});return{model:l,pair:S(...l),changed:l[0]!==e[0]||l[1]!==e[1],event:n}},x=e=>{try{const n=L(e);return{source:e,model:n.model,pair:n.pair,frame:K(n.pair),error:null,history:[]}}catch(n){return{source:e,model:null,pair:null,frame:null,error:String(n?.message||n),history:[]}}},h=(e,n)=>e(x(n)),q=({title:e,hint:n,kind:l=null,scene:i})=>{const d=x(c);let s;return s=k(({source:p=c,model:o=d.model,pair:u=d.pair,frame:m=d.frame,error:b=null,history:a=[],event:f=null}={})=>{const r=o===null?null:P(o),v=!!r&&!r.changed,_=["dashboard",l].filter(Boolean).join(" "),C=Array.isArray(n)?n:[n],E=()=>u===null||!r?.changed?void 0:s({source:p,model:r.model,pair:r.pair,frame:m,error:null,history:[...a,{model:o,pair:u}],event:r.event}),U=()=>a.length?s({source:p,model:a[a.length-1].model,pair:a[a.length-1].pair,frame:m,error:null,history:a.slice(0,-1),event:null}):void 0;return t({class:_},t({class:"panel"},y(e),A({class:"hint"},...C),O("Program / expression",R({value:p,onchange:$=>h(s,String($??"")),spellcheck:!1})),t({class:"row"},g({onclick:()=>h(s,c)},"Reset"),g({onclick:E,disabled:!!b||!r?.changed},v?"Stable":"Reduce"),g({onclick:U,disabled:a.length===0},"Undo")),t({class:"hint"},`Steps: ${a.length}`),f?t({class:"hint expr"},I(f)):null,b?j({class:"expr"},`Error: ${b}`):null),t({class:"panel"},t({class:"scene"},i(u,f,m,o))))}),s},N=Object.freeze(Object.defineProperty({__proto__:null,DEFAULT_SOURCE:c,dashboard:q},Symbol.toStringTag,{value:"Module"}));export{B as D,N as a,q as d};
