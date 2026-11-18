/* =====================================================================
   MONITOREO DE PLAGAS (visor web · Coordinación)
   Lee las jornadas de plagas/jornadas de los últimos días: resumen por plaga y por lote, palmas muestreadas con fotos,
   exportación a CSV y los puntos en el mapa (rojo = con daño, verde = sin daño).
   ===================================================================== */
GER.plg={dias:30,cargando:false,datos:null,capa:null,sub:'prog'};
/* Acceso directo en la cabecera, junto a ✚ CIRUGÍAS y ERRADICACIÓN: datos del monitoreo en el mapa (como el censo) */
(function botonPlagas(){const bt=document.createElement('button');bt.className='btn mini';bt.id='btPlg';bt.innerHTML='🐛 PLAGAS';bt.title='Programación y resultados del monitoreo de plagas';
  const r=$('#btErr')||$('#btCir');if(r)r.after(bt);else $('#chDatos').before(bt);
  bt.onclick=()=>alternarPlgMapa();})();
async function cargarPlagasVisor(){
  const G=GER.plg;G.cargando=true;pintarGer();
  try{const ini=GER.plgc&&GER.plgc.as&&GER.plgc.as.inicio;const nd=Math.max(G.dias,ini?diasEntre(ini,hoyISO())+1:0);
    const hoy=hoyISO(),d1=hoyISO(new Date(Date.now()-nd*86400000));
    const dias=await listarDias('plagas/jornadas',d1,hoy);const arch=[];
    await enParalelo(dias,6,async d=>{for(const f of await arbol(d.sha))if(f.type==='blob')arch.push({...f,dia:d.path});});
    const zips=new Map(arch.filter(f=>f.path.endsWith('_fotos.zip')).map(f=>[f.dia+'/'+f.path,f.sha]));
    const regs=[],jors=[];
    await enParalelo(arch.filter(f=>f.path.endsWith('.geojson')),6,async f=>{try{const g=JSON.parse(await blobTexto(f.sha));const h=g.jornada||{};
      const j={...h,zipSha:zips.get(f.dia+'/'+f.path.replace(/\.geojson$/,'_fotos.zip')),ruta:f.dia+'/'+f.path};jors.push(j);
      for(const ft of g.features||[]){const p=ft.properties||{};
        if(p.tipo==='recorrido'&&ft.geometry){j.track=ft.geometry.type==='LineString'?ft.geometry.coordinates:[ft.geometry.coordinates];continue;}
        if(p.tipo!=='monitoreo')continue;const c=ft.geometry&&ft.geometry.coordinates;
        let pl=p.plagas;if(typeof pl==='string')try{pl=JSON.parse(pl);}catch(e){pl=[];}
        regs.push({...p,plagas:Array.isArray(pl)?pl:[],lng:c?c[0]:p.lng,lat:c?c[1]:p.lat,_j:j});}}catch(e){console.warn('archivo ilegible',f.path,e);}});
    regs.sort((a,b)=>String(b.creado).localeCompare(String(a.creado)));G.datos={regs,jors,desde:d1,hasta:hoy};}
  catch(e){toast(e.message,6000);G.datos=G.datos||{regs:[],jors:[]};}
  G.cargando=false;pintarGer();
}
const estTxtV=x=>ESTADOS_PLAGA.filter(e=>Number(x[e.k])>0).map(e=>`${e.t} ${x[e.k]}`).join(' · ')||'sin individuos';
function pintarPlagasGer(){
  const G=GER.plg;
  if(!G.datos&&!G.cargando){cargarPlagasVisor();}
  const sub=`<div class="ger-par"><button class="btn mini ${G.sub==='prog'?'prim':''}" data-psub="prog">Programación</button><button class="btn mini ${G.sub==='res'?'prim':''}" data-psub="res">Resultados</button></div>`;
  if(G.sub==='prog')return sub+tarjetaModoProg('plagas')+pintarProgPlagas();
  return sub+pintarResPlagas();
}
function pintarResPlagas(){
  const G=GER.plg;
  const par=`<div class="ger-par">Últimos <select id="plgDias">${[7,15,30,60,90].map(d=>`<option value="${d}" ${G.dias===d?'selected':''}>${d} días</option>`).join('')}</select>
    <button class="btn mini" id="plgRec">↻ Volver a leer</button>${G.datos&&G.datos.regs.length?'<button class="btn mini" id="plgCsv">⬇ Exportar (CSV)</button><button class="btn mini prim" id="plgMapa">'+(G.capa?'Quitar del mapa':'Ver en el mapa')+'</button>':''}</div>`;
  if(G.cargando||!G.datos)return `<div class="ger-sec"><h3>Monitoreo de plagas</h3>${par}<p class="tenue">Leyendo las jornadas de monitoreo de plagas…</p></div>`;
  const R=G.datos.regs;
  if(!R.length)return `<div class="ger-sec"><h3>Monitoreo de plagas</h3>${par}<p class="tenue">Aún no hay jornadas de monitoreo de plagas sincronizadas en este periodo.</p></div>`;
  const conD=R.filter(r=>r.dano===true||r.dano==='true').length;
  const porPlaga=PLAGAS.map(p=>{const xs=R.flatMap(r=>r.plagas.filter(x=>x.plaga===p.id));const o={plaga:p.n,palmas:xs.length,dano:xs.filter(x=>x.dano===true||x.dano==='true').length};
    for(const e of ESTADOS_PLAGA)o[e.k]=xs.reduce((a,x)=>a+(Number(x[e.k])||0),0);return o;}).filter(x=>x.palmas);
  const lotes=new Map();for(const r of R){const l=lotes.get(r.lote)||{lote:r.lote,n:0,d:0,pl:new Map(),muestreo:new Set()};l.n++;if(r.dano===true||r.dano==='true')l.d++;l.muestreo.add(r.muestreo);
    for(const x of r.plagas)l.pl.set(x.plaga,(l.pl.get(x.plaga)||0)+1);lotes.set(r.lote,l);}
  const tLotes=[...lotes.values()].sort((a,b)=>b.d-a.d||ordenNat(a.lote,b.lote));G._regs=R;
  return `<div class="ger-sec"><h3>Monitoreo de plagas</h3>${par}
    <div class="ger-kpis">${kpi(num(G.datos.jors.length),'Jornadas')}${kpi(num(R.length),'Palmas muestreadas')}${kpi(num(conD),'Con daño',conD?'mal':'ok')}${kpi(num(R.length?conD/R.length*100:0,1)+' %','Palmas con daño')}${kpi(num(lotes.size),'Lotes')}</div></div>
    <div class="ger-sec"><h3>Por plaga</h3>${tablaGer([{t:'Plaga',f:x=>`<b>${esc(x.plaga)}</b>`},{t:'Palmas con la plaga',n:1,f:x=>num(x.palmas)},{t:'Con daño',n:1,f:x=>num(x.dano)},
      ...ESTADOS_PLAGA.map(e=>({t:e.t,n:1,f:x=>num(x[e.k])}))],porPlaga)}</div>
    <div class="ger-sec"><h3>Por lote</h3>${tablaGer([{t:'Lote',f:x=>`<b>${esc(x.lote)}</b>`},{t:'Muestreo',f:x=>esc([...x.muestreo].map(m=>(MUESTREOS.find(y=>y.id===m)||{}).t||m).join(', '))},{t:'Palmas muestreadas',n:1,f:x=>num(x.n)},
      {t:'Con daño',n:1,f:x=>x.d?`<span class="ger-chip mal">${num(x.d)} · ${num(x.d/x.n*100,0)} %</span>`:'0'},{t:'Plagas encontradas (palmas)',f:x=>esc([...x.pl].map(([k,v])=>`${(PLAGAS.find(p=>p.id===k)||{}).n||k} ${v}`).join(' · ')||'—')}],tLotes)}</div>
    <div class="ger-sec"><h3>Palmas muestreadas (${num(R.length)})</h3>${tablaGer([{t:'Fecha',f:x=>esc(String(x.fecha||x.creado||'').slice(0,16).replace('T',' '))},{t:'Palma',f:x=>`<b>${esc(x.lote)} · L${esc(x.linea)} · P${esc(x.palma)}</b>`},
      {t:'Muestreo',f:x=>esc((MUESTREOS.find(y=>y.id===x.muestreo)||{}).t||x.muestreo||'')},{t:'Hoja',n:1,f:x=>esc(x.hoja)},{t:'Plagas',f:x=>x.plagas.map(p=>`${esc(p.plaga_nombre||p.plaga)}: ${esc(estTxtV(p))}${p.dano===true||p.dano==='true'?' <span class="ger-chip mal">daño</span>':''}`).join('<br>')},
      {t:'Transitabilidad',f:x=>esc(x.transitabilidad||'')},{t:'Operario',f:x=>esc(x.evaluador||'')},{t:'Foto',f:(x)=>String(x.fotos||'').split('|').filter(Boolean).length?`<button class="btn mini" data-pfo="${R.indexOf(x)}">Ver</button>`:'—'}],R.slice(0,300))}
      ${R.length>300?'<p class="tenue">Se muestran las 300 más recientes; el CSV las trae todas.</p>':''}</div>`;
}
function exportarPlagasCSV(){
  const R=GER.plg.datos.regs;const cols=['fecha','lote','linea','palma','muestreo','en_muestra','hoja','plaga',...ESTADOS_PLAGA.map(e=>e.t),'dano','transitabilidad','operario','observaciones'];
  const filas=[];for(const r of R)for(const p of (r.plagas.length?r.plagas:[{}]))filas.push([String(r.fecha||r.creado||'').slice(0,16).replace('T',' '),r.lote,r.linea,r.palma,(MUESTREOS.find(y=>y.id===r.muestreo)||{}).t||r.muestreo||'',
    r.en_muestra===false||r.en_muestra==='false'?'No':'Sí',r.hoja,p.plaga_nombre||p.plaga||'',...ESTADOS_PLAGA.map(e=>p[e.k]??''),p.dano===true||p.dano==='true'?'Sí':p.plaga?'No':'',r.transitabilidad||'',r.evaluador||'',r.observaciones||'']
    .map(v=>String(v??'').replace(/[;\r\n]+/g,' ')).join(';'));
  descargar(`monitoreo_plagas_${hoyISO()}.csv`,'﻿'+[cols.join(';'),...filas].join('\r\n'),'text/csv');
}
function alternarCapaPlagas(){
  const G=GER.plg;if(G.capa){mapa.removeLayer(G.capa);G.capa=null;const c=$('#chPlg');if(c)c.remove();return;}
  G.capa=L.layerGroup();const R=G.datos.regs.filter(r=>r.lat!=null);
  for(const r of R){const d=r.dano===true||r.dano==='true';L.circleMarker([r.lat,r.lng],{renderer:rend,radius:6,color:'#fff',weight:1.2,fillColor:d?'#e53935':'#22d39a',fillOpacity:.95})
    .bindPopup(`<b>${esc(r.lote)} · L${esc(r.linea)} · P${esc(r.palma)}</b><br>Hoja ${esc(r.hoja)} · ${esc((MUESTREOS.find(y=>y.id===r.muestreo)||{}).t||r.muestreo||'')}<br>${r.plagas.map(p=>`${esc(p.plaga_nombre||p.plaga)}: ${esc(estTxtV(p))}${p.dano===true||p.dano==='true'?' · daño':''}`).join('<br>')}<br><span class="tenue">${esc(r.evaluador||'')} · ${esc(String(r.fecha||r.creado||'').slice(0,10))}</span>`).addTo(G.capa);}
  G.capa.addTo(mapa);if(R.length)mapa.fitBounds(L.latLngBounds(R.map(r=>[r.lat,r.lng])),{padding:[40,40],maxZoom:17});
  const ch=document.createElement('span');ch.className='chip';ch.id='chPlg';ch.style.cursor='pointer';ch.title='Quitar del mapa';ch.innerHTML=`🐛 Plagas: ${num(R.length)} palmas ✕`;ch.onclick=()=>alternarCapaPlagas();$('#chDatos').before(ch);
}
ENLACES_GER.plagas=()=>{const G=GER.plg;
  $$('#gerPanel [data-psub]').forEach(b=>b.onclick=()=>{G.sub=b.dataset.psub;pintarGer();});
  if(G.sub==='prog'){enlazarModoProg();enlazarProgPlagas();}
  const d=$('#plgDias');if(d)d.onchange=()=>{G.dias=Number(d.value)||30;G.datos=null;cargarPlagasVisor();};
  const r=$('#plgRec');if(r)r.onclick=()=>{G.datos=null;cargarPlagasVisor();};
  const c=$('#plgCsv');if(c)c.onclick=exportarPlagasCSV;
  const m=$('#plgMapa');if(m)m.onclick=()=>{alternarCapaPlagas();if(G.capa)alternarGerencia(false);else pintarGer();};
  $$('#gerPanel [data-pfo]').forEach(b=>b.onclick=()=>{const x=G._regs[+b.dataset.pfo];verFotos({...x,_j:x._j});});
};

/* =====================================================================
   PROGRAMACIÓN DEL MONITOREO DE PLAGAS (ciclo de 18 días · unidades de ~30 ha)
   plagas/programacion/ciclo.json: unidades (bloque P y mitad) con sus lotes y palmas (rangos de ids).
   · Titular por posición del día (1…6): sigue con su siguiente unidad pendiente, a su ritmo.
   · Avance: palmas de la muestra registradas dentro de la unidad (10×10 o el muestreo usado en el lote) desde el inicio de la vuelta;
     con 90 % la unidad queda hecha; también se marca a mano.
   · Plan del día en plagas/plan/AAAA-MM-DD.json (lo lee la App: «Su bloque de hoy»).
   ===================================================================== */
GER.plgc={c:null,cargando:false,err:null,as:null,asSha:null,planes:[],av:null,avKey:'',calc:false,dia:null,guardado:false};
function unidadesPlg(){const C=GER.plgc;const m=new Map();for(const D of C.c.dias)for(const u of D.unidades)m.set(u.unidad,{...u,dia:D.dia});return m;}
async function guardarAsigPlg(msg){const C=GER.plgc;C.as.actualizado=new Date().toISOString();C.as.actualizado_por=SES.u;
  C.asSha=await ghPut('plagas/programacion/asignacion.json',JSON.stringify(C.as,null,1),msg,C.asSha);}
async function cargarCicloPlg(){
  const C=GER.plgc,rama=encodeURIComponent(SES.repo.rama),raw=async r=>JSON.parse(await (await gh(`/contents/${r}?ref=${rama}`,'application/vnd.github.raw+json')).text());
  try{C.c=await raw('plagas/programacion/ciclo.json');}catch(e){C.c=false;if(e.status!==404)C.err=e.message;return;}
  try{const j=await (await gh(`/contents/plagas/programacion/asignacion.json?ref=${rama}`)).json();C.asSha=j.sha;C.as=JSON.parse(DEC.decode(deB64(j.content.replace(/\s/g,''))));}catch(e){if(e.status!==404)throw e;C.as=null;}
  if(!C.as)C.as={formato:'sanidad-asignacion-plagas-1',ciclo_version:C.c.version,vuelta:1,inicio:null,titulares:{},manual:{}};
  C.as.titulares=C.as.titulares||{};C.as.manual=C.as.manual||{};C.planes=[];
  try{const l=await (await gh(`/contents/plagas/plan?ref=${rama}`)).json();
    const fs=(Array.isArray(l)?l:[]).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x.name)).map(x=>x.name).sort().reverse().filter(n=>!C.as.inicio||n.slice(0,10)>=C.as.inicio).slice(0,30);
    for(const n of fs){try{C.planes.push({fecha:n.slice(0,10),...await raw(`plagas/plan/${n}`)});}catch(e){}}}catch(e){}
  C.planes.sort((a,b)=>a.fecha.localeCompare(b.fecha));
  if(!Object.keys(C.as.titulares).length)for(const p of C.planes)for(const a of p.asignaciones||[])if(a.tipo==='titular'&&a.posicion)C.as.titulares[a.posicion]=a.usuario;
}
/* Avance de cada unidad: palmas registradas de su muestra (calculada con la cartografía) desde el inicio de la vuelta */
/* Llave del avance (igual al pintar y al calcular: si no coinciden, se recalcularía sin fin) */
const llaveAvPlg=()=>{const G=GER.plg,r=G.datos&&G.datos.regs||[];return r.length+'|'+GER.plgc.as.inicio+'|'+(r[0]&&r[0].id)+'|'+JSON.stringify(GER.plgc.as.manual||{}).length;};
async function avancePlg(){
  const C=GER.plgc,G=GER.plg,ini=C.as.inicio;const regs=(G.datos&&G.datos.regs||[]).filter(r=>ini&&String(r.fecha||r.creado).slice(0,10)>=ini);
  const key=llaveAvPlg();if(C.avKey===key&&C.av)return;C.calc=true;
  const hechas=new Set(regs.map(r=>String(r.palma_id)));const mLote=new Map();for(const r of regs)if(r.muestreo)mLote.set(r.lote,r.muestreo);
  const av={};
  for(const u of unidadesPlg().values()){let n=0,h=0;
    for(const t of u.lotes){if(!ini){n+=1;continue;}const k=(MUESTREOS.find(x=>x.id===(mLote.get(t.lote)||C.c.reglas.muestreo_defecto))||MUESTREOS[0]).k;
      const d=await chunkLote(t.lote);const m=muestraLote(d,k,id=>VAJ.has(id)).filter(x=>enRangos(x.palma_id,t.rangos));n+=m.length;h+=m.filter(x=>hechas.has(x.palma_id)).length;}
    av[u.unidad]={n,h,p:n?h/n*100:0};}
  C.av=av;C.avKey=key;C.calc=false;
}
function estadoUnidad(id){const C=GER.plgc,m=C.as.manual[id],a=(C.av&&C.av[id])||{p:0};
  if(m&&m.estado==='terminado')return {e:'hecha',p:a.p,manual:true};if(a.p>=90&&!(m&&m.estado==='reabierto'))return {e:'hecha',p:a.p};return {e:a.p>0?'curso':'pendiente',p:a.p};}
function sigUnidad(pos,ocup){const C=GER.plgc;for(const D of C.c.dias){const u=D.unidades.find(x=>x.posicion===pos);if(u&&!ocup.has(u.unidad)&&estadoUnidad(u.unidad).e!=='hecha')return u.unidad;}return null;}
const nPos=()=>Math.max(...GER.plgc.c.dias.map(D=>D.unidades.length));
function armarDiaPlg(fecha,forzar){const C=GER.plgc;const env=C.planes.find(p=>p.fecha===fecha);
  if(env&&!forzar){C.dia={fecha,enviado:true,filas:(env.asignaciones||[]).map(a=>({usuario:a.usuario,unidad:a.unidad}))};C.guardado=true;return;}
  const filas=[],ocup=new Set();for(let p=1;p<=6;p++){const u=sigUnidad(p,ocup);if(!u)continue;ocup.add(u);filas.push({usuario:C.as.titulares[p]||'',unidad:u});}
  C.dia={fecha,enviado:false,filas};C.guardado=false;}
const chipU=s=>s.e==='hecha'?`<span class="ger-chip ok">✔ ${s.manual?'terminada':num(s.p,0)+' %'}</span>`:s.e==='curso'?`<span class="ger-chip med">${num(s.p,0)} %</span>`:'<span class="ger-chip gris">pendiente</span>';
/* Auxiliares con la labor de monitoreo de plagas (del paquete de acceso) */
async function opsPlagas(){if(GER.plg.ops)return GER.plg.ops;const us=await cirUsuarios();
  GER.plg.ops=us.filter(x=>!x.inactivo&&(x.labores||[]).includes('plagas')).map(x=>({u:x.u,nombre:x.nombre}));return GER.plg.ops;}
function pintarProgPlagas(){
  const C=GER.plgc,G=GER.plg;
  if(C.c==null&&!C.cargando){C.cargando=true;cargarCicloPlg().catch(e=>{C.err=e.message;C.c=false;}).finally(()=>{C.cargando=false;pintarGer();});}
  if(!G.ops&&!G.cargandoOps){G.cargandoOps=true;opsPlagas().catch(e=>{G.ops=[];toast(e.message,6000);}).finally(()=>{G.cargandoOps=false;pintarGer();});}
  if(C.c==null)return '<p class="tenue">Consultando la programación de plagas…</p>';
  if(C.c===false)return `<p class="tenue">${C.err?'❌ '+esc(C.err):'Aún no hay programación de plagas (plagas/programacion/ciclo.json).'}</p>`;
  if(!G.datos)return '<p class="tenue">Leyendo los monitoreos registrados…</p>';
  const key=llaveAvPlg();
  if((C.avKey!==key||!C.av)&&!C.calc){avancePlg().catch(e=>{C.calc=false;C.av={};toast(e.message,6000);}).finally(()=>pintarGer());}
  if(!C.av)return '<p class="tenue">Calculando el avance de las unidades…</p>';
  const P=GER.plan;if(!P.fecha)P.fecha=(()=>{const h=new Date();const f=hoyISO();return h.getHours()<10&&esHabil(f)?f:habilMas(f);})();
  if(!C.dia||C.dia.fecha!==P.fecha)armarDiaPlg(P.fecha);
  const ops=(G.ops||[]),U=unidadesPlg(),todos=[...U.values()],est=new Map(todos.map(u=>[u.unidad,estadoUnidad(u.unidad)]));
  const selOp=(attr,val,vacio)=>`<select ${attr} style="min-width:170px"><option value="">${vacio}</option>${ops.map(o=>`<option value="${esc(o.u)}" ${val===o.u?'selected':''}>${esc(o.nombre)}</option>`).join('')}</select>`;
  const nH=todos.filter(u=>est.get(u.unidad).e==='hecha').length;
  const tTit=tablaGer([{t:'Posición',f:x=>`<b>${x}</b>`},{t:'Titular',f:x=>selOp(`data-ptit="${x}"`,C.as.titulares[x]||'','— Sin titular —')},
    {t:'Siguiente unidad',f:x=>{const s=sigUnidad(x,new Set());return s?`<b>${esc(s)}</b> ${chipU(est.get(s))}`:'<span class="ger-chip ok">vuelta completa</span>';}}],[1,2,3,4,5,6]);
  const fl=C.dia.filas,usadas=new Map();fl.forEach(f=>{if(f.unidad)usadas.set(f.unidad,(usadas.get(f.unidad)||0)+1);});
  const pend=todos.filter(u=>est.get(u.unidad).e!=='hecha');
  const tDia=tablaGer([{t:'Auxiliar',f:x=>selOp(`data-pfu="${x.i}"`,x.usuario,'— Auxiliar —')},
    {t:'Unidad',f:x=>`<select data-pfb="${x.i}" style="min-width:150px"><option value="">— Unidad —</option>${pend.concat(x.unidad&&!pend.some(u=>u.unidad===x.unidad)?[U.get(x.unidad)]:[]).filter(Boolean).map(u=>`<option value="${esc(u.unidad)}" ${u.unidad===x.unidad?'selected':''}>${esc(u.unidad)} · día ${u.dia}</option>`).join('')}</select>${usadas.get(x.unidad)>1?' <b style="color:#ff8a8a">repetida</b>':''}`},
    {t:'Lotes',f:x=>{const u=U.get(x.unidad);return u?esc(u.lotes.map(l=>l.lote).join(', ')):'—';}},{t:'Palmas',n:1,f:x=>{const u=U.get(x.unidad);return u?num(u.palmas):'—';}},
    {t:'Avance',f:x=>x.unidad?chipU(est.get(x.unidad)):''},{t:'',f:x=>`<button class="btn mini" data-pfq="${x.i}" title="Quitar">✕</button>`}],fl.map((f,i)=>({...f,i})));
  const sinAux=[];{const oc=new Set(fl.map(f=>f.unidad));for(const D of C.c.dias){if(!D.unidades.some(u=>est.get(u.unidad).e!=='hecha'))continue;
    for(const u of D.unidades)if(u.posicion>6&&!oc.has(u.unidad)&&est.get(u.unidad).e!=='hecha')sinAux.push(u.unidad);break;}}
  const grid=`<div class="ger-tabla"><table class="ger-calor"><thead><tr><th>Día</th>${Array.from({length:nPos()},(_,i)=>`<th class="c">${i+1}</th>`).join('')}</tr></thead><tbody>${C.c.dias.map(D=>`<tr><td><b>D${D.dia}</b></td>${Array.from({length:nPos()},(_,i)=>{const u=D.unidades.find(x=>x.posicion===i+1);if(!u)return '<td class="c tenue">—</td>';
    const s=est.get(u.unidad),bg=s.e==='hecha'?'rgba(34,211,154,.35)':s.e==='curso'?'rgba(255,197,61,.30)':'transparent';
    return `<td class="c" data-pcel="${esc(u.unidad)}" style="cursor:pointer;background:${bg}" title="${esc(u.unidad)} · ${esc(u.lotes.map(l=>l.lote).join(', '))} · ${num(u.palmas)} palmas">${s.e==='hecha'?'✔':s.e==='curso'?num(s.p,0):'·'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="ger-sec"><h3>Programación del monitoreo · vuelta ${C.as.vuelta}</h3>
    <p class="tenue">${C.c.resumen.dias} días · ${C.c.resumen.unidades} unidades de ~30 ha (bloque P y mitad) · ${num(C.c.resumen.palmas)} palmas. ${C.as.inicio?'Vuelta iniciada el '+esc(C.as.inicio)+'.':'La vuelta inicia con el primer plan que se envíe.'} Cada auxiliar sigue con su siguiente unidad; una unidad queda hecha con el 90 % de su muestra registrada.</p>
    <div class="ger-kpis">${kpi(`${nH} / ${todos.length}`,'Unidades hechas',nH===todos.length?'ok':'')}${kpi(num(todos.filter(u=>est.get(u.unidad).e==='curso').length),'En curso')}${kpi(num(todos.length-nH),'Pendientes')}</div></div>
    <div class="ger-sec"><h3>1. Auxiliar titular de cada posición</h3><p class="tenue">La posición 1 hace la primera unidad de cada día, la 2 la segunda… Los días con una séptima unidad se cubren con apoyo.</p>${tTit}
      <div class="ger-par"><button class="btn mini prim" id="pTitG">Guardar titulares</button></div></div>
    <div class="ger-sec"><h3>2. Plan del día</h3><div class="ger-par">Fecha <input type="date" id="pFecha" value="${esc(P.fecha)}">
      <button class="btn mini" id="pAg">＋ Agregar unidad (apoyo)</button><button class="btn mini" id="pSug">↺ Volver a la sugerencia</button>
      <button class="btn mini nar" id="pEnv">${C.guardado?'✅ Enviado · enviar de nuevo':'Guardar y enviar a los celulares'}</button></div>
      ${C.dia.enviado?`<p class="tenue">Plan ya enviado para el ${esc(C.dia.fecha)}; puede modificarlo y enviarlo de nuevo.</p>`:''}${tDia}
      ${sinAux.length?`<div class="ger-aviso">Unidades del día sin auxiliar: <b>${sinAux.map(esc).join(', ')}</b>. Agréguelas como apoyo (＋ Agregar unidad).</div>`:''}</div>
    <div class="ger-sec"><h3>3. Avance del ciclo</h3><p class="tenue">✔ hecha · número = % de la muestra registrada · · pendiente. Clic en una unidad para marcarla terminada o reabrirla.</p>${grid}
      <div class="ger-par"><button class="btn mini" id="pVuelta">Iniciar una nueva vuelta</button></div></div>`;
}
function enlazarProgPlagas(){
  const C=GER.plgc,P=GER.plan;if(!C.c||!C.av||!C.dia)return;
  const f=$('#pFecha');if(f)f.onchange=()=>{P.fecha=f.value;armarDiaPlg(P.fecha);pintarGer();};
  $$('#gerPanel [data-ptit]').forEach(s=>s.onchange=()=>{C.as.titulares[s.dataset.ptit]=s.value;if(!C.dia.enviado)armarDiaPlg(P.fecha,true);pintarGer();});
  const tg=$('#pTitG');if(tg)tg.onclick=async()=>{tg.disabled=true;try{await guardarAsigPlg('Plagas: auxiliares titulares de las posiciones');toast('✅ Titulares guardados.');}catch(e){toast(e.message,6000);}pintarGer();};
  $$('#gerPanel [data-pfu]').forEach(s=>s.onchange=()=>{C.dia.filas[s.dataset.pfu].usuario=s.value;C.guardado=false;pintarGer();});
  $$('#gerPanel [data-pfb]').forEach(s=>s.onchange=()=>{C.dia.filas[s.dataset.pfb].unidad=s.value;C.guardado=false;pintarGer();});
  $$('#gerPanel [data-pfq]').forEach(b=>b.onclick=()=>{C.dia.filas.splice(Number(b.dataset.pfq),1);C.guardado=false;pintarGer();});
  const ag=$('#pAg');if(ag)ag.onclick=()=>{const oc=new Set(C.dia.filas.map(x=>x.unidad));let s='';for(let p=1;p<=nPos()&&!s;p++)s=sigUnidad(p,oc)||'';C.dia.filas.push({usuario:'',unidad:s});C.guardado=false;pintarGer();};
  const su=$('#pSug');if(su)su.onclick=()=>{armarDiaPlg(P.fecha,true);pintarGer();};
  $$('#gerPanel [data-pcel]').forEach(td=>td.onclick=async()=>{const id=td.dataset.pcel,s=estadoUnidad(id);const t=s.e!=='hecha';
    if(!confirm(t?`¿Marcar ${id} como terminada? (muestra registrada: ${num(s.p,0)} %)`:`¿Reabrir ${id}?`))return;
    C.as.manual[id]={estado:t?'terminado':'reabierto',por:SES.u,fecha:new Date().toISOString()};
    try{await guardarAsigPlg(`Plagas: ${id} ${t?'terminada':'reabierta'}`);if(!C.dia.enviado)armarDiaPlg(P.fecha,true);}catch(e){delete C.as.manual[id];toast(e.message,6000);}pintarGer();});
  const vu=$('#pVuelta');if(vu)vu.onclick=async()=>{if(!confirm('¿Iniciar una nueva vuelta? Todas las unidades vuelven a quedar pendientes.'))return;
    const prev=JSON.parse(JSON.stringify(C.as));C.as.vuelta=(C.as.vuelta||1)+1;C.as.inicio=null;C.as.manual={};
    try{await guardarAsigPlg(`Plagas: inicia la vuelta ${C.as.vuelta}`);C.planes=[];C.av=null;C.avKey='';C.dia=null;}catch(e){C.as=prev;toast(e.message,6000);}pintarGer();};
  const g=$('#pEnv');if(g)g.onclick=async()=>{const U=unidadesPlg(),fl=C.dia.filas;
    if(!fl.length){toast('El plan no tiene unidades.',5000);return;}
    const mal=fl.findIndex(x=>!x.usuario||!x.unidad);if(mal>=0){toast(`Complete el auxiliar y la unidad de la fila ${mal+1}.`,6000);return;}
    const us=fl.map(x=>x.unidad);if(new Set(us).size!==us.length){toast('Hay una unidad asignada dos veces.',6000);return;}
    g.disabled=true;g.textContent='Guardando…';const ruta=`plagas/plan/${P.fecha}.json`;let sha=null;try{sha=(await (await gh(`/contents/${ruta}?ref=${encodeURIComponent(SES.repo.rama)}`)).json()).sha;}catch(e){}
    const nom=u=>((GER.plg.ops||[]).find(o=>o.u===u)||{}).nombre||u;
    const plan={formato:'sanidad-plan-plagas-1',fecha:P.fecha,ciclo_version:C.c.version,vuelta:C.as.vuelta,creado:new Date().toISOString(),creado_por:SES.u,
      asignaciones:fl.map(x=>{const u=U.get(x.unidad);const tit=Object.entries(C.as.titulares).find(([k,v])=>v===x.usuario&&Number(k)===u.posicion);
        return {usuario:x.usuario,nombre:nom(x.usuario),unidad:u.unidad,dia:u.dia,posicion:u.posicion,tipo:tit?'titular':'apoyo',palmas:u.palmas,ha:u.ha,muestreo:C.c.reglas.muestreo_defecto,lotes:u.lotes};})};
    try{await ghPut(ruta,JSON.stringify(plan),`Plan de monitoreo de plagas ${P.fecha} · ${fl.length} unidades`,sha);
      if(!C.as.inicio||P.fecha<C.as.inicio){C.as.inicio=P.fecha;await guardarAsigPlg(`Plagas: vuelta ${C.as.vuelta} inicia el ${P.fecha}`);C.avKey='';}
      C.planes=C.planes.filter(p=>p.fecha!==P.fecha).concat([plan]).sort((a,b)=>a.fecha.localeCompare(b.fecha));C.dia.enviado=true;C.guardado=true;
      toast(`✅ Plan del ${P.fecha} enviado: cada auxiliar verá su bloque al iniciar el monitoreo.`,7000);}catch(e){toast(e.message,6000);}pintarGer();};
}

/* =====================================================================
   MODO PLAGAS EN EL MAPA (botón 🐛 PLAGAS de la cabecera), como el censo de enfermedades:
   recorrido de cada jornada, palmas muestreadas (rojo = con daño, verde = sin daño), filtros, lista de jornadas,
   tabla de palmas y fotos. La programación sigue en 🧭 COORDINACIÓN → Monitoreo de plagas.
   ===================================================================== */
const PLM={on:false,capa:L.layerGroup(),f:{plaga:'',op:'',lote:'',dano:false},sel:null};
(function montarModoPlagas(){
  const css=document.createElement('style');css.textContent=`
  body.modo-plg #filtros,body.modo-plg nav.tabs,body.modo-plg #panel,body.modo-plg #leyenda{display:none!important}
  #plgPanel input#plmLote{width:100%;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.06);color:var(--texto);border:1px solid var(--borde)}
  .plg-ley{display:flex;gap:12px;font-size:12.5px;margin:4px 0 8px}.plg-ley i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle;border:1px solid #fff}
  #plgPanel{flex:1;overflow:auto;padding:12px 14px 30px;display:none}
  body.modo-plg #plgPanel{display:block}
  .plg-j{border:1px solid var(--borde);border-radius:10px;padding:7px 9px;margin:5px 0;cursor:pointer;font-size:12.8px}
  .plg-j.on{border-color:var(--acento);background:rgba(34,211,154,.08)}`;
  document.head.appendChild(css);
  const p=document.createElement('div');p.id='plgPanel';$('aside').appendChild(p);
})();
function alternarPlgMapa(on){
  PLM.on=on==null?!PLM.on:on;
  if(PLM.on){if(typeof ERR!=='undefined'&&ERR.on)alternarErr(false);if(typeof CIR!=='undefined'&&CIR.on)alternarCirugia(false);if(GER.on)alternarGerencia(false);}
  document.body.classList.toggle('modo-plg',PLM.on);{const b=$('#btPlg');if(b)b.classList.toggle('prim',PLM.on);}
  for(const c of [capaRec,capaDiag,capaPar,capaCirR])PLM.on?mapa.removeLayer(c):(c.addTo(mapa));
  if(PLM.on){PLM.capa.addTo(mapa);if(!GER.plg.datos&&!GER.plg.cargando)cargarPlagasVisor().then(()=>{pintarPlgMapa(true);});pintarPlgMapa(true);}
  else mapa.removeLayer(PLM.capa);
}
const esSi=v=>v===true||v==='true';
function regsFiltrados(){const R=(GER.plg.datos&&GER.plg.datos.regs)||[],f=PLM.f;
  return R.filter(r=>(!f.plaga||r.plagas.some(p=>p.plaga===f.plaga))&&(!f.op||r.evaluador===f.op)&&(!f.lote||String(r.lote).toUpperCase().includes(f.lote.toUpperCase()))&&(!f.dano||esSi(r.dano))&&(!PLM.sel||r._j===PLM.sel));}
function popupPlg(r){return `<b>${esc(r.lote)} · L${esc(r.linea)} · P${esc(r.palma)}</b><br>Hoja ${esc(r.hoja)} · muestreo ${esc((MUESTREOS.find(y=>y.id===r.muestreo)||{}).t||r.muestreo||'')}${r.unidad?' · '+esc(r.unidad):''}
  <br>${r.plagas.map(p=>`<b>${esc(p.plaga_nombre||p.plaga)}</b>: ${esc(estTxtV(p))}${esSi(p.dano)?' · <span style="color:#ff8a80">daño</span>':''}`).join('<br>')||'Sin plagas'}
  <br><span class="tenue">${esc(r.transitabilidad||'')} · ${esc(r.evaluador||'')} · ${esc(String(r.fecha||r.creado||'').slice(0,16).replace('T',' '))}</span>
  ${String(r.fotos||'').split('|').filter(Boolean).length?`<br><button class="btn mini" data-pfp="${esc(r.id)}" style="margin-top:6px">📷 Ver foto</button>`:''}`;}
function pintarPlgMapa(encuadrar){
  const P=$('#plgPanel');if(!P)return;const G=GER.plg;
  const salir='<button class="btn mini" id="plmSalir" title="Volver al visor">✕ Salir</button>';
  if(!G.datos){P.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><h3>Monitoreo de plagas</h3>${salir}</div><div class="tenue">Leyendo las jornadas de monitoreo de plagas…</div>`;$('#plmSalir').onclick=()=>alternarPlgMapa(false);return;}
  const R=regsFiltrados(),todos=G.datos.regs,jors=[...new Set(todos.map(r=>r._j))].sort((a,b)=>String(b.inicio||b.fecha).localeCompare(String(a.inicio||a.fecha)));
  const ops=[...new Set(todos.map(r=>r.evaluador).filter(Boolean))].sort();const conD=R.filter(r=>esSi(r.dano)).length;
  const porP=PLAGAS.map(p=>({p,n:R.filter(r=>r.plagas.some(x=>x.plaga===p.id)).length})).filter(x=>x.n);
  // mapa: recorridos de las jornadas y palmas
  PLM.capa.clearLayers();const jsVis=new Set(R.map(r=>r._j));
  for(const j of jsVis){if(j.track&&j.track.length>1){const on=PLM.sel===j;L.polyline(j.track.map(([x,y])=>[y,x]),{renderer:rend,color:on?'#ffd166':'#4fb3ff',weight:on?4:2.5,opacity:.85,interactive:false}).addTo(PLM.capa);}}
  for(const r of R){if(r.lat==null)continue;L.circleMarker([r.lat,r.lng],{renderer:rend,radius:6.5,color:'#fff',weight:1.3,fillColor:esSi(r.dano)?'#e53935':'#22d39a',fillOpacity:.95}).bindPopup(popupPlg(r),{maxWidth:320}).addTo(PLM.capa);}
  if(encuadrar){const ll=R.filter(r=>r.lat!=null).map(r=>[r.lat,r.lng]);if(ll.length)mapa.fitBounds(L.latLngBounds(ll),{padding:[40,40],maxZoom:17});}
  P.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">🐛 Monitoreo de plagas</h3>${salir}</div>
    <div class="cir-par" style="margin-top:8px">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">Últimos <select id="plmDias">${[7,15,30,60,90].map(d=>`<option value="${d}" ${G.dias===d?'selected':''}>${d} días</option>`).join('')}</select><button class="btn mini" id="plmRec">↻</button></div>
      <label class="campo" for="plmPlaga">Plaga</label><select id="plmPlaga"><option value="">Todas</option>${PLAGAS.map(p=>`<option value="${p.id}" ${PLM.f.plaga===p.id?'selected':''}>${esc(p.n)}</option>`).join('')}</select>
      <label class="campo" for="plmOp">Auxiliar</label><select id="plmOp"><option value="">Todos</option>${ops.map(o=>`<option ${PLM.f.op===o?'selected':''}>${esc(o)}</option>`).join('')}</select>
      <label class="campo" for="plmLote">Lote</label><input id="plmLote" value="${esc(PLM.f.lote)}" placeholder="IT05" autocapitalize="characters">
      <label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="plmDano" ${PLM.f.dano?'checked':''}> Solo palmas con daño</label></div>
    <div class="kpis"><div class="kpi"><b>${num(jsVis.size)}</b><span>Jornadas</span></div><div class="kpi"><b>${num(R.length)}</b><span>Palmas muestreadas</span></div><div class="kpi"><b class="${conD?'venc':''}">${num(conD)}</b><span>Con daño</span></div></div>
    <div class="plg-ley"><span><i style="background:#e53935"></i>Con daño</span><span><i style="background:#22d39a"></i>Sin daño</span><span><i style="background:#4fb3ff;border-radius:2px;height:4px"></i>Recorrido</span></div>
    ${porP.length?`<div class="tenue" style="font-size:12.5px;margin:4px 0 8px">${porP.map(x=>`${esc(x.p.n)}: <b>${num(x.n)}</b>`).join(' · ')}</div>`:''}
    <h3>Jornadas</h3>${jors.length?jors.map((j,i)=>{const rs=todos.filter(r=>r._j===j);return `<div class="plg-j ${PLM.sel===j?'on':''}" data-pj="${i}"><b>${esc(j.fecha||String(j.inicio||'').slice(0,10))}</b> · ${esc(j.evaluador||'')}<br><span class="tenue">${esc([...new Set(rs.map(r=>r.lote))].join(', '))} · ${num(rs.length)} palmas · ${num(rs.filter(r=>esSi(r.dano)).length)} con daño${j.hora_inicio?' · '+esc(j.hora_inicio)+'–'+esc(j.hora_fin||''):''}</span></div>`;}).join(''):'<div class="tenue">Sin jornadas en el periodo.</div>'}
    ${PLM.sel?'<button class="btn mini" id="plmTodas" style="margin:4px 0">Ver todas las jornadas</button>':''}
    <h3>Palmas (${num(R.length)})</h3>${R.length?`<table class="t"><thead><tr><th>Palma</th><th>Plagas</th><th>Daño</th></tr></thead><tbody>${R.slice(0,400).map(r=>`<tr data-pll="${r.lat},${r.lng}"><td>${esc(r.lote)} · L${esc(r.linea)} · P${esc(r.palma)}<br><span class="tenue">hoja ${esc(r.hoja)} · ${esc(String(r.fecha||r.creado||'').slice(5,16).replace('T',' '))}</span></td><td>${r.plagas.map(p=>`${esc(p.plaga_nombre||p.plaga)}<br><span class="tenue">${esc(estTxtV(p))}</span>`).join('<br>')}</td><td>${esSi(r.dano)?'<span class="venc">Sí</span>':'No'}</td></tr>`).join('')}</tbody></table>`:'<div class="tenue">Ninguna palma coincide con los filtros.</div>'}`;
  $('#plmSalir').onclick=()=>alternarPlgMapa(false);
  $('#plmDias').onchange=e=>{G.dias=Number(e.target.value)||30;G.datos=null;PLM.sel=null;pintarPlgMapa();cargarPlagasVisor().then(()=>pintarPlgMapa(true));};
  $('#plmRec').onclick=()=>{G.datos=null;PLM.sel=null;pintarPlgMapa();cargarPlagasVisor().then(()=>pintarPlgMapa(true));};
  $('#plmPlaga').onchange=e=>{PLM.f.plaga=e.target.value;pintarPlgMapa(true);};
  $('#plmOp').onchange=e=>{PLM.f.op=e.target.value;pintarPlgMapa(true);};
  $('#plmLote').onchange=e=>{PLM.f.lote=e.target.value.trim();pintarPlgMapa(true);};
  $('#plmDano').onchange=e=>{PLM.f.dano=e.target.checked;pintarPlgMapa(true);};
  P.querySelectorAll('[data-pj]').forEach(d=>d.onclick=()=>{const j=jors[+d.dataset.pj];PLM.sel=PLM.sel===j?null:j;pintarPlgMapa(true);});
  const t=$('#plmTodas');if(t)t.onclick=()=>{PLM.sel=null;pintarPlgMapa(true);};
  P.querySelectorAll('tr[data-pll]').forEach(tr=>tr.onclick=()=>{const [a,b]=tr.dataset.pll.split(',').map(Number);if(isFinite(a)&&isFinite(b))mapa.setView([a,b],19);});
}
mapa.on('popupopen',e=>{const b=e.popup.getElement()&&e.popup.getElement().querySelector('[data-pfp]');if(!b)return;
  b.onclick=()=>{const r=((GER.plg.datos&&GER.plg.datos.regs)||[]).find(x=>String(x.id)===b.dataset.pfp);if(r)verFotos({...r,_j:r._j});};});
