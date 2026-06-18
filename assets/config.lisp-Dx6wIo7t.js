const $={trace:(g,c,n="")=>{const o=(t,f="$",i=new Map)=>Array.isArray(t)?i.has(t)?`${i.get(t)}`:(i.set(t,f),t.map((s,y)=>o(s,`${f}[${y}]`,i))):t;console.log(c?c+" : ":"........................",JSON.stringify(o(g)),n?`
  -> `:"",n?JSON.stringify(o(n)):"",`
`)}};export{$ as default};
