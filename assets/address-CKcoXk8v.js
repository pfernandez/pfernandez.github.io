const n=(e,t,s)=>(s?.(t),e.getUint32(t,!0)===t?t:n(e,e.getUint32(t,!0),s)),d=(e,t)=>e.getUint32(t+4,!0);export{n as observeAddress,d as selectAddress};
