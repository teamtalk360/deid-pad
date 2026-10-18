// Caches only the static app shell plus the on-device OCR files (vendor/tesseract, cached on first Scan).
// Never caches or sees pasted text, scanned images, audio or API traffic (only same-origin GETs of app files are handled).
// No skipWaiting(): a new version installs in the background and takes over on the next launch, so an open
// session (recording, text present) is never reloaded or swapped mid-use.
const C='deid-pad-v4-scan',SHELL=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','auth-redirect.html','auth-redirect.js','vendor/msal-browser.min.js','vendor/msal-redirect-bridge.min.js'];
const OCR=/\/vendor\/tesseract\/[\w.\-]+$/;
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{
 if(res.ok&&OCR.test(u.pathname)){const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{});}return res;})))});
