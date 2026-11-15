// Browser APIs are injected so the sweep can be unit-tested without Chromium.
export function eligible(tab) {
  return Number.isInteger(tab?.id) && !tab.discarded &&
    typeof tab.url === "string" && /^https?:\/\//i.test(tab.url);
}

export async function ensureTab(api, tab) {
  if (!eligible(tab)) return "skipped";
  try {
    const state = await api.tabs.sendMessage(tab.id, {type:"pageStats"}, {frameId:0});
    if (state && typeof state.active === "boolean") return "present";
  } catch {
    // No content script in this document (e.g. it predates installation).
  }
  try {
    const result = await api.scripting.executeScript({
      target:{tabId:tab.id},
      files:["content.js"]
    });
    return result?.length ? "injected" : "unavailable";
  } catch {
    // Browser-restricted pages, revoked site access, closed or navigated tabs.
    return "unavailable";
  }
}

export async function activateOpenTabs(api) {
  const tabs = await api.tabs.query({});
  const counts = {present:0,injected:0,skipped:0,unavailable:0};
  // Limit concurrency so dozens of open tabs do not all initialize at once.
  for (let i=0; i<tabs.length; i+=8) {
    const results = await Promise.all(tabs.slice(i,i+8).map(tab=>ensureTab(api,tab)));
    for (const result of results) counts[result]++;
  }
  return counts;
}
