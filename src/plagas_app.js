/* =====================================================================
   MÓDULO DE MONITOREO DE PLAGAS (App de campo)
   Muestreo por lote (10×10, 7×7 o 5×5, elegido por lote al iniciar): la App calcula las palmas de la muestra con la cartografía
   y las marca en el mapa. En cada palma: hoja evaluada (9, 17 o 25), una o varias plagas con el número de cada estado
   (LV, Huevo, Nido, PM, PV, Adulto) y si hay daño, foto obligatoria y transitabilidad del lote.
   Se sincroniza en plagas/jornadas/AAAA-MM-DD/<jornada>.geojson.
   ===================================================================== */
LABORES_TODAS.push('plagas');
const PLG={capa:L.layerGroup().addTo(mapa),radio:50,sel:[]};
const esPlg=()=>!!(S.jornada&&S.jornada.labor==='plagas');
const plagaNom=id=>(PLAGAS.find(p=>p.id===id)||{}).n||id;
const txtEstados=x=>ESTADOS_PLAGA.filter(e=>Number(x[e.k])>0).map(e=>`${e.t} ${x[e.k]}`).join(' · ')||'sin individuos';

(function montarPlagasApp(){
  const css=document.createElement('style');css.textContent=`
  #pp{border-radius:16px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:6px}
  #pp .pc-sup{display:flex;justify-content:space-between;align-items:center;gap:8px;font-family:var(--t);font-weight:700;letter-spacing:.5px}
  #pp .pc-sup .eti{font-size:12px;letter-spacing:1.4px;color:#c5e478}
  #pp .pc-pal{font-family:var(--t);font-weight:700;font-size:21px;line-height:1.1}
  #pp .pc-sub{font-size:12.5px;color:var(--tenue)}
  #pp .pc-bt{display:flex;gap:8px}#pp .pc-bt .btn{flex:1;padding:10px 8px;font-size:14px;margin:0}
  .plg-ct{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .plg-ct .c{border:1px solid var(--borde);border-radius:12px;padding:6px;text-align:center}
  .plg-ct .c b{display:block;font-family:var(--t);font-size:22px}
  .plg-ct .c small{display:block;color:var(--tenue);font-size:11.5px;margin-bottom:4px}
  .plg-ct .c .bb{display:flex;gap:6px;justify-content:center}.plg-ct .c .bb button{width:38px;height:34px;border-radius:10px;border:1px solid var(--borde);background:rgba(255,255,255,.06);color:var(--texto);font-size:18px}
  .plg-ent{border:1px solid var(--borde);border-radius:12px;padding:8px 10px;margin:6px 0;font-size:13px}
  .plg-lote{border:1px solid var(--borde);border-radius:12px;padding:8px 10px;margin:6px 0}`;
  document.head.appendChild(css);
  const pp=document.createElement('div');pp.id='pp';pp.className='glass';pp.hidden=true;$('#pj').after(pp);
  pp.onclick=e=>{if(e.target.closest('button'))return;panelPlg();};
})();

/* ---------- Elección de labor (agrega Monitoreo de plagas) ---------- */
{const _elegir2=elegirLabor;elegirLabor=function(){
  const L=laboresSES();if(!L.includes('plagas'))return _elegir2();
  const otras=L.filter(l=>l!=='plagas');if(!otras.length)return abrirInicioPlg();
  abrirHoja('¿Qué labor hará hoy?',`
    ${L.includes('censo')?`<button class="btn ancho grande" id="lbCenso">${IC.play} CENSO DE ENFERMEDADES</button>`:''}
    ${L.includes('cirugia')?'<button class="btn ancho grande" id="lbCir">✚ CIRUGÍA</button>':''}
    ${L.includes('erradicacion')?'<button class="btn ancho grande" id="lbErr">🪓 ERRADICACIÓN</button>':''}
    <button class="btn prim ancho grande" id="lbPlg">🐛 MONITOREO DE PLAGAS</button>
    <p class="tenue" style="font-size:12.5px">Solo aparecen las labores habilitadas para su usuario.</p>`);
  const c=$('#lbCenso');if(c)c.onclick=()=>{cerrarHoja();abrirPlanificador('nueva');};
  const k=$('#lbCir');if(k)k.onclick=()=>abrirInicioCirugia();
  const e=$('#lbErr');if(e)e.onclick=()=>abrirInicioErr();
  $('#lbPlg').onclick=()=>abrirInicioPlg();};}

/* ---------- Inicio: lotes del día y tipo de muestreo por lote ---------- */
async function muestraDe(lote,k){const d=await leerChunk(lote);return muestraLote(d,k,id=>AJ_EXIST.has(id)).map(m=>({...m,lote}));}
function abrirInicioPlg(){
  if(S.jornada){toast('Ya hay una jornada en curso.');return;}
  if(!PLG.sel.length&&S.gps){const l=loteDe(S.gps.lat,S.gps.lng);if(l&&CARTO.lotes[l])PLG.sel=[{lote:l,muestreo:'10x10'}];}
  const lotes=Object.keys(CARTO.lotes||{}).sort(ordenNat);
  abrirHoja('Monitoreo de plagas',`
    <div class="banda-form" style="--bf:#5b6b12"><span>1</span><b>LOTES DE HOY Y TIPO DE MUESTREO</b></div>
    <div style="display:flex;gap:8px"><input id="plgLote" list="plgLotes" placeholder="Escriba el lote (ej. IT05)" autocapitalize="characters" style="flex:1;padding:12px;border-radius:12px;background:#0a1d16;color:var(--texto);border:1px solid var(--borde)">
      <button class="btn" id="plgAg" style="margin:0">Agregar</button></div>
    <datalist id="plgLotes">${lotes.map(l=>`<option value="${esc(l)}">`).join('')}</datalist>
    <div id="plgSel"></div>
    <p class="tenue" style="font-size:12.5px">10 × 10: líneas 1, 11, 21… y en cada una la primera palma viva, luego cada 10 palmas (7 × 7 y 5 × 5 igual con su número). Si la palma que toca está muerta, se toma la siguiente viva.</p>
    <button class="btn prim ancho grande" id="plgIni" style="margin-top:10px">${IC.play} INICIAR MONITOREO</button>`);
  const pintar=async()=>{const c=$('#plgSel');if(!c)return;
    const filas=[];for(const s of PLG.sel){const m=MUESTREOS.find(x=>x.id===s.muestreo)||MUESTREOS[0];const n=(await muestraDe(s.lote,m.k)).length;
      filas.push(`<div class="plg-lote"><div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(s.lote)}</b><span class="tenue" style="font-size:12.5px">${n?num(n)+' palmas en la muestra':'⚠ lote sin numeración de líneas: toque las palmas en el mapa'}</span><button class="btn mini" data-qp="${esc(s.lote)}" style="margin:0">✕</button></div>
        <div class="seg2" style="margin:6px 0 0">${MUESTREOS.map(x=>`<label><input type="radio" name="m_${esc(s.lote)}" value="${x.id}" ${x.id===s.muestreo?'checked':''} data-lm="${esc(s.lote)}"><span>${x.t}</span></label>`).join('')}</div></div>`);}
    c.innerHTML=filas.join('')||'<p class="tenue">Agregue los lotes que va a monitorear hoy.</p>';
    c.querySelectorAll('[data-qp]').forEach(b=>b.onclick=()=>{PLG.sel=PLG.sel.filter(x=>x.lote!==b.dataset.qp);pintar();});
    c.querySelectorAll('[data-lm]').forEach(i=>i.onchange=()=>{const s=PLG.sel.find(x=>x.lote===i.dataset.lm);if(s){s.muestreo=i.value;pintar();}});};
  const agregar=()=>{const l=String($('#plgLote').value||'').trim().toUpperCase();if(!l)return;
    if(!CARTO.lotes[l]){toast('El lote '+l+' no está en la cartografía.');return;}
    if(!PLG.sel.some(x=>x.lote===l))PLG.sel.push({lote:l,muestreo:'10x10'});$('#plgLote').value='';pintar();};
  $('#plgAg').onclick=agregar;$('#plgLote').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();agregar();}};pintar();
  $('#plgIni').onclick=async()=>{if(!PLG.sel.length){alert('Agregue al menos un lote.');return;}await iniciarPlg(PLG.sel.map(x=>({...x})));};
}
async function iniciarPlg(sel){
  {const m=motivoNoIniciar();if(m){avisarFueraPlantacion(m);return;}}
  const muestra=[];for(const s of sel){const m=MUESTREOS.find(x=>x.id===s.muestreo)||MUESTREOS[0];
    (await muestraDe(s.lote,m.k)).forEach((x,i)=>muestra.push({...x,muestreo:s.muestreo,orden:i+1,estado:'pendiente'}));}
  const j={id:idJornada(),labor:'plagas',lotes_muestreo:sel,muestra,inicio:new Date().toISOString(),fin:null,evaluador:SES.nombre,usuario:SES.u,dispositivo:S.cfg.dispositivo,
    seleccion:sel.map(s=>({lote:s.lote,desde:null,hasta:null})),estado:'activa',km:0,sync:'pendiente',version_app:VERSION,carto_version:CARTO.version,paradaRadio:Number(S.cfg.paradaRadio)||20,paradaMin:Number(S.cfg.paradaMin)||5};
  await dbPut('jornadas',j);S.jornada=j;S.cfg.jornadaActiva=j.id;S.cfg.evaluador=SES.nombre;await guardarCfg();
  TRACK.ultimo=null;TRACK.n=0;TRACK.pts=[];prepararTrack([]);VIS=null;PAR.lista=[];capaParadas.clearLayers();
  cerrarHoja();await cargarPalmasJornada();iniciarGPS();pantallaEncendida(true);actualizarJornadaUI();dibujarPlg(true);
  if(S.cfg.seguir!==false){S.seguir=true;pintarSeguir();S.pausaSeguir=Date.now()+12000;}
  setTimeout(()=>revisarSegundoPlano(false),2500);hablar(MSJ_INICIO,true);
  toast(`▶ Monitoreo iniciado: ${muestra.length} palmas en la muestra de ${sel.length} lote(s).`,4500);
  try{avisoJornada(true);}catch(e){}
}
async function restaurarPlg(j){
  S.jornada=j;const pts=await puntosTrack(j.id);TRACK.ultimo=pts[pts.length-1]||null;TRACK.n=pts.length;TRACK.pts=pts;prepararTrack(pts.map(p=>[p.lat,p.lng]));VIS=null;
  await cargarPalmasJornada();pantallaEncendida(true);dibujarPlg(false);toast('Monitoreo de plagas recuperado. El recorrido continúa.',4000);
}
const muestraPlg=()=>S.jornada&&S.jornada.muestra||[];
const sigPlg=()=>{const m=muestraPlg().filter(x=>x.estado==='pendiente');if(!m.length)return null;if(!S.gps)return m[0];
  return m.reduce((b,x)=>dist(S.gps.lat,S.gps.lng,x.lat,x.lng)<dist(S.gps.lat,S.gps.lng,b.lat,b.lng)?x:b,m[0]);};
function dibujarPlg(encuadrar){
  PLG.capa.clearLayers();if(!esPlg())return;const sig=sigPlg();
  for(const m of muestraPlg()){if(m.lat==null)continue;const es=m===sig;const col=m.estado==='pendiente'?'#ffffff':m.dano?'#e53935':'#22d39a';
    L.circleMarker([m.lat,m.lng],{renderer:rend,radius:es?9:6.5,color:es?'#ee7633':'#06140f',weight:es?3:1.5,fillColor:col,fillOpacity:.95}).on('click',()=>abrirPalmaPlg(m.palma_id)).addTo(PLG.capa);}
  if(encuadrar){const ll=muestraPlg().filter(m=>m.lat!=null).map(m=>[m.lat,m.lng]);if(ll.length)mapa.fitBounds(L.latLngBounds(ll).pad(.1),{maxZoom:17});}
  actualizarPlgUI();
}
function actualizarPlgUI(){
  const pp=$('#pp');if(!pp)return;if(!esPlg()){pp.hidden=true;return;}
  $('#pj').hidden=true;for(const id of ['#pc','#pe']){const x=$(id);if(x)x.hidden=true;}pp.hidden=false;
  const m=muestraPlg(),hechas=m.filter(x=>x.estado!=='pendiente').length,sig=sigPlg();
  const d=sig&&S.gps?dist(S.gps.lat,S.gps.lng,sig.lat,sig.lng):null;
  pp.innerHTML=`<div class="pc-sup"><span class="eti">${sig?'SIGUIENTE PALMA DE LA MUESTRA':m.length?'MUESTRA COMPLETA':'MONITOREO DE PLAGAS'}</span><span class="tenue" style="font-size:13px">${hechas}/${m.length} palmas</span></div>
    ${sig?`<div class="pc-pal">${esc(sig.lote)} · L${esc(sig.linea)} · P${esc(sig.palma)}</div><div class="pc-sub">Muestreo ${esc((MUESTREOS.find(x=>x.id===sig.muestreo)||{}).t||sig.muestreo)}${d!=null?` · a ${d<1000?Math.round(d)+' m':(d/1000).toFixed(1)+' km'}`:''}</div>`
      :`<div class="pc-sub">${m.length?'Todas las palmas de la muestra están registradas. Puede finalizar.':'Toque una palma del mapa para registrar el monitoreo.'}</div>`}
    <div class="pc-bt">${sig?'<button class="btn prim" id="ppLlegue">LLEGUÉ A LA PALMA</button>':''}<button class="btn" id="ppAv">Avance</button></div>`;
  const ll=$('#ppLlegue');if(ll)ll.onclick=()=>{mapa.setView([sig.lat,sig.lng],19);abrirPalmaPlg(sig.palma_id);};
  $('#ppAv').onclick=()=>panelPlg();
}
setInterval(()=>{if(esPlg())actualizarPlgUI();},3000);

/* ---------- Palma en modo monitoreo ---------- */
function abrirPalmaPlg(id,dm){
  const f=S.idx.get(id);const m=muestraPlg().find(x=>String(x.palma_id)===String(id));
  let lat,lng,lote,linea,num;
  if(f){[lng,lat]=f.geometry.coordinates;const p=f.properties;lote=p._lote;linea=p._linea;num=p._num;}else if(m){lat=m.lat;lng=m.lng;lote=m.lote;linea=m.linea;num=m.palma;}else return;
  resaltar(lat,lng);
  const d=dm!=null?dm:(S.gps?dist(S.gps.lat,S.gps.lng,lat,lng):null);const lejos=d!=null&&d>PLG.radio;
  const regs=S.registros.filter(r=>r.jornada_id===S.jornada.id&&r.tipo==='monitoreo'&&String(r.palma_id)===String(id));
  const muestreo=m?m.muestreo:((S.jornada.lotes_muestreo||[]).find(x=>x.lote===lote)||{}).muestreo||'10x10';
  abrirHoja(`${lote} · L${linea??'?'} · P${num??'?'}`,`
    <div class="ficha gran"><div><div class="big">${esc(lote)}</div><span class="tenue">LOTE</span></div><div><div class="big">${esc(linea??'—')}</div><span class="tenue">LÍNEA</span></div><div><div class="big">${esc(num??'—')}</div><span class="tenue">PALMA</span></div></div>
    <div class="ficha" style="margin-top:8px">${d!=null?`<div><b>Distancia a usted:</b> ${d.toFixed(1)} m</div>`:'<div class="tenue">Sin lectura GPS en este momento</div>'}
      <div>${m?`<b>Palma de la muestra</b> · muestreo ${esc((MUESTREOS.find(x=>x.id===muestreo)||{}).t||muestreo)}`:'<span class="tenue">Esta palma no está en la muestra.</span>'}</div>
      ${regs.map(r=>`<div style="color:var(--acento)">✓ Registrada a las ${esc(fmtHora(r.creado).slice(0,5))}: ${esc(r.plagas.map(p=>plagaNom(p.plaga)).join(', '))}</div>`).join('')}</div>
    ${lejos?`<div class="aviso">⚠ Usted está a ${Math.round(d)} m de la palma. Acérquese a menos de ${PLG.radio} m para registrar.</div>`:''}
    <button class="btn prim ancho grande" id="ppReg" ${lejos?'disabled':''}>${regs.length?'REGISTRAR DE NUEVO':'REGISTRAR MONITOREO'}</button>`);
  $('#ppReg').onclick=()=>abrirFormPlg({m,palma:{id,lat,lng,lote,linea,num},muestreo});
}
{const _abrirPalma3=abrirPalma;abrirPalma=function(id,dm){if(esPlg())return abrirPalmaPlg(id,dm);return _abrirPalma3(id,dm);};}

/* ---------- Formulario: hoja, plagas con sus estados, daño, foto y transitabilidad ---------- */
function abrirFormPlg({m,palma,muestreo}){
  F={fotosNuevas:[],fotosQuitar:[],urls:[],cir:{antes:null},plg:{lista:[],act:{plaga:'',dano:'',...Object.fromEntries(ESTADOS_PLAGA.map(e=>[e.k,0]))}}};
  const chip=(name,val,txt,on)=>`<label class="chip-op"><input type="radio" name="${name}" value="${esc(val)}" ${on?'checked':''}><span>${esc(txt)}</span></label>`;
  const transPrev=(S.registros.filter(r=>r.jornada_id===S.jornada.id&&r.tipo==='monitoreo'&&r.lote===palma.lote).pop()||{}).transitabilidad||'';
  abrirHoja('Monitoreo de plagas',`
    <form id="frmPlg" autocomplete="off">
      <div class="ficha"><b>${esc(palma.lote)} · L${esc(palma.linea??'?')} · P${esc(palma.num??'?')}</b><br><span class="tenue">Muestreo ${esc((MUESTREOS.find(x=>x.id===muestreo)||{}).t||muestreo)}${m?'':' · fuera de la muestra'}</span></div>
      <div class="banda-form" style="--bf:#5b6b12"><span>1</span><b>HOJA EVALUADA</b></div>
      <div class="chips">${HOJAS_PLAGA.map(h=>chip('hoja',h,'Hoja '+h,false)).join('')}</div>
      <div class="banda-form" style="--bf:#7a5a12"><span>2</span><b>PLAGA</b></div>
      <div id="plgLista"></div>
      <div class="chips" id="plgPlagas">${PLAGAS.map(p=>chip('plaga',p.id,p.n,false)).join('')}</div>
      <div class="banda-form" style="--bf:#1e5a86"><span>3</span><b>ESTADOS (NÚMERO)</b></div>
      <div class="plg-ct">${ESTADOS_PLAGA.map(e=>`<div class="c"><small>${esc(e.t)}${e.t.length<=2?' · '+esc(e.d.toLowerCase()):''}</small><b id="pv_${e.k}">0</b><div class="bb"><button type="button" data-menos="${e.k}" aria-label="Restar ${esc(e.d)}">−</button><button type="button" data-mas="${e.k}" aria-label="Sumar ${esc(e.d)}">+</button></div></div>`).join('')}</div>
      <div class="banda-form" style="--bf:#8a3b12"><span>4</span><b>¿LA PALMA PRESENTA DAÑO?</b></div>
      <div class="seg2"><label><input type="radio" name="dano" value="si"><span>Sí</span></label><label><input type="radio" name="dano" value="no"><span>No</span></label></div>
      <button type="button" class="btn ancho" id="plgOtra" style="margin-top:8px">＋ Agregar otra plaga en esta palma</button>
      <div class="banda-form" style="--bf:#1b6e52"><span>5</span><b>FOTO DE LA MUESTRA (OBLIGATORIA)</b></div>
      <div class="fotoSlot" style="grid-template-columns:1fr"><div class="sl" id="slAntes"><button type="button" class="cam" data-slot="antes">📷<span>Tomar foto</span></button></div></div>
      <div class="banda-form" style="--bf:#3d5248"><span>6</span><b>TRANSITABILIDAD DEL LOTE</b></div>
      <div class="chips">${TRANSITABILIDAD.map(t=>chip('trans',t,t,t===transPrev)).join('')}</div>
      <label class="campo" style="margin-top:8px">Observación (opcional)</label><textarea name="obs" placeholder="Detalle de la muestra"></textarea>
      <p id="plgFalta" style="color:var(--ambar);font-size:13px;text-align:center"></p>
      <button type="submit" class="btn prim ancho grande" id="plgGuardar">💾 GUARDAR PALMA</button>
    </form>`);
  const frm=$('#frmPlg');const P=F.plg;
  const leerAct=()=>{P.act.plaga=(frm.querySelector('input[name=plaga]:checked')||{}).value||'';P.act.dano=(frm.querySelector('input[name=dano]:checked')||{}).value||'';};
  const pintarLista=()=>{$('#plgLista').innerHTML=P.lista.map((x,i)=>`<div class="plg-ent"><b>${esc(plagaNom(x.plaga))}</b> · ${esc(txtEstados(x))} · ${x.dano==='si'?'<span style="color:#ff8a80">con daño</span>':'sin daño'} <button type="button" class="btn mini" data-qe="${i}" style="float:right;margin:0">Quitar</button></div>`).join('');
    $('#plgLista').querySelectorAll('[data-qe]').forEach(b=>b.onclick=()=>{P.lista.splice(+b.dataset.qe,1);pintarLista();revisar();});};
  const pintarCont=()=>{for(const e of ESTADOS_PLAGA)$('#pv_'+e.k).textContent=P.act[e.k];};
  const actCompleta=()=>!!(P.act.plaga&&P.act.dano);
  const revisar=()=>{if(!F||!F.plg||!$('#plgFalta'))return;leerAct();const falta=[];
    if(!frm.querySelector('input[name=hoja]:checked'))falta.push('hoja');
    if(!P.lista.length&&!actCompleta())falta.push(!P.act.plaga?'plaga':'daño');
    else if(P.act.plaga&&!P.act.dano)falta.push('daño de la plaga elegida');
    if(!F.cir.antes)falta.push('foto');if(!frm.querySelector('input[name=trans]:checked'))falta.push('transitabilidad');
    $('#plgFalta').textContent=falta.length?'Falta: '+falta.join(', '):'';$('#plgGuardar').disabled=!!falta.length;$('#plgOtra').disabled=!actCompleta();};
  frm.querySelectorAll('[data-mas]').forEach(b=>b.onclick=()=>{P.act[b.dataset.mas]++;pintarCont();pitido(1100,40);});
  frm.querySelectorAll('[data-menos]').forEach(b=>b.onclick=()=>{P.act[b.dataset.menos]=Math.max(0,P.act[b.dataset.menos]-1);pintarCont();});
  $('#plgOtra').onclick=()=>{leerAct();if(!actCompleta())return;P.lista.push({...P.act});
    P.act={plaga:'',dano:'',...Object.fromEntries(ESTADOS_PLAGA.map(e=>[e.k,0]))};frm.querySelectorAll('input[name=plaga],input[name=dano]').forEach(i=>i.checked=false);
    pintarCont();pintarLista();revisar();toast('Plaga agregada. Elija la siguiente plaga de esta palma.',2500);};
  frm.addEventListener('change',revisar);revisar();
  frm.querySelector('button.cam').onclick=()=>tomarFotoCir('antes',revisar);
  frm.onsubmit=async e=>{e.preventDefault();revisar();if($('#plgGuardar').disabled)return;
    leerAct();const lista=P.lista.slice();if(actCompleta())lista.push({...P.act});
    const fd=new FormData(frm);await guardarPlg({m,palma,muestreo,hoja:Number(fd.get('hoja')),plagas:lista,trans:fd.get('trans'),obs:(fd.get('obs')||'').trim()});};
}
async function guardarPlg({m,palma,muestreo,hoja,plagas,trans,obs}){
  if(SYNC.activo){alert('Se está sincronizando. Intente de nuevo en unos segundos.');return;}
  const j=S.jornada;const a=F.cir.antes;
  try{await dbPut('fotos',{id:a.id,registro_id:null,buf:a.buf,type:'image/jpeg'});
    const pl=plagas.map(x=>({plaga:x.plaga,plaga_nombre:plagaNom(x.plaga),...Object.fromEntries(ESTADOS_PLAGA.map(e=>[e.k,Number(x[e.k])||0])),dano:x.dano==='si'}));
    const r={id:uid(),tipo:'monitoreo',jornada_id:j.id,palma_id:palma.id,lote:palma.lote,linea:palma.linea||'',numero:palma.num||'',lat:palma.lat,lng:palma.lng,
      muestreo,en_muestra:!!m,hoja,plagas:pl,dano:pl.some(x=>x.dano),transitabilidad:trans,observaciones:obs,fotos:[a.id],
      evaluador:SES.nombre,usuario:SES.u,creado:new Date().toISOString(),fecha:ahoraLocal(),...gpsCampos(palma)};
    await guardarRegCir(r);if(m){m.estado='registrada';m.dano=r.dano;m.registro=r.id;}await dbPut('jornadas',j);}
  catch(e){alert('Error al guardar: '+e.message);return;}
  liberarUrls();F=null;pitido(988,140);toast(`✅ Palma guardada: ${plagas.map(x=>plagaNom(x.plaga)).join(', ')}.`,3500);cerrarHoja();dibujarPlg(false);estadoSync();
}

/* ---------- Panel y fin de la jornada ---------- */
function panelPlg(){
  const j=S.jornada;if(!esPlg())return;const m=muestraPlg();const regs=S.registros.filter(r=>r.jornada_id===j.id&&r.tipo==='monitoreo');
  const por=(j.lotes_muestreo||[]).map(s=>{const ms=m.filter(x=>x.lote===s.lote);return {...s,n:ms.length,h:ms.filter(x=>x.estado!=='pendiente').length,d:ms.filter(x=>x.dano).length};});
  abrirHoja('Monitoreo de plagas',`
    <div class="stats">
      <div class="stat"><b>${hhmm(j.inicio)}</b><span>Hora de inicio</span></div>
      <div class="stat"><b>${fmtDur(Date.now()-Date.parse(j.inicio)).slice(0,5)}</b><span>Duración</span></div>
      <div class="stat"><b>${(j.km||0).toFixed(2)}</b><span>Km recorridos</span></div>
      <div class="stat"><b>${num(regs.length)}</b><span>Palmas registradas</span></div>
      <div class="stat"><b>${num(regs.filter(r=>r.dano).length)}</b><span>Con daño</span></div>
      <div class="stat"><b>${num(m.filter(x=>x.estado==='pendiente').length)}</b><span>Pendientes de la muestra</span></div>
    </div>
    <h3>Avance por lote</h3>${por.map(x=>`<div class="plg-lote"><b>${esc(x.lote)}</b> · muestreo ${esc((MUESTREOS.find(y=>y.id===x.muestreo)||{}).t||x.muestreo)}<br><span class="tenue">${x.h} de ${x.n} palmas · ${x.d} con daño</span></div>`).join('')}
    <button class="btn ancho" id="ppVer">${IC.play} Ver recorrido hasta ahora</button>
    <button class="btn peligro ancho mantener" id="ppFin" style="margin-top:14px;flex-direction:column">${IC.stop} FINALIZAR MONITOREO<small class="subMant">Mantenga presionado 2 segundos</small></button>`);
  $('#ppVer').onclick=()=>abrirPlay(j.id);botonMantener($('#ppFin'),finalizarPlg);
}
async function finalizarPlg(){
  const j=S.jornada;if(!esPlg())return;const pend=muestraPlg().filter(x=>x.estado==='pendiente').length;
  if(!confirm(`¿Finalizar el monitoreo de plagas?${pend?`\n\nQuedan ${pend} palma(s) de la muestra sin registrar.`:''}\nSe detendrá el registro del recorrido.`))return;
  j.fin=new Date().toISOString();j.estado='finalizada';j.sync='pendiente';j.cierre={modo:'boton',usuario:SES?SES.u:'',fecha:j.fin};
  const regs=S.registros.filter(r=>r.jornada_id===j.id);const pts=await puntosTrack(j.id);
  j.paradas=detectarParadas(pts,j.paradaRadio,j.paradaMin,regs);j.resumen_paradas=resumenParadas(j.paradas,j);j.visita={};j.secuencias=[];j.tiempos={};
  await dbPut('jornadas',j);
  S.jornada=null;S.cfg.jornadaActiva=null;await guardarCfg();VIS=null;PLG.capa.clearLayers();
  S.palmas=null;S.hechos.clear();indexar();dibujarPalmas();capaTrack.clearLayers();TRACK.linea=null;TRACK.pts=[];PAR.lista=[];capaParadas.clearLayers();
  if(VOZ.activa)alternarVoz();pantallaEncendida(false);gpsFondo(false);actualizarJornadaUI();actualizarPlgUI();dibujarLotes();
  hablar(MSJ_FIN,true);try{avisoJornada(false);}catch(e){}
  const ms=regs.filter(r=>r.tipo==='monitoreo');
  abrirHoja('Monitoreo de plagas finalizado',`
    <div class="stats"><div class="stat"><b>${hhmm(j.inicio)}</b><span>Hora de inicio</span></div><div class="stat"><b>${hhmm(j.fin)}</b><span>Hora de fin</span></div>
      <div class="stat"><b>${(j.km||0).toFixed(2)}</b><span>Km</span></div><div class="stat"><b>${num(ms.length)}</b><span>Palmas registradas</span></div>
      <div class="stat"><b>${num(ms.filter(r=>r.dano).length)}</b><span>Con daño</span></div><div class="stat"><b>${num(pend)}</b><span>Sin registrar</span></div></div>
    <p class="tenue">La jornada se sincronizará con GitHub en cuanto haya conexión; después quedará bloqueada.</p>
    <button class="btn prim ancho" id="fPlay">${IC.play} Ver el recorrido del día</button><button class="btn ancho" id="fSync">${IC.sync} Sincronizar ahora</button>`);
  $('#fPlay').onclick=()=>abrirPlay(j.id);$('#fSync').onclick=()=>sincronizar(true);programarSync(1000);
}
/* GeoJSON de la jornada de monitoreo: palmas registradas (con sus plagas), recorrido y paradas. */
function geoPlagas(j,regs,pts,ahora,archivoFotos){
  const g=geoCirugia(j,regs,pts,ahora,archivoFotos);const ms=regs.filter(r=>r.tipo==='monitoreo');
  g.name='plagas_'+j.id;
  g.jornada={id:j.id,labor:'plagas',evaluador:j.evaluador,usuario:j.usuario,dispositivo:j.dispositivo,fecha:fechaLocal(j.inicio),hora_inicio:hhmm(j.inicio),hora_fin:hhmm(j.fin),inicio:j.inicio,fin:j.fin,
    km:+(j.km||0).toFixed(3),...(j.resumen_paradas||{}),lotes_muestreo:j.lotes_muestreo,
    muestra:(j.muestra||[]).map(m=>({palma_id:m.palma_id,lote:m.lote,linea:m.linea,palma:m.palma,muestreo:m.muestreo,estado:m.estado,registro:m.registro||null})),
    palmas_registradas:ms.length,con_dano:ms.filter(r=>r.dano).length,fotos:new Set(regs.flatMap(r=>r.fotos||[])).size,archivo_fotos:archivoFotos||null,app:'Sanidad Vegetal '+VERSION,sincronizado:ahora};
  return g;
}
/* El botón INICIAR: panel de la labor en curso o elección de labor. */
$('#btJornada').onclick=()=>{if(PLAY.on)return;if(S.jornada){if(esPlg())panelPlg();else if(esErr())panelErr();else if(esCir())panelCirugia();else panelJornada();}else{const m=motivoNoIniciar();if(m){avisarFueraPlantacion(m);return;}elegirLabor();}};
