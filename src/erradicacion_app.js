/* =====================================================================
   MÓDULO DE ERRADICACIÓN (App de campo)
   Equipos mixtos: un erradicador solo, o erradicador + auxiliar de erradicación (cada uno con su celular).
   El equipo recibe la programación del día (ruta desde la oficina central) con las palmas reportadas por el censo
   como PC cráter, palmas espontáneas y yarumos. En cada palma: foto antes, método (motosierra o química con
   producto y dosis) y foto después, obligatorias y solo con la cámara. El erradicador puede corregir un caso mal
   reportado (queda la versión del censador y la suya) y reportar casos nuevos.
   Se sincroniza en erradicacion/jornadas/AAAA-MM-DD/<jornada>.geojson.
   ===================================================================== */
LABORES_TODAS.push('erradicacion');
const ERRA={capa:L.layerGroup().addTo(mapa),usuarios:null,prog:null,radio:50,productos:null,equipoProg:null};
const esErr=()=>!!(S.jornada&&S.jornada.labor==='erradicacion');
const rolErrSES=()=>{if(!SES)return 'erradicador';if(SES.rol_erradicacion)return SES.rol_erradicacion;return SES.rol==='operario'?'auxiliar':'erradicador';};

(function montarErradicacionApp(){
  const css=document.createElement('style');css.textContent=`
  #pe{border-radius:16px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:6px}
  #pe .pc-sup{display:flex;justify-content:space-between;align-items:center;gap:8px;font-family:var(--t);font-weight:700;letter-spacing:.5px}
  #pe .pc-sup .eti{font-size:12px;letter-spacing:1.4px;color:#ff8a65}
  #pe .pc-pal{font-family:var(--t);font-weight:700;font-size:21px;line-height:1.1}
  #pe .pc-sub{font-size:12.5px;color:var(--tenue)}
  #pe .pc-bt{display:flex;gap:8px}
  #pe .pc-bt .btn{flex:1;padding:10px 8px;font-size:14px;margin:0}
  .tipoErr{border-radius:999px;padding:2px 8px;font-size:11.5px;font-weight:700;background:rgba(255,138,101,.15);color:#ff8a65;border:1px solid rgba(255,138,101,.5)}`;
  document.head.appendChild(css);
  const pe=document.createElement('div');pe.id='pe';pe.className='glass';pe.hidden=true;$('#pj').after(pe);
  pe.onclick=e=>{if(e.target.closest('button'))return;panelErr();};
})();

/* ---------- Usuarios con la labor de erradicación ---------- */
async function usuariosErr(){
  if(ERRA.usuarios)return ERRA.usuarios;const out=[];
  for(const x of ACCESO.usuarios){try{const m=JSON.parse(DEC.decode(await desObj(SES.dk,x.meta)));if(!m.inactivo&&(m.labores||[]).includes('erradicacion'))out.push({u:x.u,nombre:m.nombre,rol_erradicacion:m.rol_erradicacion||'erradicador'});}catch(e){}}
  ERRA.usuarios=out.sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));return ERRA.usuarios;
}
/* Productos químicos (config/erradicacion.json del repositorio de datos; si no hay, Mesa Mate) */
async function productosErr(){
  if(ERRA.productos)return ERRA.productos;
  try{const c=await (await ghRaw('config/erradicacion.json')).json();const l=(c.productos||[]).map(p=>typeof p==='string'?p:p.nombre).filter(Boolean);
    if(l.length){ERRA.productos=l;await dbPut('config',{clave:'err_productos',v:l});return l;}}catch(e){}
  try{const c=await dbGet('config','err_productos');if(c&&c.v&&c.v.length)return ERRA.productos=c.v;}catch(e){}
  return ERRA.productos=PRODUCTOS_ERR.slice();
}

/* ---------- Elección de labor (agrega Erradicación) ---------- */
{const _elegir=elegirLabor;elegirLabor=function(){
  const L=laboresSES();if(!L.includes('erradicacion'))return _elegir();
  const otras=L.filter(l=>l!=='erradicacion');if(!otras.length)return abrirInicioErr();
  abrirHoja('¿Qué labor hará hoy?',`
    ${L.includes('censo')?`<button class="btn ancho grande" id="lbCenso">${IC.play} CENSO DE ENFERMEDADES</button>`:''}
    ${L.includes('cirugia')?'<button class="btn ancho grande" id="lbCir">✚ CIRUGÍA</button>':''}
    <button class="btn prim ancho grande" id="lbErr">🪓 ERRADICACIÓN</button>
    <p class="tenue" style="font-size:12.5px">Solo aparecen las labores habilitadas para su usuario.</p>`);
  const c=$('#lbCenso');if(c)c.onclick=()=>{cerrarHoja();abrirPlanificador('nueva');};
  const k=$('#lbCir');if(k)k.onclick=()=>abrirInicioCirugia();
  $('#lbErr').onclick=()=>abrirInicioErr();};}

async function programacionErr(fecha){
  const clave='err_prog_'+fecha;
  try{const r=await ghRaw(`erradicacion/programacion/${fecha}.json`);const p=await r.json();await dbPut('config',{clave,v:p});return {p,origen:'red'};}
  catch(e){const c=await dbGet('config',clave);if(c&&c.v)return {p:c.v,origen:'local'};if(e.status===404)return {p:null,origen:'red'};return {p:null,origen:'error',error:e.message};}
}
async function abrirInicioErr(){
  if(S.jornada){toast('Ya hay una jornada en curso.');return;}
  const us=await usuariosErr();const miRol=rolErrSES();const puedeErr=miRol==='erradicador'||SES.rol!=='operario';
  const hoy=fechaISO(new Date());productosErr().catch(()=>{});
  abrirHoja('Jornada de erradicación',`
    <div class="banda-form" style="--bf:#8a3b12"><span>1</span><b>MI ROL HOY</b></div>
    <div class="seg2" role="radiogroup" aria-label="Rol">
      <label><input type="radio" name="eRol" value="erradicador" ${puedeErr?'checked':'disabled'}><span>Erradicador</span></label>
      <label><input type="radio" name="eRol" value="auxiliar" ${puedeErr?'':'checked'}><span>Auxiliar</span></label>
    </div>
    <div class="banda-form" style="--bf:#7a5a12"><span>2</span><b id="eParTit">MI EQUIPO</b></div>
    <label class="campo" for="ePar">Persona con la que trabaja hoy</label>
    <select id="ePar" class="ancho" style="width:100%;padding:12px;border-radius:12px;background:#0a1d16;color:var(--texto);border:1px solid var(--borde)"></select>
    <p class="tenue" style="font-size:12.5px">Si trabaja en pareja, su compañero debe elegirlo a usted en su propio celular.</p>
    <div class="banda-form" style="--bf:#1e5a86"><span>3</span><b>PROGRAMACIÓN DE HOY</b></div>
    <div id="eProg" class="ficha">Consultando la programación del ${esc(fechaCorta(hoy))}…</div>
    <button class="btn prim ancho grande" id="eIni" style="margin-top:14px">${IC.play} INICIAR JORNADA DE ERRADICACIÓN</button>`);
  const {p,origen,error}=await programacionErr(hoy);ERRA.prog=p;
  const miEq=p&&(p.equipos||[]).find(e=>(e.erradicador&&e.erradicador.u===SES.u)||(e.auxiliar&&e.auxiliar.u===SES.u));
  const pintarPar=()=>{const rol=(document.querySelector('input[name=eRol]:checked')||{}).value;
    $('#eParTit').textContent=rol==='erradicador'?'MI AUXILIAR':'MI ERRADICADOR';
    const ops=us.filter(u=>u.u!==SES.u&&(rol==='erradicador'?true:u.rol_erradicacion==='erradicador'));
    const sug=miEq?(miEq.erradicador.u===SES.u?(miEq.auxiliar?miEq.auxiliar.u:'__solo'):miEq.erradicador.u):(S.cfg.errPareja||'');
    $('#ePar').innerHTML=(rol==='erradicador'?`<option value="__solo" ${sug==='__solo'?'selected':''}>Trabajo solo (sin auxiliar)</option>`:'<option value="">Seleccione…</option>')+
      ops.map(u=>`<option value="${esc(u.u)}" ${u.u===sug?'selected':''}>${esc(nomBonito(u.nombre))} · ${u.rol_erradicacion==='erradicador'?'erradicador':'auxiliar'}</option>`).join('');
    buscar();};
  const buscar=()=>{const rol=(document.querySelector('input[name=eRol]:checked')||{}).value,par=$('#ePar').value;
    const err=rol==='erradicador'?SES.u:par;const eq=p&&(p.equipos||[]).find(e=>e.erradicador.u===err||(rol==='auxiliar'&&e.auxiliar&&e.auxiliar.u===SES.u));
    const el=$('#eProg');
    if(!p)el.innerHTML=origen==='error'?`⚠ No se pudo consultar la programación (${esc(error)}). Puede iniciar y reportar casos nuevos.`:'No hay programación de erradicación para hoy. Puede iniciar y reportar casos nuevos.';
    else if(!eq)el.innerHTML='Su equipo no aparece en la programación de hoy. Revise su compañero o consulte al coordinador.';
    else el.innerHTML=`<b>Equipo ${eq.n}:</b> ${eq.ordenes.length} palmas · ${eq.km_campo??eq.km??'—'} km en campo<br><span class="tenue">${esc(nomBonito(eq.erradicador.nombre))} (erradicador)${eq.auxiliar?' · '+esc(nomBonito(eq.auxiliar.nombre))+' (auxiliar)':' · trabaja solo'}${origen==='local'?' · guardada en el celular':''}</span>`;
    ERRA.equipoProg=eq||null;};
  document.querySelectorAll('input[name=eRol]').forEach(i=>i.onchange=pintarPar);$('#ePar').onchange=buscar;pintarPar();
  $('#eIni').onclick=async()=>{const rol=(document.querySelector('input[name=eRol]:checked')||{}).value;const par=$('#ePar').value;
    if(!par){alert('Seleccione a su erradicador.');return;}
    const yo={u:SES.u,nombre:SES.nombre};let equipo;
    if(par==='__solo')equipo={erradicador:yo,auxiliar:null};
    else{const pu=us.find(u=>u.u===par);const otro={u:par,nombre:pu?pu.nombre:par};equipo=rol==='erradicador'?{erradicador:yo,auxiliar:otro}:{erradicador:otro,auxiliar:yo};}
    S.cfg.errPareja=par;await guardarCfg();await iniciarErr(rol,equipo,ERRA.equipoProg,hoy);};
}

/* ---------- Jornada de erradicación ---------- */
async function iniciarErr(rol,equipo,eq,fecha){
  {const m=motivoNoIniciar();if(m){avisarFueraPlantacion(m);return;}}
  const ordenes=eq?eq.ordenes.map(o=>({...o,estado:'pendiente'})):[];
  const lotes=[...new Set(ordenes.map(o=>o.lote).filter(Boolean))];
  const j={id:idJornada(),labor:'erradicacion',rol,equipo,programacion:fecha,equipo_n:eq?eq.n:null,ruta:eq?eq.ruta:[],ordenes,
    inicio:new Date().toISOString(),fin:null,evaluador:SES.nombre,usuario:SES.u,dispositivo:S.cfg.dispositivo,seleccion:lotes.map(l=>({lote:l,desde:null,hasta:null})),
    estado:'activa',km:0,sync:'pendiente',version_app:VERSION,carto_version:CARTO.version,paradaRadio:Number(S.cfg.paradaRadio)||20,paradaMin:Number(S.cfg.paradaMin)||5};
  await dbPut('jornadas',j);S.jornada=j;S.cfg.jornadaActiva=j.id;S.cfg.evaluador=SES.nombre;await guardarCfg();
  TRACK.ultimo=null;TRACK.n=0;TRACK.pts=[];prepararTrack([]);VIS=null;PAR.lista=[];capaParadas.clearLayers();
  cerrarHoja();await cargarPalmasJornada();iniciarGPS();pantallaEncendida(true);actualizarJornadaUI();dibujarRutaErr(true);
  if(S.cfg.seguir!==false){S.seguir=true;pintarSeguir();S.pausaSeguir=Date.now()+12000;}
  setTimeout(()=>revisarSegundoPlano(false),2500);
  hablar(MSJ_INICIO,true);
  toast(ordenes.length?`▶ Erradicación iniciada: ${ordenes.length} palmas en su ruta.`:'▶ Erradicación iniciada sin programación: puede reportar casos nuevos.',4500);
  setTimeout(()=>anunciarSigErr(true),9000);
  try{avisoJornada(true);}catch(e){}
}
async function restaurarErr(j){
  S.jornada=j;const pts=await puntosTrack(j.id);TRACK.ultimo=pts[pts.length-1]||null;TRACK.n=pts.length;TRACK.pts=pts;prepararTrack(pts.map(p=>[p.lat,p.lng]));VIS=null;
  await cargarPalmasJornada();pantallaEncendida(true);dibujarRutaErr(false);productosErr().catch(()=>{});toast('Jornada de erradicación recuperada. El recorrido continúa.',4000);
}
const ordenesErr=()=>S.jornada&&S.jornada.ordenes||[];
const sigOrdenErr=()=>ordenesErr().find(o=>o.estado==='pendiente')||null;
const puedeRegistrarErr=()=>{const j=S.jornada;return !!j&&(j.rol==='erradicador'||!j.equipo.auxiliar);};
function dibujarRutaErr(encuadrar){
  ERRA.capa.clearLayers();if(!esErr())return;const j=S.jornada;const sig=sigOrdenErr();
  if(j.ruta&&j.ruta.length>1){L.polyline(j.ruta.map(([x,y])=>[y,x]),{renderer:rend,color:'#06140f',weight:7,opacity:.55,interactive:false}).addTo(ERRA.capa);
    L.polyline(j.ruta.map(([x,y])=>[y,x]),{renderer:rend,color:'#ff8a65',weight:3.5,opacity:.95,dashArray:'8 6',interactive:false}).addTo(ERRA.capa);}
  for(const o of j.ordenes){if(o.lat==null)continue;const es=o===sig;const col=o.estado==='erradicada'?'#5c6b64':o.estado==='corregida'?'#c28a10':es?'#ee7633':'#bf360c';const t=es?28:22;
    L.marker([o.lat,o.lng],{icon:L.divIcon({className:'cir-mk',iconSize:[t,t],iconAnchor:[t/2,t/2],html:`<b style="width:${t}px;height:${t}px;background:${col};font-size:${es?13:11.5}px">${o.orden}</b>`}),zIndexOffset:es?900:400,keyboard:false})
      .on('click',()=>abrirPalmaErr(o.palma_id)).addTo(ERRA.capa);}
  if(encuadrar){const ll=j.ordenes.filter(o=>o.lat!=null).map(o=>[o.lat,o.lng]);if(ll.length)mapa.fitBounds(L.latLngBounds(ll).pad(.15),{maxZoom:17});}
  actualizarErrUI();
}
function actualizarErrUI(){
  const pe=$('#pe');if(!pe)return;
  if(!esErr()){pe.hidden=true;return;}
  $('#pj').hidden=true;const pc=$('#pc');if(pc)pc.hidden=true;pe.hidden=false;
  const j=S.jornada,os=ordenesErr(),sig=sigOrdenErr(),hechas=os.filter(o=>o.estado!=='pendiente').length;
  const d=sig&&S.gps?dist(S.gps.lat,S.gps.lng,sig.lat,sig.lng):null;
  const regsHoy=S.registros.filter(r=>r.jornada_id===j.id&&r.tipo==='erradicacion').length;
  pe.innerHTML=`<div class="pc-sup"><span class="eti">${sig?`SIGUIENTE · ${sig.orden} DE ${os.length}`:os.length?'RUTA COMPLETA':'ERRADICACIÓN · SIN PROGRAMACIÓN'}</span><span class="tenue" style="font-size:13px">${j.rol==='erradicador'?'Erradicador':'Auxiliar'} · ${hechas}/${os.length} · ${regsHoy} erradicada(s)</span></div>
    ${sig?`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><div class="pc-pal">${esc(etqOrden(sig))}</div><div class="pc-sub"><span class="tipoErr">${esc((TIPOS_ERR[sig.tipo]||{}).t||sig.tipo)}</span> · reporte ${esc(fechaCorta(sig.fecha_censo))}${d!=null?` · a ${d<1000?Math.round(d)+' m':(d/1000).toFixed(1)+' km'}`:''}</div></div><span class="venceChip ${claseVence(sig.vence)}">${esc(textoVence(sig.vence))}</span></div>`
      :`<div class="pc-sub">${os.length?'Todas las palmas programadas están atendidas. Puede reportar casos nuevos o finalizar.':'Toque una palma del mapa para reportar un caso nuevo y erradicarlo.'}</div>`}
    <div class="pc-bt">${sig?'<button class="btn prim" id="peLlegue">LLEGUÉ A LA PALMA</button>':''}<button class="btn" id="peNuevo">${puedeRegistrarErr()?'Caso nuevo':'Mi ruta'}</button></div>`;
  const ll=$('#peLlegue');if(ll)ll.onclick=()=>{mapa.setView([sig.lat,sig.lng],19);abrirPalmaErr(sig.palma_id);};
  $('#peNuevo').onclick=async()=>{if(!puedeRegistrarErr())return panelErr();
    const l=S.gps?loteDe(S.gps.lat,S.gps.lng):'';
    if(l&&!j.seleccion.some(s=>s.lote===l)){j.seleccion.push({lote:l,desde:null,hasta:null});await dbPut('jornadas',j);await cargarPalmasJornada();}
    toast(l?`Lote ${l}: toque en el mapa la palma del caso nuevo (a menos de 50 m).`:'Ubíquese dentro del lote y toque la palma del caso nuevo.',5000);if(S.gps)mapa.setView([S.gps.lat,S.gps.lng],19);};
}
setInterval(()=>{if(esErr()){actualizarErrUI();vozCercaniaErr();}},3000);
function anunciarSigErr(prio){
  if(!esErr())return;const sig=sigOrdenErr();if(!sig){if(ordenesErr().length)hablar('Ruta completa. Todas las palmas programadas están atendidas.',prio);return;}
  const d=S.gps?dist(S.gps.lat,S.gps.lng,sig.lat,sig.lng):null;
  hablar(`Siguiente: ${(TIPOS_ERR[sig.tipo]||{}).t||''}, lote ${paraVoz(sig.lote)}, línea ${paraVoz(sig.linea)}, palma ${paraVoz(sig.palma)}${d!=null?', a '+(d<1000?Math.round(d/10)*10+' metros':(d/1000).toFixed(1).replace('.',' punto ')+' kilómetros'):''}.`,prio);
}
function vozCercaniaErr(){const sig=sigOrdenErr();if(!sig||!S.gps)return;const d=dist(S.gps.lat,S.gps.lng,sig.lat,sig.lng);
  if(d<=20&&ERRA.ultCerca!==sig.id){ERRA.ultCerca=sig.id;pitido(880,160);hablar(`Llegó a la palma ${paraVoz(sig.palma)} de la línea ${paraVoz(sig.linea)}.`);}}

/* ---------- Palma en modo erradicación ---------- */
const ordenErrDe=pid=>ordenesErr().find(o=>String(o.palma_id)===String(pid))||null;
function htmlHistErr(pid,o){
  const ev=[];if(o)ev.push({t:o.creado||o.fecha_censo,cl:'censo',txt:o.diagnostico,quien:o.censador});
  for(const r of regsPalma(pid)){if(r.tipo==='erradicacion')ev.push({t:r.creado,cl:'erradicacion',txt:`${(TIPOS_ERR[r.tipo_erradicacion]||{}).t||r.tipo_erradicacion} · ${r.metodo}${r.producto?' · '+r.producto+' '+r.dosis+' '+(r.dosis_unidad||'ml'):''}`,quien:r.erradicador_nombre});
    else if(r.tipo==='cirugia')ev.push({t:r.creado,cl:'cirugia',txt:`${r.tipo_cirugia} · ${r.producto}`,quien:r.cirujano_nombre});
    else if(r.tipo==='diagnostico'&&r.origen)ev.push({t:r.creado,cl:r.origen,txt:[r.n1,r.n2].filter(Boolean).join(' · '),quien:r.evaluador,rol:r.autor_rol});
    else if(!r.tipo&&r.n1)ev.push({t:r.creado,cl:'censo',txt:[r.n1,r.n2].filter(Boolean).join(' · '),quien:r.evaluador});}
  if(!ev.length)return '';
  const ultD=[...ev].reverse().find(e=>e.cl!=='erradicacion'&&e.cl!=='cirugia');
  const et=e=>({censo:'Censo',correccion:`Corrección del ${e.rol==='cirujano'?'cirujano':'erradicador'}`,caso_nuevo:`Caso nuevo (${e.rol==='cirujano'?'cirujano':'erradicador'})`,erradicacion:'Erradicación',cirugia:'Cirugía'})[e.cl]||e.cl;
  return `<h3>Historial del diagnóstico</h3><div class="histC">${ev.map(e=>`<div class="v ${e.cl==='erradicacion'||e.cl==='cirugia'||e===ultD?'vig':'vieja'}"><span class="tenue">${et(e)} · ${esc(fmtFecha(e.t))}${e===ultD?' · vigente':''}</span><br><b>${esc(e.txt||'')}</b><br><span class="tenue">${esc(nomBonito(e.quien||''))}</span></div>`).join('')}</div>`;
}
function abrirPalmaErr(id,dm){
  const f=S.idx.get(id);const o=ordenErrDe(id);
  let lat,lng,lote,linea,num;
  if(f){[lng,lat]=f.geometry.coordinates;const p=f.properties;lote=p._lote;linea=p._linea;num=p._num;}else if(o){lat=o.lat;lng=o.lng;lote=o.lote;linea=o.linea;num=o.palma;}else return;
  resaltar(lat,lng);
  const d=dm!=null?dm:(S.gps?dist(S.gps.lat,S.gps.lng,lat,lng):null);const lejos=d!=null&&d>ERRA.radio;
  const j=S.jornada;const reg=puedeRegistrarErr();const hecha=o&&o.estado!=='pendiente';
  const marca=S.registros.find(r=>r.jornada_id===j.id&&r.tipo==='marca'&&String(r.palma_id)===String(id));
  const palma={id,lat,lng,lote,linea,num};
  abrirHoja(`${lote} · L${linea??'?'} · P${num??'?'}`,`
    <div class="ficha gran"><div><div class="big">${esc(lote)}</div><span class="tenue">LOTE</span></div><div><div class="big">${esc(linea??'—')}</div><span class="tenue">LÍNEA</span></div><div><div class="big">${esc(num??'—')}</div><span class="tenue">PALMA</span></div></div>
    <div class="ficha" style="margin-top:8px">${d!=null?`<div><b>Distancia a usted:</b> ${d.toFixed(1)} m${S.gps?` · GPS ±${Math.round(S.gps.acc)} m`:''}</div>`:'<div class="tenue">Sin lectura GPS en este momento</div>'}
      ${o?`<div><b>Para erradicar:</b> <span class="tipoErr">${esc((TIPOS_ERR[o.tipo]||{}).t||o.tipo)}</span> · ${esc(nomBonito(o.diagnostico))}</div><div><b>Reportó:</b> ${esc(nomBonito(o.censador))} · ${esc(fechaCorta(o.fecha_censo))}</div><div><b>Plazo (día hábil siguiente):</b> ${esc(fechaCorta(o.vence))} <span class="venceChip ${claseVence(o.vence)}">${esc(textoVence(o.vence))}</span></div>`:'<div class="tenue">Esta palma no está en la programación de hoy.</div>'}
      ${hecha?`<div style="color:var(--acento)"><b>✓ ${o.estado==='erradicada'?'Erradicada':'Reporte corregido'} en esta jornada</b></div>`:''}
    </div>
    ${lejos?`<div class="aviso">⚠ Usted está a ${Math.round(d)} m de la palma. Acérquese a menos de ${ERRA.radio} m para registrar.</div>`:''}
    ${reg?(o&&!hecha?`<button class="btn prim ancho grande" id="peErr" ${lejos?'disabled':''}>CONFIRMA: ERRADICAR</button>
        <button class="btn ancho" id="peCorr" ${lejos?'disabled':''} style="border-color:var(--ambar);color:var(--ambar)">El reporte está mal: corregir</button>`
      :!o?`<button class="btn prim ancho grande" id="peNuevoP" ${lejos?'disabled':''}>REPORTAR CASO NUEVO Y ERRADICAR</button>`:'')
      :(marca?`<div class="ficha" style="color:var(--acento)">✓ Usted marcó esta palma a las ${esc(fmtHora(marca.creado).slice(0,5))}</div>`:`<button class="btn prim ancho grande" id="peMarca" ${lejos?'disabled':''}>MARCAR PALMA (AUXILIAR)</button>`)}
    ${htmlHistErr(id,o)}`);
  const b1=$('#peErr');if(b1)b1.onclick=()=>abrirFormErr({o,palma});
  const b2=$('#peCorr');if(b2)b2.onclick=()=>abrirCorreccionErr({o,palma});
  const b3=$('#peNuevoP');if(b3)b3.onclick=()=>abrirFormErr({o:null,palma,nuevo:true});
  const b4=$('#peMarca');if(b4)b4.onclick=()=>marcarPalmaAuxErr({o,palma});
}
{const _abrirPalma2=abrirPalma;abrirPalma=function(id,dm){if(esErr())return abrirPalmaErr(id,dm);return _abrirPalma2(id,dm);};}
async function marcarPalmaAuxErr({o,palma}){
  const j=S.jornada;const r={id:uid(),tipo:'marca',labor:'erradicacion',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
    rol:'auxiliar',usuario:SES.u,evaluador:SES.nombre,erradicador:j.equipo.erradicador.u,erradicador_nombre:j.equipo.erradicador.nombre,orden_id:o?o.id:null,creado:new Date().toISOString(),fecha:ahoraLocal(),fotos:[],...gpsCampos(palma)};
  await guardarRegCir(r);if(o){o.estado='erradicada';await dbPut('jornadas',j);}
  pitido(988,120);toast('✓ Palma marcada. Siga con su erradicador a la siguiente palma.',3500);cerrarHoja();dibujarRutaErr(false);setTimeout(()=>anunciarSigErr(false),1200);
}

/* ---------- Formulario de erradicación ---------- */
async function abrirFormErr({o,palma,nuevo}){
  F={fotosNuevas:[],fotosQuitar:[],urls:[],cir:{antes:null,despues:null}};
  const prods=await productosErr();const tipo0=o?o.tipo:'';
  const chip=(name,val,txt,on)=>`<label class="chip-op"><input type="radio" name="${name}" value="${esc(val)}" ${on?'checked':''}><span>${esc(txt)}</span></label>`;
  const eq=S.jornada.equipo;
  abrirHoja(nuevo?'Caso nuevo y erradicación':'Registro de la erradicación',`
    <form id="frmErr" autocomplete="off">
      <div class="ficha"><b>${esc(palma.lote)} · L${esc(palma.linea??'?')} · P${esc(palma.num??'?')}</b><br><span class="tenue">Erradicador: ${esc(nomBonito(eq.erradicador.nombre))}${eq.auxiliar?' · Auxiliar: '+esc(nomBonito(eq.auxiliar.nombre)):' · trabaja solo'}</span></div>
      <div class="banda-form" style="--bf:#8a3b12"><span>1</span><b>QUÉ SE ERRADICA</b></div>
      ${nuevo?'<p class="tenue" style="font-size:12.5px;margin:0 0 6px">El caso nuevo queda registrado como diagnóstico del erradicador.</p>':''}
      <div class="chips">${Object.entries(TIPOS_ERR).map(([k,v])=>chip('tipo',k,v.t,k===tipo0)).join('')}</div>
      ${o?'<p class="tenue" style="font-size:12px;margin:6px 0 0">Si no coincide con el reporte, se guarda como corrección del diagnóstico.</p>':''}
      <div class="banda-form" style="--bf:#7a5a12"><span>2</span><b>MÉTODO</b></div>
      <div class="seg2">${METODOS_ERR.map((m,i)=>`<label><input type="radio" name="metodo" value="${esc(m)}" ${i?'':'checked'}><span>${esc(m)}</span></label>`).join('')}</div>
      <div id="eQuim" hidden>
        <label class="campo">Producto</label><div class="chips">${prods.map((p,i)=>chip('prod',p,p,prods.length===1&&!i)).join('')}</div>
        <label class="campo" for="eDosis">Dosis aplicada (${DOSIS_UNIDAD_ERR} por palma)</label>
        <input type="number" id="eDosis" name="dosis" min="0" step="any" inputmode="decimal" placeholder="Ej. 20" style="width:100%;padding:12px;border-radius:12px;background:#0a1d16;color:var(--texto);border:1px solid var(--borde)">
      </div>
      <div class="banda-form" style="--bf:#1e5a86"><span>3</span><b>FOTOS OBLIGATORIAS (SOLO CÁMARA)</b></div>
      <div class="fotoSlot">
        <div class="sl" id="slAntes"><button type="button" class="cam" data-slot="antes">📷<span>Foto antes</span></button><span class="tenue">Antes · pendiente</span></div>
        <div class="sl" id="slDespues"><button type="button" class="cam" data-slot="despues">📷<span>Foto después</span></button><span class="tenue">Después · pendiente</span></div>
      </div>
      <div class="ficha" id="eDur" style="margin-top:8px">Inicio: al tomar la foto de antes · Fin: al tomar la foto de después</div>
      <label class="campo" style="margin-top:8px">Observación (opcional)</label><textarea name="obs" placeholder="Detalle de la erradicación"></textarea>
      <p id="eFalta" style="color:var(--ambar);font-size:13px;text-align:center"></p>
      <button type="submit" class="btn prim ancho grande" id="eGuardar">💾 GUARDAR ERRADICACIÓN</button>
    </form>`);
  const frm=$('#frmErr');
  const metodo=()=>(frm.querySelector('input[name=metodo]:checked')||{}).value;
  const revisar=()=>{if(!F||!F.cir||!$('#eQuim'))return;const q=metodo()==='Química';$('#eQuim').hidden=!q;const falta=[];
    if(!frm.querySelector('input[name=tipo]:checked'))falta.push('qué se erradica');
    if(q){if(!frm.querySelector('input[name=prod]:checked'))falta.push('producto');if(!(Number($('#eDosis').value)>0))falta.push('dosis');}
    if(!F.cir.antes)falta.push('foto de antes');if(!F.cir.despues)falta.push('foto de después');
    $('#eFalta').textContent=falta.length?'Falta: '+falta.join(', '):'';$('#eGuardar').disabled=!!falta.length;
    if(F.cir.antes&&F.cir.despues){const m=Math.max(0,Math.round((F.cir.despues.t-F.cir.antes.t)/60000));$('#eDur').innerHTML=`Inicio ${fmtHora(F.cir.antes.t).slice(0,5)} · Fin ${fmtHora(F.cir.despues.t).slice(0,5)} · <b>Duración: ${m} min</b>`;}
    else if(F.cir.antes)$('#eDur').innerHTML=`Inicio ${fmtHora(F.cir.antes.t).slice(0,5)} · falta la foto de después`;};
  frm.addEventListener('change',revisar);frm.addEventListener('input',revisar);revisar();
  frm.querySelectorAll('button.cam').forEach(b=>b.onclick=()=>tomarFotoCir(b.dataset.slot,revisar));
  frm.onsubmit=async e=>{e.preventDefault();revisar();if($('#eGuardar').disabled)return;
    const fd=new FormData(frm);const q=fd.get('metodo')==='Química';
    await guardarErr({o,palma,nuevo,tipo:fd.get('tipo'),metodo:fd.get('metodo'),prod:q?fd.get('prod'):'',dosis:q?Number(fd.get('dosis')):null,obs:(fd.get('obs')||'').trim()});};
}
/* Diagnóstico equivalente a cada tipo de erradicación (para casos nuevos o correcciones del erradicador) */
function diagDeTipoErr(tipo,o){
  if(tipo==='CRATER')return {n1_codigo:'PC',n1:'PUDRICIÓN DE COGOLLO (PC)',n2:'CRATER',n3:'SEGUIMIENTO PC',estado:'enferma',problemas:['PC']};
  if(tipo==='ESPONTANEA')return {n1_codigo:'ESP',n1:'ESPONTANEA',n2:'',n3:'',estado:'novedad',problemas:['ESP']};
  const n2=o&&/YARUMO/.test(o.diagnostico||'')?o.diagnostico:'YARUMO EN LOTE';
  return {n1_codigo:'YAR',n1:'YARUMO',n2,n3:'',estado:'novedad',problemas:['YAR']};
}
async function guardarErr({o,palma,nuevo,tipo,metodo,prod,dosis,obs}){
  if(SYNC.activo){alert('Se está sincronizando. Intente de nuevo en unos segundos.');return;}
  const j=S.jornada;const a=F.cir.antes,dpu=F.cir.despues;const g=gpsCampos(palma);
  try{
    for(const fo of [a,dpu])await dbPut('fotos',{id:fo.id,registro_id:null,buf:fo.buf,type:'image/jpeg'});
    if(nuevo||(o&&o.tipo!==tipo)){
      const dx=diagDeTipoErr(tipo,o);
      const dg={id:uid(),tipo:'diagnostico',origen:nuevo?'caso_nuevo':'correccion',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
        evaluador:SES.nombre,usuario:SES.u,autor_rol:'erradicador',...dx,sintomas:[],accion:'erradicar',
        corrige_id:o?o.diag_id:null,corrige_texto:o?o.diagnostico:'',corrige_evaluador:o?o.censador:'',corrige_fecha:o?o.fecha_censo:'',
        observaciones:'',fotos:[a.id],creado:new Date(a.t-1000).toISOString(),fecha:ahoraLocal(),...g};
      await guardarRegCir(dg);}
    const hoy=fechaISO(new Date());
    const r={id:uid(),tipo:'erradicacion',origen:nuevo?'caso_nuevo':o?'programada':'no_programada',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
      tipo_erradicacion:tipo,metodo,producto:prod||'',dosis:dosis??null,dosis_unidad:prod?DOSIS_UNIDAD_ERR:'',requiere_aprobacion:!!(TIPOS_ERR[tipo]||{}).existencia,
      foto_antes:a.id,foto_despues:dpu.id,fotos:[a.id,dpu.id],hora_foto_antes:new Date(a.t).toISOString(),hora_foto_despues:new Date(dpu.t).toISOString(),duracion_min:Math.max(0,Math.round((dpu.t-a.t)/60000)),
      erradicador:j.equipo.erradicador.u,erradicador_nombre:j.equipo.erradicador.nombre,auxiliar:j.equipo.auxiliar?j.equipo.auxiliar.u:'',auxiliar_nombre:j.equipo.auxiliar?j.equipo.auxiliar.nombre:'',
      orden_id:o?o.id:null,programacion:j.programacion,diag_censo:o?o.diagnostico:'',censador:o?o.censador:'',fecha_censo:o?o.fecha_censo:'',vence:o?o.vence:habilMas(hoy),
      a_tiempo:o?hoy<=o.vence:true,observaciones:obs,evaluador:SES.nombre,usuario:SES.u,creado:new Date(dpu.t).toISOString(),fecha:ahoraLocal(),...g};
    await guardarRegCir(r);
    if(o){o.estado='erradicada';o.registro=r.id;}
    else if(nuevo)j.ordenes.push({id:'nuevo-'+r.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea,palma:palma.num,lat:palma.lat,lng:palma.lng,tipo,diagnostico:(TIPOS_ERR[tipo]||{}).t||tipo,orden:j.ordenes.length+1,estado:'erradicada',origen:'caso_nuevo',fecha_censo:hoy,vence:hoy});
    await dbPut('jornadas',j);
  }catch(e){alert('Error al guardar: '+e.message);return;}
  liberarUrls();F=null;if((TIPOS_ERR[tipo]||{}).existencia){S.hechos.set(palma.id,{estado:'erradicada'});repintarPalma(palma.id);}
  pitido(988,140);toast(`✅ Erradicación guardada: ${(TIPOS_ERR[tipo]||{}).t||tipo} · ${metodo}${prod?' · '+prod+' '+dosis+' '+DOSIS_UNIDAD_ERR:''}.`,3500);cerrarHoja();dibujarRutaErr(false);estadoSync();
  setTimeout(()=>anunciarSigErr(false),1500);
}

/* ---------- Corrección del reporte (sin erradicar) ---------- */
function abrirCorreccionErr({o,palma}){
  F={fotosNuevas:[],fotosQuitar:[],urls:[],cir:{antes:null}};
  abrirHoja('Corregir el reporte',`
    <form id="frmCorrE">
      <div class="ficha"><b>${esc(palma.lote)} · L${esc(palma.linea??'?')} · P${esc(palma.num??'?')}</b><br><span class="tenue">Reporte: ${esc(o?nomBonito(o.diagnostico):'—')} · ${esc(o?nomBonito(o.censador):'')}</span></div>
      <div class="banda-form" style="--bf:#7a5a12"><span>1</span><b>¿CÓMO ESTÁ REALMENTE LA PALMA?</b></div>
      <div class="chips">${CORRECCIONES_ERR.map(c=>`<label class="chip-op"><input type="radio" name="cc" value="${c.id}"><span>${esc(c.t)}</span></label>`).join('')}</div>
      <div class="aviso">PC inicial o avanzada pasa a la programación de cirugía. Queda la versión del censador y la suya.</div>
      <div class="banda-form" style="--bf:#1e5a86"><span>2</span><b>FOTO DE EVIDENCIA (OBLIGATORIA)</b></div>
      <div class="fotoSlot" style="grid-template-columns:1fr"><div class="sl" id="slAntes"><button type="button" class="cam" data-slot="antes">📷<span>Tomar foto</span></button></div></div>
      <label class="campo" style="margin-top:8px">Observación</label><textarea name="obs" placeholder="Qué encontró en la palma"></textarea>
      ${htmlHistErr(palma.id,o)}
      <p id="cFaltaE" style="color:var(--ambar);font-size:13px;text-align:center"></p>
      <button type="submit" class="btn ancho grande" id="cGuardarE" style="background:var(--ambar);color:#06140f">GUARDAR CORRECCIÓN</button>
    </form>`);
  const frm=$('#frmCorrE');
  const revisar=()=>{if(!F||!F.cir||!$('#cFaltaE'))return;const falta=[];if(!frm.querySelector('input[name=cc]:checked'))falta.push('estado real');if(!F.cir.antes)falta.push('foto');$('#cFaltaE').textContent=falta.length?'Falta: '+falta.join(', '):'';$('#cGuardarE').disabled=!!falta.length;};
  frm.addEventListener('change',revisar);revisar();
  frm.querySelector('button.cam').onclick=()=>tomarFotoCir('antes',revisar);
  frm.onsubmit=async e=>{e.preventDefault();revisar();if($('#cGuardarE').disabled)return;const fd=new FormData(frm);const c=CORRECCIONES_ERR.find(x=>x.id===fd.get('cc'));
    const j=S.jornada;const a=F.cir.antes;
    try{await dbPut('fotos',{id:a.id,registro_id:null,buf:a.buf,type:'image/jpeg'});
      const dg={id:uid(),tipo:'diagnostico',origen:'correccion',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
        evaluador:SES.nombre,usuario:SES.u,autor_rol:'erradicador',n1_codigo:c.n1_codigo,n1:c.n1,n2:c.n2,n3:c.n3,estado:c.estado,accion:'',problemas:c.n1_codigo&&c.n1_codigo!=='SN'?[c.n1_codigo]:[],sintomas:[],
        corrige_id:o?o.diag_id:null,corrige_texto:o?o.diagnostico:'',corrige_evaluador:o?o.censador:'',corrige_fecha:o?o.fecha_censo:'',
        observaciones:(fd.get('obs')||'').trim(),fotos:[a.id],creado:new Date().toISOString(),fecha:ahoraLocal(),...gpsCampos(palma)};
      await guardarRegCir(dg);if(o&&c.id!=='crater'){o.estado='corregida';o.registro=dg.id;}await dbPut('jornadas',j);}
    catch(err){alert('Error al guardar: '+err.message);return;}
    liberarUrls();F=null;toast(`✅ Corrección guardada: ${c.t}. Queda la versión del censador y la suya.`,4000);cerrarHoja();dibujarRutaErr(false);estadoSync();setTimeout(()=>anunciarSigErr(false),1500);};
}

/* ---------- Panel y fin de la jornada ---------- */
function panelErr(){
  const j=S.jornada;if(!esErr())return;const os=ordenesErr();
  const regs=S.registros.filter(r=>r.jornada_id===j.id);const errs=regs.filter(r=>r.tipo==='erradicacion'),corr=regs.filter(r=>r.tipo==='diagnostico'&&r.origen==='correccion'),nuevos=regs.filter(r=>r.tipo==='diagnostico'&&r.origen==='caso_nuevo'),marcas=regs.filter(r=>r.tipo==='marca');
  abrirHoja('Jornada de erradicación',`
    <div class="stats">
      <div class="stat"><b>${hhmm(j.inicio)}</b><span>Hora de inicio</span></div>
      <div class="stat"><b>${fmtDur(Date.now()-Date.parse(j.inicio)).slice(0,5)}</b><span>Duración</span></div>
      <div class="stat"><b>${(j.km||0).toFixed(2)}</b><span>Km recorridos</span></div>
      <div class="stat"><b>${puedeRegistrarErr()?num(errs.length):num(marcas.length)}</b><span>${puedeRegistrarErr()?'Erradicadas':'Palmas marcadas'}</span></div>
      <div class="stat"><b>${num(corr.length)}</b><span>Correcciones</span></div>
      <div class="stat"><b>${num(nuevos.length)}</b><span>Casos nuevos</span></div>
    </div>
    <p class="tenue">${j.rol==='erradicador'?'Erradicador':'Auxiliar'} · equipo: ${esc(nomBonito(j.equipo.erradicador.nombre))}${j.equipo.auxiliar?' + '+esc(nomBonito(j.equipo.auxiliar.nombre)):' (solo)'}${j.equipo_n?' · equipo '+j.equipo_n+' de la programación':''}</p>
    <h3>Ruta del día (${os.filter(o=>o.estado!=='pendiente').length}/${os.length})</h3>
    ${os.length?os.map(o=>`<button class="fila-palma btn ancho" data-pid="${esc(o.palma_id)}" style="justify-content:space-between;text-align:left"><span><b>${o.orden}.</b> ${esc(etqOrden(o))}<br><span class="tenue" style="font-size:12px">${esc((TIPOS_ERR[o.tipo]||{}).t||o.tipo)}</span></span><span class="venceChip ${o.estado==='pendiente'?claseVence(o.vence):'ok'}">${o.estado==='pendiente'?esc(textoVence(o.vence)):o.estado==='erradicada'?'Erradicada':'Corregida'}</span></button>`).join(''):'<p class="tenue">Sin programación para hoy.</p>'}
    <button class="btn ancho" id="eVer">${IC.play} Ver recorrido hasta ahora</button>
    <button class="btn peligro ancho mantener" id="eFin" style="margin-top:14px;flex-direction:column">${IC.stop} FINALIZAR JORNADA DE ERRADICACIÓN<small class="subMant">Mantenga presionado 2 segundos</small></button>`);
  [...document.querySelectorAll('#hojaCuerpo .fila-palma')].forEach(b=>b.onclick=()=>{const o=ordenErrDe(b.dataset.pid);if(o&&o.lat!=null)mapa.setView([o.lat,o.lng],19);abrirPalmaErr(b.dataset.pid);});
  $('#eVer').onclick=()=>abrirPlay(j.id);botonMantener($('#eFin'),finalizarErr);
}
async function finalizarErr(){
  const j=S.jornada;if(!esErr())return;const pend=ordenesErr().filter(o=>o.estado==='pendiente').length;
  if(!confirm(`¿Finalizar la jornada de erradicación?${pend?`\n\nQuedan ${pend} palma(s) programadas sin atender: pasarán a la programación del siguiente día hábil.`:''}\nSe detendrá el registro del recorrido.`))return;
  j.fin=new Date().toISOString();j.estado='finalizada';j.sync='pendiente';j.cierre={modo:'boton',usuario:SES?SES.u:'',fecha:j.fin};
  const regs=S.registros.filter(r=>r.jornada_id===j.id);const pts=await puntosTrack(j.id);
  j.paradas=detectarParadas(pts,j.paradaRadio,j.paradaMin,regs);j.resumen_paradas=resumenParadas(j.paradas,j);
  j.visita={};j.secuencias=[];j.tiempos={};
  await dbPut('jornadas',j);
  S.jornada=null;S.cfg.jornadaActiva=null;await guardarCfg();VIS=null;ERRA.capa.clearLayers();
  S.palmas=null;S.hechos.clear();indexar();dibujarPalmas();capaTrack.clearLayers();TRACK.linea=null;TRACK.pts=[];PAR.lista=[];capaParadas.clearLayers();
  if(VOZ.activa)alternarVoz();pantallaEncendida(false);gpsFondo(false);actualizarJornadaUI();actualizarErrUI();dibujarLotes();
  hablar(MSJ_FIN,true);try{avisoJornada(false);}catch(e){}
  const errs=regs.filter(r=>r.tipo==='erradicacion');
  abrirHoja('Jornada de erradicación finalizada',`
    <div class="stats">
      <div class="stat"><b>${hhmm(j.inicio)}</b><span>Hora de inicio</span></div><div class="stat"><b>${hhmm(j.fin)}</b><span>Hora de fin</span></div>
      <div class="stat"><b>${(j.km||0).toFixed(2)}</b><span>Km</span></div><div class="stat"><b>${num(errs.length)}</b><span>Erradicadas</span></div>
      <div class="stat"><b>${num(errs.filter(r=>r.metodo==='Química').length)}</b><span>Químicas</span></div><div class="stat"><b>${num(regs.filter(r=>r.origen==='correccion').length)}</b><span>Correcciones</span></div>
    </div>
    <p class="tenue">Las palmas erradicadas (PC cráter y espontáneas) quedan pendientes de aprobación del analista de datos para pasar a existencia 0. La jornada se sincronizará en cuanto haya conexión.</p>
    <button class="btn prim ancho" id="fPlay">${IC.play} Ver el recorrido del día</button><button class="btn ancho" id="fSync">${IC.sync} Sincronizar ahora</button>`);
  $('#fPlay').onclick=()=>abrirPlay(j.id);$('#fSync').onclick=()=>sincronizar(true);programarSync(1000);
}
/* GeoJSON de la jornada de erradicación: erradicaciones, correcciones, casos nuevos, marcas, recorrido y paradas. */
function geoErradicacion(j,regs,pts,ahora,archivoFotos){
  const g=geoCirugia(j,regs,pts,ahora,archivoFotos);const errs=regs.filter(r=>r.tipo==='erradicacion');
  g.name='erradicacion_'+j.id;
  g.jornada={id:j.id,labor:'erradicacion',rol:j.rol,equipo:j.equipo,equipo_n:j.equipo_n,programacion:j.programacion,evaluador:j.evaluador,usuario:j.usuario,dispositivo:j.dispositivo,fecha:fechaLocal(j.inicio),
    hora_inicio:hhmm(j.inicio),hora_fin:hhmm(j.fin),inicio:j.inicio,fin:j.fin,km:+(j.km||0).toFixed(3),...(j.resumen_paradas||{}),
    ordenes:(j.ordenes||[]).map(o=>({id:o.id,orden:o.orden,palma_id:o.palma_id,lote:o.lote,linea:o.linea,palma:o.palma,tipo:o.tipo,diagnostico:o.diagnostico,vence:o.vence,estado:o.estado,registro:o.registro||null})),
    erradicaciones:errs.length,quimicas:errs.filter(r=>r.metodo==='Química').length,correcciones:regs.filter(r=>r.origen==='correccion').length,casos_nuevos:regs.filter(r=>r.tipo==='diagnostico'&&r.origen==='caso_nuevo').length,
    marcas:regs.filter(r=>r.tipo==='marca').length,fotos:new Set(regs.flatMap(r=>r.fotos||[])).size,archivo_fotos:archivoFotos||null,app:'Sanidad Vegetal '+VERSION,sincronizado:ahora};
  return g;
}
/* El botón INICIAR: panel de la labor en curso o elección de labor. */
$('#btJornada').onclick=()=>{if(PLAY.on)return;if(S.jornada){if(esErr())panelErr();else if(esCir())panelCirugia();else panelJornada();}else{const m=motivoNoIniciar();if(m){avisarFueraPlantacion(m);return;}elegirLabor();}};
