/* =====================================================================
   PROGRAMADOR, SEGUIMIENTO Y APROBACIÓN DE LA ERRADICACIÓN (visor web · Coordinación)
   · Casos: palmas cuyo último diagnóstico (censo o corrección de cirujano/erradicador) es PC cráter (o «para erradicar»),
     palma espontánea o yarumo, sin erradicación posterior. Plazo: día hábil siguiente. Prioridad: cráter → espontánea → yarumo.
   · Equipos mixtos: erradicador solo o con auxiliar; eficiencia de 5 a 30 palmas por día.
   · Programación en erradicacion/programacion/AAAA-MM-DD.json (la descarga la App).
   · Aprobaciones (analista de datos o super administrador): las palmas erradicadas (cráter y espontáneas) pasan a
     existencia 0 en cartografia/ajustes_existencia.json; si se rechaza, la palma vuelve a quedar pendiente.
   ===================================================================== */
const ERR={on:false,cargado:false,cargando:false,diags:[],correcciones:[],errs:[],jornadas:[],pend:[],usuarios:[],equipos:[],prog:null,progSha:null,
  capa:L.layerGroup(),fecha:null,tab:'prog',aj:null,ajSha:null,productos:null,selAprob:new Set()};
const COLORES_EQ=['#ff8a65','#4fb3ff','#c77dff','#22d39a','#f2a33a','#e57373'];
const puedeAprobarErr=()=>!!SES&&['analista','superadmin'].includes(SES.rol);
const tipoErrTxt=t=>(TIPOS_ERR[t]||{}).t||t||'';

(function montarErradicacion(){
  const css=document.createElement('style');css.textContent=`
  body.modo-err #filtros,body.modo-err nav.tabs,body.modo-err #panel{display:none!important}
  #errPanel{flex:1;overflow:auto;padding:12px 14px 30px;display:none}
  body.modo-err #errPanel{display:block}
  .err-tipo{border-radius:999px;padding:1px 7px;font-size:11px;font-weight:700;background:rgba(255,138,101,.15);color:#ff8a65;border:1px solid rgba(255,138,101,.45);white-space:nowrap}`;
  document.head.appendChild(css);
  const p=document.createElement('div');p.id='errPanel';$('aside').appendChild(p);
  // Acceso directo en la cabecera, junto a ✚ CIRUGÍAS (también está en 🧭 COORDINACIÓN → Programador de erradicación)
  const bt=document.createElement('button');bt.className='btn mini';bt.id='btErr';bt.innerHTML='🪓 ERRADICACIÓN';bt.title='Programador, seguimiento y aprobaciones de la erradicación';
  const c=$('#btCir');if(c)c.after(bt);else $('#chDatos').before(bt);bt.onclick=()=>{if(GER.on)alternarGerencia(false);alternarErr();};
})();
function alternarErr(on){
  ERR.on=on==null?!ERR.on:on;if(ERR.on&&typeof CIR!=='undefined'&&CIR.on)alternarCirugia(false);
  document.body.classList.toggle('modo-err',ERR.on);{const b=$('#btErr');if(b)b.classList.toggle('prim',ERR.on);}
  for(const c of [capaRec,capaDiag,capaPar])ERR.on?mapa.removeLayer(c):(c.addTo(mapa));
  if(ERR.on){ERR.capa.addTo(mapa);if(!ERR.cargado&&!ERR.cargando)errCargar();else pintarErr();}
  else mapa.removeLayer(ERR.capa);
}
const erradicadores=()=>ERR.usuarios.filter(x=>!x.inactivo&&(x.labores||[]).includes('erradicacion')&&(x.rol_erradicacion||'erradicador')==='erradicador');
const auxiliaresErr=()=>ERR.usuarios.filter(x=>!x.inactivo&&(x.labores||[]).includes('erradicacion'));

/* ---------- Ajustes de existencia aprobados (compartido con el resto del visor) ---------- */
let VAJ=new Set();
async function cargarAjustesVisor(){
  try{const j=await (await gh(`/contents/cartografia/ajustes_existencia.json?ref=${encodeURIComponent(SES.repo.rama)}`)).json();ERR.ajSha=j.sha;ERR.aj=JSON.parse(DEC.decode(deB64(j.content.replace(/\s/g,''))));}
  catch(e){if(e.status&&e.status!==404)console.warn('ajustes',e);ERR.aj=null;ERR.ajSha=null;}
  if(!ERR.aj)ERR.aj={formato:'sanidad-ajustes-existencia-1',ajustes:[],rechazos:[]};ERR.aj.ajustes=ERR.aj.ajustes||[];ERR.aj.rechazos=ERR.aj.rechazos||[];
  VAJ=new Set(ERR.aj.ajustes.filter(x=>Number(x.existe)===0).map(x=>String(x.palma_id)));CHUNK.clear();
}
{const _chunk=chunkLote;chunkLote=async function(l){const d=await _chunk(l);if(VAJ.size)for(const a of d)if(VAJ.has(String(a[0])))a[3]=0;return d;};}

/* ---------- Carga: censo (45 días), correcciones de cirugía y jornadas de erradicación ---------- */
async function errCargar(){
  ERR.cargando=true;pintarErr('Cargando el censo de los últimos 45 días, cirugías y erradicaciones…');
  try{
    ERR.usuarios=await cirUsuarios();await cargarAjustesVisor();
    const hoy=hoyISO(),d1=hoyISO(new Date(Date.now()-45*86400000));
    const [dC,dX,dE]=await Promise.all([listarDias('jornadas',d1,hoy),listarDias('cirugia/jornadas',d1,hoy),listarDias('erradicacion/jornadas',d1,hoy)]);
    const arch=[];
    for(const [dias,k] of [[dC,'c'],[dX,'x'],[dE,'e']])await enParalelo(dias,6,async d=>{for(const f of await arbol(d.sha))if(f.type==='blob')arch.push({...f,dia:d.path,k});});
    const zips=new Map(arch.filter(f=>f.path.endsWith('_fotos.zip')).map(f=>[f.k+'/'+f.dia+'/'+f.path,f.sha]));
    const diags=[],corr=[],errs=[],jors=[];let n=0;const geos=arch.filter(f=>f.path.endsWith('.geojson'));
    await enParalelo(geos,6,async f=>{try{const g=JSON.parse(await blobTexto(f.sha));const zip=zips.get(f.k+'/'+f.dia+'/'+f.path.replace(/\.geojson$/,'_fotos.zip'));
      if(f.k==='c'){const j=normalizar(g,f,zip);for(const d of j.diags){d._j=j;diags.push(d);}}
      else{const h=g.jornada||{};const j={...h,zipSha:zip,ruta:f.dia+'/'+f.path};if(f.k==='e')jors.push(j);
        for(const ft of g.features||[]){const p=ft.properties||{};const ll=ft.geometry&&ft.geometry.type==='Point'?{lng:ft.geometry.coordinates[0],lat:ft.geometry.coordinates[1]}:{};
          const o={...p,...ll,_j:j,_labor:f.k==='e'?'erradicacion':'cirugia'};
          if(p.tipo==='erradicacion')errs.push(o);else if(p.tipo==='diagnostico')corr.push(o);}}
    }catch(e){console.warn('archivo ilegible',f.path,e);}n++;pintarErr(`Leyendo archivos: ${n} de ${geos.length}`);});
    ERR.diags=diags;ERR.correcciones=corr;ERR.errs=errs;ERR.jornadas=jors;
    calcularPendErr();ERR.cargado=true;
    const g=await dget('kv','err_equipos');ERR.equipos=Array.isArray(g)&&g.length?g:equiposIniciales();
    if(!ERR.fecha)ERR.fecha=esHabil(hoyISO())&&new Date().getHours()<12?hoyISO():habilMas(hoyISO());
    await leerProgErr(ERR.fecha);
    try{const c=await (await gh(`/contents/config/erradicacion.json?ref=${encodeURIComponent(SES.repo.rama)}`,'application/vnd.github.raw+json')).text();ERR.productos=(JSON.parse(c).productos||[]).filter(Boolean);}catch(e){ERR.productos=null;}
  }catch(e){toast(e.message,6000);}
  finally{ERR.cargando=false;pintarErr();}
}
function equiposIniciales(){const e=erradicadores();return e.length?e.slice(0,3).map(x=>({erradicador:x.u,auxiliar:'',ef:20})):[{erradicador:'',auxiliar:'',ef:20}];}
const rechazada=e=>ERR.aj&&ERR.aj.rechazos.some(r=>r.erradicacion_id===e.id);
const aprobada=e=>ERR.aj&&ERR.aj.ajustes.some(a=>a.erradicacion_id===e.id);
function calcularPendErr(){
  const ult=new Map(),ultE=new Map();
  const ponD=(d,clase)=>{const k=String(d.palma_id);const t=tDe(d);const u=ult.get(k);if(!u||t>=u.t)ult.set(k,{t,d,clase});};
  ERR.diags.forEach(d=>ponD(d,'censo'));ERR.correcciones.forEach(d=>ponD(d,d.origen==='caso_nuevo'?'caso_nuevo':'correccion'));
  for(const e of ERR.errs){if(rechazada(e))continue;const k=String(e.palma_id);const t=tDe(e);const u=ultE.get(k);if(!u||t>u.t)ultE.set(k,{t,e});}
  const pend=[];
  for(const [k,{t,d,clase}] of ult){const tipo=tipoErradicacion(d);if(!tipo||VAJ.has(k))continue;const e=ultE.get(k);if(e&&e.t>=t-60000)continue;
    const f=fechaISO(new Date(t));pend.push({palma_id:k,lote:d.lote,linea:d.linea,palma:d.palma,lat:d.lat,lng:d.lng,tipo,diagnostico:[d.nivel1||d.n1,d.nivel2||d.n2].filter(Boolean).join(' · '),
      fecha_censo:f,vence:habilMas(f),censador:d.evaluador||'',diag_id:d.id||'',origen:clase,creado:new Date(t).toISOString()});}
  ERR.pend=pend.sort((a,b)=>a.vence.localeCompare(b.vence)||(TIPOS_ERR[a.tipo].p-TIPOS_ERR[b.tipo].p)||ordenNat(a.lote,b.lote));
  // Cumplimiento del plazo (30 días): casos que se volvieron «para erradicar» y si se erradicaron a tiempo
  const desde=Date.now()-30*86400000;let tot=0,ok=0;
  for(const d of [...ERR.diags,...ERR.correcciones]){if(!tipoErradicacion(d))continue;const t=tDe(d);if(t<desde)continue;const vence=habilMas(fechaISO(new Date(t)));
    if(vence>hoyISO())continue;tot++;const e=ERR.errs.find(x=>String(x.palma_id)===String(d.palma_id)&&tDe(x)>=t-60000&&!rechazada(x));if(e&&fechaISO(new Date(tDe(e)))<=vence)ok++;}
  ERR.cumplimiento=tot?Math.round(ok/tot*100):null;ERR.cumpTot=tot;
}

/* ---------- Programación ---------- */
function generarProgErr(){
  const fecha=ERR.fecha;const eqs=ERR.equipos.filter(p=>p.erradicador);
  if(!eqs.length){toast('Defina al menos un equipo con su erradicador.');return;}
  const cap=eqs.reduce((s,p)=>s+(Number(p.ef)||20),0);
  const cand=ERR.pend.filter(o=>o.fecha_censo<=fecha);
  const sel=cand.slice(0,cap),quedan=cand.slice(cap);
  const asig=repartir(sel,eqs);const of=oficinaCentral();
  const out=eqs.map((p,j)=>{const er=ERR.usuarios.find(u=>u.u===p.erradicador)||{},ax=p.auxiliar?(ERR.usuarios.find(u=>u.u===p.auxiliar)||{}):null;
    const ords=sel.filter((_,i)=>asig[i]===j);let ruta={orden:ords.map((_,i)=>i),geometria:[],tramos_m:[],km:0};
    try{if(VIAS.gj&&ords.length)ruta=rutaOptima(VIAS.gj,of,ords,{dentro:(lng,lat)=>!!loteDe(lat,lng)});}catch(e){console.warn('ruta',e);}
    const ordenes=ruta.orden.map((ix,n)=>({...ords[ix],orden:n+1,id:`err-${fecha}-${ords[ix].palma_id}`,tramo_m:ruta.tramos_m[n]||null}));
    return {n:j+1,color:COLORES_EQ[j%COLORES_EQ.length],erradicador:{u:p.erradicador,nombre:er.nombre||p.erradicador},auxiliar:p.auxiliar?{u:p.auxiliar,nombre:ax.nombre||p.auxiliar}:null,
      eficiencia:Number(p.ef)||20,km:ruta.km,km_campo:+((ruta.tramos_m||[]).slice(1,-1).reduce((a,b)=>a+b,0)/1000).toFixed(2),ruta:ruta.geometria,ordenes};});
  ERR.prog={formato:'sanidad-programacion-erradicacion-1',fecha,generado:new Date().toISOString(),por:SES.u,por_nombre:SES.nombre,oficina:of,equipos:out,
    sin_programar:quedan.map(o=>({palma_id:o.palma_id,lote:o.lote,linea:o.linea,palma:o.palma,tipo:o.tipo,vence:o.vence})),enviada:false};
  dput('kv','err_equipos',ERR.equipos);pintarErr();toast(`Programación lista: ${sel.length} palma(s) en ${out.length} equipo(s). Revise y envíela a los celulares.`,4500);
}
async function leerProgErr(fecha){
  ERR.prog=null;ERR.progSha=null;
  try{const j=await (await gh(`/contents/erradicacion/programacion/${fecha}.json?ref=${encodeURIComponent(SES.repo.rama)}`)).json();
    ERR.progSha=j.sha;ERR.prog={...JSON.parse(DEC.decode(deB64(j.content.replace(/\s/g,'')))),enviada:true};}
  catch(e){if(e.status!==404)toast(e.message,5000);}
}
async function enviarProgErr(){
  if(!ERR.prog)return;const b=$('#errEnviar');if(b){b.disabled=true;b.textContent='Enviando…';}
  try{const datos={...ERR.prog};delete datos.enviada;datos.enviado=new Date().toISOString();
    let sha=ERR.progSha;if(!sha){try{sha=(await (await gh(`/contents/erradicacion/programacion/${ERR.prog.fecha}.json?ref=${encodeURIComponent(SES.repo.rama)}`)).json()).sha;}catch(e){}}
    ERR.progSha=await ghPut(`erradicacion/programacion/${ERR.prog.fecha}.json`,JSON.stringify(datos),`Programación de erradicación ${ERR.prog.fecha} · ${SES.nombre}`,sha);
    ERR.prog={...datos,enviada:true};toast('✓ Programación enviada. Los equipos la reciben al iniciar la jornada de erradicación.',5000);}
  catch(e){toast('No se pudo enviar: '+e.message,6000);}
  finally{pintarErr();}
}

/* ---------- Aprobación de existencia 0 ---------- */
const porAprobar=()=>ERR.errs.filter(e=>(e.requiere_aprobacion===true||e.requiere_aprobacion==='true'||(TIPOS_ERR[e.tipo_erradicacion]||{}).existencia)&&!aprobada(e)&&!rechazada(e)).sort((a,b)=>tDe(a)-tDe(b));
async function guardarAjustes(mutar,msg){
  // Se vuelve a leer el archivo justo antes de escribir para no pisar otra aprobación hecha al mismo tiempo
  await cargarAjustesVisor();mutar(ERR.aj);ERR.aj.formato='sanidad-ajustes-existencia-1';ERR.aj.actualizado=new Date().toISOString();ERR.aj.actualizado_por=SES.u;
  ERR.ajSha=await ghPut('cartografia/ajustes_existencia.json',JSON.stringify(ERR.aj,null,1),msg,ERR.ajSha);
  VAJ=new Set(ERR.aj.ajustes.filter(x=>Number(x.existe)===0).map(x=>String(x.palma_id)));CHUNK.clear();
}
async function aprobarErr(lista){
  if(!puedeAprobarErr()||!lista.length)return;
  if(!confirm(`¿Aprobar ${lista.length} palma(s) erradicada(s)?\n\nQuedarán con existencia 0: salen de los casos activos de PC y de la incidencia en la App, el visor y los reportes.`))return;
  try{const ahora=new Date().toISOString();
    await guardarAjustes(aj=>{for(const e of lista){if(aj.ajustes.some(a=>a.erradicacion_id===e.id))continue;
      aj.ajustes.push({palma_id:String(e.palma_id),lote:e.lote,linea:e.linea,palma:e.palma,existe:0,motivo:'erradicada',tipo:e.tipo_erradicacion,metodo:e.metodo,producto:e.producto||'',dosis:e.dosis??null,
        erradicacion_id:e.id,fecha_erradicacion:fechaISO(new Date(tDe(e))),erradicador:e.erradicador_nombre||e.erradicador||'',aprobado_por:SES.u,aprobado_nombre:SES.nombre,aprobado:ahora});}},
      `Existencia 0 aprobada: ${lista.length} palma(s) erradicada(s) · ${SES.nombre}`);
    ERR.selAprob.clear();calcularPendErr();toast(`✓ ${lista.length} palma(s) aprobadas con existencia 0.`,4500);}
  catch(e){toast('No se pudo guardar: '+e.message,6000);}
  pintarErr();
}
async function rechazarErr(e){
  if(!puedeAprobarErr())return;const m=prompt('Motivo del rechazo (la palma vuelve a quedar pendiente de erradicar):','');if(m==null)return;
  try{await guardarAjustes(aj=>{if(!aj.rechazos.some(r=>r.erradicacion_id===e.id))aj.rechazos.push({erradicacion_id:e.id,palma_id:String(e.palma_id),lote:e.lote,linea:e.linea,palma:e.palma,motivo:m.trim(),por:SES.u,por_nombre:SES.nombre,fecha:new Date().toISOString()});},
      `Erradicación rechazada: ${e.lote} L${e.linea} P${e.palma} · ${SES.nombre}`);
    calcularPendErr();toast('Rechazada: la palma vuelve a la lista de pendientes.',4000);}
  catch(err){toast('No se pudo guardar: '+err.message,6000);}
  pintarErr();
}

/* ---------- Pintado ---------- */
function pintarMapaErr(){
  ERR.capa.clearLayers();const pop=o=>`<b>${esc(etqPalma(o))}</b><br><span class="err-tipo">${esc(tipoErrTxt(o.tipo))}</span> · ${esc(o.diagnostico||'')}<br>Reporte ${fechaCorta(o.fecha_censo)} · vence ${fechaCorta(o.vence)}<br>${esc(nombreCorto(o.censador||''))}`;
  if(ERR.tab==='prog'&&ERR.prog){for(const p of ERR.prog.equipos){
      if(p.ruta&&p.ruta.length>1){L.polyline(p.ruta.map(([x,y])=>[y,x]),{renderer:rend,color:'#06140f',weight:7,opacity:.6,interactive:false}).addTo(ERR.capa);
        L.polyline(p.ruta.map(([x,y])=>[y,x]),{renderer:rend,color:p.color,weight:4,opacity:.95,dashArray:'8 6',interactive:false}).addTo(ERR.capa);}
      for(const o of p.ordenes)marcadorNum(o,p.color,o.orden).bindPopup(pop(o)+`<br>Equipo ${p.n} · orden ${o.orden}`,{maxWidth:300}).addTo(ERR.capa);}
    const prog=new Set(ERR.prog.equipos.flatMap(p=>p.ordenes.map(o=>String(o.palma_id))));
    for(const o of ERR.pend)if(!prog.has(String(o.palma_id))&&o.lat!=null)L.circleMarker([o.lat,o.lng],{renderer:rend,radius:6,color:'#fff',weight:1.5,fillColor:'#bf360c',fillOpacity:.9}).bindPopup(pop(o)+'<br>Sin programar',{maxWidth:300}).addTo(ERR.capa);}
  else if(ERR.tab==='prog'){for(const o of ERR.pend)if(o.lat!=null)L.circleMarker([o.lat,o.lng],{renderer:rend,radius:6,color:'#fff',weight:1.5,fillColor:o.vence<ERR.fecha?'#ff1744':'#bf360c',fillOpacity:.9}).bindPopup(pop(o),{maxWidth:300}).addTo(ERR.capa);}
  else for(const e of (ERR.tab==='aprob'?porAprobar():ERR.errs))if(e.lat!=null)L.circleMarker([e.lat,e.lng],{renderer:rend,radius:6,color:'#fff',weight:1.5,fillColor:'#5c6b64',fillOpacity:.9})
    .bindPopup(`<b>${esc(etqPalma(e))}</b><br>${esc(tipoErrTxt(e.tipo_erradicacion))} · ${esc(e.metodo||'')}${e.producto?' · '+esc(e.producto)+' '+esc(e.dosis)+' '+esc(e.dosis_unidad||'ml'):''}<br>${esc(fechaCorta(new Date(tDe(e))))} · ${esc(nombreCorto(e.erradicador_nombre||e.erradicador||''))}`,{maxWidth:300}).addTo(ERR.capa);
}
function filaErr(e,i,conAcc){
  const sel=ERR.selAprob.has(e.id);
  return `<tr data-ll="${e.lat},${e.lng}">${conAcc?`<td><input type="checkbox" data-sela="${esc(e.id)}" ${sel?'checked':''} aria-label="Seleccionar"></td>`:''}<td>${esc(fechaCorta(new Date(tDe(e))))}</td><td>${esc(etqPalma(e))}</td>
    <td><span class="err-tipo">${esc(tipoErrTxt(e.tipo_erradicacion))}</span>${e.origen==='caso_nuevo'?'<br><span class="tenue">caso nuevo</span>':''}</td>
    <td>${esc(e.metodo||'')}${e.producto?`<br><span class="tenue">${esc(e.producto)} · ${esc(e.dosis)} ${esc(e.dosis_unidad||'ml')}</span>`:''}</td>
    <td>${esc(nombreCorto(e.erradicador_nombre||e.erradicador||''))}${e.auxiliar_nombre?`<br><span class="tenue">${esc(nombreCorto(e.auxiliar_nombre))}</span>`:''}</td>
    <td>${(e.fotos||'').split('|').filter(Boolean).length?`<button class="btn mini" data-fote="${i}">Ver</button>`:'—'}</td>
    ${conAcc?`<td><button class="btn mini prim" data-apr="${i}">Aprobar</button> <button class="btn mini" data-rec="${i}">Rechazar</button></td>`:`<td>${aprobada(e)?'<span class="ger-chip ok">existencia 0</span>':rechazada(e)?'<span class="ger-chip mal">rechazada</span>':(TIPOS_ERR[e.tipo_erradicacion]||{}).existencia?'<span class="ger-chip med">por aprobar</span>':'<span class="ger-chip gris">no aplica</span>'}</td>`}</tr>`;
}
function exportarErrCSV(){
  const cols=['fecha','lote','linea','palma','tipo','metodo','producto','dosis','unidad','erradicador','auxiliar','reporte_censo','censador','fecha_reporte','vence','a_tiempo','duracion_min','estado_aprobacion','origen','observaciones'];
  const filas=[...ERR.errs].sort((a,b)=>tDe(a)-tDe(b)).map(e=>[fechaISO(new Date(tDe(e))),e.lote,e.linea,e.palma,tipoErrTxt(e.tipo_erradicacion),e.metodo,e.producto||'',e.dosis??'',e.dosis_unidad||'',e.erradicador_nombre||e.erradicador||'',e.auxiliar_nombre||'',
    e.diag_censo||'',e.censador||'',e.fecha_censo||'',e.vence||'',e.a_tiempo===false||e.a_tiempo==='false'?'No':'Sí',e.duracion_min??'',aprobada(e)?'Aprobada (existencia 0)':rechazada(e)?'Rechazada':(TIPOS_ERR[e.tipo_erradicacion]||{}).existencia?'Por aprobar':'No aplica',e.origen||'',e.observaciones||'']
    .map(v=>String(v??'').replace(/[;\r\n]+/g,' ')).join(';'));
  descargar(`erradicaciones_${hoyISO()}.csv`,'﻿'+[cols.join(';'),...filas].join('\r\n'),'text/csv');
}
function pintarErr(msg){
  const P=$('#errPanel');if(!P)return;
  const salir='<button class="btn mini" id="errSalir" title="Volver al visor">✕ Salir</button>';
  if(!ERR.cargado){P.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><h3>Erradicación</h3>${salir}</div><div class="tenue">${esc(msg||'Preparando…')}</div>`;const s=$('#errSalir');if(s)s.onclick=()=>alternarErr(false);return;}
  const f=ERR.fecha;const venc=ERR.pend.filter(o=>o.vence<f).length,venceF=ERR.pend.filter(o=>o.vence===f).length;const nApr=porAprobar().length;
  const tabs=`<div class="cir-tabs" style="flex-wrap:wrap"><button class="btn mini ${ERR.tab==='prog'?'on':''}" data-et="prog">PROGRAMACIÓN</button><button class="btn mini ${ERR.tab==='seg'?'on':''}" data-et="seg">SEGUIMIENTO</button>
    ${puedeAprobarErr()?`<button class="btn mini ${ERR.tab==='aprob'?'on':''}" data-et="aprob">APROBACIONES${nApr?' ('+nApr+')':''}</button>`:''}<button class="btn mini" id="errRec" title="Volver a leer los datos">↻</button>${salir}</div>`;
  let h=tabs;
  if(ERR.tab==='prog'){
    const prods=(ERR.productos&&ERR.productos.length?ERR.productos:PRODUCTOS_ERR);
    h+=`<div class="kpis"><div class="kpi"><b>${num(ERR.pend.length)}</b><span>Casos pendientes</span></div><div class="kpi"><b class="venc">${num(venc)}</b><span>Vencidos</span></div><div class="kpi"><b class="hoyv">${num(venceF)}</b><span>Vencen el ${esc(fechaCorta(f))}</span></div></div>
    <div class="kpis">${Object.entries(TIPOS_ERR).map(([k,v])=>`<div class="kpi"><b>${num(ERR.pend.filter(o=>o.tipo===k).length)}</b><span>${esc(v.t)}</span></div>`).join('')}</div>
    <label class="campo" for="errFecha">Programar para</label>
    <div style="display:flex;gap:8px;align-items:center"><input type="date" id="errFecha" value="${f}"><span class="tenue">${esFestivo(f)?'⚠ Festivo: '+esc(esFestivo(f)):esHabil(f)?esc(fechaCorta(f)):'⚠ Domingo'}</span></div>
    <h3>Equipos y eficiencia (palmas/día)</h3>
    ${ERR.equipos.map((p,i)=>`<div class="cir-par"><div class="cab"><i style="background:${COLORES_EQ[i%COLORES_EQ.length]}"></i><b>Equipo ${i+1}</b>${ERR.equipos.length>1?`<button class="btn mini" data-qe="${i}" style="margin-left:auto">Quitar</button>`:''}</div>
      <label class="campo" for="ee${i}">Erradicador</label><select id="ee${i}" data-e="${i}" data-k="erradicador"><option value="">—</option>${erradicadores().map(u=>`<option value="${esc(u.u)}" ${u.u===p.erradicador?'selected':''}>${esc(u.nombre)}</option>`).join('')}</select>
      <label class="campo" for="ea${i}">Auxiliar</label><select id="ea${i}" data-e="${i}" data-k="auxiliar"><option value="">— Trabaja solo —</option>${auxiliaresErr().filter(u=>u.u!==p.erradicador).map(u=>`<option value="${esc(u.u)}" ${u.u===p.auxiliar?'selected':''}>${esc(u.nombre)} · ${esc(u.rol_erradicacion==='auxiliar'?'auxiliar':'erradicador')}</option>`).join('')}</select>
      <div class="cir-ef"><span>Eficiencia</span><select data-e="${i}" data-k="ef" aria-label="Eficiencia del equipo ${i+1}">${EFICIENCIAS_ERR.map(v=>`<option value="${v}" ${Number(p.ef)===v?'selected':''}>${v} palmas/día</option>`).join('')}</select></div></div>`).join('')}
    ${ERR.equipos.length<6?'<button class="btn mini" id="errMasEq">+ Agregar equipo</button>':''}
    <p class="tenue" style="font-size:12.5px;margin:8px 0 0">Productos químicos: <b>${esc(prods.join(', '))}</b> <button class="btn mini" id="errProds">Editar</button></p>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn prim" id="errGenerar">GENERAR PROGRAMACIÓN</button>${ERR.prog?`<button class="btn nar" id="errEnviar">${ERR.prog.enviada?'REENVIAR A LOS CELULARES':'ENVIAR A LOS CELULARES'}</button>`:''}</div>`;
    if(ERR.prog){const tot=ERR.prog.equipos.reduce((s,p)=>s+p.ordenes.length,0);
      h+=`<p class="tenue" style="margin:8px 0">${ERR.prog.enviada?'✓ Enviada':'Sin enviar'} · generada ${esc(fechaCorta(ERR.prog.generado))} ${hhmm(ERR.prog.generado)} por ${esc(ERR.prog.por_nombre||ERR.prog.por)} · ${num(tot)} palmas</p>`;
      if(ERR.prog.sin_programar&&ERR.prog.sin_programar.length)h+=`<div class="cir-aviso">${num(ERR.prog.sin_programar.length)} caso(s) quedan para el siguiente día hábil (${esc(fechaCorta(habilMas(f)))}): la capacidad de los equipos no alcanza. Aumente la eficiencia o agregue un equipo.</div>`;
      for(const p of ERR.prog.equipos)h+=`<h3 style="color:${p.color}">Equipo ${p.n} · ${p.ordenes.length} palmas · ${p.km_campo??p.km??'—'} km en campo</h3><div class="tenue" style="font-size:12.5px;margin:-4px 0 6px">${esc(p.erradicador.nombre)} (erradicador)${p.auxiliar?' · '+esc(p.auxiliar.nombre)+' (auxiliar)':' · trabaja solo'}</div>
        <table class="t"><thead><tr><th>#</th><th>Palma</th><th>Erradicar</th><th>Reporte</th><th>Vence</th></tr></thead><tbody>${p.ordenes.map(o=>`<tr data-ll="${o.lat},${o.lng}"><td>${o.orden}</td><td>${esc(etqPalma(o))}</td><td><span class="err-tipo">${esc(tipoErrTxt(o.tipo))}</span>${o.origen==='caso_nuevo'?' · nuevo':''}</td><td>${esc(fechaCorta(o.fecha_censo))}<br><span class="tenue">${esc(nombreCorto(o.censador))}</span></td><td class="${o.vence<f?'venc':o.vence===f?'hoyv':''}">${esc(fechaCorta(o.vence))}</td></tr>`).join('')}</tbody></table>`;}
    else h+=`<h3>Casos pendientes</h3>${ERR.pend.length?`<table class="t"><thead><tr><th>Palma</th><th>Erradicar</th><th>Reporte</th><th>Vence</th></tr></thead><tbody>${ERR.pend.map(o=>`<tr data-ll="${o.lat},${o.lng}"><td>${esc(etqPalma(o))}</td><td><span class="err-tipo">${esc(tipoErrTxt(o.tipo))}</span></td><td>${esc(fechaCorta(o.fecha_censo))}<br><span class="tenue">${esc(nombreCorto(o.censador))}</span></td><td class="${o.vence<f?'venc':o.vence===f?'hoyv':''}">${esc(fechaCorta(o.vence))}</td></tr>`).join('')}</tbody></table>`:'<div class="tenue">No hay palmas pendientes de erradicar en los últimos 45 días.</div>'}`;
  }else if(ERR.tab==='seg'){
    const es=[...ERR.errs].sort((a,b)=>tDe(b)-tDe(a));ERR._lista=es;
    const q=es.filter(e=>e.metodo==='Química');const dosis=new Map();for(const e of q){const k=(e.producto||'—')+' ('+(e.dosis_unidad||'ml')+')';dosis.set(k,(dosis.get(k)||0)+(Number(e.dosis)||0));}
    const porEq=new Map();for(const e of es){const k=e.erradicador_nombre||e.erradicador||'—';const x=porEq.get(k)||{n:0,dias:new Set(),aux:new Set()};x.n++;x.dias.add(fechaISO(new Date(tDe(e))));if(e.auxiliar_nombre)x.aux.add(e.auxiliar_nombre);porEq.set(k,x);}
    const aTiempo=es.filter(e=>!(e.a_tiempo===false||e.a_tiempo==='false')).length;
    h+=`<div class="kpis"><div class="kpi"><b>${num(es.length)}</b><span>Erradicadas (45 días)</span></div><div class="kpi"><b>${ERR.cumplimiento==null?'—':ERR.cumplimiento+' %'}</b><span>Cumplimiento del plazo (30 días)</span></div><div class="kpi"><b>${num(nApr)}</b><span>Por aprobar (existencia 0)</span></div></div>
      <div class="kpis">${Object.entries(TIPOS_ERR).map(([k,v])=>`<div class="kpi"><b>${num(es.filter(e=>e.tipo_erradicacion===k).length)}</b><span>${esc(v.t)}</span></div>`).join('')}</div>
      <div class="kpis"><div class="kpi"><b>${num(es.length-q.length)}</b><span>Con motosierra</span></div><div class="kpi"><b>${num(q.length)}</b><span>Químicas</span></div><div class="kpi"><b>${num(es.length?aTiempo/es.length*100:0,0)} %</b><span>A tiempo</span></div></div>
      ${dosis.size?`<h3>Producto aplicado</h3><table class="t"><thead><tr><th>Producto</th><th>Palmas</th><th>Dosis total</th></tr></thead><tbody>${[...dosis].map(([k,v])=>`<tr><td>${esc(k)}</td><td>${num(q.filter(e=>(e.producto||'—')+' ('+(e.dosis_unidad||'ml')+')'===k).length)}</td><td>${num(v,1)}</td></tr>`).join('')}</tbody></table>`:''}
      <h3>Rendimiento por erradicador</h3><table class="t"><thead><tr><th>Erradicador</th><th>Palmas</th><th>Días</th><th>Palmas/día</th></tr></thead><tbody>${[...porEq].sort((a,b)=>b[1].n-a[1].n).map(([k,x])=>`<tr><td>${esc(nombreCorto(k))}${x.aux.size?`<br><span class="tenue">con ${esc([...x.aux].map(nombreCorto).join(', '))}</span>`:''}</td><td>${num(x.n)}</td><td>${num(x.dias.size)}</td><td>${num(x.n/Math.max(1,x.dias.size),1)}</td></tr>`).join('')||'<tr><td colspan="4" class="tenue">Sin datos.</td></tr>'}</tbody></table>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><h3 style="margin:0">Palmas erradicadas</h3><button class="btn mini" id="errCsv">⬇ Exportar (CSV)</button></div>
      ${es.length?`<table class="t"><thead><tr><th>Fecha</th><th>Palma</th><th>Tipo</th><th>Método</th><th>Equipo</th><th>Fotos</th><th>Estado</th></tr></thead><tbody>${es.map((e,i)=>filaErr(e,i,false)).join('')}</tbody></table>`:'<div class="tenue">Aún no hay erradicaciones sincronizadas.</div>'}
      <h3>Correcciones del erradicador</h3>${(()=>{const c=ERR.correcciones.filter(x=>x._labor==='erradicacion'&&x.origen==='correccion');return c.length?`<table class="t"><thead><tr><th>Palma</th><th>Reporte (antes)</th><th>Erradicador (vigente)</th></tr></thead><tbody>${c.map(x=>`<tr data-ll="${x.lat},${x.lng}"><td>${esc(etqPalma(x))}</td><td class="tenue">${esc(x.corrige_texto||'')}<br>${esc(nombreCorto(x.corrige_evaluador||''))}</td><td><b>${esc([x.nivel1,x.nivel2].filter(Boolean).join(' · '))}</b><br><span class="tenue">${esc(nombreCorto(x.evaluador))} · ${esc(fechaCorta(new Date(tDe(x))))}</span></td></tr>`).join('')}</tbody></table>`:'<div class="tenue">Sin correcciones.</div>';})()}`;
  }else{
    const l=porAprobar();ERR._lista=l;
    h+=`<p class="tenue">Palmas erradicadas (PC cráter y espontáneas) que esperan su aprobación para quedar con <b>existencia 0</b>. Revise las fotos de antes y después. Los yarumos no cambian ninguna palma.</p>
      ${l.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0"><button class="btn mini" id="errSelTodo">Seleccionar todas</button><button class="btn prim mini" id="errAprSel" ${ERR.selAprob.size?'':'disabled'}>Aprobar seleccionadas (${ERR.selAprob.size})</button></div>
        <table class="t"><thead><tr><th></th><th>Fecha</th><th>Palma</th><th>Tipo</th><th>Método</th><th>Equipo</th><th>Fotos</th><th>Decisión</th></tr></thead><tbody>${l.map((e,i)=>filaErr(e,i,true)).join('')}</tbody></table>`:'<div class="tenue">No hay palmas por aprobar.</div>'}
      ${ERR.aj&&ERR.aj.ajustes.length?`<p class="tenue" style="margin-top:10px">${num(ERR.aj.ajustes.length)} palma(s) con existencia 0 aprobada en total.</p>`:''}`;
  }
  P.innerHTML=h;
  P.querySelectorAll('[data-et]').forEach(b=>b.onclick=()=>{ERR.tab=b.dataset.et;pintarErr();});
  $('#errSalir').onclick=()=>alternarErr(false);
  const rec=$('#errRec');if(rec)rec.onclick=()=>{ERR.cargado=false;errCargar();};
  const fi=$('#errFecha');if(fi)fi.onchange=async()=>{ERR.fecha=fi.value||hoyISO();await leerProgErr(ERR.fecha);pintarErr();};
  P.querySelectorAll('select[data-e]').forEach(s=>s.onchange=()=>{const q=ERR.equipos[+s.dataset.e];q[s.dataset.k]=s.dataset.k==='ef'?+s.value:s.value;dput('kv','err_equipos',ERR.equipos);pintarErr();});
  P.querySelectorAll('[data-qe]').forEach(b=>b.onclick=()=>{ERR.equipos.splice(+b.dataset.qe,1);dput('kv','err_equipos',ERR.equipos);pintarErr();});
  const mas=$('#errMasEq');if(mas)mas.onclick=()=>{ERR.equipos.push({erradicador:'',auxiliar:'',ef:20});pintarErr();};
  const g=$('#errGenerar');if(g)g.onclick=generarProgErr;
  const en=$('#errEnviar');if(en)en.onclick=enviarProgErr;
  const pr=$('#errProds');if(pr)pr.onclick=async()=>{const v=prompt('Productos químicos para la erradicación, separados por coma:',(ERR.productos&&ERR.productos.length?ERR.productos:PRODUCTOS_ERR).join(', '));if(v==null)return;
    const l=v.split(',').map(x=>x.trim()).filter(Boolean);if(!l.length)return;
    try{let sha=null;try{sha=(await (await gh(`/contents/config/erradicacion.json?ref=${encodeURIComponent(SES.repo.rama)}`)).json()).sha;}catch(e){}
      await ghPut('config/erradicacion.json',JSON.stringify({formato:'sanidad-config-erradicacion-1',productos:l,dosis_unidad:DOSIS_UNIDAD_ERR,actualizado:new Date().toISOString(),por:SES.u},null,1),`Erradicación: productos químicos (${l.join(', ')})`,sha);
      ERR.productos=l;toast('✓ Productos guardados. Los celulares los toman al iniciar la jornada.');}catch(e){toast(e.message,6000);}pintarErr();};
  const csv=$('#errCsv');if(csv)csv.onclick=exportarErrCSV;
  P.querySelectorAll('tr[data-ll]').forEach(tr=>tr.onclick=ev=>{if(ev.target.closest('button,input'))return;const [a,b]=tr.dataset.ll.split(',').map(Number);if(isFinite(a)&&isFinite(b))mapa.setView([a,b],18);});
  P.querySelectorAll('[data-fote]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const e=ERR._lista[+b.dataset.fote];verFotos({...e,_j:e._j});});
  P.querySelectorAll('[data-apr]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();aprobarErr([ERR._lista[+b.dataset.apr]]);});
  P.querySelectorAll('[data-rec]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();rechazarErr(ERR._lista[+b.dataset.rec]);});
  P.querySelectorAll('[data-sela]').forEach(c=>c.onchange=()=>{c.checked?ERR.selAprob.add(c.dataset.sela):ERR.selAprob.delete(c.dataset.sela);pintarErr();});
  const st=$('#errSelTodo');if(st)st.onclick=()=>{for(const e of porAprobar())ERR.selAprob.add(e.id);pintarErr();};
  const as=$('#errAprSel');if(as)as.onclick=()=>aprobarErr(porAprobar().filter(e=>ERR.selAprob.has(e.id)));
  pintarMapaErr();
}

/* ---------- Pestaña en Coordinación ---------- */
function pintarProgErrGer(){
  return `<div class="ger-sec"><h3>Programador de erradicación</h3>
    <p class="tenue">Programa la erradicación de las palmas reportadas por el censo como <b>PC cráter</b>, <b>palmas espontáneas</b> y <b>yarumos</b>, al día hábil siguiente, con equipos de un erradicador solo o con su auxiliar (eficiencia de 5 a 30 palmas por día) y rutas sobre el mapa.
      Incluye el seguimiento (método, producto y dosis, rendimiento, cumplimiento del plazo, fotos de antes y después, exportación) y las <b>aprobaciones</b> de existencia 0 (analista de datos y super administrador).</p>
    <div class="ger-par"><button class="btn prim" id="gerAbrirErr">🪓 Abrir el programador de erradicación en el mapa</button></div></div>`;
}
ENLACES_GER.progerr=()=>{const b=$('#gerAbrirErr');if(b)b.onclick=()=>{alternarGerencia(false);if(!ERR.on)alternarErr(true);};};
