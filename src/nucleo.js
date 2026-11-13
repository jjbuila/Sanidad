/* ===================== NÚCLEO COMÚN DE LABORES (App, visor y programador) =====================
   1) Calendario laboral colombiano: festivos (Ley 51 de 1983 «Ley Emiliani» y fiestas móviles por Semana Santa).
      Día hábil = lunes a sábado que no sea festivo. Plazo D+1 hábil para cirugías.
   2) Red de caminos: grafo de vías y senderos (vias.enc), caminos más cortos (Dijkstra) y orden de visita
      (vecino más cercano + 2-opt) para rutas de palmas puntuales.
   3) Reglas de cirugía: qué diagnósticos generan orden de cirugía y las condiciones de corrección. */

/* ---------- 1. Calendario ---------- */
const NUCLEO_CAL={cache:new Map()};
function pascuaCO(y){ // algoritmo de Meeus/Jones/Butcher (calendario gregoriano)
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
    i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1;
  return new Date(Date.UTC(y,mes-1,dia));
}
const isoUTC=d=>d.toISOString().slice(0,10);
const masDias=(d,n)=>new Date(d.getTime()+n*86400000);
const aLunes=d=>{const w=d.getUTCDay();return w===1?d:masDias(d,(8-w)%7||7);};
function festivosCO(y){
  if(NUCLEO_CAL.cache.has(y))return NUCLEO_CAL.cache.get(y);
  const F=new Map(),fijo=(m,d,n)=>F.set(isoUTC(new Date(Date.UTC(y,m-1,d))),n),
    emiliani=(m,d,n)=>F.set(isoUTC(aLunes(new Date(Date.UTC(y,m-1,d)))),n),P=pascuaCO(y);
  fijo(1,1,'Año Nuevo');fijo(5,1,'Día del Trabajo');fijo(7,20,'Día de la Independencia');fijo(8,7,'Batalla de Boyacá');
  fijo(12,8,'Inmaculada Concepción');fijo(12,25,'Navidad');
  emiliani(1,6,'Reyes Magos');emiliani(3,19,'San José');emiliani(6,29,'San Pedro y San Pablo');emiliani(8,15,'Asunción de la Virgen');
  emiliani(10,12,'Día de la Raza');emiliani(11,1,'Todos los Santos');emiliani(11,11,'Independencia de Cartagena');
  F.set(isoUTC(masDias(P,-3)),'Jueves Santo');F.set(isoUTC(masDias(P,-2)),'Viernes Santo');
  F.set(isoUTC(masDias(P,43)),'Ascensión del Señor');F.set(isoUTC(masDias(P,64)),'Corpus Christi');F.set(isoUTC(masDias(P,71)),'Sagrado Corazón');
  NUCLEO_CAL.cache.set(y,F);return F;
}
const fechaISO=f=>{if(typeof f==='string')return f.slice(0,10);const d=new Date(f);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function esFestivo(f){const s=fechaISO(f);return festivosCO(+s.slice(0,4)).get(s)||null;}
function esHabil(f){const s=fechaISO(f);const w=new Date(s+'T12:00:00Z').getUTCDay();return w!==0&&!esFestivo(s);}
/* Siguiente día hábil después de f (D+n hábil). */
function habilMas(f,n=1){let d=new Date(fechaISO(f)+'T12:00:00Z');let k=0;while(k<n){d=masDias(d,1);if(esHabil(isoUTC(d)))k++;}return isoUTC(d);}
function diasHabilesEntre(a,b){ // hábiles en (a, b]
  a=fechaISO(a);b=fechaISO(b);if(b<=a)return 0;let d=new Date(a+'T12:00:00Z'),n=0;while(isoUTC(d)<b){d=masDias(d,1);if(esHabil(isoUTC(d)))n++;}return n;}
const DIAS_SEM=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES_C=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fechaCorta(f){const s=fechaISO(f);const d=new Date(s+'T12:00:00Z');return `${DIAS_SEM[d.getUTCDay()].slice(0,3)} ${d.getUTCDate()} ${MESES_C[d.getUTCMonth()]}`;}

/* ---------- 2. Red de caminos ---------- */
const R_TIERRA=6371000;
function dM(lat1,lng1,lat2,lng2){const r=Math.PI/180,x=(lng2-lng1)*r*Math.cos((lat1+lat2)/2*r),y=(lat2-lat1)*r;return Math.sqrt(x*x+y*y)*R_TIERRA;}
/* Proyección local en metros alrededor de la plantación. */
const PROY={lat0:1.52,k:Math.PI/180*R_TIERRA};
const aXY=(lng,lat)=>[lng*PROY.k*Math.cos(PROY.lat0*Math.PI/180),lat*PROY.k];
const deXY=(x,y)=>[x/(PROY.k*Math.cos(PROY.lat0*Math.PI/180)),y/PROY.k];
/* Factor de TIEMPO por tipo de camino (solo para estimar minutos). La ruta se elige SIEMPRE por la distancia real más corta. */
const COSTO_CAMINO={via:1,sendero_principal:4.5/4.0,sendero_secundario:4.5/3.8,acceso:4.5/3.3};
function construirRed(gj){
  const nodos=[],adj=[],idx=new Map(),key=(x,y)=>Math.round(x*2)+','+Math.round(y*2); // nodos a 0,5 m
  const nodo=(x,y)=>{const k=key(x,y);let i=idx.get(k);if(i==null){i=nodos.length;nodos.push([x,y]);adj.push([]);idx.set(k,i);}return i;};
  const arista=(a,b,f)=>{if(a===b)return;const [x1,y1]=nodos[a],[x2,y2]=nodos[b];const w=Math.hypot(x2-x1,y2-y1);adj[a].push([b,w,w,f]);adj[b].push([a,w,w,f]);};
  const lineas=(gj&&gj.features||[]).filter(f=>f.geometry&&f.geometry.type==='LineString');
  const segs=[];
  for(const f of lineas){const fac=COSTO_CAMINO[f.properties.tipo]||1.2;const P=f.geometry.coordinates.map(([lng,lat])=>aXY(lng,lat));
    const ids=P.map(([x,y])=>nodo(x,y));for(let i=1;i<ids.length;i++){arista(ids[i-1],ids[i],fac);segs.push([ids[i-1],ids[i],fac]);}}
  /* Cruces: extremo de una línea que cae sobre otra (≤4 m) → se une al punto más cercano de esa línea. Nodos casi iguales (≤3 m) → se unen. */
  const celda=25,grid=new Map(),gk=(x,y)=>Math.floor(x/celda)+','+Math.floor(y/celda);
  segs.forEach((s,i)=>{const [a,b]=s;const [x1,y1]=nodos[a],[x2,y2]=nodos[b];
    for(let gx=Math.floor(Math.min(x1,x2)/celda);gx<=Math.floor(Math.max(x1,x2)/celda);gx++)for(let gy=Math.floor(Math.min(y1,y2)/celda);gy<=Math.floor(Math.max(y1,y2)/celda);gy++){const k=gx+','+gy;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}});
  const RED={nodos,adj,segs,grid,celda,gk};
  // cruces en medio de los tramos (líneas que se atraviesan sin vértice común)
  const nSeg=segs.length;
  for(const [k,l] of grid){for(let u=0;u<l.length;u++)for(let v=u+1;v<l.length;v++){const s1=segs[l[u]],s2=segs[l[v]];if(!s1||!s2||l[u]>=nSeg||l[v]>=nSeg)continue;
    const [a,b]=s1,[c,d]=s2;if(a===c||a===d||b===c||b===d)continue;const [x1,y1]=nodos[a],[x2,y2]=nodos[b],[x3,y3]=nodos[c],[x4,y4]=nodos[d];
    const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(den)<1e-9)continue;const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den,w=((x1-x3)*(y1-y2)-(y1-y3)*(x1-x2))/den;
    if(t>0&&t<1&&w>0&&w<1){const n=nodo(x1+t*(x2-x1),y1+t*(y2-y1));arista(a,n,s1[2]);arista(n,b,s1[2]);arista(c,n,s2[2]);arista(n,d,s2[2]);}}}
  // extremos sueltos: se unen a la línea más cercana (≤25 m); así quedan conectados vías y senderos digitalizados con pequeños huecos
  const grado=adj.map(a=>a.length);
  for(let i=0;i<grado.length;i++){if(grado[i]!==1)continue;const [x,y]=nodos[i];
    const p=puntoEnRed(RED,x,y,25,i);if(!p)continue;
    if(p.d<=0.6){arista(p.a,i,p.fac);arista(i,p.b,p.fac);continue;} // el extremo cae justo sobre otra línea: se parte esa línea en él
    const n=nodo(p.x,p.y);if(n!==p.a&&n!==p.b){arista(p.a,n,p.fac);arista(n,p.b,p.fac);}arista(i,n,Math.max(p.fac,1.3));}
  // componentes que siguen aisladas: se unen a la componente principal por el par de nodos más cercano (≤60 m)
  unirComponentes(RED,60);
  return RED;
}
function unirComponentes(R,maxD){
  for(let vuelta=0;vuelta<6;vuelta++){
    const n=R.nodos.length,comp=new Int32Array(n).fill(-1),tam=[];let nc=0;
    for(let i=0;i<n;i++){if(comp[i]>=0||!R.adj[i].length)continue;const st=[i];comp[i]=nc;let t=0;while(st.length){const u=st.pop();t++;for(const [v] of R.adj[u])if(comp[v]<0){comp[v]=nc;st.push(v);}}tam.push(t);nc++;}
    if(nc<=1)return;const prin=tam.indexOf(Math.max(...tam));
    const celda=maxD,g=new Map();for(let i=0;i<n;i++){if(comp[i]!==prin)continue;const [x,y]=R.nodos[i];const k=Math.floor(x/celda)+','+Math.floor(y/celda);if(!g.has(k))g.set(k,[]);g.get(k).push(i);}
    const mejor=new Map();
    for(let i=0;i<n;i++){const c=comp[i];if(c<0||c===prin)continue;const [x,y]=R.nodos[i];const gx=Math.floor(x/celda),gy=Math.floor(y/celda);
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=g.get((gx+a)+','+(gy+b));if(!l)continue;for(const j of l){const d=Math.hypot(R.nodos[j][0]-x,R.nodos[j][1]-y);if(d<=maxD&&(!mejor.has(c)||d<mejor.get(c)[0]))mejor.set(c,[d,i,j]);}}}
    if(!mejor.size)return;
    for(const [c,[d,i,j]] of mejor){R.adj[i].push([j,d,d,1.5]);R.adj[j].push([i,d,d,1.5]);}
  }
}
/* Punto más cercano de la red a (x,y) dentro de maxD metros. excluye: nodo que no puede ser extremo del segmento. */
function puntoEnRed(R,x,y,maxD,excluye){
  let mejor=null;const r=Math.ceil(maxD/R.celda);const gx=Math.floor(x/R.celda),gy=Math.floor(y/R.celda);const vistos=new Set();
  for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){const l=R.grid.get((gx+i)+','+(gy+j));if(!l)continue;
    for(const si of l){if(vistos.has(si))continue;vistos.add(si);const [a,b,fac]=R.segs[si];if(a===excluye||b===excluye)continue;
      const [x1,y1]=R.nodos[a],[x2,y2]=R.nodos[b];const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy||1e-9;let t=((x-x1)*dx+(y-y1)*dy)/L2;t=Math.max(0,Math.min(1,t));
      const px=x1+t*dx,py=y1+t*dy,d=Math.hypot(x-px,y-py);if(d<=maxD&&(!mejor||d<mejor.d))mejor={x:px,y:py,d,a,b,fac,t};}}
  return mejor;
}
/* Enlaza un punto (palma, oficina) a la red: va en línea recta (por la calle de palmas) hasta el camino más cercano. */
function enlazarPunto(R,lng,lat){
  const [x,y]=aXY(lng,lat);let p=null;for(const m of [60,150,400,1200]){p=puntoEnRed(R,x,y,m);if(p)break;}
  if(!p)return null;
  const id=R.nodos.length;R.nodos.push([x,y]);R.adj.push([]);
  const pid=R.nodos.length;R.nodos.push([p.x,p.y]);R.adj.push([]);
  const [x1,y1]=R.nodos[p.a],[x2,y2]=R.nodos[p.b];
  const ad=(u,v,f)=>{const [ax,ay]=R.nodos[u],[bx,by]=R.nodos[v];const w=Math.hypot(bx-ax,by-ay);R.adj[u].push([v,w,w,f]);R.adj[v].push([u,w,w,f]);};
  ad(pid,p.a,p.fac);ad(pid,p.b,p.fac);ad(id,pid,COSTO_CAMINO.acceso);
  return id;
}
/* Dijkstra con montículo binario: costo y distancia real desde el origen a todos los nodos. */
function dijkstra(R,origen){
  const n=R.nodos.length,cost=new Float64Array(n).fill(Infinity),dist=new Float64Array(n),prev=new Int32Array(n).fill(-1);
  const h=[];const push=(c,v)=>{h.push([c,v]);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;[h[p],h[i]]=[h[i],h[p]];i=p;}};
  const pop=()=>{const t=h[0],l=h.pop();if(h.length){h[0]=l;let i=0;for(;;){const a=2*i+1,b=a+1;let m=i;if(a<h.length&&h[a][0]<h[m][0])m=a;if(b<h.length&&h[b][0]<h[m][0])m=b;if(m===i)break;[h[m],h[i]]=[h[i],h[m]];i=m;}}return t;};
  cost[origen]=0;push(0,origen);
  while(h.length){const [c,u]=pop();if(c>cost[u])continue;for(const [v,w,real] of R.adj[u]){const nc=c+w;if(nc<cost[v]){cost[v]=nc;dist[v]=dist[u]+real;prev[v]=u;push(nc,v);}}}
  return {cost,dist,prev};
}
function caminoNodos(prev,destino){const out=[];for(let v=destino;v!==-1;v=prev[v])out.push(v);return out.reverse();}
/* Velocidades de caminata (km/h) por sector: sirven solo para estimar los minutos de cada tramo.
   El recorrido se decide por la distancia real más corta (vía, sendero o atajo por dentro del lote). */
const VEL_KMH={via:4.5,sendero_principal:4.0,sendero_secundario:3.8,lote:3.3};
const FACTOR_LOTE=VEL_KMH.via/VEL_KMH.lote;
/* ¿El tramo recto entre dos puntos va por dentro de los lotes? (≥85 % de las muestras cada 8 m caen en un lote;
   así puede cruzar una vía o un sendero, pero no un bosque o una quebrada ancha). */
function tramoEnLotes(dentro,x1,y1,x2,y2){
  if(!dentro)return true;const L=Math.hypot(x2-x1,y2-y1);const n=Math.max(2,Math.ceil(L/8));let ok=0;
  for(let i=0;i<=n;i++){const t=i/n;const [lng,lat]=deXY(x1+t*(x2-x1),y1+t*(y2-y1));if(dentro(lng,lat))ok++;}
  return ok/(n+1)>=0.85;
}
/* Accesos de un punto a la red: hasta 3 caminos cercanos en direcciones distintas, por dentro del lote. */
function accesosRed(R,x,y,dentro){
  const cand=[];const r=Math.ceil(450/R.celda);const gx=Math.floor(x/R.celda),gy=Math.floor(y/R.celda);const vistos=new Set();
  for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){const l=R.grid.get((gx+i)+','+(gy+j));if(!l)continue;
    for(const si of l){if(vistos.has(si))continue;vistos.add(si);const [a,b,fac]=R.segs[si];const [x1,y1]=R.nodos[a],[x2,y2]=R.nodos[b];
      const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy||1e-9;let t=((x-x1)*dx+(y-y1)*dy)/L2;t=Math.max(0,Math.min(1,t));const px=x1+t*dx,py=y1+t*dy,d=Math.hypot(x-px,y-py);
      if(d<=450)cand.push({x:px,y:py,d,a,b,fac,ang:Math.atan2(py-y,px-x)});}}
  cand.sort((u,v)=>u.d-v.d);const out=[];
  for(const c of cand){if(out.length>=3)break;if(out.some(o=>Math.abs(Math.atan2(Math.sin(o.ang-c.ang),Math.cos(o.ang-c.ang)))<Math.PI/3))continue;
    if(out.length&&!tramoEnLotes(dentro,x,y,c.x,c.y))continue;out.push(c);}
  if(!out.length&&cand.length)out.push(cand[0]);
  return out;
}
function nodoNuevo(R,x,y){R.nodos.push([x,y]);R.adj.push([]);return R.nodos.length-1;}
function unir(R,u,v,f){const [ax,ay]=R.nodos[u],[bx,by]=R.nodos[v];const w=Math.hypot(bx-ax,by-ay);R.adj[u].push([v,w,w,f]);R.adj[v].push([u,w,w,f]);}
/* Ruta óptima: parte de la oficina, visita todos los puntos y regresa. Grafo combinado: vías y senderos + accesos desde cada
   palma + tramos directos palma a palma por dentro de los lotes (≤600 m). El orden se resuelve con vecino más cercano + 2-opt
   sobre la distancia real (ruta más corta); la geometría es una sola línea continua. opciones.dentro(lng,lat) → ¿el punto está en un lote? */
function rutaOptima(RED_GJ,oficina,puntos,opciones={}){
  const dentro=opciones.dentro||null;const R=construirRed(RED_GJ);
  const o=enlazarPunto(R,oficina.lng,oficina.lat);
  const P=puntos.map(p=>aXY(p.lng,p.lat));
  const ids=P.map(([x,y])=>{const id=nodoNuevo(R,x,y);for(const c of accesosRed(R,x,y,dentro)){const n=nodoNuevo(R,c.x,c.y);unir(R,n,c.a,c.fac);unir(R,n,c.b,c.fac);unir(R,id,n,FACTOR_LOTE*(c===undefined?1:1));}return id;});
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const [x1,y1]=P[i],[x2,y2]=P[j];const d=Math.hypot(x2-x1,y2-y1);
    if(d<=600&&tramoEnLotes(dentro,x1,y1,x2,y2))unir(R,ids[i],ids[j],FACTOR_LOTE);}
  const todos=[o,...ids];const D=[],C=[],PREV=[];
  for(const s of todos){if(s==null){D.push(null);C.push(null);PREV.push(null);continue;}const r=dijkstra(R,s);D.push(todos.map(t=>t==null?Infinity:r.dist[t]));C.push(todos.map(t=>t==null?Infinity:r.cost[t]));PREV.push(r.prev);}
  const n=puntos.length;const costo=(i,j)=>{const a=C[i],b=a&&a[j];if(b!=null&&isFinite(b))return b;const pi=i?puntos[i-1]:oficina,pj=j?puntos[j-1]:oficina;return dM(pi.lat,pi.lng,pj.lat,pj.lng)*2;};
  let orden=[],libres=new Set(Array.from({length:n},(_,i)=>i+1)),act=0;
  while(libres.size){let mejor=null,mc=Infinity;for(const j of libres){const c=costo(act,j);if(c<mc){mc=c;mejor=j;}}orden.push(mejor);libres.delete(mejor);act=mejor;}
  let mejora=true,vueltas=0;
  while(mejora&&vueltas++<80){mejora=false;for(let i=0;i<orden.length-1;i++)for(let k=i+1;k<orden.length;k++){
    const a=i?orden[i-1]:0,b=orden[i],c=orden[k],d=k+1<orden.length?orden[k+1]:0;
    if(costo(a,c)+costo(b,d)<costo(a,b)+costo(c,d)-0.5){orden=orden.slice(0,i).concat(orden.slice(i,k+1).reverse(),orden.slice(k+1));mejora=true;}}}
  // geometría continua, distancias y tiempos por tramo (y metros por dentro del lote)
  const geom=[],tramos=[],tiempos=[];let acum=0,acumLote=0,acumCosto=0;const sec=[0,...orden,0];
  const pegar=(lng,lat)=>{const u=geom[geom.length-1];if(!u||Math.abs(u[0]-lng)>1e-8||Math.abs(u[1]-lat)>1e-8)geom.push([+lng.toFixed(7),+lat.toFixed(7)]);};
  for(let s=1;s<sec.length;s++){const i=sec[s-1],j=sec[s];let m=0,c=0;
    if(PREV[i]&&todos[j]!=null&&isFinite(C[i][j])){const ns=caminoNodos(PREV[i],todos[j]);m=D[i][j];c=0;
      for(let q=0;q<ns.length;q++){const [lng,lat]=deXY(...R.nodos[ns[q]]);pegar(lng,lat);
        if(q){let e=null;for(const x of R.adj[ns[q-1]])if(x[0]===ns[q]&&(!e||x[1]<e[1]))e=x;if(e){c+=e[2]*(e[3]||1);if(e[3]===FACTOR_LOTE)acumLote+=e[2];}}}}
    else{const pi=i?puntos[i-1]:oficina,pj=j?puntos[j-1]:oficina;m=dM(pi.lat,pi.lng,pj.lat,pj.lng);c=m*FACTOR_LOTE;pegar(pi.lng,pi.lat);pegar(pj.lng,pj.lat);}
    acum+=m;acumCosto+=c;tramos.push(Math.round(m));tiempos.push(Math.round(c/(VEL_KMH.via*1000/60)));}
  return {orden:orden.map(i=>i-1),geometria:geom,tramos_m:tramos,tramos_min:tiempos,km:+(acum/1000).toFixed(2),km_lote:+(acumLote/1000).toFixed(2),
    min_caminata:Math.round(acumCosto/(VEL_KMH.via*1000/60))};
}

/* ---------- 3. Reglas de cirugía ---------- */
const CIR_N2=['PC INICIAL','PC AVANZADA','PC REINCIDENTE'];
const esCasoCirugia=d=>!!d&&(d.n1_codigo==='PC'||/PUDRICI[ÓO]N DE COGOLLO/i.test(d.nivel1||d.n1||''))&&CIR_N2.includes(String(d.nivel2||d.n2||'').toUpperCase());
const PRODUCTOS_CIR={quimico:['Mancozeb','Malathion','Clorpirifos','Oxicloruro de cobre','Mancozeb + Malathion'],biologico:['Beauveria bassiana','Quelato de zinc']};
/* Correcciones del cirujano: estado real de la palma cuando el censo quedó mal. */
const CORRECCIONES_CIR=[
  {id:'recuperacion',t:'PC en recuperación',n1_codigo:'PC',n1:'PUDRICIÓN DE COGOLLO (PC)',n2:'PC EN RECUPERACIÓN',n3:'SEGUIMIENTO PC',estado:'tratamiento'},
  {id:'crater',t:'Cráter',n1_codigo:'PC',n1:'PUDRICIÓN DE COGOLLO (PC)',n2:'CRATER',n3:'SEGUIMIENTO PC',estado:'enferma'},
  {id:'muerta',t:'Palma muerta',n1_codigo:'MUERTA',n1:'PALMA MUERTA',n2:'',n3:'',estado:'muerta'},
  {id:'erradicar',t:'Para erradicar',n1_codigo:'PC',n1:'PUDRICIÓN DE COGOLLO (PC)',n2:'PARA ERRADICAR',n3:'SEGUIMIENTO PC',estado:'enferma',accion:'erradicar'},
  {id:'sana',t:'Palma sana',n1_codigo:'SN',n1:'SIN NOVEDAD (PALMA SANA)',n2:'',n3:'',estado:'sana'},
  {id:'boro',t:'Deficiencia de boro',n1_codigo:'DEF',n1:'DEFICIENCIAS',n2:'BORO (B)',n3:'',estado:'enferma'},
  {id:'doblamiento',t:'Doblamiento de cogollo',n1_codigo:'DC',n1:'DOBLAMIENTO DE COGOLLO',n2:'',n3:'',estado:'novedad'}
];
