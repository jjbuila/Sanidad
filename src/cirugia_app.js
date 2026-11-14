/* =====================================================================
   MÓDULO DE CIRUGÍA (App de campo)
   Cirujano y auxiliar, cada uno con su celular. La pareja recibe la programación del día (ruta optimizada desde la
   oficina central), opera las palmas con PC inicial, avanzada o reincidente, puede corregir diagnósticos mal hechos
   (queda la versión del censador y la del cirujano) y reportar casos nuevos. Fotos de antes y después obligatorias,
   solo con la cámara. Se sincroniza en cirugia/jornadas/AAAA-MM-DD/<jornada>.geojson.
   ===================================================================== */
const CIRA={capa:L.layerGroup().addTo(mapa),linea:null,usuarios:null,prog:null,ultDistVoz:0,radio:50};
const esCir=()=>!!(S.jornada&&S.jornada.labor==='cirugia');
/* Labores disponibles en la App. El administrador entra a todos los módulos, sin importar su rol o sus labores. */
const LABORES_TODAS=['censo','cirugia'];
const laboresSES=()=>{if(!SES)return ['censo'];if(SES.rol==='admin')return LABORES_TODAS;
  if(SES.labores&&SES.labores.length)return SES.labores;return SES.rol==='supervisor'?LABORES_TODAS:['censo'];};
const nomBonito=n=>String(n||'').toLowerCase().replace(/(^|[\s-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
const etqOrden=o=>`${o.lote} · L${o.linea??'?'} · P${o.palma??'?'}`;

(function montarCirugiaApp(){
  const css=document.createElement('style');css.textContent=`
  #pc{border-radius:16px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:6px}
  #pc .pc-sup{display:flex;justify-content:space-between;align-items:center;gap:8px;font-family:var(--t);font-weight:700;letter-spacing:.5px}
  #pc .pc-sup .eti{font-size:12px;letter-spacing:1.4px;color:var(--naranja)}
  #pc .pc-pal{font-family:var(--t);font-weight:700;font-size:21px;line-height:1.1}
  #pc .pc-sub{font-size:12.5px;color:var(--tenue)}
  #pc .pc-bt{display:flex;gap:8px}
  #pc .pc-bt .btn{flex:1;padding:10px 8px;font-size:14px;margin:0}
  .venceChip{border-radius:999px;padding:3px 9px;font-size:11.5px;font-weight:700;white-space:nowrap}
  .venceChip.v{background:rgba(255,93,93,.15);color:#ff8a80;border:1px solid #ff5d5d}
  .venceChip.h{background:rgba(255,197,61,.12);color:var(--ambar);border:1px solid rgba(255,197,61,.6)}
  .venceChip.ok{background:rgba(34,211,154,.12);color:var(--acento);border:1px solid rgba(34,211,154,.5)}
  .cir-mk{background:none;border:0}
  .cir-mk b{display:grid;place-items:center;border-radius:50%;color:#fff;font:700 11.5px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.55)}
  .seg2{display:flex;background:rgba(255,255,255,.06);border-radius:12px;padding:3px;gap:3px;margin:4px 0 8px}
  .seg2 label{flex:1}.seg2 input{position:absolute;opacity:0}.seg2 span{display:block;text-align:center;padding:9px;border-radius:9px;font-weight:600}
  .seg2 input:checked+span{background:var(--acento);color:#032a1d}
  .fotoSlot{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .fotoSlot .sl{display:flex;flex-direction:column;gap:5px}
  .fotoSlot button.cam{height:120px;border-radius:12px;border:2px dashed var(--celeste);background:rgba(144,205,241,.06);color:var(--celeste);font-weight:600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
  .fotoSlot img{height:120px;width:100%;object-fit:cover;border-radius:12px;border:2px solid var(--acento)}
  .histC{border-left:2px solid var(--borde);margin:6px 0 0 6px;padding-left:12px;display:grid;gap:8px;font-size:13px}
  .histC .v{position:relative}.histC .v::before{content:'';position:absolute;left:-18px;top:4px;width:10px;height:10px;border-radius:50%;background:#5c6b64}
  .histC .v.vig::before{background:var(--acento)}.histC .v.vieja b{text-decoration:line-through;color:var(--tenue)}`;
  document.head.appendChild(css);
  const pc=document.createElement('div');pc.id='pc';pc.className='glass';pc.hidden=true;$('#pj').after(pc);
  pc.onclick=e=>{if(e.target.closest('button'))return;panelCirugia();};
})();

/* ---------- Usuarios (para elegir la pareja) ---------- */
async function usuariosCir(){
  if(CIRA.usuarios)return CIRA.usuarios;const out=[];
  for(const x of ACCESO.usuarios){try{const m=JSON.parse(DEC.decode(await desObj(SES.dk,x.meta)));if((m.labores||[]).includes('cirugia'))out.push({u:x.u,nombre:m.nombre,rol_cirugia:m.rol_cirugia||'auxiliar',cargo:m.cargo||''});}catch(e){}}
  CIRA.usuarios=out.sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));return CIRA.usuarios;
}

/* ---------- Elección de labor al tocar INICIAR ---------- */
function elegirLabor(){
  const L=laboresSES();
  if(!L.includes('cirugia'))return abrirPlanificador('nueva');
  if(!L.includes('censo'))return abrirInicioCirugia();
  abrirHoja('¿Qué labor hará hoy?',`
    <button class="btn ancho grande" id="lbCenso">${IC.play} CENSO DE ENFERMEDADES</button>
    <button class="btn prim ancho grande" id="lbCir">✚ CIRUGÍA</button>
    <p class="tenue" style="font-size:12.5px">Solo aparecen las labores habilitadas para su usuario.</p>`);
  $('#lbCenso').onclick=()=>{cerrarHoja();abrirPlanificador('nueva');};
  $('#lbCir').onclick=()=>abrirInicioCirugia();
}
async function programacionDe(fecha){
  const clave='cir_prog_'+fecha;
  try{const r=await ghRaw(`cirugia/programacion/${fecha}.json`);const p=await r.json();await dbPut('config',{clave,v:p});return {p,origen:'red'};}
  catch(e){const c=await dbGet('config',clave);if(c&&c.v)return {p:c.v,origen:'local'};if(e.status===404)return {p:null,origen:'red'};return {p:null,origen:'error',error:e.message};}
}
async function abrirInicioCirugia(){
  if(S.jornada){toast('Ya hay una jornada en curso.');return;}
  const us=await usuariosCir();const yo=us.find(u=>u.u===SES.u)||{rol_cirugia:SES.rol==='operario'?'auxiliar':'cirujano'};
  const puedeCir=yo.rol_cirugia==='cirujano'||SES.rol!=='operario';
  const hoy=fechaISO(new Date());
  abrirHoja('Jornada de cirugía',`
    <div class="banda-form" style="--bf:#1b6e52"><span>1</span><b>MI ROL HOY</b></div>
    <div class="seg2" role="radiogroup" aria-label="Rol">
      <label><input type="radio" name="cRol" value="cirujano" ${puedeCir?'checked':'disabled'}><span>Cirujano</span></label>
      <label><input type="radio" name="cRol" value="auxiliar" ${puedeCir?'':'checked'}><span>Auxiliar</span></label>
    </div>
    ${puedeCir?'':'<p class="tenue" style="font-size:12.5px">Su usuario participa en cirugía como auxiliar.</p>'}
    <div class="banda-form" style="--bf:#7a5a12"><span>2</span><b id="cParTit">MI PAREJA</b></div>
    <label class="campo" for="cPar">Persona con la que trabaja hoy</label>
    <select id="cPar" class="ancho" style="width:100%;padding:12px;border-radius:12px;background:#0a1d16;color:var(--texto);border:1px solid var(--borde)"></select>
    <p class="tenue" style="font-size:12.5px">Su pareja debe elegirlo a usted en su propio celular.</p>
    <div class="banda-form" style="--bf:#1e5a86"><span>3</span><b>PROGRAMACIÓN DE HOY</b></div>
    <div id="cProg" class="ficha">Consultando la programación del ${esc(fechaCorta(hoy))}…</div>
    <button class="btn prim ancho grande" id="cIni" style="margin-top:14px">${IC.play} INICIAR JORNADA DE CIRUGÍA</button>`);
  const pintarPar=()=>{const rol=(document.querySelector('input[name=cRol]:checked')||{}).value;
    $('#cParTit').textContent=rol==='cirujano'?'MI AUXILIAR':'MI CIRUJANO';
    const ops=us.filter(u=>u.u!==SES.u&&(rol==='cirujano'?true:u.rol_cirugia==='cirujano'));
    const ult=S.cfg.cirPareja||'';
    $('#cPar').innerHTML='<option value="">Seleccione…</option>'+ops.map(u=>`<option value="${esc(u.u)}" ${u.u===ult?'selected':''}>${esc(nomBonito(u.nombre))} · ${u.rol_cirugia==='cirujano'?'cirujano':'aux. fumigación'}</option>`).join('');
    buscarRuta();};
  const {p,origen,error}=await programacionDe(hoy);CIRA.prog=p;
  const buscarRuta=()=>{const rol=(document.querySelector('input[name=cRol]:checked')||{}).value,par=$('#cPar').value;
    const cir=rol==='cirujano'?SES.u:par;const pr=p&&p.parejas.find(x=>x.cirujano.u===cir||(rol==='auxiliar'&&x.auxiliar.u===SES.u));
    const el=$('#cProg');
    if(!p)el.innerHTML=origen==='error'?`⚠ No se pudo consultar la programación (${esc(error)}). Puede iniciar y reportar casos nuevos.`:'No hay programación de cirugías para hoy. Puede iniciar y reportar casos nuevos de PC.';
    else if(!pr)el.innerHTML='Su pareja no aparece en la programación de hoy. Revise que haya elegido bien a su pareja o consulte al coordinador.';
    else el.innerHTML=`<b>Pareja ${pr.n}:</b> ${pr.ordenes.length} palmas · ${pr.km_campo??pr.km??'—'} km en campo${pr.min_campo?' · ~'+pr.min_campo+' min caminando':''}<br><span class="tenue">${esc(nomBonito(pr.cirujano.nombre))} (cirujano)${pr.auxiliar.nombre?' · '+esc(nomBonito(pr.auxiliar.nombre))+' (auxiliar)':''}${origen==='local'?' · guardada en el celular':''}</span>`;
    CIRA.parejaProg=pr||null;};
  document.querySelectorAll('input[name=cRol]').forEach(i=>i.onchange=pintarPar);$('#cPar').onchange=buscarRuta;pintarPar();
  $('#cIni').onclick=async()=>{const rol=(document.querySelector('input[name=cRol]:checked')||{}).value;const par=$('#cPar').value;
    if(!par){alert(rol==='cirujano'?'Seleccione a su auxiliar.':'Seleccione a su cirujano.');return;}
    const pu=us.find(u=>u.u===par);S.cfg.cirPareja=par;await guardarCfg();
    const yoN={u:SES.u,nombre:SES.nombre},otro={u:par,nombre:pu?pu.nombre:par};
    await iniciarCirugia(rol,rol==='cirujano'?{cirujano:yoN,auxiliar:otro}:{cirujano:otro,auxiliar:yoN},CIRA.parejaProg,hoy);};
}

/* ---------- Jornada de cirugía ---------- */
async function iniciarCirugia(rol,pareja,pr,fecha){
  {const m=motivoNoIniciar();if(m){avisarFueraPlantacion(m);return;}}
  const ordenes=pr?pr.ordenes.map(o=>({...o,estado:'pendiente'})):[];
  const lotes=[...new Set(ordenes.map(o=>o.lote).filter(Boolean))];
  const j={id:idJornada(),labor:'cirugia',rol,pareja,programacion:fecha,pareja_n:pr?pr.n:null,ruta:pr?pr.ruta:[],ordenes,
    inicio:new Date().toISOString(),fin:null,evaluador:SES.nombre,usuario:SES.u,dispositivo:S.cfg.dispositivo,seleccion:lotes.map(l=>({lote:l,desde:null,hasta:null})),
    estado:'activa',km:0,sync:'pendiente',version_app:VERSION,carto_version:CARTO.version,paradaRadio:Number(S.cfg.paradaRadio)||20,paradaMin:Number(S.cfg.paradaMin)||5};
  await dbPut('jornadas',j);S.jornada=j;S.cfg.jornadaActiva=j.id;S.cfg.evaluador=SES.nombre;await guardarCfg();
  TRACK.ultimo=null;TRACK.n=0;TRACK.pts=[];prepararTrack([]);VIS=null;PAR.lista=[];capaParadas.clearLayers();
  cerrarHoja();await cargarPalmasJornada();iniciarGPS();pantallaEncendida(true);actualizarJornadaUI();dibujarRutaCir(true);
  if(S.cfg.seguir!==false){S.seguir=true;pintarSeguir();S.pausaSeguir=Date.now()+12000;}
  setTimeout(()=>revisarSegundoPlano(false),2500);
  hablar(MSJ_INICIO,true);
  toast(ordenes.length?`▶ Cirugía iniciada: ${ordenes.length} palmas en su ruta.`:'▶ Cirugía iniciada sin programación: puede reportar casos nuevos.',4500);
  setTimeout(()=>anunciarSiguiente(true),9000);
  try{avisoJornada(true);}catch(e){}
}
async function restaurarCirugia(j){
  S.jornada=j;const pts=await puntosTrack(j.id);TRACK.ultimo=pts[pts.length-1]||null;TRACK.n=pts.length;TRACK.pts=pts;prepararTrack(pts.map(p=>[p.lat,p.lng]));VIS=null;
  await cargarPalmasJornada();pantallaEncendida(true);dibujarRutaCir(false);toast('Jornada de cirugía recuperada. El recorrido continúa.',4000);
}
const ordenesCir=()=>S.jornada&&S.jornada.ordenes||[];
const siguienteOrden=()=>ordenesCir().find(o=>o.estado==='pendiente')||null;
function claseVence(v){const h=fechaISO(new Date());return v<h?'v':v===h?'h':'ok';}
function textoVence(v){const h=fechaISO(new Date());return v<h?'Vencida':v===h?'Vence hoy':'Vence '+fechaCorta(v);}
function dibujarRutaCir(encuadrarRuta){
  CIRA.capa.clearLayers();if(!esCir())return;const j=S.jornada;const sig=siguienteOrden();
  if(j.ruta&&j.ruta.length>1){L.polyline(j.ruta.map(([x,y])=>[y,x]),{renderer:rend,color:'#06140f',weight:7,opacity:.55,interactive:false}).addTo(CIRA.capa);
    L.polyline(j.ruta.map(([x,y])=>[y,x]),{renderer:rend,color:'#22d39a',weight:3.5,opacity:.95,dashArray:'8 6',interactive:false}).addTo(CIRA.capa);}
  for(const o of j.ordenes){if(o.lat==null)continue;const es=o===sig;const col=o.estado==='operada'?'#5c6b64':o.estado==='corregida'?'#c28a10':es?'#ee7633':'#e53935';const t=es?28:22;
    L.marker([o.lat,o.lng],{icon:L.divIcon({className:'cir-mk',iconSize:[t,t],iconAnchor:[t/2,t/2],html:`<b style="width:${t}px;height:${t}px;background:${col};font-size:${es?13:11.5}px">${o.orden}</b>`}),zIndexOffset:es?900:400,keyboard:false})
      .on('click',()=>abrirPalmaCir(o.palma_id)).addTo(CIRA.capa);}
  if(encuadrarRuta){const ll=j.ordenes.filter(o=>o.lat!=null).map(o=>[o.lat,o.lng]);if(ll.length)mapa.fitBounds(L.latLngBounds(ll).pad(.15),{maxZoom:17});}
  actualizarCirUI();
}
function actualizarCirUI(){
  const pc=$('#pc');if(!pc)return;
  if(!esCir()){pc.hidden=true;return;}
  $('#pj').hidden=true;pc.hidden=false;
  const j=S.jornada,os=ordenesCir(),sig=siguienteOrden(),hechas=os.filter(o=>o.estado!=='pendiente').length;
  const d=sig&&S.gps?dist(S.gps.lat,S.gps.lng,sig.lat,sig.lng):null;
  const regsHoy=S.registros.filter(r=>r.jornada_id===j.id&&r.tipo==='cirugia').length;
  pc.innerHTML=`<div class="pc-sup"><span class="eti">${sig?`SIGUIENTE · ${sig.orden} DE ${os.length}`:os.length?'RUTA COMPLETA':'CIRUGÍA · SIN PROGRAMACIÓN'}</span><span class="tenue" style="font-size:13px">${j.rol==='cirujano'?'Cirujano':'Auxiliar'} · ${hechas}/${os.length} · ${regsHoy} cirugía(s)</span></div>
    ${sig?`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><div class="pc-pal">${esc(etqOrden(sig))}</div><div class="pc-sub">${esc(nomBonito(sig.diagnostico))} · censo ${esc(fechaCorta(sig.fecha_censo))}${d!=null?` · a ${d<1000?Math.round(d)+' m':(d/1000).toFixed(1)+' km'}`:''}</div></div><span class="venceChip ${claseVence(sig.vence)}">${esc(textoVence(sig.vence))}</span></div>`
      :`<div class="pc-sub">${os.length?'Todas las palmas programadas están atendidas. Puede reportar casos nuevos o finalizar.':'Toque una palma del mapa para reportar un caso nuevo de PC.'}</div>`}
    <div class="pc-bt">${sig?'<button class="btn prim" id="pcLlegue">LLEGUÉ A LA PALMA</button>':''}<button class="btn" id="pcNuevo">${j.rol==='cirujano'?'Caso nuevo':'Mi ruta'}</button></div>`;
  const ll=$('#pcLlegue');if(ll)ll.onclick=()=>{mapa.setView([sig.lat,sig.lng],19);abrirPalmaCir(sig.palma_id);};
  $('#pcNuevo').onclick=async()=>{if(j.rol!=='cirujano')return panelCirugia();
    const l=S.gps?loteDe(S.gps.lat,S.gps.lng):'';
    if(l&&!j.seleccion.some(s=>s.lote===l)){j.seleccion.push({lote:l,desde:null,hasta:null});await dbPut('jornadas',j);await cargarPalmasJornada();}
    toast(l?`Lote ${l}: toque en el mapa la palma con el caso nuevo de PC (a menos de 50 m).`:'Ubíquese dentro del lote y toque la palma con el caso nuevo de PC.',5000);if(S.gps)mapa.setView([S.gps.lat,S.gps.lng],19);};
}
setInterval(()=>{if(esCir()){actualizarCirUI();vozCercania();}},3000);
function anunciarSiguiente(prio){
  if(!esCir())return;const sig=siguienteOrden();if(!sig){if(ordenesCir().length)hablar('Ruta completa. Todas las palmas programadas están atendidas.',prio);return;}
  const d=S.gps?dist(S.gps.lat,S.gps.lng,sig.lat,sig.lng):null;
  hablar(`Siguiente: lote ${paraVoz(sig.lote)}, línea ${paraVoz(sig.linea)}, palma ${paraVoz(sig.palma)}${d!=null?', a '+(d<1000?Math.round(d/10)*10+' metros':(d/1000).toFixed(1).replace('.',' punto ')+' kilómetros'):''}.`,prio);
}
function vozCercania(){const sig=siguienteOrden();if(!sig||!S.gps)return;const d=dist(S.gps.lat,S.gps.lng,sig.lat,sig.lng);
  if(d<=20&&CIRA.ultCerca!==sig.id){CIRA.ultCerca=sig.id;pitido(880,160);hablar(`Llegó a la palma ${paraVoz(sig.palma)} de la línea ${paraVoz(sig.linea)}.`);}}

/* ---------- Palma en modo cirugía ---------- */
function ordenDe(pid){return ordenesCir().find(o=>String(o.palma_id)===String(pid))||null;}
function regsPalma(pid){return S.registros.filter(r=>String(r.palma_id)===String(pid)).sort((a,b)=>String(a.creado).localeCompare(String(b.creado)));}
function htmlHistC(pid,o){
  const ev=[];if(o)ev.push({t:o.creado||o.fecha_censo,cl:'censo',txt:o.diagnostico,quien:o.censador});
  for(const r of regsPalma(pid)){if(r.tipo==='cirugia')ev.push({t:r.creado,cl:'cirugia',txt:`${r.tipo_cirugia} · ${r.producto}`,quien:r.cirujano_nombre});
    else if(r.tipo==='diagnostico'&&r.origen)ev.push({t:r.creado,cl:r.origen,txt:[r.n1,r.n2].filter(Boolean).join(' · '),quien:r.evaluador});
    else if(!r.tipo&&r.n1)ev.push({t:r.creado,cl:'censo',txt:[r.n1,r.n2].filter(Boolean).join(' · '),quien:r.evaluador});}
  if(!ev.length)return '';
  const ultD=[...ev].reverse().find(e=>e.cl!=='cirugia');
  const et={censo:'Censo',correccion:'Corrección del cirujano',caso_nuevo:'Caso nuevo (cirujano)',cirugia:'Cirugía'};
  return `<h3>Historial del diagnóstico</h3><div class="histC">${ev.map(e=>`<div class="v ${e.cl==='cirugia'||e===ultD?'vig':'vieja'}"><span class="tenue">${et[e.cl]||e.cl} · ${esc(fmtFecha(e.t))}${e===ultD?' · vigente':''}</span><br><b>${esc(e.txt||'')}</b><br><span class="tenue">${esc(nomBonito(e.quien||''))}</span></div>`).join('')}</div>`;
}
function abrirPalmaCir(id,dm){
  const f=S.idx.get(id);const o=ordenDe(id);
  let lat,lng,lote,linea,num;
  if(f){[lng,lat]=f.geometry.coordinates;const p=f.properties;lote=p._lote;linea=p._linea;num=p._num;}else if(o){lat=o.lat;lng=o.lng;lote=o.lote;linea=o.linea;num=o.palma;}else return;
  resaltar(lat,lng);
  const d=dm!=null?dm:(S.gps?dist(S.gps.lat,S.gps.lng,lat,lng):null);const lejos=d!=null&&d>CIRA.radio;
  const j=S.jornada;const cir=j.rol==='cirujano';
  const hecha=o&&o.estado!=='pendiente';
  const marca=S.registros.find(r=>r.jornada_id===j.id&&r.tipo==='marca'&&String(r.palma_id)===String(id));
  abrirHoja(`${lote} · L${linea??'?'} · P${num??'?'}`,`
    <div class="ficha gran"><div><div class="big">${esc(lote)}</div><span class="tenue">LOTE</span></div><div><div class="big">${esc(linea??'—')}</div><span class="tenue">LÍNEA</span></div><div><div class="big">${esc(num??'—')}</div><span class="tenue">PALMA</span></div></div>
    <div class="ficha" style="margin-top:8px">${d!=null?`<div><b>Distancia a usted:</b> ${d.toFixed(1)} m${S.gps?` · GPS ±${Math.round(S.gps.acc)} m`:''}</div>`:'<div class="tenue">Sin lectura GPS en este momento</div>'}
      ${o?`<div><b>Reporte del censo:</b> ${esc(nomBonito(o.diagnostico))} · ${esc(nomBonito(o.seguimiento||''))}</div><div><b>Censador:</b> ${esc(nomBonito(o.censador))} · ${esc(fechaCorta(o.fecha_censo))}</div><div><b>Plazo D+1 hábil:</b> ${esc(fechaCorta(o.vence))} <span class="venceChip ${claseVence(o.vence)}">${esc(textoVence(o.vence))}</span></div>`:'<div class="tenue">Esta palma no está en la programación de hoy.</div>'}
      ${hecha?`<div style="color:var(--acento)"><b>✓ ${o.estado==='operada'?'Operada':'Diagnóstico corregido'} en esta jornada</b></div>`:''}
    </div>
    ${lejos?`<div class="aviso">⚠ Usted está a ${Math.round(d)} m de la palma. Acérquese a menos de ${CIRA.radio} m para registrar.</div>`:''}
    ${cir?(o&&!hecha?`<button class="btn prim ancho grande" id="pCir" ${lejos?'disabled':''}>CONFIRMA PC: HACER CIRUGÍA</button>
        <button class="btn ancho" id="pCorr" ${lejos?'disabled':''} style="border-color:var(--ambar);color:var(--ambar)">El diagnóstico está mal: corregir</button>`
      :!o?`<button class="btn prim ancho grande" id="pNuevo" ${lejos?'disabled':''}>REPORTAR CASO NUEVO DE PC Y OPERAR</button>`:'')
      :(marca?`<div class="ficha" style="color:var(--acento)">✓ Usted marcó esta palma a las ${esc(fmtHora(marca.creado).slice(0,5))}</div>`:`<button class="btn prim ancho grande" id="pMarca" ${lejos?'disabled':''}>MARCAR PALMA (AUXILIAR)</button>`)}
    ${htmlHistC(id,o)}`);
  const b1=$('#pCir');if(b1)b1.onclick=()=>abrirFormCirugia({o,palma:{id,lat,lng,lote,linea,num}});
  const b2=$('#pCorr');if(b2)b2.onclick=()=>abrirCorreccion({o,palma:{id,lat,lng,lote,linea,num}});
  const b3=$('#pNuevo');if(b3)b3.onclick=()=>abrirFormCirugia({o:null,palma:{id,lat,lng,lote,linea,num},nuevo:true});
  const b4=$('#pMarca');if(b4)b4.onclick=()=>marcarPalmaAux({o,palma:{id,lat,lng,lote,linea,num}});
}
{const _abrirPalma=abrirPalma;abrirPalma=function(id,dm){if(esCir())return abrirPalmaCir(id,dm);return _abrirPalma(id,dm);};}
const gpsCampos=pal=>S.gps?{gps_lat:+S.gps.lat.toFixed(7),gps_lng:+S.gps.lng.toFixed(7),gps_acc:Math.round(S.gps.acc*10)/10,dist_gps:Math.round(dist(S.gps.lat,S.gps.lng,pal.lat,pal.lng)*10)/10}:{gps_lat:null,gps_lng:null,gps_acc:null,dist_gps:null};
async function guardarRegCir(r){
  r.sync='pendiente';r.modificado=new Date().toISOString();await dbPut('registros',r);await marcarJornadaPendiente(r.jornada_id);
  const i=S.registros.findIndex(x=>x.id===r.id);if(i>=0)S.registros[i]=r;else S.registros.push(r);recalcUltimo();
}
async function marcarPalmaAux({o,palma}){
  const j=S.jornada;const r={id:uid(),tipo:'marca',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
    rol:'auxiliar',usuario:SES.u,evaluador:SES.nombre,cirujano:j.pareja.cirujano.u,cirujano_nombre:j.pareja.cirujano.nombre,orden_id:o?o.id:null,creado:new Date().toISOString(),fecha:ahoraLocal(),fotos:[],...gpsCampos(palma)};
  await guardarRegCir(r);if(o){o.estado='operada';await dbPut('jornadas',j);}
  pitido(988,120);toast('✓ Palma marcada. Siga con su cirujano a la siguiente palma.',3500);cerrarHoja();dibujarRutaCir(false);setTimeout(()=>anunciarSiguiente(false),1200);
}

/* ---------- Formulario de cirugía ---------- */
const TIPOS_CIR=[['PC INICIAL','PC inicial'],['PC AVANZADA','PC avanzada'],['PC REINCIDENTE','PC reincidente']];
function abrirFormCirugia({o,palma,nuevo}){
  F={fotosNuevas:[],fotosQuitar:[],urls:[],cir:{antes:null,despues:null}};
  const tipo0=o&&TIPOS_CIR.some(t=>t[0]===o.diagnostico)?o.diagnostico:'';
  const chip=(name,val,txt,on)=>`<label class="chip-op"><input type="radio" name="${name}" value="${esc(val)}" ${on?'checked':''}><span>${esc(txt)}</span></label>`;
  abrirHoja(nuevo?'Caso nuevo y cirugía':'Registro de la cirugía',`
    <form id="frmCir" autocomplete="off">
      <div class="ficha"><b>${esc(palma.lote)} · L${esc(palma.linea??'?')} · P${esc(palma.num??'?')}</b><br><span class="tenue">Cirujano: ${esc(nomBonito(S.jornada.pareja.cirujano.nombre))} · Auxiliar: ${esc(nomBonito(S.jornada.pareja.auxiliar.nombre))}</span></div>
      <div class="banda-form" style="--bf:#1b6e52"><span>1</span><b>TIPO DE CIRUGÍA</b></div>
      ${nuevo?'<p class="tenue" style="font-size:12.5px;margin:0 0 6px">El caso nuevo queda registrado como diagnóstico del cirujano.</p>':''}
      <div class="chips">${TIPOS_CIR.map(([v,t])=>chip('tipo',v,t,v===tipo0)).join('')}</div>
      ${o&&tipo0?'<p class="tenue" style="font-size:12px;margin:6px 0 0">Si el tipo no coincide con el censo, se guarda como corrección del diagnóstico.</p>':''}
      <div class="banda-form" style="--bf:#7a5a12"><span>2</span><b>PRODUCTO APLICADO</b></div>
      <div class="seg2"><label><input type="radio" name="ptipo" value="Químico" checked><span>Químico</span></label><label><input type="radio" name="ptipo" value="Biológico"><span>Biológico</span></label></div>
      <div class="chips" id="cProd"></div>
      <div class="banda-form" style="--bf:#1e5a86"><span>3</span><b>FOTOS OBLIGATORIAS (SOLO CÁMARA)</b></div>
      <div class="fotoSlot">
        <div class="sl" id="slAntes"><button type="button" class="cam" data-slot="antes">📷<span>Foto antes</span></button><span class="tenue">Antes · pendiente</span></div>
        <div class="sl" id="slDespues"><button type="button" class="cam" data-slot="despues">📷<span>Foto después</span></button><span class="tenue">Después · pendiente</span></div>
      </div>
      <div class="ficha" id="cDur" style="margin-top:8px">Inicio: al tomar la foto de antes · Fin: al tomar la foto de después</div>
      <label class="campo" style="margin-top:8px">Observación (opcional)</label><textarea name="obs" placeholder="Detalle de la cirugía"></textarea>
      <p id="cFalta" style="color:var(--ambar);font-size:13px;text-align:center"></p>
      <button type="submit" class="btn prim ancho grande" id="cGuardar">💾 GUARDAR CIRUGÍA</button>
    </form>`);
  const frm=$('#frmCir');
  const pintarProd=()=>{const t=(frm.querySelector('input[name=ptipo]:checked')||{}).value;const l=t==='Biológico'?PRODUCTOS_CIR.biologico:PRODUCTOS_CIR.quimico;
    $('#cProd').innerHTML=l.map(p=>chip('prod',p,p,false)).join('');};
  frm.querySelectorAll('input[name=ptipo]').forEach(i=>i.onchange=pintarProd);pintarProd();
  const revisar=()=>{const falta=[];if(!frm.querySelector('input[name=tipo]:checked'))falta.push('tipo de cirugía');if(!frm.querySelector('input[name=prod]:checked'))falta.push('producto');
    if(!F.cir.antes)falta.push('foto de antes');if(!F.cir.despues)falta.push('foto de después');
    $('#cFalta').textContent=falta.length?'Falta: '+falta.join(', '):'';$('#cGuardar').disabled=!!falta.length;
    if(F.cir.antes&&F.cir.despues){const m=Math.max(0,Math.round((F.cir.despues.t-F.cir.antes.t)/60000));$('#cDur').innerHTML=`Inicio ${fmtHora(F.cir.antes.t).slice(0,5)} · Fin ${fmtHora(F.cir.despues.t).slice(0,5)} · <b>Duración: ${m} min</b>`;}
    else if(F.cir.antes)$('#cDur').innerHTML=`Inicio ${fmtHora(F.cir.antes.t).slice(0,5)} · falta la foto de después`;};
  frm.addEventListener('change',revisar);revisar();
  frm.querySelectorAll('button.cam').forEach(b=>b.onclick=()=>tomarFotoCir(b.dataset.slot,revisar));
  frm.onsubmit=async e=>{e.preventDefault();revisar();if($('#cGuardar').disabled)return;
    const fd=new FormData(frm);await guardarCirugia({o,palma,nuevo,tipo:fd.get('tipo'),ptipo:fd.get('ptipo'),prod:fd.get('prod'),obs:(fd.get('obs')||'').trim()});};
}
function tomarFotoCir(slot,alListo){
  if(slot==='despues'&&!F.cir.antes){toast('Primero tome la foto de antes de la cirugía.');return;}
  F.alFoto=(id,blob,buf)=>{const t=Date.now();F.cir[slot]={id,buf,t};F.alFoto=null;
    const url=URL.createObjectURL(blob);F.urls.push(url);
    $('#sl'+(slot==='antes'?'Antes':'Despues')).innerHTML=`<img src="${url}" alt="Foto ${slot}"><span><b>${slot==='antes'?'Antes':'Después'}</b> · ${fmtHora(t).slice(0,5)}</span><button type="button" class="btn" data-slot="${slot}" style="padding:6px;margin:0;font-size:12.5px">Repetir</button>`;
    const rb=$('#sl'+(slot==='antes'?'Antes':'Despues')+' button');rb.onclick=()=>tomarFotoCir(slot,alListo);
    alListo&&alListo();};
  abrirCamara();
}
async function guardarCirugia({o,palma,nuevo,tipo,ptipo,prod,obs}){
  if(SYNC.activo){alert('Se está sincronizando. Intente de nuevo en unos segundos.');return;}
  const j=S.jornada;const a=F.cir.antes,dpu=F.cir.despues;const g=gpsCampos(palma);
  try{
    for(const fo of [a,dpu])await dbPut('fotos',{id:fo.id,registro_id:null,buf:fo.buf,type:'image/jpeg'});
    // corrección o caso nuevo: se registra antes que la cirugía (versión del cirujano)
    if(nuevo||(o&&o.diagnostico!==tipo)){
      const reinc=tipo==='PC REINCIDENTE';
      const dg={id:uid(),tipo:'diagnostico',origen:nuevo?'caso_nuevo':'correccion',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
        evaluador:SES.nombre,usuario:SES.u,autor_rol:'cirujano',n1_codigo:'PC',n1:'PUDRICIÓN DE COGOLLO (PC)',n2:tipo,n3:reinc||(!nuevo)?'SEGUIMIENTO PC':'PC CASO NUEVO',estado:'enferma',problemas:['PC'],sintomas:[],
        corrige_id:o?o.diag_id:null,corrige_texto:o?o.diagnostico:'',corrige_evaluador:o?o.censador:'',corrige_fecha:o?o.fecha_censo:'',
        observaciones:'',fotos:[a.id],creado:new Date(a.t-1000).toISOString(),fecha:ahoraLocal(),...g};
      await guardarRegCir(dg);}
    const r={id:uid(),tipo:'cirugia',origen:nuevo?'caso_nuevo':o?'programada':'no_programada',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
      tipo_cirugia:tipo,producto_tipo:ptipo,producto:prod,foto_antes:a.id,foto_despues:dpu.id,fotos:[a.id,dpu.id],
      hora_foto_antes:new Date(a.t).toISOString(),hora_foto_despues:new Date(dpu.t).toISOString(),duracion_min:Math.max(0,Math.round((dpu.t-a.t)/60000)),
      cirujano:j.pareja.cirujano.u,cirujano_nombre:j.pareja.cirujano.nombre,auxiliar:j.pareja.auxiliar.u,auxiliar_nombre:j.pareja.auxiliar.nombre,
      orden_id:o?o.id:null,programacion:j.programacion,diag_censo:o?o.diagnostico:'',censador:o?o.censador:'',fecha_censo:o?o.fecha_censo:'',vence:o?o.vence:habilMas(fechaISO(new Date())),
      a_tiempo:o?fechaISO(new Date())<=o.vence:true,observaciones:obs,evaluador:SES.nombre,usuario:SES.u,creado:new Date(dpu.t).toISOString(),fecha:ahoraLocal(),...g};
    await guardarRegCir(r);
    if(o){o.estado='operada';o.registro=r.id;}
    else if(nuevo)j.ordenes.push({id:'nuevo-'+r.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea,palma:palma.num,lat:palma.lat,lng:palma.lng,diagnostico:tipo,orden:j.ordenes.length+1,estado:'operada',origen:'caso_nuevo',fecha_censo:fechaISO(new Date()),vence:fechaISO(new Date())});
    await dbPut('jornadas',j);
  }catch(e){alert('Error al guardar: '+e.message);return;}
  liberarUrls();F=null;S.hechos.set(palma.id,{estado:'tratamiento'});repintarPalma(palma.id);
  pitido(988,140);toast(`✅ Cirugía guardada: ${tipo.replace('PC ','PC ')} · ${prod}.`,3500);cerrarHoja();dibujarRutaCir(false);estadoSync();
  setTimeout(()=>anunciarSiguiente(false),1500);
}

/* ---------- Corrección del diagnóstico (sin cirugía) ---------- */
function abrirCorreccion({o,palma}){
  F={fotosNuevas:[],fotosQuitar:[],urls:[],cir:{antes:null}};
  abrirHoja('Corregir diagnóstico',`
    <form id="frmCorr">
      <div class="ficha"><b>${esc(palma.lote)} · L${esc(palma.linea??'?')} · P${esc(palma.num??'?')}</b><br><span class="tenue">Censo: ${esc(o?nomBonito(o.diagnostico):'—')} · ${esc(o?nomBonito(o.censador):'')}</span></div>
      <div class="banda-form" style="--bf:#7a5a12"><span>1</span><b>¿CÓMO ESTÁ REALMENTE LA PALMA?</b></div>
      <div class="chips">${CORRECCIONES_CIR.map(c=>`<label class="chip-op"><input type="radio" name="cc" value="${c.id}"><span>${esc(c.t)}</span></label>`).join('')}</div>
      <div class="aviso">Estas condiciones no llevan cirugía. «Para erradicar» deja la palma lista para la orden de erradicación.</div>
      <div class="banda-form" style="--bf:#1e5a86"><span>2</span><b>FOTO DE EVIDENCIA (OBLIGATORIA)</b></div>
      <div class="fotoSlot" style="grid-template-columns:1fr"><div class="sl" id="slAntes"><button type="button" class="cam" data-slot="antes">📷<span>Tomar foto</span></button></div></div>
      <label class="campo" style="margin-top:8px">Observación</label><textarea name="obs" placeholder="Qué encontró en la palma"></textarea>
      ${htmlHistC(palma.id,o)}
      <p id="cFalta" style="color:var(--ambar);font-size:13px;text-align:center"></p>
      <button type="submit" class="btn ancho grande" id="cGuardar" style="background:var(--ambar);color:#06140f">GUARDAR CORRECCIÓN</button>
    </form>`);
  const frm=$('#frmCorr');
  const revisar=()=>{const falta=[];if(!frm.querySelector('input[name=cc]:checked'))falta.push('estado real');if(!F.cir.antes)falta.push('foto');$('#cFalta').textContent=falta.length?'Falta: '+falta.join(', '):'';$('#cGuardar').disabled=!!falta.length;};
  frm.addEventListener('change',revisar);revisar();
  frm.querySelector('button.cam').onclick=()=>tomarFotoCir('antes',revisar);
  frm.onsubmit=async e=>{e.preventDefault();revisar();if($('#cGuardar').disabled)return;const fd=new FormData(frm);const c=CORRECCIONES_CIR.find(x=>x.id===fd.get('cc'));
    const j=S.jornada;const a=F.cir.antes;
    try{await dbPut('fotos',{id:a.id,registro_id:null,buf:a.buf,type:'image/jpeg'});
      const dg={id:uid(),tipo:'diagnostico',origen:'correccion',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
        evaluador:SES.nombre,usuario:SES.u,autor_rol:j.rol,n1_codigo:c.n1_codigo,n1:c.n1,n2:c.n2,n3:c.n3,estado:c.estado,accion:c.accion||'',problemas:c.n1_codigo&&c.n1_codigo!=='SN'?[c.n1_codigo]:[],sintomas:[],
        corrige_id:o?o.diag_id:null,corrige_texto:o?o.diagnostico:'',corrige_evaluador:o?o.censador:'',corrige_fecha:o?o.fecha_censo:'',
        observaciones:(fd.get('obs')||'').trim(),fotos:[a.id],creado:new Date().toISOString(),fecha:ahoraLocal(),...gpsCampos(palma)};
      await guardarRegCir(dg);if(o){o.estado='corregida';o.registro=dg.id;}await dbPut('jornadas',j);}
    catch(err){alert('Error al guardar: '+err.message);return;}
    liberarUrls();F=null;toast(`✅ Corrección guardada: ${c.t}. Queda la versión del censador y la suya.`,4000);cerrarHoja();dibujarRutaCir(false);estadoSync();setTimeout(()=>anunciarSiguiente(false),1500);};
}

/* ---------- Panel y fin de la jornada de cirugía ---------- */
function panelCirugia(){
  const j=S.jornada;if(!esCir())return;const os=ordenesCir();
  const regs=S.registros.filter(r=>r.jornada_id===j.id);const cirs=regs.filter(r=>r.tipo==='cirugia'),corr=regs.filter(r=>r.tipo==='diagnostico'&&r.origen==='correccion'),nuevos=regs.filter(r=>r.tipo==='diagnostico'&&r.origen==='caso_nuevo'),marcas=regs.filter(r=>r.tipo==='marca');
  abrirHoja('Jornada de cirugía',`
    <div class="stats">
      <div class="stat"><b>${hhmm(j.inicio)}</b><span>Hora de inicio</span></div>
      <div class="stat"><b>${fmtDur(Date.now()-Date.parse(j.inicio)).slice(0,5)}</b><span>Duración</span></div>
      <div class="stat"><b>${(j.km||0).toFixed(2)}</b><span>Km recorridos</span></div>
      <div class="stat"><b>${j.rol==='cirujano'?num(cirs.length):num(marcas.length)}</b><span>${j.rol==='cirujano'?'Cirugías':'Palmas marcadas'}</span></div>
      <div class="stat"><b>${num(corr.length)}</b><span>Correcciones</span></div>
      <div class="stat"><b>${num(nuevos.length)}</b><span>Casos nuevos</span></div>
    </div>
    <p class="tenue">${j.rol==='cirujano'?'Cirujano':'Auxiliar'} · pareja: ${esc(nomBonito(j.pareja.cirujano.nombre))} + ${esc(nomBonito(j.pareja.auxiliar.nombre))}${j.pareja_n?' · pareja '+j.pareja_n+' de la programación':''}</p>
    <h3>Ruta del día (${os.filter(o=>o.estado!=='pendiente').length}/${os.length})</h3>
    ${os.length?os.map(o=>`<button class="fila-palma btn ancho" data-pid="${esc(o.palma_id)}" style="justify-content:space-between;text-align:left"><span><b>${o.orden}.</b> ${esc(etqOrden(o))}<br><span class="tenue" style="font-size:12px">${esc(nomBonito(o.diagnostico))}</span></span><span class="venceChip ${o.estado==='pendiente'?claseVence(o.vence):'ok'}">${o.estado==='pendiente'?esc(textoVence(o.vence)):o.estado==='operada'?'Operada':'Corregida'}</span></button>`).join(''):'<p class="tenue">Sin programación para hoy.</p>'}
    <button class="btn ancho" id="cVer">${IC.play} Ver recorrido hasta ahora</button>
    <button class="btn peligro ancho mantener" id="cFin" style="margin-top:14px;flex-direction:column">${IC.stop} FINALIZAR JORNADA DE CIRUGÍA<small class="subMant">Mantenga presionado 2 segundos</small></button>`);
  [...document.querySelectorAll('#hojaCuerpo .fila-palma')].forEach(b=>b.onclick=()=>{const o=ordenDe(b.dataset.pid);if(o&&o.lat!=null)mapa.setView([o.lat,o.lng],19);abrirPalmaCir(b.dataset.pid);});
  $('#cVer').onclick=()=>abrirPlay(j.id);botonMantener($('#cFin'),finalizarCirugia);
}
async function finalizarCirugia(){
  const j=S.jornada;if(!esCir())return;const pend=ordenesCir().filter(o=>o.estado==='pendiente').length;
  if(!confirm(`¿Finalizar la jornada de cirugía?${pend?`\n\nQuedan ${pend} palma(s) programadas sin atender: pasarán a la programación del siguiente día hábil.`:''}\nSe detendrá el registro del recorrido.`))return;
  j.fin=new Date().toISOString();j.estado='finalizada';j.sync='pendiente';j.cierre={modo:'boton',usuario:SES?SES.u:'',fecha:j.fin};
  const regs=S.registros.filter(r=>r.jornada_id===j.id);const pts=await puntosTrack(j.id);
  j.paradas=detectarParadas(pts,j.paradaRadio,j.paradaMin,regs);j.resumen_paradas=resumenParadas(j.paradas,j);
  j.visita={};j.secuencias=[];j.tiempos={};
  await dbPut('jornadas',j);
  S.jornada=null;S.cfg.jornadaActiva=null;await guardarCfg();VIS=null;CIRA.capa.clearLayers();
  S.palmas=null;S.hechos.clear();indexar();dibujarPalmas();capaTrack.clearLayers();TRACK.linea=null;TRACK.pts=[];PAR.lista=[];capaParadas.clearLayers();
  if(VOZ.activa)alternarVoz();pantallaEncendida(false);gpsFondo(false);actualizarJornadaUI();dibujarLotes();
  hablar(MSJ_FIN,true);try{avisoJornada(false);}catch(e){}
  const cirs=regs.filter(r=>r.tipo==='cirugia');
  abrirHoja('Jornada de cirugía finalizada',`
    <div class="stats">
      <div class="stat"><b>${hhmm(j.inicio)}</b><span>Hora de inicio</span></div><div class="stat"><b>${hhmm(j.fin)}</b><span>Hora de fin</span></div>
      <div class="stat"><b>${(j.km||0).toFixed(2)}</b><span>Km</span></div><div class="stat"><b>${num(cirs.length)}</b><span>Cirugías</span></div>
      <div class="stat"><b>${num(regs.filter(r=>r.origen==='correccion').length)}</b><span>Correcciones</span></div><div class="stat"><b>${num(regs.filter(r=>r.tipo==='marca').length)}</b><span>Palmas marcadas</span></div>
    </div>
    <p class="tenue">La jornada se sincronizará con GitHub en cuanto haya conexión; después quedará bloqueada.</p>
    <button class="btn prim ancho" id="fPlay">${IC.play} Ver el recorrido del día</button><button class="btn ancho" id="fSync">${IC.sync} Sincronizar ahora</button>`);
  $('#fPlay').onclick=()=>abrirPlay(j.id);$('#fSync').onclick=()=>sincronizar(true);programarSync(1000);
}
/* GeoJSON de la jornada de cirugía: cirugías, correcciones, casos nuevos, marcas del auxiliar, recorrido y paradas. */
function geoCirugia(j,regs,pts,ahora,archivoFotos){
  const feats=[];
  for(const r of regs){if(r.lat==null)continue;const sel={...r,sync:'sincronizado',sync_fecha:ahora};let p;
    if(r.tipo==='diagnostico'){p={tipo:'diagnostico',...planos(sel),origen:r.origen,autor_rol:r.autor_rol,usuario:r.usuario,corrige_id:r.corrige_id,corrige_texto:r.corrige_texto,corrige_evaluador:r.corrige_evaluador,corrige_fecha:r.corrige_fecha,accion:r.accion||''};}
    else{p={...sel,fotos:(r.fotos||[]).map(f=>f+'.jpg').join('|'),linea:r.linea,palma:r.numero,dispositivo:S.cfg.dispositivo};delete p.numero;delete p.sync;delete p.buf;}
    feats.push({type:'Feature',geometry:{type:'Point',coordinates:[r.lng,r.lat]},properties:p});}
  if(pts.length)feats.push({type:'Feature',properties:{tipo:'recorrido',jornada_id:j.id,evaluador:j.evaluador,inicio:j.inicio,fin:j.fin,km:+(j.km||0).toFixed(3),n_puntos:pts.length,tiempos:pts.map(p=>new Date(p.t).toISOString()),precision_m:pts.map(p=>p.acc)},
    geometry:pts.length>1?{type:'LineString',coordinates:pts.map(p=>[p.lng,p.lat])}:{type:'Point',coordinates:[pts[0].lng,pts[0].lat]}});
  for(const p of j.paradas||[])feats.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{tipo:'parada',n:p.n,inicio:new Date(p.inicio).toISOString(),fin:new Date(p.fin).toISOString(),duracion_min:p.duracion_min,lote:p.lote}});
  const cirs=regs.filter(r=>r.tipo==='cirugia');
  return {type:'FeatureCollection',name:'cirugia_'+j.id,
    jornada:{id:j.id,labor:'cirugia',rol:j.rol,pareja:j.pareja,pareja_n:j.pareja_n,programacion:j.programacion,evaluador:j.evaluador,usuario:j.usuario,dispositivo:j.dispositivo,fecha:fechaLocal(j.inicio),
      hora_inicio:hhmm(j.inicio),hora_fin:hhmm(j.fin),inicio:j.inicio,fin:j.fin,km:+(j.km||0).toFixed(3),...(j.resumen_paradas||{}),
      ordenes:(j.ordenes||[]).map(o=>({id:o.id,orden:o.orden,palma_id:o.palma_id,lote:o.lote,linea:o.linea,palma:o.palma,diagnostico:o.diagnostico,vence:o.vence,estado:o.estado,registro:o.registro||null})),
      cirugias:cirs.length,correcciones:regs.filter(r=>r.origen==='correccion').length,casos_nuevos:regs.filter(r=>r.tipo==='diagnostico'&&r.origen==='caso_nuevo').length,marcas:regs.filter(r=>r.tipo==='marca').length,
      fotos:new Set(regs.flatMap(r=>r.fotos||[])).size,archivo_fotos:archivoFotos||null,app:'Sanidad Vegetal '+VERSION,sincronizado:ahora},
    features:feats};
}
/* El botón INICIAR elige la labor; el panel superior muestra la ruta de cirugía. */
$('#btJornada').onclick=()=>{if(PLAY.on)return;if(S.jornada){if(esCir())panelCirugia();else panelJornada();}else{const m=motivoNoIniciar();if(m){avisarFueraPlantacion(m);return;}elegirLabor();}};
