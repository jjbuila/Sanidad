/* =====================================================================
   HOJA DE VIDA DE LA PALMA (App)
   · La genera un flujo automático del repositorio de datos (palmas/hoja_vida/<LOTE>.json) con todo lo que le ha pasado
     a cada palma: diagnósticos del censo de todos los operarios, cirugías y correcciones, erradicación, existencia 0 y
     daños de plagas. Solo existe para las palmas diagnosticadas o con alguna novedad.
   · Se descarga por lote (solo los que cambiaron) y queda guardada para usarla sin internet.
   · Se muestra al tocar la palma en cualquier labor; en las palmas de auditoría se oculta para no influir el diagnóstico.
   ===================================================================== */
const HV_RUTA='palmas/hoja_vida/';
const HV={ind:null,mem:new Map(),bajando:null};
async function cargarHojaVida(){
  if(HV.bajando)return HV.bajando;
  HV.bajando=(async()=>{
    if(!(S.cfg.gh&&S.cfg.gh.token&&navigator.onLine))return;
    let ind;try{ind=await (await ghRaw(HV_RUTA+'indice.json')).json();}catch(e){return;}
    HV.ind=ind;try{await dbPut('config',{clave:'hv_indice',v:ind});}catch(e){}
    const lotes=Object.entries(ind.lotes||{});let i=0;
    const w=async()=>{while(i<lotes.length){const [lote,x]=lotes[i++];
      try{const c=await dbGet('config','hv_'+lote);if(c&&c.v&&c.v.generado===x.generado)continue;
        const d=await (await ghRaw(HV_RUTA+x.archivo)).json();HV.mem.set(lote,d);await dbPut('config',{clave:'hv_'+lote,v:d});}catch(e){}}};
    await Promise.all([w(),w(),w()]);
    HV.ultima=Date.now();
  })().finally(()=>{HV.bajando=null;});
  return HV.bajando;
}
async function hojaVidaDe(pid,lote){
  if(!lote)return null;let d=HV.mem.get(lote);
  if(!d){try{const c=await dbGet('config','hv_'+lote);d=c&&c.v;}catch(e){}if(d)HV.mem.set(lote,d);}
  return d&&d.palmas&&d.palmas[String(pid)]||null;
}
let HV_TOKEN=0;
async function mostrarHojaVida(id){
  const tok=++HV_TOKEN;
  if(navigator.onLine&&(!HV.ultima||Date.now()-HV.ultima>30*60000))cargarHojaVida().catch(()=>{}); // refresco en segundo plano
  if(typeof AUD!=='undefined'&&AUD.ids&&AUD.ids.has(String(id)))return; // auditoría: sin registros anteriores
  const f=S.idx.get(id)||S.idx.get(String(id));const lote=f&&f.properties._lote;
  let h=await hojaVidaDe(id,lote);
  if(!h&&HV.bajando){await HV.bajando;h=await hojaVidaDe(id,lote);}
  if(tok!==HV_TOKEN||!h||!(h.ev||[]).length)return;
  const c=$('#hojaCuerpo');if(!c||$('#hoja').classList.contains('oculto')||c.querySelector('.hv'))return;
  const div=document.createElement('div');div.innerHTML=htmlHojaVida(h,true);
  const ref=c.querySelector('h3');if(ref)ref.before(div.firstElementChild);else c.appendChild(div.firstElementChild);
}
const conHV=fn=>function(id){const x=fn.apply(this,arguments);mostrarHojaVida(id).catch(()=>{});return x;};
abrirPalma=conHV(abrirPalma);abrirPalmaCir=conHV(abrirPalmaCir);abrirPalmaErr=conHV(abrirPalmaErr);abrirPalmaPlg=conHV(abrirPalmaPlg);
window.addEventListener('online',()=>cargarHojaVida().catch(()=>{}));
