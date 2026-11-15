# AdBlocker Pro

A local-first, experimental Manifest V3 extension for Chrome and Edge 121+. No account, server, build step, npm dependencies, or telemetry.

## Install

1. Clone: `git clone https://github.com/allifiz/adblocker-pro.git`
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode, click **Load unpacked**, and select the repository root (the folder containing manifest.json).
4. Pin the extension and reload open websites. Disable other blockers temporarily when comparing results.

## Features

- Bundled third-party ad and tracker domain rules using declarativeNetRequest.
- Optional daily EasyList/EasyPrivacy refresh (initial alarm after five minutes); manual refresh in settings. Only a deliberately limited domain-rule subset is supported, not the full ABP syntax. Public filter sources: https://easylist.to/ (see their license terms). No filter-list contents are bundled.
- Cosmetic filtering and throttled MutationObserver in the top frame; conservative site-specific selectors and experimental sponsored content filtering.
- Experimental YouTube skip button handling, not a guarantee of video ad removal.
- Blocking navigation to a small list of known ad redirect destinations; no blanket window.open or popup interception.
- Master switch, site allowlist (includes subdomains), custom blocked domains, element picker (click an element, Esc to cancel; remove selectors in settings).
- Browser-native network action badge and current page hidden-element count (not lifetime statistics).

## Development

Node 18+ is optional for tests only. Run `npm run check` in the root. No npm install is needed. Reload extension from browser extensions page after editing, then reload the website.

Manual smoke test: confirm the extension loads without errors; toggle master off/on; test a known ad domain as a third-party request; test site exception, custom domain, element picker and removal; refresh lists; verify regular navigations, login and video playback. Use DevTools Network to inspect blocked requests. Do not assume results from another ad blocker are ours.

## Limits and privacy

Websites can change markup, deliver ads as first-party content, use closed shadow DOM or embed ads in media. This release does not bypass anti-adblock walls, remove server-side inserted video ads, or block every popup. It does not implement full EasyList syntax or filter iframes cosmetically. Tracker blocking may break analytics-dependent features; pause the affected site if needed.

Broad HTTP(S) host access is required for page filtering. Settings, selected CSS selectors and imported domain data stay in chrome.storage.local. The only extension-initiated external requests are public filter downloads, with credentials omitted; browser networking still reveals normal connection metadata to those servers. No history or page content is uploaded. No remote executable code.

Architecture: manifest + static DNR rules, engine.js (rule generation), background.js (settings and updates), content.js (DOM filtering / picker), popup and options (UI). Plain JS/ES modules used deliberately for zero-build installation. This version is an MVP, not a production replacement for mature blockers.
