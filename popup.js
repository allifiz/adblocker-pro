import {matchesHost} from "./engine.js";
const $=id=>document.getElementById(id);
const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
let host="",settings;
try{const url=new URL(tab.url);if(["http:","https:"].includes(url.protocol))host=url.hostname;}catch{}
async function call(message){const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw Error(r?.error||"No response");return r;}
async function render(){
  settings=(await call({type:"get"})).settings;
  const paused=host&&matchesHost(host,settings.allowlist);
  $("status").textContent=!settings.enabled?"Protection off":paused?"Site paused":"Protection active";
  $("host").textContent=host||"Browser page (not supported)";
  $("power").textContent=settings.enabled?"Turn off":"Turn on";
  $("power").disabled=false;
  $("site").textContent=paused?"Resume on this site":"Pause on this site";
  $("site").disabled=!host;$("picker").disabled=!host||!settings.enabled||paused;
  try{const r=await chrome.tabs.sendMessage(tab.id,{type:"pageStats"});$("hidden").textContent=r.hidden;}catch{$("hidden").textContent="—";}
}
function bind(id,fn){$(id).addEventListener("click",async()=>{const b=$(id);b.disabled=true;try{await fn();await render();}catch(e){$("message").textContent=e.message;}finally{if(id==="power"||id==="site"&&host)b.disabled=false;}});}
bind("power",async()=>{await call({type:"save",settings:{...settings,enabled:!settings.enabled}});});
bind("site",async()=>{await call({type:"toggleSite",host});});
$("picker").addEventListener("click",async()=>{try{const r=await chrome.tabs.sendMessage(tab.id,{type:"picker"});if(!r?.ok)throw Error("Picker unavailable. Reload the page first.");window.close();}catch(e){$("message").textContent=e.message;}});
$("options").onclick=()=>chrome.runtime.openOptionsPage();
render().catch(e=>$("message").textContent=e.message);
