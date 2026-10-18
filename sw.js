// Caches only the static app shell. Never caches or sees pasted text, audio or API traffic
// (only same-origin GETs are handled; transcription/Graph/share requests go straight to the network).
const C='deid-pad-v3',SHELL=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','auth-redirect.html','auth-redirect.js','vendor/msal-browser.min.js','vendor/msal-redirect-bridge.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request)))});
