const C="gut-tracker-v3.1.4";
const PATCH=`<script>async function saveSilent(table,payload){const {data,error}=await supabaseClient.from(table).insert({...payload,user_id:user.id}).select().single();if(error)throw error;return data}</script>`;
async function appResponse(response){const text=await response.text();const patched=text.replaceAll('3.1.3','3.1.4').replace('</body>',PATCH+'</body>');return new Response(patched,{status:response.status,statusText:response.statusText,headers:response.headers})}
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"])).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith((async()=>{const r=await caches.match(e.request)||await fetch(e.request);const u=new URL(e.request.url);if(u.pathname.endsWith('/')||u.pathname.endsWith('/index.html'))return appResponse(r);return r})()));
