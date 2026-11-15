import {test} from "node:test";
import assert from "node:assert/strict";
import {eligible,ensureTab,activateOpenTabs} from "../auto-tabs.js";
test("eligibility excludes internal pages, discarded tabs and unknown URLs",()=>{
  assert.equal(eligible({id:2,url:"https://example.org"}),true);
  for(const tab of [{id:3,url:"edge://settings"},{id:4,url:"https://example.org",discarded:true},{id:5},{url:"https://example.org"}])assert.equal(eligible(tab),false);
});
test("sweep spans windows and does not inject duplicate content scripts",async()=>{
  const injected=[];
  const api={tabs:{
    query:async q=>{assert.deepEqual(q,{});return [{id:1,windowId:1,url:"https://a.test"},{id:2,windowId:2,url:"https://b.test"},{id:3,url:"https://c.test"},{id:4,url:"chrome://settings"},{id:5,url:"https://d.test",discarded:true}];},
    sendMessage:async(id)=>{if(id===1)return {active:false};throw Error("missing");}
  },scripting:{executeScript:async request=>{assert.deepEqual(request.files,["content.js"]);if(request.target.tabId===3)throw Error("restricted");injected.push(request.target.tabId);return [{frameId:0}];}}};
  assert.deepEqual(await activateOpenTabs(api),{present:1,injected:1,skipped:2,unavailable:1});
  assert.deepEqual(injected,[2]);
});
test("missing execution result is unavailable",async()=>{
  const api={tabs:{sendMessage:async()=>undefined},scripting:{executeScript:async()=>[]}};
  assert.equal(await ensureTab(api,{id:8,url:"https://example.org"}),"unavailable");
});
