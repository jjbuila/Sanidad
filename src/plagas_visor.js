/* =====================================================================
   MONITOREO DE PLAGAS (visor web · Coordinación)
   Lee las jornadas de plagas/jornadas de los últimos días: resumen por plaga y por lote, palmas muestreadas con fotos,
   exportación a CSV y los puntos en el mapa (rojo = con daño, verde = sin daño).
   ===================================================================== */
GER.plg={dias:30,cargando:false,datos:null,capa:null};
async function cargarPlagasVisor(){
  const G=GER.plg;G.cargando=true;pintarGer();
  try{const hoy=hoyISO(),d1=hoyISO(new Date(Date.now()-G.dias*86400000));
    const dias=await listarDias('plagas/jornadas',d1,hoy);const arch=[];
    await enParalelo(dias,6,async d=>{for(const f of await arbol(d.sha))if(f.type==='blob')arch.push({...f,dia:d.path});});
    const zips=new Map(arch.filter(f=>f.path.endsWith('_fotos.zip')).map(f=>[f.dia+'/'+f.path,f.sha]));
    const regs=[],jors=[];
    await enParalelo(arch.filter(f=>f.path.endsWith('.geojson')),6,async f=>{try{const g=JSON.parse(await blobTexto(f.sha));const h=g.jornada||{};
      const j={...h,zipSha:zips.get(f.dia+'/'+f.path.replace(/\.geojson$/,'_fotos.zip')),ruta:f.dia+'/'+f.path};jors.push(j);
      for(const ft of g.features||[]){const p=ft.properties||{};if(p.tipo!=='monitoreo')continue;const c=ft.geometry&&ft.geometry.coordinates;
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
  const d=$('#plgDias');if(d)d.onchange=()=>{G.dias=Number(d.value)||30;G.datos=null;cargarPlagasVisor();};
  const r=$('#plgRec');if(r)r.onclick=()=>{G.datos=null;cargarPlagasVisor();};
  const c=$('#plgCsv');if(c)c.onclick=exportarPlagasCSV;
  const m=$('#plgMapa');if(m)m.onclick=()=>{alternarCapaPlagas();if(G.capa)alternarGerencia(false);else pintarGer();};
  $$('#gerPanel [data-pfo]').forEach(b=>b.onclick=()=>{const x=G._regs[+b.dataset.pfo];verFotos({...x,_j:x._j});});
};
