(()=>{
  "use strict";
  const GENERAL=["ins.adsbygoogle","[data-ad-slot]","[data-ad-client]","[data-ad-unit]","[data-ad-format]","iframe[src*='doubleclick.net']","iframe[src*='googlesyndication.com']","[id^='google_ads_iframe_']","[id^='div-gpt-ad-']","[id^='ad-slot-']","[class~='ad-banner']","[class~='ad-container']","[class~='advertisement']","[data-testid='ad-container']"];
  const SITE={
    "youtube.com":["ytd-display-ad-renderer","ytd-promoted-sparkles-web-renderer","ytd-promoted-sparkles-text-search-renderer","ytd-ad-slot-renderer","ytd-in-feed-ad-layout-renderer","#player-ads","#masthead-ad"],
    "reddit.com":["shreddit-ad-post","[data-testid='ad-post']"],
    "x.com":["[data-testid='placementTracking']"],
    "twitter.com":["[data-testid='placementTracking']"]
  };
  const SPONSORED={"youtube.com":["ytd-promoted-video-renderer"],"reddit.com":["[data-promoted='true']"],"facebook.com":["[data-testid='sponsored_post']"]};
  const host=location.hostname.toLowerCase();
  let config,observer,timer,picker,active=false,selectors=[],videoTimer=null;
  const hidden=new Map();
  const onHost=d=>host===d||host.endsWith("."+d);
  function hide(el){
    if(!(el instanceof HTMLElement||el instanceof SVGElement)||hidden.has(el)||["HTML","BODY","HEAD","MAIN"].includes(el.tagName.toUpperCase()))return;
    hidden.set(el,[el.style.getPropertyValue("display"),el.style.getPropertyPriority("display")]);
    el.style.setProperty("display","none","important");
  }
  function restore(){
    for(const [el,[value,priority]] of hidden){
      if(el.style.getPropertyValue("display")!=="none"||el.style.getPropertyPriority("display")!=="important")continue;
      if(value)el.style.setProperty("display",value,priority);else el.style.removeProperty("display");
    }
    hidden.clear();
  }
  function scan(){
    if(!active)return;
    for(const el of hidden.keys())if(!el.isConnected)hidden.delete(el);
    for(const selector of selectors){
      try{for(const el of document.querySelectorAll(selector))hide(el);}catch{}
    }
    // Only click an actual visible skip control during a recognized ad.
    if(config.video&&onHost("youtube.com")&&document.querySelector(".html5-video-player.ad-showing")){
      const btn=document.querySelector(".ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button");
      if(btn instanceof HTMLElement&&btn.getClientRects().length&&!btn.matches(":disabled"))btn.click();
    }
  }
  function schedule(){if(timer||!active)return;timer=setTimeout(()=>{timer=null;scan();},220);}
  function configure(settings){
    config=settings||{};
    active=config.enabled!==false&&!(config.allowlist||[]).some(onHost);
    observer?.disconnect();clearTimeout(timer);timer=null;clearInterval(videoTimer);videoTimer=null;restore();
    if(!active){picker?.();return;}
    selectors=[...(config.elements?.[host]||[])];
    if(config.cosmetic!==false){
      selectors.push(...GENERAL);
      for(const [d,list] of Object.entries(SITE))if(onHost(d))selectors.push(...list);
      if(config.sponsored)for(const [d,list] of Object.entries(SPONSORED))if(onHost(d))selectors.push(...list);
    }
    observer=new MutationObserver(schedule);
    observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:["class","id","src","data-ad-slot","data-ad-client","data-testid","data-ad-unit","data-ad-format","data-promoted"]});
    if(config.video&&onHost("youtube.com"))videoTimer=setInterval(schedule,900);
    scan();
  }
  function selectorFor(el){
    const parts=[];
    while(el&&el!==document.body&&parts.length<12){
      if(el.id){const id="#"+CSS.escape(el.id);if(document.querySelectorAll(id).length===1){parts.unshift(id);break;}}
      let n=1, p=el;while((p=p.previousElementSibling))if(p.localName===el.localName)n++;
      parts.unshift(CSS.escape(el.localName)+":nth-of-type("+n+")");el=el.parentElement;
    }
    const result=parts.join(" > ");
    return result&&result.length<=500&&document.querySelectorAll(result).length===1?result:null;
  }
  function startPicker(){
    if(!active||!document.body)return false;
    picker?.();
    const box=document.createElement("div");
    box.style.cssText="position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #34d399;background:#34d39922;box-sizing:border-box;display:none";
    document.documentElement.append(box);
    let target=null;
    const move=e=>{target=e.target;if(!(target instanceof Element)||target===box)return;const r=target.getBoundingClientRect();Object.assign(box.style,{display:"block",left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});};
    const key=e=>{if(e.key==="Escape"){e.preventDefault();stop();}};
    const click=async e=>{
      e.preventDefault();e.stopImmediatePropagation();const el=e.target;stop();
      if(!(el instanceof Element)||el===document.body||el===document.documentElement)return;
      const selector=selectorFor(el);if(!selector)return;
      try{const r=await chrome.runtime.sendMessage({type:"addElement",selector});if(r?.ok)hide(el);}catch{}
    };
    function stop(){box.remove();document.removeEventListener("pointermove",move,true);document.removeEventListener("click",click,true);document.removeEventListener("keydown",key,true);picker=null;}
    picker=stop;document.addEventListener("pointermove",move,true);document.addEventListener("click",click,true);document.addEventListener("keydown",key,true);return true;
  }
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(sender.id!==chrome.runtime.id)return;
    if(msg.type==="pageStats")reply({hidden:hidden.size,active});
    if(msg.type==="picker")reply({ok:startPicker()});
  });
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes.settings)configure(changes.settings.newValue);});
  chrome.storage.local.get("settings").then(v=>configure(v.settings)).catch(()=>{});
})();
