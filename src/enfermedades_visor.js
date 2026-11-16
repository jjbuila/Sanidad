/* =====================================================================
   ENFERMEDADES (visor web)
   · Botón 🦠 ENFERMEDADES en la cabecera: vuelve al censo de enfermedades en el mapa (cierra los otros modos).
   · Casos críticos que titilan en el mapa: PE partida (la palma murió) y PC cráter (próxima a morir; se erradica).
   · DATOS → Palmas pendientes por marcar inexistentes: las PE partida pasan a existencia 0 con la aprobación del
     analista de datos o del super administrador (cartografia/ajustes_existencia.json, el mismo archivo de la erradicación).
   ===================================================================== */
(function montarEnfermedades(){
  const css=document.createElement('style');css.textContent=`
  @keyframes critOnda{0%{transform:scale(.5);opacity:1}100%{transform:scale(2.4);opacity:0}}
  @keyframes critParpadeo{0%,49%{opacity:1}50%,100%{opacity:.15}}
  .alerta-critica{background:none;border:0}
  .alerta-critica i{position:absolute;border-radius:50%;pointer-events:none}
  .alerta-critica .a1{left:-16px;top:-16px;width:32px;height:32px;border:4px solid #ff1744;animation:critOnda .8s ease-out infinite}
  .alerta-critica .a2{left:-9px;top:-9px;width:18px;height:18px;background:#ff1744;border:2px solid #fff;box-shadow:0 0 12px 4px rgba(255,23,68,.9);animation:critParpadeo .5s linear infinite}
  .alerta-critica.crater .a1{border-color:#ff9100}.alerta-critica.crater .a2{background:#ff9100;box-shadow:0 0 12px 4px rgba(255,145,0,.9)}
  .alerta-critica .et{position:absolute;left:14px;top:-26px;white-space:nowrap;font:800 11px/1 sans-serif;letter-spacing:.5px;color:#fff;background:#d50000;padding:3px 6px;border-radius:5px;border:1px solid #fff;box-shadow:0 0 8px rgba(255,23,68,.9);animation:critParpadeo 1s linear infinite;pointer-events:none}
  .alerta-critica.crater .et{background:#e65100}
  #critFranja{position:absolute;left:50%;transform:translateX(-50%);top:10px;z-index:900;display:none;align-items:center;gap:10px;background:#b71c1c;color:#fff;border:2px solid #ff5252;border-radius:12px;padding:8px 14px;font-weight:800;font-size:14px;box-shadow:0 0 0 0 rgba(255,23,68,.8);animation:critLatido 1.2s ease-out infinite;cursor:pointer;max-width:92%}
  #critFranja.on{display:flex}
  @keyframes critLatido{0%{box-shadow:0 0 0 0 rgba(255,23,68,.85)}100%{box-shadow:0 0 0 18px rgba(255,23,68,0)}}
  .crit-badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:5px;border-radius:999px;background:#ff1744;color:#fff;font-size:11px;line-height:18px;text-align:center;animation:critParpadeo .7s linear infinite}`;
  document.head.appendChild(css);
  const fr=document.createElement('div');fr.id='critFranja';fr.title='Clic: ver los casos en el mapa';(document.querySelector('.mapaCaja')||document.body).appendChild(fr);fr.onclick=()=>verCensoEnf();
  const bt=document.createElement('button');bt.className='btn mini prim';bt.id='btEnf';bt.title='Censo de enfermedades en el mapa (las palmas con PE partida y PC cráter titilan)';
  bt.innerHTML='🦠 ENFERMEDADES<span id="btEnfN"></span>';
  const c=$('#btCir');if(c)c.before(bt);else $('#chDatos').before(bt);
  bt.onclick=()=>verCensoEnf();
  setInterval(estadoBtEnf,600);
})();
const otroModoOn=()=>(typeof GER!=='undefined'&&GER.on)||(typeof CIR!=='undefined'&&CIR.on)||(typeof ERR!=='undefined'&&ERR.on)||(typeof PLM!=='undefined'&&PLM.on)||(typeof HVP!=='undefined'&&HVP.on);
function estadoBtEnf(){const b=$('#btEnf');if(b)b.classList.toggle('prim',!otroModoOn());const f=$('#critFranja');if(f)f.classList.toggle('on',!otroModoOn()&&!(typeof REP!=='undefined'&&REP.on)&&CRIT.lista.length>0);}
function verCensoEnf(){
  if(GER.on)alternarGerencia(false);if(typeof PLM!=='undefined'&&PLM.on)alternarPlgMapa(false);if(ERR.on)alternarErr(false);if(CIR.on)alternarCirugia(false);
  estadoBtEnf();
  if(!JOR.length){toast('Cargue un rango de fechas (a la izquierda) para ver el censo de enfermedades.',4500);return;}
  const cr=CRIT.lista;
  if(cr.length){try{mapa.fitBounds(L.latLngBounds(cr.map(x=>[x.d.lat,x.d.lng])),{padding:[60,60],maxZoom:17});}catch(e){}
    const np=cr.filter(x=>x.t==='PE_PARTIDA').length,nc=cr.length-np;
    toast(`⚠ Titilando: ${np?np+' PE partida (palma muerta)':''}${np&&nc?' · ':''}${nc?nc+' PC cráter (erradicar)':''}.`,6000);}
}

/* ---------- Casos críticos: último diagnóstico de la palma es PE partida o PC cráter (y no tiene existencia 0) ---------- */
const CRIT={lista:[]};
function calcularCriticos(){
  const ult=new Map();for(const j of JORF)for(const d of j.diags){const k=String(d.palma_id??(d.lote+'|'+d.linea+'|'+d.palma));const u=ult.get(k);if(!u||String(d.creado)>String(u.creado))ult.set(k,d);}
  const enDiagf=new Set(DIAGF.map(d=>d.id));
  CRIT.lista=[...ult.entries()].map(([k,d])=>({k,d,t:criticoDe(d)})).filter(x=>x.t&&x.d.lat!=null&&!VAJ.has(x.k)&&enDiagf.has(x.d.id));
  const np=CRIT.lista.filter(x=>x.t==='PE_PARTIDA').length,nc=CRIT.lista.length-np,f=$('#critFranja');
  if(f)f.innerHTML=`<span style="font-size:20px">⚠</span><span>${np?`${np} palma${np>1?'s':''} con PE PARTIDA: ${np>1?'murieron':'murió'} (marcar inexistente${np>1?'s':''})`:''}${np&&nc?' · ':''}${nc?`${nc} palma${nc>1?'s':''} con PC CRÁTER: próxima${nc>1?'s':''} a morir (erradicar)`:''}</span>`;
  estadoBtEnf();
  const n=$('#btEnfN');if(n)n.innerHTML=CRIT.lista.length?`<span class="crit-badge" title="Palmas con PE partida o PC cráter">${CRIT.lista.length}</span>`:'';
}
function iconoCritico(t){return L.divIcon({className:'alerta-critica '+(t==='CRATER'?'crater':'partida'),html:`<i class="a1"></i><i class="a2"></i><b class="et">${t==='CRATER'?'⚠ CRÁTER · ERRADICAR':'✝ PE PARTIDA · MUERTA'}</b>`,iconSize:[0,0]});}
function pintarCriticos(){
  calcularCriticos();
  for(const x of CRIT.lista){const d=x.d;
    L.marker([d.lat,d.lng],{icon:iconoCritico(x.t),zIndexOffset:1000,keyboard:false,title:`${CRITICOS[x.t].t}: ${etiquetaDiag(d)}`})
      .on('click',ev=>{L.DomEvent.stopPropagation(ev);popupDiag(d,ev.latlng);}).addTo(capaDiag);}
}
{const _pm=pintarMapa;pintarMapa=function(a){_pm(a);pintarCriticos();};}

/* ---------- DATOS → Palmas pendientes por marcar inexistentes (PE partida) ---------- */
TABS_GER.push(['inexist','PALMAS PENDIENTES POR MARCAR INEXISTENTES']);MODS_GER.datos.tabs.push('inexist');
MODS_GER.datos.ayuda='Analistas de datos: sincronización y palmas pendientes por marcar inexistentes';
GER.inx={sel:new Set()};
function pendientesInexist(){
  const ult=new Map();for(const j of JOR)for(const d of j.diags){const k=String(d.palma_id??(d.lote+'|'+d.linea+'|'+d.palma));const u=ult.get(k);if(!u||String(d.creado)>String(u.creado))ult.set(k,{...d,_j:j});}
  const rech=(ERR.aj&&ERR.aj.rechazos)||[];
  return [...ult.entries()].filter(([k,d])=>criticoDe(d)==='PE_PARTIDA'&&!VAJ.has(k)&&!rech.some(r=>r.diagnostico_id&&r.diagnostico_id===d.id))
    .map(([k,d])=>({...d,_k:k})).sort((a,b)=>String(a.creado).localeCompare(String(b.creado)));
}
PINTAR_GER.inexist=function(){
  if(!ERR.aj&&!GER.inx.cargando){GER.inx.cargando=true;cargarAjustesVisor().finally(()=>{GER.inx.cargando=false;pintarGer();});}
  const aviso=`<p class="tenue">Palmas cuyo último diagnóstico es <b>PE PARTIDA</b> (la palma murió), en las jornadas cargadas (${esc(rangoTxt())}). Al aprobarlas quedan con <b>existencia 0</b>: salen de la cartografía activa, de la incidencia y de los conteos en la App, el visor y los reportes.
    Solo el <b>analista de datos</b> o el <b>super administrador</b> aprueban. Las de <b>PC cráter</b> no van aquí: se erradican (🪓 ERRADICACIÓN) y su existencia 0 se aprueba allá.</p>
    <div class="ger-par">Buscar en: <button class="btn mini" data-rango="30">30 días</button><button class="btn mini" data-rango="90">90 días</button><button class="btn mini" data-rango="180">180 días</button></div>`;
  if(!JOR.length)return `<div class="ger-sec"><h3>Palmas pendientes por marcar inexistentes</h3>${aviso}</div>${sinDatos()}`;
  if(!ERR.aj)return `<div class="ger-sec"><h3>Palmas pendientes por marcar inexistentes</h3><p class="tenue">Leyendo los ajustes de existencia…</p></div>`;
  const P=pendientesInexist(),pa=puedeAprobarErr(),S=GER.inx.sel;for(const k of [...S])if(!P.some(d=>d._k===k))S.delete(k);
  const hechas=ERR.aj.ajustes.filter(a=>a.tipo==='PE_PARTIDA').slice(-30).reverse();
  const tP=P.length?tablaGer([...(pa?[{t:`<input type="checkbox" id="inxTodas" ${S.size===P.length?'checked':''} aria-label="Seleccionar todas">`,f:d=>`<input type="checkbox" data-inx="${esc(d._k)}" ${S.has(d._k)?'checked':''}>`}]:[]),
      {t:'Palma',f:d=>`<b>${esc(etiquetaDiag(d))}</b>`},{t:'Programa',f:d=>esc(PROG.get(d.lote)||'—')},{t:'Diagnóstico',f:d=>`<span class="ger-chip mal">${esc(d.nivel2||'PE PARTIDA')}</span>`},
      {t:'Fecha',f:d=>esc(String(d.creado||'').slice(0,10))},{t:'Días',n:1,f:d=>num(Math.max(0,Math.floor((Date.now()-Date.parse(d.creado))/864e5)))},{t:'Evaluador',f:d=>esc(d.evaluador||'')},
      {t:'Fotos',n:1,f:d=>num(Number(d.n_fotos)||0)},
      {t:'',f:d=>`<button class="btn mini" data-inxver="${esc(d._k)}">Ver en el mapa</button>${pa?` <button class="btn mini" data-inxrech="${esc(d._k)}">Rechazar</button>`:''}`}],P)
    :'<div class="ger-aviso">✅ No hay palmas PE partida pendientes en las jornadas cargadas.</div>';
  const tH=hechas.length?tablaGer([{t:'Palma',f:a=>`${esc(a.lote)} · L${esc(a.linea??'?')} · P${esc(a.palma??'?')}`},{t:'Diagnóstico',f:a=>esc(a.fecha_diagnostico||'')},{t:'Evaluador',f:a=>esc(a.evaluador||'')},
      {t:'Aprobó',f:a=>esc(a.aprobado_nombre||a.aprobado_por||'')},{t:'Fecha de aprobación',f:a=>esc(String(a.aprobado||'').slice(0,16).replace('T',' '))}],hechas):'<p class="tenue">Aún no hay palmas PE partida aprobadas.</p>';
  return `<div class="ger-sec"><h3>Palmas pendientes por marcar inexistentes</h3>${aviso}
      <div class="ger-kpis">${kpi(num(P.length),'Pendientes de aprobar',P.length?'mal':'ok')}${kpi(num(ERR.aj.ajustes.filter(a=>a.tipo==='PE_PARTIDA').length),'PE partida aprobadas (total)')}</div>
      ${pa&&P.length?`<div class="ger-par"><button class="btn mini nar" id="inxAprob" ${S.size?'':'disabled'}>✔ Aprobar existencia 0 (${S.size})</button></div>`:''}
      ${!pa&&P.length?'<div class="ger-aviso">Solo el analista de datos o el super administrador pueden aprobar.</div>':''}${tP}</div>
    <div class="ger-sec"><h3>Últimas aprobadas</h3>${tH}</div>`;
};
ENLACES_GER.inexist=()=>{enlazarRango();const P=ERR.aj?pendientesInexist():[],S=GER.inx.sel,por=k=>P.find(d=>d._k===k);
  $$('#gerPanel [data-inx]').forEach(c=>c.onchange=()=>{c.checked?S.add(c.dataset.inx):S.delete(c.dataset.inx);pintarGer();});
  const t=$('#inxTodas');if(t)t.onchange=()=>{if(t.checked)P.forEach(d=>S.add(d._k));else S.clear();pintarGer();};
  $$('#gerPanel [data-inxver]').forEach(b=>b.onclick=()=>{const d=por(b.dataset.inxver);if(!d||d.lat==null)return;alternarGerencia(false);verCensoEnf();mapa.setView([d.lat,d.lng],19);setTimeout(()=>popupDiag(d,L.latLng(d.lat,d.lng)),300);});
  $$('#gerPanel [data-inxrech]').forEach(b=>b.onclick=()=>rechazarInexist(por(b.dataset.inxrech)));
  const a=$('#inxAprob');if(a)a.onclick=()=>aprobarInexist(P.filter(d=>S.has(d._k)));
};
async function aprobarInexist(lista){
  if(!puedeAprobarErr()||!lista.length)return;
  if(!confirm(`¿Aprobar existencia 0 para ${lista.length} palma(s) con PE partida?\n\nSalen de la cartografía activa, de la incidencia y de los conteos en la App, el visor y los reportes.`))return;
  try{const ahora=new Date().toISOString();
    await guardarAjustes(aj=>{for(const d of lista){if(aj.ajustes.some(x=>String(x.palma_id)===d._k&&Number(x.existe)===0))continue;
      aj.ajustes.push({palma_id:d._k,lote:d.lote,linea:d.linea,palma:d.palma,existe:0,motivo:'PE partida',tipo:'PE_PARTIDA',diagnostico_id:d.id||'',fecha_diagnostico:String(d.creado||'').slice(0,10),
        evaluador:d.evaluador||'',aprobado_por:SES.u,aprobado_nombre:SES.nombre,aprobado:ahora});}},`Existencia 0 aprobada: ${lista.length} palma(s) PE partida · ${SES.nombre}`);
    GER.inx.sel.clear();toast(`✓ ${lista.length} palma(s) marcadas como inexistentes.`,4500);aplicarFiltros(false);}
  catch(e){toast('No se pudo guardar: '+e.message,6000);}
  pintarGer();
}
async function rechazarInexist(d){
  if(!d||!puedeAprobarErr())return;const m=prompt('Motivo del rechazo (la palma sigue existiendo; si en un censo posterior vuelve a salir PE partida, aparecerá otra vez):','');if(m==null)return;
  try{await guardarAjustes(aj=>{if(!aj.rechazos.some(r=>r.diagnostico_id===d.id))aj.rechazos.push({diagnostico_id:d.id||'',palma_id:d._k,lote:d.lote,linea:d.linea,palma:d.palma,tipo:'PE_PARTIDA',motivo:m.trim(),por:SES.u,por_nombre:SES.nombre,fecha:new Date().toISOString()});},
      `PE partida rechazada: ${d.lote} L${d.linea} P${d.palma} · ${SES.nombre}`);GER.inx.sel.delete(d._k);toast('Rechazada: la palma sigue con existencia.',4000);}
  catch(e){toast('No se pudo guardar: '+e.message,6000);}
  pintarGer();
}
