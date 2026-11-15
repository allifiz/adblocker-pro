import {domain} from "./engine.js";
const $=id=>document.getElementById(id);
const labels={enabled:"Master protection",ads:"Block advertising networks",privacy:"Block third-party trackers",cosmetic:"Hide visible ad elements",sponsored:"Hide additional sponsored placements (experimental)",video:"Click available YouTube skip-ad controls (experimental)",redirects:"Block navigation to known ad redirect domains",autoUpdate:"Refresh public lists daily"};
let settings;
async function call(msg){const r=await chrome.runtime.sendMessage(msg);if(!r?.ok)throw Error(r?.error||"No response");return r;}
for(const [id,label] of Object.entries(labels)){const row=document.createElement("label");row.className="check";const input=document.createElement("input");input.type="checkbox";input.id=id;row.append(input,document.createTextNode(label));$("toggles").append(row);}
function renderElements(){
  $("elements").replaceChildren();
  for(const [host,rules] of Object.entries(settings.elements))for(const rule of rules){
    const row=document.createElement("div");row.className="rule";const text=document.createElement("code");text.textContent=host+" · "+rule;
    const b=document.createElement("button");b.textContent="Remove";b.onclick=()=>{settings.elements[host]=settings.elements[host].filter(x=>x!==rule);if(!settings.elements[host].length)delete settings.elements[host];renderElements();};row.append(text,b);$("elements").append(row);
  }
  if(!$("elements").children.length)$("elements").textContent="No custom elements.";
}
async function render(){
  const r=await call({type:"get"});settings=r.settings;
  for(const k of Object.keys(labels))$(k).checked=settings[k];
  for(const k of ["allowlist","customDomains"])$(k).value=settings[k].join("\n");
  $("lists").textContent="Imported ad domains: "+(r.counts.ads||0)+" | Tracker domains: "+(r.counts.privacy||0)+" | Last update: "+(r.lastUpdate?new Date(r.lastUpdate).toLocaleString():"Not yet")+(r.updateError?" | Warning: "+r.updateError:"");
  renderElements();
}
function inputDomains(id){const lines=$(id).value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const invalid=lines.find(x=>!domain(x));if(invalid)throw Error("Invalid domain: "+invalid);if(lines.length>500)throw Error("Maximum 500 domains");return lines.map(domain);}
$("save").onclick=async()=>{try{for(const k of Object.keys(labels))settings[k]=$(k).checked;for(const k of ["allowlist","customDomains"])settings[k]=inputDomains(k);await call({type:"save",settings});await render();$("message").textContent="Saved. Reload open pages to fully apply network changes.";}catch(e){$("message").textContent=e.message;}};
$("refresh").onclick=async()=>{$("refresh").disabled=true;$("message").textContent="Downloading filters…";try{const r=await call({type:"refresh"});$("message").textContent=r.updateError?"Partial update: "+r.updateError:"Filters updated.";const status=await call({type:"get"});$("lists").textContent="Imported ad domains: "+(status.counts.ads||0)+" | Tracker domains: "+(status.counts.privacy||0)+" | Last update: "+new Date(status.lastUpdate).toLocaleString();}catch(e){$("message").textContent=e.message;}finally{$("refresh").disabled=false;}};
render().catch(e=>$("message").textContent=e.message);
