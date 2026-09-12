// ==UserScript==
// @name         CSOL AutoAgent Generic
// @namespace    openai.csol.autoagent
// @version      1.1.0
// @description  Persistent helper for CSOL Small Claims. Imports case data from #csolcfg, automates reversible steps, and stops before Submit Claim.
// @match        https://www.csol.ie/*
// @match        https://csol.ie/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
"use strict";
const KCFG="CSOL_AUTOAGENT_CONFIG", KRUN="CSOL_AUTOAGENT_RUNNING", KSUB="CSOL_AUTOAGENT_ALLOW_SUBMIT", KLAST="CSOL_AUTOAGENT_LAST", KLOG="CSOL_AUTOAGENT_LOG";
if(localStorage.getItem(KRUN)===null)localStorage.setItem(KRUN,"YES");
const n=s=>(s||"").toLowerCase().replace(/\s+/g," ").replace(/[^\p{L}\p{N}]+/gu," ").trim();
const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};
const bt=e=>(e.innerText||e.value||e.getAttribute("aria-label")||e.title||"").trim();
function log(msg,x){let a=[];try{a=JSON.parse(localStorage.getItem(KLOG)||"[]")}catch{};a.push({t:new Date().toISOString(),msg,x:x||null,url:location.href});localStorage.setItem(KLOG,JSON.stringify(a.slice(-80)));console.log("[CSOL-AUTOAGENT]",msg,x||"");panel(msg)}
function importCfg(){
  if(!location.hash.startsWith("#csolcfg="))return false;
  try{
    let s=location.hash.slice(9).replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";
    const cfg=JSON.parse(decodeURIComponent(escape(atob(s))));
    if(!cfg?.claimant?.fullName||!cfg?.respondent?.fullName||!cfg?.claim?.amount)throw new Error("invalid config");
    localStorage.setItem(KCFG,JSON.stringify(cfg));
    history.replaceState(null,"",location.pathname+location.search);
    log("Case configuration imported");
    return true;
  }catch(e){log("CONFIG IMPORT ERROR",String(e));return false}
}
importCfg();
let D=null;try{D=JSON.parse(localStorage.getItem(KCFG)||"null")}catch{}
function panel(msg){
 let p=document.getElementById("csol-aa");if(!p){p=document.createElement("div");p.id="csol-aa";p.style.cssText="position:fixed;right:10px;bottom:10px;z-index:2147483647;width:min(360px,92vw);background:#111;color:#fff;border-radius:12px;padding:12px;font:13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 5px 24px #0006";
 p.innerHTML='<b>CSOL AutoAgent</b><div id="csol-aa-s" style="margin-top:6px"></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button id="csol-aa-d">Copy diagnostics</button><button id="csol-aa-p">Pause</button><button id="csol-aa-r">Resume</button></div>';document.body.appendChild(p);
 p.querySelector("#csol-aa-d").onclick=async()=>{const t=JSON.stringify(diag(),null,2);try{await navigator.clipboard.writeText(t);panel("Diagnostics copied — paste into ChatGPT")}catch{prompt("Copy diagnostics:",t)}};
 p.querySelector("#csol-aa-p").onclick=()=>{localStorage.setItem(KRUN,"NO");panel("Paused")};
 p.querySelector("#csol-aa-r").onclick=()=>{localStorage.setItem(KRUN,"YES");tick()}
 }
 const s=document.getElementById("csol-aa-s");if(s)s.textContent=msg||"Running";
}
function desc(e){
 let a=[e.name,e.id,e.placeholder,e.getAttribute("aria-label"),e.title];
 if(e.id){try{const l=document.querySelector(`label[for="${CSS.escape(e.id)}"]`);if(l)a.push(l.innerText)}catch{}}
 if(e.labels)a.push(...[...e.labels].map(l=>l.innerText));
 let p=e.parentElement;for(let i=0;i<4&&p;i++,p=p.parentElement)if(p.innerText&&p.innerText.length<1200)a.push(p.innerText);
 return n(a.filter(Boolean).join(" "));
}
function sec(e){let p=e,t="";for(let i=0;i<7&&p;i++,p=p.parentElement)if(p.innerText)t+=" "+p.innerText.slice(0,1800);t=n(t);if(t.includes("respondent"))return"respondent";if(t.includes("claimant"))return"claimant";if(t.includes("claim details")||t.includes("particulars")||t.includes("amount claimed"))return"claim";return""}
function setv(e,v){
 if(v==null||e.disabled||e.readOnly)return false;
 if(e instanceof HTMLSelectElement){const w=n(v),o=[...e.options].find(o=>n(o.textContent)===w)||[...e.options].find(o=>n(o.textContent).includes(w))||[...e.options].find(o=>w.includes(n(o.textContent)));if(!o)return false;e.value=o.value}
 else{const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,s=Object.getOwnPropertyDescriptor(p,"value")?.set;s?s.call(e,v):e.value=v}
 ["input","change","blur"].forEach(x=>e.dispatchEvent(new Event(x,{bubbles:true})));e.style.outline="3px solid #2e7d32";return true
}
function val(e){
 const d=desc(e),s=sec(e),q=D?.claim;
 if(e instanceof HTMLSelectElement){
   if(/claim.*category|category.*claim/.test(d))return q?.category;
   if(/claim.*type|type.*claim/.test(d))return q?.type;
   if(/court|district.*area|court.*area/.test(d))return q?.courtArea;
   if(s==="respondent"&&/(party.*type|respondent.*type|entity.*type|organisation.*type)/.test(d))return D?.respondent?.type;
   if(s==="claimant"&&/(party.*type|claimant.*type|entity.*type)/.test(d))return D?.claimant?.type;
   return null
 }
 if(/particulars|details of claim|claim details|description of claim|nature of claim|claim description/.test(d))return q?.particulars;
 if(/amount|sum claimed|claim value|value of claim/.test(d))return q?.amount;
 const o=s==="respondent"?D?.respondent:s==="claimant"?D?.claimant:null;if(!o)return null;
 if(/eircode|postal code|postcode/.test(d))return o.eircode;
 if(/county/.test(d))return o.county;
 if(/city|town/.test(d))return o.city;
 if(/address.*2|address line 2|address2/.test(d))return o.address2;
 if(/address.*1|address line 1|address1/.test(d))return o.address1;
 if(/address/.test(d)&&!/email/.test(d))return [o.address1,o.address2,o.city,o.eircode].filter(Boolean).join(", ");
 if(/email/.test(d))return o.email;
 if(/phone|telephone|mobile/.test(d)&&o.phone)return o.phone;
 if(s==="respondent"&&/cro|company.*number|registration.*number/.test(d))return o.cro;
 if(/first.*name|forename/.test(d)&&o.firstName)return o.firstName;
 if(/last.*name|surname/.test(d)&&o.lastName)return o.lastName;
 if(/name|company|business|organisation/.test(d))return o.fullName;
 return null
}
function fill(){
 let c=0;for(const e of [...document.querySelectorAll('input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]),textarea,select')].filter(vis)){const v=val(e);if(v!=null&&(!e.value||n(e.value)!==n(v))&&setv(e,v))c++}
 if(c)log("Filled "+c+" field(s)");return c
}
function radio(rx){for(const r of [...document.querySelectorAll('input[type=radio]')].filter(vis)){if(rx.test(desc(r))&&!r.checked){r.click();r.dispatchEvent(new Event("change",{bubbles:true}));log("Selected option",desc(r).slice(0,100));return true}}return false}
const BLOCK=/(submit claim|pay|payment|checkout|confirm filing|lodge claim|declaration|i agree|sign and submit)/i;
const PRI=[/^new case$/i,/^add claimant$/i,/^edit claimant$/i,/^save claimant$/i,/^claimant party$/i,/^add respondent$/i,/^edit respondent$/i,/^save respondent$/i,/^respondent party$/i,/^edit claim$/i,/^save claim$/i,/^claim details$/i,/^save case$/i,/^continue$/i,/^next$/i,/^update$/i,/^save$/i];
function recent(k){try{const x=JSON.parse(localStorage.getItem(KLAST)||"{}");return x.k===k&&Date.now()-x.t<5000}catch{return false}}
function mark(k){localStorage.setItem(KLAST,JSON.stringify({k,t:Date.now()}))}
function buttons(){return[...document.querySelectorAll('button,input[type=button],input[type=submit],a')].filter(vis).map(e=>({e,t:bt(e)})).filter(x=>x.t)}
function submit(){
 const b=buttons(),s=b.find(x=>/submit claim/i.test(x.t));if(!s)return false;s.e.style.outline="4px solid #c62828";
 if(localStorage.getItem(KSUB)!=="YES"){log("READY: Submit Claim found. Stopped pending explicit approval.");return true}
 const k=location.pathname+"|SUBMIT";if(!recent(k)){mark(k);log("Submit unlocked; clicking Submit Claim");setTimeout(()=>s.e.click(),600)}return true
}
function confirmSubmit(){
 if(localStorage.getItem(KSUB)!=="YES")return false;
 if(!/(are you sure|wish to submit|confirm.*submit)/i.test(document.body?.innerText||""))return false;
 const y=buttons().find(x=>/^(yes|confirm|ok)$/i.test(x.t));if(!y)return false;const k=location.pathname+"|CONFIRM";if(!recent(k)){mark(k);log("Confirming submission");setTimeout(()=>y.e.click(),600)}return true
}
function clickSafe(){
 const b=buttons().filter(x=>!BLOCK.test(x.t));
 for(const r of PRI){const x=b.find(z=>r.test(z.t));if(!x)continue;const k=location.pathname+"|"+x.t;if(recent(k))continue;if(/^new case$/i.test(x.t)&&/openai ireland|56\.53/i.test(document.body?.innerText||""))continue;mark(k);x.e.style.outline="3px solid #1565c0";log("Clicking safe action: "+x.t);setTimeout(()=>x.e.click(),450);return true}return false
}
function diag(){
 return{version:"1.1.0",url:location.href,title:document.title,configured:!!D,text:(document.body?.innerText||"").slice(0,3500),controls:[...document.querySelectorAll('input,textarea,select')].filter(vis).map(e=>({tag:e.tagName,type:e.type||"",id:e.id||"",name:e.name||"",placeholder:e.placeholder||"",descriptor:desc(e).slice(0,220),hasValue:!!e.value})),buttons:buttons().map(x=>x.t).slice(0,120),logs:(()=>{try{return JSON.parse(localStorage.getItem(KLOG)||"[]").slice(-20)}catch{return[]}})()}
}
function tick(){
 panel();
 if(localStorage.getItem(KRUN)!=="YES"){panel("Paused");return}
 if(!D){panel("Needs case configuration. Open the private CSOL configuration link.");return}
 try{fill();const t=n(document.body?.innerText||"");if(t.includes("claimant"))radio(/individual|person/);if(t.includes("respondent"))radio(/company|organisation|organization|business/);if(confirmSubmit())return;if(submit())return;if(clickSafe())return;panel("Waiting / no safe action detected")}catch(e){log("ERROR",String(e?.stack||e))}
}
panel("Loaded");log("Agent loaded");setTimeout(tick,700);setInterval(tick,2500);new MutationObserver(()=>{clearTimeout(window.__csolT);window.__csolT=setTimeout(tick,450)}).observe(document.documentElement,{childList:true,subtree:true});
window.CSOLAutoAgent={diagnostics:diag,pause:()=>localStorage.setItem(KRUN,"NO"),resume:()=>{localStorage.setItem(KRUN,"YES");tick()},lockSubmit:()=>localStorage.removeItem(KSUB),clearConfig:()=>localStorage.removeItem(KCFG)};
})();