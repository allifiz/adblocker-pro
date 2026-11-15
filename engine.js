export const DEFAULTS={enabled:true,ads:true,privacy:true,cosmetic:true,sponsored:false,video:true,redirects:true,autoUpdate:true,allowlist:[],customDomains:[],elements:{}};
export const SOURCES={ads:"https://easylist.to/easylist/easylist.txt",privacy:"https://easylist.to/easylist/easyprivacy.txt"};
export const TYPES=["sub_frame","stylesheet","script","image","font","object","xmlhttprequest","ping","csp_report","media","websocket","other"];
export const REDIRECT_DOMAINS=["popads.net","popcash.net","propellerads.com","hilltopads.net","adsterra.com","monetag.com","ad-maven.com","admaven.com"];
export function domain(value){
  const s=String(value).trim().toLowerCase().replace(/\.$/,"");
  return s.length<=253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s) ? s : null;
}
export function matchesHost(host, list){return list.some(d=>host===d||host.endsWith("."+d));}
export function normalize(raw={}){
  const next={...DEFAULTS};
  for(const k of Object.keys(DEFAULTS)) if(typeof DEFAULTS[k]==="boolean" && typeof raw[k]==="boolean") next[k]=raw[k];
  for(const k of ["allowlist","customDomains"]) if(Array.isArray(raw[k])) next[k]=[...new Set(raw[k].map(domain).filter(Boolean))].slice(0,500);
  next.elements={};
  for(const [host,selectors] of Object.entries(raw.elements||{}).slice(0,500)){
    if(domain(host)!==host||!Array.isArray(selectors))continue;
    next.elements[host]=[...new Set(selectors.filter(x=>typeof x==="string"&&x.length>0&&x.length<=500))].slice(0,100);
  }
  return next;
}
// Only exact domain rules with no modifiers or the third-party modifier.
// Unsupported exceptions cause us to skip the corresponding domain, conservatively.
export function parseList(text, limit=9000){
  const block=new Set(), exceptions=new Set();
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(line.startsWith("@@")){
      const m=line.match(/^@@\|\|([a-z0-9.-]+)\^/i);
      if(m&&domain(m[1]))exceptions.add(domain(m[1]));
      continue;
    }
    const m=line.match(/^\|\|([a-z0-9.-]+)\^(?:\$third-party)?$/i);
    if(m&&domain(m[1]))block.add(domain(m[1]));
  }
  // Remove both overlapping ancestors and descendants of known exceptions.
  const parents=new Set();
  for(const d of exceptions){const parts=d.split(".");for(let i=0;i<parts.length-1;i++)parents.add(parts.slice(i).join("."));}
  function overlaps(d){const parts=d.split(".");for(let i=0;i<parts.length-1;i++)if(exceptions.has(parts.slice(i).join(".")))return true;return false;}
  return [...block].filter(d=>!parents.has(d)&&!overlaps(d)).sort().slice(0,limit);
}
export function makeRules(settings, cache={}){
  const s=normalize(settings), rules=[];
  if(!s.enabled)return rules;
  let id=1;
  const make=(action,condition,priority=1)=>rules.push({id:id++,priority,action:{type:action},condition});
  const domains=new Set();
  for(const key of ["ads","privacy"])if(s[key])for(const d of (Array.isArray(cache[key])?cache[key]:[]).slice(0,9000)){const valid=domain(d);if(valid)domains.add(valid);}
  for(const d of domains)make("block",{requestDomains:[d],domainType:"thirdParty",resourceTypes:TYPES});
  if(s.ads&&s.redirects)for(const d of REDIRECT_DOMAINS)make("block",{requestDomains:[d],resourceTypes:["main_frame"]});
  for(const d of s.customDomains)make("block",{requestDomains:[d],resourceTypes:[...TYPES,"main_frame"]},5);
  if(s.allowlist.length){
    make("allowAllRequests",{requestDomains:s.allowlist,resourceTypes:["main_frame"]},100);
    make("allow",{initiatorDomains:s.allowlist,resourceTypes:[...TYPES,"main_frame"]},100);
  }
  return rules;
}
