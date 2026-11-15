import {DEFAULTS,SOURCES,domain,normalize,parseList,makeRules} from "./engine.js";
const dnr=chrome.declarativeNetRequest;
let queue=Promise.resolve();
function serial(fn){const p=queue.then(fn);queue=p.catch(()=>{});return p;}
async function read(){const v=await chrome.storage.local.get(["settings","cache","lastUpdate","updateError"]);return {...v,settings:normalize(v.settings),cache:v.cache||{}};}
async function apply(settings,cache){
  const old=await dnr.getDynamicRules();
  await dnr.updateDynamicRules({removeRuleIds:old.map(r=>r.id),addRules:makeRules(settings,cache)});
  const wanted=["ads","privacy"].filter(k=>settings.enabled&&settings[k]);
  const current=await dnr.getEnabledRulesets();
  await dnr.updateEnabledRulesets({enableRulesetIds:wanted.filter(x=>!current.includes(x)),disableRulesetIds:current.filter(x=>!wanted.includes(x))});
}
async function save(settings){
  const old=await read(), next=normalize(settings);
  try{await apply(next,old.cache);await chrome.storage.local.set({settings:next});}
  catch(e){await apply(old.settings,old.cache).catch(()=>{});throw e;}
  return next;
}
async function refresh(){
  const v=await read(), cache={...v.cache};
  const results=await Promise.allSettled(Object.entries(SOURCES).map(async ([k,url])=>{
    const response=await fetch(url,{credentials:"omit",cache:"no-cache",redirect:"error",signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error(k+": HTTP "+response.status);
    const data=await response.text();
    if(data.length>12000000||!/\[Adblock Plus/i.test(data.slice(0,1000)))throw Error(k+": invalid list");
    const entries=parseList(data);
    if(entries.length<50)throw Error(k+": unexpectedly short list");
    return [k,entries];
  }));
  const errors=[];
  for(const r of results)if(r.status==="fulfilled")cache[r.value[0]]=r.value[1];else errors.push(String(r.reason));
  const updateError=errors.join("; ");
  if(results.every(x=>x.status==="rejected")){
    await chrome.storage.local.set({updateError});throw Error(updateError);
  }
  try{await apply(v.settings,cache);await chrome.storage.local.set({cache,lastUpdate:Date.now(),updateError});}
  catch(e){await apply(v.settings,v.cache).catch(()=>{});throw e;}
  return {counts:Object.fromEntries(Object.entries(cache).map(([k,v])=>[k,v.length])),updateError};
}
async function init(){
  const v=await read();await apply(v.settings,v.cache);
  await chrome.storage.local.set({settings:v.settings});
  await dnr.setExtensionActionOptions({displayActionCountAsBadgeText:true});
  await chrome.alarms.create("filters",{periodInMinutes:1440,delayInMinutes:5});
}
chrome.runtime.onInstalled.addListener(()=>serial(init).catch(console.error));
chrome.runtime.onStartup.addListener(()=>serial(init).catch(console.error));
chrome.alarms.onAlarm.addListener(a=>{if(a.name==="filters")serial(async()=>{if((await read()).settings.autoUpdate)await refresh();}).catch(console.warn);});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||!msg||typeof msg!=="object")return;
  const pageSender=Boolean(sender.tab);
  // Content scripts may only add a selector to their own host, not modify network settings.
  if(pageSender&&msg.type!=="addElement")return;
  serial(async()=>{
    const v=await read();
    switch(msg.type){
      case "get": return {settings:v.settings,lastUpdate:v.lastUpdate||null,updateError:v.updateError||"",counts:Object.fromEntries(Object.entries(v.cache).map(([k,v])=>[k,v.length]))};
      case "save":return {settings:await save(msg.settings)};
      case "toggleSite":{
        const d=domain(msg.host);if(!d)throw Error("Invalid hostname");
        const list=v.settings.allowlist;
        const existing=list.filter(x=>d===x||d.endsWith("."+x));
        return {settings:await save({...v.settings,allowlist:existing.length?list.filter(x=>!existing.includes(x)):[...list,d]})};
      }
      case "addElement":{
        if(!pageSender||sender.frameId!==0)throw Error("Invalid sender");
        const host=domain(new URL(sender.url).hostname);
        const selector=msg.selector;
        if(!host||typeof selector!=="string"||selector.length>500||!selector)throw Error("Invalid selector");
        const elements={...v.settings.elements,[host]:[...(v.settings.elements[host]||[]),selector]};
        return {settings:await save({...v.settings,elements})};
      }
      case "refresh":return await refresh();
      default:throw Error("Unknown command");
    }
  }).then(data=>reply({ok:true,...data}),e=>reply({ok:false,error:String(e.message||e)}));
  return true;
});
