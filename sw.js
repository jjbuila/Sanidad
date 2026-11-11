/* Service worker de Sanidad Vegetal 2.0: permite abrir la aplicación y ver mapas sin conexión.
   Las llamadas a la API de GitHub no se guardan en caché. */
const APP='sanidad-vegetal-20261111-1737';
const TESELAS='teselas-v1';
const ARCHIVOS=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

const OPCIONALES=['./datos/acceso.json','./datos/carto.enc'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(APP).then(async c=>{
    await c.addAll(ARCHIVOS);
    for(const f of OPCIONALES){try{const r=await fetch(f,{cache:'no-store'});if(r.ok)await c.put(f,r);}catch(err){}}
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==APP&&k!==TESELAS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
function esTesela(u){
  return /arcgisonline\.com$/.test(u.hostname)||/tile\.openstreetmap\.org$/.test(u.hostname)||(u.pathname.includes('/teselas/')&&!u.pathname.endsWith('.json'));
}
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(esTesela(u)){
    e.respondWith(caches.open(TESELAS).then(async c=>{
      const m=await c.match(req.url,{ignoreVary:true});if(m)return m;
      try{const r=await fetch(req);if(r.ok)c.put(req.url,r.clone());return r;}
      catch(err){return new Response('',{status:504,statusText:'Offline'});}
    }));
    return;
  }
  // Paquete de acceso y cartografía cifrada: primero la red (para recibir cambios), si no hay, la copia guardada.
  if(u.origin===self.location.origin&&u.pathname.includes('/datos/')){
    e.respondWith(caches.open(APP).then(async c=>{
      try{const r=await fetch(req,{cache:'no-store'});if(r.ok){c.put(req,r.clone());return r;}throw new Error();}
      catch(err){return (await c.match(req,{ignoreSearch:true}))||new Response('',{status:504,statusText:'Offline'});}
    }));
    return;
  }
  // Versión publicada: siempre de la red, nunca de la copia guardada (para «Actualizar versión»).
  if(u.origin===self.location.origin&&u.pathname.endsWith('/version.json')){
    e.respondWith(fetch(req,{cache:'no-store'}).catch(()=>new Response('{}',{status:503,headers:{'Content-Type':'application/json'}})));
    return;
  }
  // Visor web y página de administración: siempre de la red (la copia guardada solo sin conexión), nunca la app.
  if(u.origin===self.location.origin&&/\/(visor|admin)\.html$/.test(u.pathname)){
    e.respondWith(caches.open(APP).then(async c=>{
      try{const r=await fetch(req,{cache:'no-store'});if(r.ok)c.put(req,r.clone());return r;}
      catch(err){return (await c.match(req,{ignoreSearch:true}))||new Response('Sin conexión',{status:503});}
    }));
    return;
  }
  if(u.origin===self.location.origin){
    e.respondWith(caches.open(APP).then(async c=>{
      const raiz=/\/(index\.html)?$/.test(u.pathname);
      const m=await c.match(req,{ignoreSearch:true})||(req.mode==='navigate'&&raiz?await c.match('./index.html'):null);
      const red=fetch(req).then(r=>{if(r.ok)c.put(req,r.clone());return r;}).catch(()=>null);
      if(m){e.waitUntil(red);return m;}
      return (await red)||new Response('Sin conexión',{status:503});
    }));
  }
});

// Tocar el aviso de «Jornada en curso» vuelve a abrir la aplicación.
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if(!/\/(visor|admin)\.html/.test(c.url)&&'focus' in c)return c.focus();}
    return self.clients.openWindow('./');}));
});
