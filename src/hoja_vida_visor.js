/* =====================================================================
   HOJA DE VIDA DE LA PALMA (visor web)
   · «📋 Hoja de vida» en la ficha del diagnóstico: todo lo que le ha pasado a la palma desde el inicio, desde
     palmas/hoja_vida/<LOTE>.json (lo genera el flujo automático del repositorio de datos), más lo cargado en el visor
     que aún no esté en ese archivo. Cada registro con foto se puede ver.
   ===================================================================== */
const HVV={lotes:new Map()};
(function(){
  const m=document.createElement('div');m.id='hvModal';m.hidden=true;
  m.innerHTML='<div class="caja glass"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b class="tit" id="hvTit" style="flex:1;font-size:18px"></b><button class="x" id="hvX">✕</button></div><div id="hvCuerpo"></div></div>';
  document.body.appendChild(m);
  const css=document.createElement('style');css.textContent=`#hvModal{position:fixed;inset:0;z-index:5900;background:rgba(2,8,6,.85);display:flex;align-items:center;justify-content:center;padding:16px}
    #hvModal[hidden]{display:none}#hvModal .caja{width:min(640px,100%);max-height:92vh;overflow:auto;border-radius:18px;padding:14px}
    #hvModal .hv{background:transparent;border:0;padding:0}#hvModal .hv>summary{display:none}`;
  document.head.appendChild(css);
  $('#hvX').onclick=()=>{$('#hvModal').hidden=true;};m.onclick=e=>{if(e.target.id==='hvModal')$('#hvModal').hidden=true;};
})();
async function hvLoteVisor(lote){
  if(HVV.lotes.has(lote))return HVV.lotes.get(lote);
  const pr=(async()=>{try{const r=await gh(`/contents/palmas/hoja_vida/${encodeURIComponent(String(lote).replace(/[^\w-]+/g,'_'))}.json?ref=${encodeURIComponent(SES.repo.rama)}`,'application/vnd.github.raw+json');return await r.json();}
    catch(e){if(e.status===404)return {palmas:{}};HVV.lotes.delete(lote);throw e;}})();
  HVV.lotes.set(lote,pr);return pr;
}
/* Eventos de lo cargado en el visor (censo y, si están cargadas, cirugías y correcciones) en el formato de la hoja de vida. */
function eventosCargadosHV(pid){const k=String(pid),ev=[];
  for(const j of JOR)for(const d of j.diags)if(String(d.palma_id)===k)ev.push({t:d.creado,l:'censo',x:[d.nivel1,d.nivel2,d.nivel3].filter(Boolean).join(' › ')||d.estado_nombre||d.estado,e:d.estado,n2:d.nivel2||'',q:d.evaluador||j.evaluador,id:d.id,
    d:[d.sintomas?'Síntomas: '+String(d.sintomas).split('|').join(' / '):'',d.cirugia?'Cirugía: '+d.cirugia:'',d.produccion?'Producción: '+d.produccion:'',d.observaciones?'Observaciones: '+d.observaciones:''].filter(Boolean).join(' · '),
    f:Number(d.n_fotos)>0&&d.fotos&&j.ruta?'jornadas/'+j.ruta.replace(/\.geojson$/,'_fotos.zip')+'|'+String(d.fotos).split('|')[0]:'',_d:{...d,_j:j}});
  if(typeof CIR!=='undefined'&&CIR.cargado){
    for(const d of CIR.correcciones)if(String(d.palma_id)===k)ev.push({t:d.creado,l:d.origen==='caso_nuevo'?'caso_nuevo':'correccion',r:d.autor_rol||'cirujano',x:[d.nivel1,d.nivel2,d.nivel3].filter(Boolean).join(' › '),n2:d.nivel2||'',q:d.evaluador||'',id:d.id});
    for(const c of CIR.cirugias)if(String(c.palma_id)===k)ev.push({t:c.creado,l:'cirugia',x:[c.tipo_cirugia,c.producto].filter(Boolean).join(' · ')||'Cirugía realizada',q:[c.cirujano_nombre,c.auxiliar_nombre].filter(Boolean).join(' + ')||c.evaluador||'',id:c.id});}
  return ev;}
async function hojaVidaVisor(d){
  const pid=String(d.palma_id);let h=null,err='';
  try{const L=await hvLoteVisor(d.lote);h=L.palmas&&L.palmas[pid]||null;}catch(e){err=e.message;}
  const ev=[...((h&&h.ev)||[])];const ids=new Set(ev.map(e=>e.l+'|'+e.id));
  for(const e of eventosCargadosHV(pid))if(!e.id||!ids.has(e.l+'|'+e.id)){ev.push(e);ids.add(e.l+'|'+e.id);}
  ev.sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  return {h:{...(h||{}),ev},err};
}
verHistoriaPalma=async function(d){
  $('#hvTit').textContent='📋 Hoja de vida · '+etiquetaDiag(d);$('#hvCuerpo').innerHTML='<p class="tenue">Cargando la hoja de vida…</p>';$('#hvModal').hidden=false;
  const {h,err}=await hojaVidaVisor(d);
  if(!h.ev.length){$('#hvCuerpo').innerHTML=`<p class="tenue">Esta palma no tiene hoja de vida: no tiene diagnósticos ni novedades registradas.${err?' ('+esc(err)+')':''}</p>`;return;}
  $('#hvCuerpo').innerHTML=htmlHojaVida(h,true,true)+(err?`<div class="aviso">No se pudo leer la hoja de vida completa (${esc(err)}); se muestra solo lo cargado en el visor.</div>`:'');
  $$('#hvCuerpo [data-hvf]').forEach(b=>b.onclick=()=>verFotoHV(b.dataset.hvf,h.ev.find(e=>e.f===b.dataset.hvf)));
};
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
