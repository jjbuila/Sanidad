/* =====================================================================
   HOJA DE VIDA DE LA PALMA (visor web)
   · Botón 📋 HOJA DE VIDA en la cabecera: vista con la lista de palmas que tienen hoja de vida (por lote, con búsqueda
     y filtros), la hoja de vida de la palma elegida y el mapa sobre la ortofoto del dron.
   · «📋 Hoja de vida» en la ficha del diagnóstico abre la misma vista en esa palma.
   · Datos: palmas/hoja_vida/<LOTE>.json (lo genera el flujo automático del repositorio de datos) más lo cargado en el
     visor que aún no esté en ese archivo, sin duplicar. Cada registro con foto se puede ver.
   ===================================================================== */
const HVV={lotes:new Map(),ind:null};
const HVP={on:false,lote:'',pid:null,filtro:'todas',q:'',mapa:null,capa:null,lista:[]};
const HV_FILTROS=[['todas','Todas'],['crit','🚨 Críticas'],['rec','En recuperación'],['cir','Con cirugía'],['plg','Con plagas']];
(function(){
  const css=document.createElement('style');css.textContent=`
  #hvPanel{position:fixed;left:0;right:0;bottom:0;z-index:1500;display:grid;grid-template-columns:minmax(320px,400px) 1fr;background:var(--fondo,#06140f)}
  #hvPanel[hidden]{display:none}
  #hvPanel .izq{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--borde);padding:10px 12px;gap:8px;overflow:hidden}
  #hvPanel .cab{display:flex;align-items:center;gap:8px}#hvPanel .cab b{font-family:var(--t);font-size:18px;letter-spacing:.8px;flex:1}
  #hvPanel .fil{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  #hvPanel .fil select,#hvPanel .fil input{padding:5px 8px;font-size:13px}
  #hvPanel .chipf{border:1px solid var(--borde);border-radius:999px;padding:3px 10px;font-size:12.5px;background:transparent;color:var(--tenue);cursor:pointer}
  #hvPanel .chipf.on{background:var(--acento);color:#032a1d;border-color:var(--acento);font-weight:700}
  #hvLista,#hvCuerpo{overflow:auto;min-height:0;flex:1}
  #hvLista .it{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--borde);border-radius:10px;padding:6px 8px;margin:5px 0;cursor:pointer;font-size:13px}
  #hvLista .it:hover,#hvLista .it.on{border-color:var(--acento)}
  #hvLista .it .p{width:12px;height:12px;border-radius:50%;margin-top:3px;flex:none;border:1.5px solid #fff}
  #hvLista .it .al{color:#ff8a80;font-weight:700}
  #hvCuerpo .hv{background:transparent;border:0;padding:0;margin:0}#hvCuerpo .hv>summary{display:none}
  #hvMapa{min-height:0}
  .hv-sel{background:none;border:0}.hv-sel i{position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;border:3px solid #ffd54f;box-shadow:0 0 10px #ffd54f}
  @media (max-width:820px){#hvPanel{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) 42%}#hvPanel .izq{border-right:0;border-bottom:1px solid var(--borde)}}`;
  document.head.appendChild(css);
  const p=document.createElement('div');p.id='hvPanel';p.hidden=true;
  p.innerHTML=`<div class="izq"><div class="cab"><b>📋 HOJA DE VIDA</b><button class="x" id="hvX" title="Cerrar">✕</button></div>
    <div class="fil"><select id="hvLote" aria-label="Lote"></select><input id="hvQ" placeholder="Línea y palma (ej. 12 5)" style="flex:1;min-width:120px"></div>
    <div class="fil" id="hvFil">${HV_FILTROS.map(([k,t])=>`<button class="chipf" data-f="${k}">${t}</button>`).join('')}</div>
    <div class="tenue" id="hvInfo" style="font-size:12px"></div><div id="hvLista"></div><div id="hvCuerpo" hidden></div></div><div id="hvMapa"></div>`;
  document.body.appendChild(p);
  const bt=document.createElement('button');bt.className='btn mini';bt.id='btHV';bt.title='Hoja de vida de las palmas diagnosticadas o con novedades, con el mapa';bt.innerHTML='📋 HOJA DE VIDA';
  const g=$('#btGer');if(g)g.before(bt);else $('#chDatos').before(bt);
  bt.onclick=()=>HVP.on?cerrarHVP():abrirHVP();
  $('#hvX').onclick=cerrarHVP;
  $('#hvLote').onchange=e=>{HVP.lote=e.target.value;HVP.pid=null;pintarHVP(true);};
  $('#hvQ').oninput=e=>{HVP.q=e.target.value;HVP.pid=null;pintarHVP(false);};
  $$('#hvFil .chipf').forEach(b=>b.onclick=()=>{HVP.filtro=b.dataset.f;HVP.pid=null;pintarHVP(false);});
  // Otro botón de la cabecera cierra la vista
  document.querySelector('header').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.id!=='btHV'&&HVP.on)cerrarHVP();},true);
  window.addEventListener('resize',()=>{if(HVP.on)ubicarHVP();});
})();
function ubicarHVP(){const h=document.querySelector('header');$('#hvPanel').style.top=(h?h.getBoundingClientRect().bottom:60)+'px';if(HVP.mapa)HVP.mapa.invalidateSize();}
async function hvIndiceVisor(){if(HVV.ind)return HVV.ind;
  try{HVV.ind=await (await gh(`/contents/palmas/hoja_vida/indice.json?ref=${encodeURIComponent(SES.repo.rama)}`,'application/vnd.github.raw+json')).json();}catch(e){HVV.ind={lotes:{},err:e.status===404?'':e.message};}
  return HVV.ind;}
async function hvLoteVisor(lote){
  if(HVV.lotes.has(lote))return HVV.lotes.get(lote);
  const pr=(async()=>{try{const r=await gh(`/contents/palmas/hoja_vida/${encodeURIComponent(String(lote).replace(/[^\w-]+/g,'_'))}.json?ref=${encodeURIComponent(SES.repo.rama)}`,'application/vnd.github.raw+json');return await r.json();}
    catch(e){if(e.status===404)return {palmas:{}};HVV.lotes.delete(lote);throw e;}})();
  HVV.lotes.set(lote,pr);return pr;
}
/* Eventos de lo cargado en el visor (censo y, si están cargadas, cirugías y correcciones) en el formato de la hoja de vida. */
function eventosCargadosHV(pid){const k=String(pid),ev=[];
  for(const j of JOR)for(const d of j.diags)if(String(d.palma_id)===k)ev.push({t:d.creado,l:'censo',x:[d.nivel1,d.nivel2,d.nivel3].filter(Boolean).join(' › ')||d.estado_nombre||d.estado,e:d.estado,n1:codN1(d),n2:d.nivel2||'',q:d.evaluador||j.evaluador,id:d.id,
    d:[d.sintomas?'Síntomas: '+String(d.sintomas).split('|').join(' / '):'',d.cirugia?'Cirugía: '+d.cirugia:'',d.produccion?'Producción: '+d.produccion:'',d.observaciones?'Observaciones: '+d.observaciones:''].filter(Boolean).join(' · '),
    f:Number(d.n_fotos)>0&&d.fotos&&j.ruta?'jornadas/'+j.ruta.replace(/\.geojson$/,'_fotos.zip')+'|'+String(d.fotos).split('|')[0]:''});
  if(typeof CIR!=='undefined'&&CIR.cargado){
    for(const d of CIR.correcciones)if(String(d.palma_id)===k)ev.push({t:d.creado,l:d.origen==='caso_nuevo'?'caso_nuevo':'correccion',r:d.autor_rol||'cirujano',x:[d.nivel1,d.nivel2,d.nivel3].filter(Boolean).join(' › '),e:d.estado,n1:codN1(d),n2:d.nivel2||'',q:d.evaluador||'',id:d.id});
    for(const c of CIR.cirugias)if(String(c.palma_id)===k)ev.push({t:c.creado,l:'cirugia',x:[c.tipo_cirugia,c.producto].filter(Boolean).join(' · ')||'Cirugía realizada',q:[c.cirujano_nombre,c.auxiliar_nombre].filter(Boolean).join(' + ')||c.evaluador||'',id:c.id});}
  return ev;}
function unirHV(h,cargados){const ev=[...((h&&h.ev)||[])];const ids=new Set(ev.map(e=>e.l+'|'+e.id));
  for(const e of cargados)if(!e.id||!ids.has(e.l+'|'+e.id)){ev.push(e);ids.add(e.l+'|'+e.id);}
  ev.sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));return ev;}
async function hojaVidaVisor(d){
  const pid=String(d.palma_id);let h=null,err='';
  try{const L=await hvLoteVisor(d.lote);h=L.palmas&&L.palmas[pid]||null;}catch(e){err=e.message;}
  return {h:{...(h||{}),ev:unirHV(h,eventosCargadosHV(pid))},err};
}
/* Palmas con hoja de vida de un lote: archivo central + palmas con diagnósticos cargados en el visor. */
async function palmasHV(lote){
  let F={palmas:{}},err='';try{F=await hvLoteVisor(lote);}catch(e){err=e.message;}
  const out=new Map();
  for(const [pid,h] of Object.entries(F.palmas||{}))out.set(pid,{pid,lote,linea:h.linea,palma:h.palma,ll:h.ll||null,h});
  for(const j of JOR)for(const d of j.diags)if(d.lote===lote){const k=String(d.palma_id);if(!out.has(k))out.set(k,{pid:k,lote,linea:String(d.linea??''),palma:String(d.palma??''),ll:[d.lat,d.lng],h:null});
    else if(!out.get(k).ll)out.get(k).ll=[d.lat,d.lng];}
  for(const x of out.values()){x.ev=unirHV(x.h,eventosCargadosHV(x.pid));x.r=resumenHV(x.ev);}
  return {lista:[...out.values()].filter(x=>x.ev.length).sort((a,b)=>ordenNat(a.linea,b.linea)||ordenNat(a.palma,b.palma)),err};
}
const colorHV=x=>{const u=x.r.ult;if(x.ev.some(e=>e.l==='existencia'&&/aprobada/i.test(e.x)))return '#9e9e9e';return u?colorD({estado:u.e,n1_codigo:u.n1}):(x.ev.some(e=>e.l==='plagas')?'#c77dff':'#2f93d5');};
const filtroHV={todas:()=>true,crit:x=>x.r.al.length>0,rec:x=>/RECUPERACI/i.test(x.r.ult&&x.r.ult.n2||''),cir:x=>x.r.nCir>0,plg:x=>x.r.nPlg>0};
async function abrirHVP(lote,pid){
  HVP.on=true;$('#hvPanel').hidden=false;$('#btHV').classList.add('prim');ubicarHVP();
  if(!HVP.mapa){HVP.mapa=L.map('hvMapa',{zoomControl:true,attributionControl:true,maxZoom:22});capaOrto('teselas/orto/','3',ORTO_B,17).addTo(HVP.mapa);
    HVP.capa=L.layerGroup().addTo(HVP.mapa);HVP.rend=L.canvas({padding:.5,tolerance:6});HVP.mapa.fitBounds(ORTO_B);}
  setTimeout(()=>HVP.mapa.invalidateSize(),50);
  const ind=await hvIndiceVisor();
  const lotes=[...new Set([...Object.keys(ind.lotes||{}),...JOR.flatMap(j=>j.diags.map(d=>d.lote))].filter(Boolean))].sort(ordenNat);
  if(lote)HVP.lote=lote;if(!HVP.lote||!lotes.includes(HVP.lote))HVP.lote=HVP.lote&&lote?HVP.lote:(lotes.slice().sort((a,b)=>((ind.lotes[b]||{}).palmas||0)-((ind.lotes[a]||{}).palmas||0))[0]||'');
  if(HVP.lote&&!lotes.includes(HVP.lote))lotes.push(HVP.lote);
  $('#hvLote').innerHTML=lotes.length?lotes.map(l=>`<option value="${esc(l)}" ${l===HVP.lote?'selected':''}>${esc(l)}${ind.lotes&&ind.lotes[l]?` · ${ind.lotes[l].palmas} palmas`:''}</option>`).join(''):'<option value="">Sin palmas con hoja de vida</option>';
  HVP.pid=pid!=null?String(pid):null;if(pid!=null){HVP.q='';$('#hvQ').value='';HVP.filtro='todas';}
  await pintarHVP(true);
}
function cerrarHVP(){HVP.on=false;$('#hvPanel').hidden=true;$('#btHV').classList.remove('prim');}
async function pintarHVP(ajustar){
  $$('#hvFil .chipf').forEach(b=>b.classList.toggle('on',b.dataset.f===HVP.filtro));
  if(!HVP.lote){$('#hvLista').innerHTML='<p class="tenue">Aún no hay palmas con hoja de vida.</p>';return;}
  $('#hvInfo').textContent='Cargando…';
  const {lista,err}=await palmasHV(HVP.lote);HVP.lista=lista;
  const nums=(HVP.q.match(/\d+/g)||[]);
  const vis=lista.filter(filtroHV[HVP.filtro]).filter(x=>!nums.length||(String(x.linea)===nums[0]&&(nums.length<2||String(x.palma)===nums[1])));
  $('#hvInfo').innerHTML=`${vis.length} de ${lista.length} palma${lista.length===1?'':'s'} con hoja de vida en ${esc(HVP.lote)} · ${lista.filter(x=>x.r.al.length).length} con alerta${err?` · <span style="color:#ff8a80">${esc(err)}</span>`:''}`;
  $('#hvLista').innerHTML=vis.map(x=>`<div class="it${x.pid===HVP.pid?' on':''}" data-pid="${esc(x.pid)}"><span class="p" style="background:${colorHV(x)}"></span><div><b>L${esc(x.linea)} · P${esc(x.palma)}</b> <span class="tenue">· ${x.ev.length} reg.</span><br>${esc(x.r.ult?x.r.ult.x:(x.ev[x.ev.length-1]||{}).x||'')}
    <br><span class="tenue">${x.r.ult?esc(fechaHV(x.r.ult.t)):''}</span>${x.r.al.length?`<br><span class="al">${esc(x.r.al[0][0])}</span>`:''}</div></div>`).join('')||'<p class="tenue">Ninguna palma cumple el filtro.</p>';
  $$('#hvLista .it').forEach(el=>el.onclick=()=>verPalmaHVP(el.dataset.pid,true));
  await mapaHVP(lista,vis,ajustar&&!HVP.pid);
  if(HVP.pid)verPalmaHVP(HVP.pid,true);else{$('#hvCuerpo').hidden=true;$('#hvLista').hidden=false;}
}
async function mapaHVP(lista,vis,ajustar){
  const m=HVP.mapa,c=HVP.capa;c.clearLayers();const caja=L.latLngBounds([]);
  const f=LOTES&&LOTES.features.find(x=>x.properties._lote===HVP.lote);
  if(f){const g=L.geoJSON(f,{style:{color:'#ffd166',weight:2,fill:false},interactive:false}).addTo(c);caja.extend(g.getBounds());if(typeof etiquetaLoteMC==='function')etiquetaLoteMC(c,HVP.lote);}
  let pal=[];try{pal=await chunkLote(HVP.lote);}catch(e){}
  const pos=new Map(pal.map(a=>[String(a[0]),[a[5],a[4]]]));
  for(const a of pal)L.circleMarker([a[5],a[4]],{renderer:HVP.rend,radius:2.5,color:'#ffffff',weight:0,fillColor:'#ffffff',fillOpacity:.35,interactive:false}).addTo(c);
  const visS=new Set(vis.map(x=>x.pid));
  for(const x of lista){const ll=x.ll||pos.get(x.pid);if(!ll)continue;x.ll=ll;caja.extend(ll);const vi=visS.has(x.pid);
    L.circleMarker(ll,{renderer:HVP.rend,radius:vi?7:4,color:'#fff',weight:vi?1.5:.5,fillColor:colorHV(x),fillOpacity:vi?1:.35}).bindTooltip(`L${esc(x.linea)} · P${esc(x.palma)} · ${x.ev.length} reg.`,{direction:'top'})
      .on('click',()=>verPalmaHVP(x.pid,false)).addTo(c);
    if(vi&&x.r.al.length&&typeof iconoCritico==='function'){const t=/PE PARTIDA|existencia/i.test(x.r.al[0][0])?'PE_PARTIDA':/CR[AÁ]TER/i.test(x.r.al[0][0])?'CRATER':null;
      if(t)L.marker(ll,{icon:iconoCritico(t),interactive:false,keyboard:false,zIndexOffset:1000}).addTo(c);}}
  if(ajustar&&caja.isValid())m.fitBounds(caja,{padding:[30,30],maxZoom:19});
}
function verPalmaHVP(pid,centrar){
  const x=HVP.lista.find(y=>y.pid===String(pid));HVP.pid=String(pid);
  $$('#hvLista .it').forEach(el=>el.classList.toggle('on',el.dataset.pid===HVP.pid));
  if(HVP.sel){HVP.capa.removeLayer(HVP.sel);HVP.sel=null;}
  if(!x){$('#hvCuerpo').hidden=false;$('#hvLista').hidden=true;$('#hvCuerpo').innerHTML='<button class="btn mini" id="hvVolver">← Lista</button><p class="tenue">Esta palma no tiene hoja de vida: no tiene diagnósticos ni novedades registradas.</p>';$('#hvVolver').onclick=volverHVP;return;}
  if(x.ll){HVP.sel=L.marker(x.ll,{icon:L.divIcon({className:'hv-sel',html:'<i></i>',iconSize:[0,0]}),interactive:false,zIndexOffset:2000}).addTo(HVP.capa);
    if(centrar)HVP.mapa.setView(x.ll,Math.max(HVP.mapa.getZoom(),19),{animate:true});}
  $('#hvLista').hidden=true;$('#hvCuerpo').hidden=false;
  $('#hvCuerpo').innerHTML=`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><button class="btn mini" id="hvVolver">← Lista</button><b style="flex:1;font-size:16px">${esc(x.lote)} · L${esc(x.linea)} · P${esc(x.palma)}</b>${x.ll?'<button class="btn mini" id="hvCentrar">🎯 Centrar</button>':''}</div>`+htmlHojaVida({ev:x.ev},true,true);
  $('#hvVolver').onclick=volverHVP;const ce=$('#hvCentrar');if(ce)ce.onclick=()=>HVP.mapa.setView(x.ll,20,{animate:true});
  $$('#hvCuerpo [data-hvf]').forEach(b=>b.onclick=()=>verFotoHV(b.dataset.hvf,x.ev.find(e=>e.f===b.dataset.hvf)));
}
function volverHVP(){HVP.pid=null;if(HVP.sel){HVP.capa.removeLayer(HVP.sel);HVP.sel=null;}$('#hvCuerpo').hidden=true;$('#hvLista').hidden=false;$$('#hvLista .it').forEach(el=>el.classList.remove('on'));}
/* Desde la ficha del diagnóstico: abre la vista en esa palma. */
verHistoriaPalma=function(d){mapa.closePopup();return abrirHVP(d.lote,d.palma_id);};
/* Foto de un registro: del archivo de fotos de su jornada (zip), aunque la jornada no esté cargada. */
async function verFotoHV(f,e){
  const [zip,nombre]=String(f).split('|');
  $('#fotosTit').textContent=(e?(HV_LAB[e.l]||[e.l])[0]+' · '+fechaHV(e.t):'Foto');$('#fotosG').innerHTML='<div class="tenue">Descargando la foto…</div>';$('#fotos').hidden=false;
  try{let sha=null;const j=JOR.find(x=>x.zipSha&&'jornadas/'+String(x.ruta).replace(/\.geojson$/,'_fotos.zip')===zip);if(j)sha=j.zipSha;
    if(!sha){const dir=zip.slice(0,zip.lastIndexOf('/')),base=zip.slice(zip.lastIndexOf('/')+1);
      const l=await (await gh(`/contents/${dir.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(SES.repo.rama)}`)).json();const x=(Array.isArray(l)?l:[]).find(y=>y.name===base);sha=x&&x.sha;}
    if(!sha)throw new Error('No se encontró el archivo de fotos de esa jornada.');
    const z=await blobZip(sha);const fz=z.file(nombre)||z.file(nombre.replace(/\.jpg$/,''));if(!fz)throw new Error('La foto no está en el archivo de la jornada.');
    const url=URL.createObjectURL(new Blob([await fz.async('arraybuffer')],{type:'image/jpeg'}));
    $('#fotosG').innerHTML=`<a href="${url}" download="${esc(nombre)}"><img src="${url}" alt="Foto"></a>`;}
  catch(er){$('#fotosG').innerHTML=`<div class="aviso">${esc(er.message)}</div>`;}
}
