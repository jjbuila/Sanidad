/* Service worker de Sanidad Palma: permite abrir la aplicación y ver mapas sin conexión. */
const APP='sanidad-palma-app-v4';
const TESELAS='teselas-v1';
const ARCHIVOS=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(APP).then(c=>c.addAll(ARCHIVOS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==APP&&k!==TESELAS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
function esTesela(u){
  return /arcgisonline\.com$/.test(u.hostname)||/tile\.openstreetmap\.org$/.test(u.hostname)||u.pathname.includes('/teselas/');
}
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  // Mapas base: primero la copia guardada; si no existe, internet (y se guarda).
  if(esTesela(u)){
    e.respondWith(caches.open(TESELAS).then(async c=>{
      const m=await c.match(req.url,{ignoreVary:true});if(m)return m;
      try{const r=await fetch(req);if(r.ok)c.put(req.url,r.clone());return r;}
      catch(err){return new Response('',{status:504,statusText:'Offline'});}
    }));
    return;
  }
  // Aplicación: responde desde la copia local y la actualiza en segundo plano cuando hay internet.
  if(u.origin===self.location.origin){
    e.respondWith(caches.open(APP).then(async c=>{
      const m=await c.match(req,{ignoreSearch:true})||(req.mode==='navigate'?await c.match('./index.html'):null);
      const red=fetch(req).then(r=>{if(r.ok)c.put(req,r.clone());return r;}).catch(()=>null);
      if(m){e.waitUntil(red);return m;}
      return (await red)||new Response('Sin conexión',{status:503});
    }));
  }
});
