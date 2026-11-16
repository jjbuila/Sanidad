/* =====================================================================
   GERENCIA (visor web) · botón «📊 GERENCIA» del encabezado
   · Tablero: indicadores, productividad por operario, incidencia de PC por lote y semana, avance del ciclo de censo y mapa de calor.
   · Cirugía: ciclo censo → cirugía (tiempo de respuesta, cumplimiento D+1, vencidos, por pareja y por lote).
   · Sincronización: último envío de cada operario y alerta si lleva más de N días sin sincronizar.
   · Calidad: diagnósticos sospechosos (lejos de la palma, GPS impreciso, sin foto, muy rápidos, rachas iguales, fuera de la jornada).
   · Auditoría: muestra aleatoria de palmas para que el supervisor las verifique y concordancia por operario.
   · Reportes: reportes semanales generados automáticamente en el repositorio de datos (reportes/).
   Usa las jornadas cargadas en el visor (rango de fechas y filtros de la izquierda).
   ===================================================================== */
const GER={on:false,tab:'tablero',sync:null,cargandoSync:false,calor:null,umbralSync:2,umbralCiclo:30,
  cal:{dist:20,prec:15,seg:20,racha:8,tipo:'',op:'',solo:true},revisados:new Set(),aud:{pct:5,min:5,muestra:null,lista:null,sel:null,res:null},reportes:null};
const TABS_GER=[['tablero','TABLERO'],['plan','PROGRAMADOR DE CENSO DE ENFERMEDADES'],['progcir','PROGRAMADOR DE CIRUGÍAS'],['progerr','PROGRAMADOR DE ERRADICACIÓN'],['plagas','MONITOREO DE PLAGAS'],['cirugia','CIRUGÍA'],['sync','SINCRONIZACIÓN'],['calidad','CALIDAD'],['auditoria','AUDITORÍA'],['reportes','REPORTES']];
/* Módulos (comparten el mismo panel): Gerencia; Coordinación y supervisión de la labor (gestión del personal); Análisis de datos (sincronización). */
const MODS_GER={
  ger:{roles:['superadmin','admin','analista','supervisor'],btn:'btGer',icono:'📊',titulo:'GERENCIA',corto:'GERENCIA',tabs:['tablero','reportes','sync'],ayuda:'Tablero gerencial, reportes y sincronización'},
  coord:{roles:['superadmin','admin','analista','supervisor'],btn:'btCoord',icono:'🧭',titulo:'COORDINACIÓN Y SUPERVISIÓN DE LA LABOR',corto:'COORDINACIÓN',tabs:['plan','progcir','progerr','plagas','cirugia','calidad','auditoria','reportes'],ayuda:'Gestión del personal: programador de censo de enfermedades, programador de cirugías, programador de erradicación, monitoreo de plagas, cirugía, calidad, auditoría y reportes'},
  datos:{roles:['superadmin','admin','supervisor','analista'],btn:'btDatos',icono:'🗄️',titulo:'ANÁLISIS DE DATOS',corto:'DATOS',tabs:['sync'],ayuda:'Analistas de datos: sincronización de los equipos'}};
GER.mod='ger';GER.tabMod={ger:'tablero',coord:'plan',datos:'sync'};
/* Módulos permitidos por rol (el analista de datos tiene los permisos de administrador: ve todo). */
const modPermitido=k=>!SES||MODS_GER[k].roles.includes(SES.rol);
function aplicarPermisosGer(){
  for(const [k,m] of Object.entries(MODS_GER)){const b=$('#'+m.btn);if(b)b.hidden=!modPermitido(k);}
  if(!modPermitido(GER.mod)){GER.mod=Object.keys(MODS_GER).find(modPermitido)||'datos';GER.tab=GER.tabMod[GER.mod];}
  if(GER.on&&!modPermitido(GER.mod))alternarGerencia(false);
}
(function montarGerencia(){
  const css=document.createElement('style');css.textContent=`
  #gerPanel{position:fixed;left:0;right:0;bottom:0;z-index:1150;background:radial-gradient(120% 60% at 50% 0%,#0d3a2a 0%,#06140f 60%);overflow:auto;padding:12px 16px 40px}
  #gerPanel .ger-cab{display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:sticky;top:-12px;background:#071a13;padding:10px 0;z-index:2;border-bottom:1px solid var(--borde)}
  #gerPanel .ger-cab h2{margin:0;font-family:var(--t);letter-spacing:1.5px;font-size:20px;flex:1}
  .ger-tabs{display:flex;gap:6px;flex-wrap:wrap}
  .ger-tabs button{border:1px solid var(--borde);background:transparent;color:var(--tenue);border-radius:999px;padding:6px 12px;font-family:var(--t);font-weight:700;font-size:13.5px;letter-spacing:.8px;cursor:pointer}
  .ger-tabs button.on{background:var(--acento);color:#032a1d;border-color:var(--acento)}
  .ger-sec{margin-top:16px}
  .ger-sec>h3{font-family:var(--t);letter-spacing:1.2px;font-size:17px;margin:0 0 8px;color:var(--acento)}
  .ger-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  .ger-kpi{border:1px solid var(--borde);border-radius:14px;padding:10px 12px;background:rgba(255,255,255,.03)}
  .ger-kpi b{display:block;font-family:var(--t);font-size:26px;line-height:1.1}
  .ger-kpi span{font-size:12px;color:var(--tenue)}
  .ger-kpi.mal b{color:#ff8a8a}.ger-kpi.med b{color:#ffd166}.ger-kpi.ok b{color:#7ef0c4}
  .ger-tabla{overflow-x:auto}
  .ger-tabla table{width:100%;border-collapse:collapse;font-size:13px}
  .ger-tabla th{position:sticky;top:0;background:#0b241b;text-align:left;font-family:var(--t);letter-spacing:.6px;font-size:12.5px;color:var(--tenue);padding:6px 6px;border-bottom:1px solid var(--borde);white-space:nowrap}
  .ger-tabla td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap}
  .ger-tabla td.n,.ger-tabla th.n{text-align:right;font-variant-numeric:tabular-nums}
  .ger-tabla tr.clic{cursor:pointer}.ger-tabla tr.clic:hover td{background:rgba(255,255,255,.04)}
  .ger-chip{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11.5px;font-weight:700;white-space:nowrap}
  .ger-chip.ok{background:rgba(34,211,154,.16);color:#8ff0cd}.ger-chip.med{background:rgba(255,197,61,.16);color:#ffe08a}.ger-chip.mal{background:rgba(255,93,93,.18);color:#ffb3b3}.ger-chip.gris{background:rgba(255,255,255,.08);color:var(--tenue)}
  .ger-aviso{border:1px solid rgba(255,197,61,.45);background:rgba(255,197,61,.08);border-radius:12px;padding:9px 12px;font-size:13.5px;margin:8px 0}
  .ger-mal{border-color:rgba(255,93,93,.5);background:rgba(255,93,93,.08)}
  .ger-par{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--tenue);margin:6px 0}
  .ger-par input[type=number]{width:70px;padding:4px 6px}
  #gerPanel input[type=number],#gerPanel select{background:rgba(255,255,255,.06);color:var(--texto);border:1px solid var(--borde);border-radius:8px;padding:4px 8px}
  #gerPanel select option{background:#0b241b}
  .ger-calor td.c{text-align:center;font-variant-numeric:tabular-nums;min-width:38px}
  .ger-barra{display:inline-block;height:8px;border-radius:4px;background:var(--acento);vertical-align:middle;margin-right:6px}
  #chCalor{cursor:pointer}
  .mc-etq{background:transparent;border:0;box-shadow:none;color:#111;font-size:8px;font-weight:600;padding:0;text-shadow:0 0 2px #fff,0 0 2px #fff}.mc-etq::before{display:none}
  .mc-sin-etq .mc-etq{display:none}
  .leaflet-marker-icon.mc-etq span{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;background:rgba(255,255,255,.85);border-radius:3px;padding:0 2px;line-height:1.25}
  #gerMapaCalor .leaflet-control-scale-line{background:rgba(255,255,255,.85);color:#222;border-color:#222}
  @media (max-width:900px){.mc-grid{grid-template-columns:1fr!important}}`;
  document.head.appendChild(css);
  for(const [k,m] of Object.entries(MODS_GER)){const bt=document.createElement('button');bt.className='btn mini';bt.id=m.btn;bt.innerHTML=`${m.icono} ${m.corto}`;bt.title=m.ayuda;
    $('#chDatos').before(bt);bt.onclick=()=>alternarGerencia(!(GER.on&&GER.mod===k),k);}
  const p=document.createElement('div');p.id='gerPanel';p.hidden=true;document.body.appendChild(p);
})();
function alternarGerencia(on,mod){
  if(mod&&!modPermitido(mod))return;
  if(mod&&MODS_GER[mod]&&mod!==GER.mod){GER.tabMod[GER.mod]=GER.tab;GER.mod=mod;GER.tab=GER.tabMod[mod];}
  if(!MODS_GER[GER.mod].tabs.includes(GER.tab))GER.tab=MODS_GER[GER.mod].tabs[0];
  GER.on=on==null?!GER.on:on;const p=$('#gerPanel');for(const [k,m] of Object.entries(MODS_GER))$('#'+m.btn).classList.toggle('prim',GER.on&&GER.mod===k);
  if(GER.on){const h=document.querySelector('header');p.style.top=(h?h.getBoundingClientRect().bottom:56)+'px';p.hidden=false;pintarGer();}
  else p.hidden=true;
}
function tablaGer(cols,filas,attr){
  return `<div class="ger-tabla"><table><thead><tr>${cols.map(c=>`<th class="${c.n?'n':''}">${c.t}</th>`).join('')}</tr></thead><tbody>${
    filas.length?filas.map((f,i)=>`<tr ${attr?attr(f,i):''}>${cols.map(c=>`<td class="${c.n?'n':''}">${c.f?c.f(f):esc(f[c.k]??'—')}</td>`).join('')}</tr>`).join('')
    :`<tr><td colspan="${cols.length}" class="tenue" style="padding:14px">Sin datos.</td></tr>`}</tbody></table></div>`;}
const kpi=(v,t,cls='')=>`<div class="ger-kpi ${cls}"><b>${v}</b><span>${t}</span></div>`;
const rangoTxt=()=>{const d1=$('#fDesde').value,d2=$('#fHasta').value;return d1&&d2?`${d1} a ${d2}`:'sin rango';};
const diasEntre=(a,b)=>Math.floor((Date.parse(b+'T12:00:00')-Date.parse(a+'T12:00:00'))/86400000);
function semanaISO(f){const d=new Date(f+'T12:00:00Z');const dia=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dia+3);const p=new Date(Date.UTC(d.getUTCFullYear(),0,4));
  const n=1+Math.round(((d-p)/86400000-3+((p.getUTCDay()+6)%7))/7);return `${d.getUTCFullYear()}-S${String(n).padStart(2,'0')}`;}
async function cargarRango(dias){const h=hoyISO(),d=hoyISO(new Date(Date.now()-dias*86400000));$('#fDesde').value=d;$('#fHasta').value=h;await cargar();pintarGer();}
function pintarGer(){
  const P=$('#gerPanel');if(!P||P.hidden)return;
  const M=MODS_GER[GER.mod];
  const cab=`<div class="ger-cab"><h2>${M.icono} ${M.titulo}</h2><div class="ger-tabs">${TABS_GER.filter(([k])=>M.tabs.includes(k)).sort((a,b)=>M.tabs.indexOf(a[0])-M.tabs.indexOf(b[0])).map(([k,t])=>`<button data-gt="${k}" class="${GER.tab===k?'on':''}">${t}</button>`).join('')}</div>
    <button class="btn mini" id="gerX" title="Cerrar y volver al mapa">✕ Cerrar</button></div>`;
  let cuerpo='';
  try{cuerpo=({plagas:pintarPlagasGer,progerr:pintarProgErrGer,progcir:pintarProgCir,plan:pintarPlanCenso,tablero:pintarTablero,cirugia:pintarCirGer,sync:pintarSync,calidad:pintarCalidad,auditoria:pintarAuditoria,reportes:pintarReportes}[GER.tab]||PINTAR_GER[GER.tab])();}
  catch(e){console.error(e);cuerpo=`<div class="ger-aviso ger-mal">⚠ ${esc(e.message)}</div>`;}
  P.innerHTML=cab+(usaFiltrosGer()?barraFiltrosGer():'')+cuerpo;
  $$('#gerPanel [data-gt]').forEach(b=>b.onclick=()=>{GER.tab=b.dataset.gt;pintarGer();});
  $('#gerX').onclick=()=>alternarGerencia(false);
  if(usaFiltrosGer())enlazarFiltrosGer();
  (ENLACES_GER[GER.tab]||(()=>{}))();
}
const ENLACES_GER={},PINTAR_GER={};   /* PINTAR_GER: pestañas que agregan otros módulos */
const sinDatos=()=>`<div class="ger-aviso">No hay jornadas cargadas. Cargue un rango de fechas (a la izquierda) o use un atajo:
  <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn mini prim" data-rango="30">Últimos 30 días</button><button class="btn mini" data-rango="60">60 días</button><button class="btn mini" data-rango="90">90 días</button></div></div>`;
function enlazarRango(){$$('#gerPanel [data-rango]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Cargando…';try{await cargarRango(+b.dataset.rango);}catch(e){toast(e.message,6000);}});}

/* ---------------- TABLERO ---------------- */
function pintarTablero(){
  if(!JOR.length)return sinDatos();
  const L=resumenLotes(),O=resumenOperarios();
  const pc=L.reduce((a,x)=>a+(x.pc||0),0),tot=L.reduce((a,x)=>a+(x.total_lote||0),0);
  const ha=JORF.reduce((a,j)=>a+(Number(j.ha)||0),0),palmas=JORF.reduce((a,j)=>a+(Number(j.palmas)||0),0),diags=DIAGF.length;
  const kp=`<div class="ger-kpis">${kpi(num(JORF.length),'Jornadas')}${kpi(num(new Set(JORF.map(j=>j.usuario)).size),'Operarios')}${kpi(num(ha,1),'Ha recorridas')}${kpi(num(palmas),'Palmas visitadas')}
    ${kpi(num(diags),'Diagnósticos')}${kpi(num(pc),'Casos de PC',pc?'mal':'ok')}${kpi(tot?num(pc/tot*100,2)+' %':'—','Incidencia PC (lotes con censo)')}${kpi(num(O.length?ha/Math.max(1,O.reduce((a,o)=>a+o.dias,0)):0,2),'Ha por operario-día')}</div>`;
  // Productividad por operario
  const prod=O.map(o=>({...o,hah:o.min_efe>0?o.ha/(o.min_efe/60):null,pah:o.min_efe>0?o.palmas/(o.min_efe/60):null,dj:o.jornadas?o.diag/o.jornadas:0})).sort((a,b)=>(b.hah||0)-(a.hah||0));
  const maxH=Math.max(1,...prod.map(x=>x.hah||0));
  const tProd=tablaGer([{t:'Operario',f:x=>esc(x.evaluador)},{t:'Jornadas',n:1,f:x=>num(x.jornadas)},{t:'Días',n:1,f:x=>num(x.dias)},{t:'Ha',n:1,f:x=>num(x.ha,2)},{t:'Ha/día',n:1,f:x=>num(x.ha_dia,2)},
    {t:'Ha/hora efectiva',f:x=>x.hah==null?'—':`<span class="ger-barra" style="width:${Math.round(60*x.hah/maxH)}px"></span>${num(x.hah,2)}`},{t:'Palmas/hora',n:1,f:x=>x.pah==null?'—':num(x.pah)},
    {t:'Horas efectivas',n:1,f:x=>num(x.min_efe/60,1)},{t:'Diag./jornada',n:1,f:x=>num(x.dj,1)},{t:'Km',n:1,f:x=>num(x.km,1)},{t:'Vel. km/h',n:1,f:x=>x.vel==null?'—':num(x.vel,1)}],prod);
  // Incidencia de PC por lote y semana: casos nuevos de PC (primera vez que la palma aparece como caso en el periodo)
  const primera=new Map();
  for(const j of JORF)for(const d of j.diags){if(!esCasoPC(codN1(d),d.nivel2,d.estado))continue;if(!loteSel(d.lote)||!enProg(d.lote))continue;
    const k=d.palma_id??(d.lote+'|'+d.linea+'|'+d.palma);const f=d.creado?hoyISO(new Date(d.creado)):String(j.fecha).slice(0,10);const u=primera.get(k);if(!u||f<u.f)primera.set(k,{f,lote:d.lote});}
  const semanas=[...new Set([...primera.values()].map(x=>semanaISO(x.f)))].sort();
  const porLote=new Map();for(const x of primera.values()){const s=semanaISO(x.f);if(!porLote.has(x.lote))porLote.set(x.lote,new Map());const m=porLote.get(x.lote);m.set(s,(m.get(s)||0)+1);}
  const lotesPC=[...porLote.entries()].map(([l,m])=>({lote:l,m,tot:[...m.values()].reduce((a,b)=>a+b,0),incid:(L.find(x=>x.lote===l)||{}).incid_pc})).sort((a,b)=>b.tot-a.tot);
  const maxC=Math.max(1,...lotesPC.flatMap(x=>[...x.m.values()]));
  const celda=v=>v?`<td class="c" style="background:rgba(229,57,53,${(.15+.75*v/maxC).toFixed(2)})">${v}</td>`:'<td class="c tenue">·</td>';
  const tCalor=lotesPC.length?`<div class="ger-tabla ger-calor"><table><thead><tr><th>Lote</th>${semanas.map(s=>`<th class="n">${s.slice(5)}</th>`).join('')}<th class="n">Total</th><th class="n">Incidencia actual</th></tr></thead><tbody>${
    lotesPC.map(x=>`<tr><td><b>${esc(x.lote)}</b></td>${semanas.map(s=>celda(x.m.get(s)||0)).join('')}<td class="n"><b>${x.tot}</b></td><td class="n">${x.incid==null?'—':num(x.incid,2)+' %'}</td></tr>`).join('')}</tbody></table></div>`
    :'<p class="tenue">No hay casos de PC en el periodo cargado.</p>';
  // Avance del ciclo de censo: último censo por lote y días transcurridos
  const ult=new Map();for(const j of JORF)for(const x of j.por_lote){const u=ult.get(x.lote);if(!u||j.fecha>u)ult.set(x.lote,j.fecha);}
  const hoy=hoyISO(),X=GER.umbralCiclo;
  const todos=(LOTES?LOTES.features.map(f=>f.properties._lote):[...ult.keys()]).filter(l=>l&&enProg(l)&&loteSel(l));
  const ciclo=[...new Set(todos)].map(l=>{const f=ult.get(l);const r=L.find(x=>x.lote===l)||{};const d=f?diasEntre(f,hoy):null;
    return {lote:l,prog:PROG.get(l)||'',ultimo:f||null,dias:d,avance:r.avance,estado:d==null?'sin':d>X?'mal':d>X/2?'med':'ok'};})
    .sort((a,b)=>({sin:0,mal:1,med:2,ok:3}[a.estado]-{sin:0,mal:1,med:2,ok:3}[b.estado])||(b.dias??1e9)-(a.dias??1e9)||ordenNat(a.lote,b.lote));
  const nMal=ciclo.filter(x=>x.estado==='mal').length,nSin=ciclo.filter(x=>x.estado==='sin').length;
  const chipC=x=>x.estado==='sin'?'<span class="ger-chip gris">Sin censo en el periodo</span>':x.estado==='mal'?`<span class="ger-chip mal">${x.dias} días</span>`:x.estado==='med'?`<span class="ger-chip med">${x.dias} días</span>`:`<span class="ger-chip ok">${x.dias} días</span>`;
  const tCiclo=tablaGer([{t:'Lote',f:x=>`<b>${esc(x.lote)}</b>`},{t:'Programa',f:x=>esc(x.prog||'—')},{t:'Último censo',f:x=>esc(x.ultimo||'—')},{t:'Desde el último censo',f:chipC},{t:'Avance en el periodo',n:1,f:x=>x.avance==null?'—':num(x.avance,1)+' %'}],ciclo);
  return `<p class="tenue">Datos: ${esc(rangoTxt())} · ${num(JORF.length)} jornadas con los filtros de arriba.</p>${kp}
    <div class="ger-sec"><h3>Productividad por operario</h3><p class="tenue">Ha/hora y palmas/hora sobre el tiempo efectivo (sin paradas). Ordenado de mayor a menor rendimiento.</p>${tProd}</div>
    <div class="ger-sec"><h3>Mapas de PC por lote</h3>
      <p class="tenue">Superficie interpolada (IDW) a partir del valor de cada lote, por clases, sobre toda la plantación (sin ortofoto). Con los filtros de la izquierda.
        <b>Incidencia actual</b> = casos vigentes (último diagnóstico PC, sin recuperación, alta ni tratamiento) ÷ palmas del lote. <b>Casos nuevos</b> = palmas que aparecen por primera vez como caso en el periodo cargado (${esc(rangoTxt())}).</p>
      <div class="ger-par"><button class="btn mini ${(GER.mcModo||'incid')==='incid'?'prim':''}" data-mcm="incid">Incidencia actual PC</button>
        <button class="btn mini ${GER.mcModo==='nuevos'?'prim':''}" data-mcm="nuevos">Casos nuevos PC</button>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="mcNombres" ${GER.mcNombres!==false?'checked':''}> Nombres de lote</label>
        <span id="mcResumen"></span></div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px" class="mc-grid">
        <div id="gerMapaCalor" style="height:640px;border-radius:14px;border:1px solid var(--borde);background:#fff"></div>
        <div><div id="mcLeyenda"></div><div id="mcTop" class="ger-tabla" style="max-height:330px;overflow:auto;margin-top:10px"></div></div></div></div>
    <div class="ger-sec"><h3>Casos nuevos de PC por lote y semana</h3><p class="tenue">Primera vez que cada palma aparece como caso de PC en el periodo. Más rojo = más casos. La incidencia actual es casos vigentes ÷ palmas del lote.</p>
      <div class="ger-par"><button class="btn mini ${GER.calor?'prim':''}" id="gerCalor">🔥 ${GER.calor?'Quitar':'Ver'} mapa de calor de PC en el mapa</button></div>${tCalor}</div>
    <div class="ger-sec"><h3>Avance del ciclo de censo</h3>${nMal||nSin?`<div class="ger-aviso ${nMal?'ger-mal':''}">⚠ ${nMal?`<b>${nMal}</b> lote(s) llevan más de ${X} días sin censo`:''}${nMal&&nSin?' · ':''}${nSin?`<b>${nSin}</b> lote(s) sin censo en el periodo cargado (cargue un rango más largo para verlos)`:''}.</div>`:''}
      <div class="ger-par">Alerta si pasan más de <input type="number" id="gerCiclo" min="1" max="365" value="${X}"> días sin censo</div>${tCiclo}</div>`;
}
ENLACES_GER.tablero=()=>{enlazarRango();montarMapaCalor();
  const c=$('#gerCiclo');if(c)c.onchange=()=>{GER.umbralCiclo=Math.max(1,Number(c.value)||30);pintarGer();};
  const b=$('#gerCalor');if(b)b.onclick=()=>{alternarCalor();pintarGer();if(GER.calor)alternarGerencia(false);};};
/* Casos de PC vigentes: último diagnóstico de cada palma (con los filtros), que sigue siendo PC. */
function casosPCActivos(){
  const ult=new Map();for(const j of JORF)for(const d of j.diags){if(!loteSel(d.lote)||!enProg(d.lote))continue;const k=d.palma_id??(d.lote+'|'+d.linea+'|'+d.palma);const u=ult.get(k);if(!u||String(d.creado)>String(u.creado))ult.set(k,d);}
  return [...ult.values()].filter(d=>esCasoPC(codN1(d),d.nivel2,d.estado)&&d.lat!=null&&!VAJ.has(String(d.palma_id)));   /* sin las palmas erradicadas con existencia 0 aprobada */
}
/* Casos nuevos de PC en el periodo: primera vez que cada palma aparece como caso (con su diagnóstico de esa vez). */
function casosPCNuevos(){
  const pri=new Map();
  for(const j of JORF)for(const d of j.diags){if(!esCasoPC(codN1(d),d.nivel2,d.estado)||!loteSel(d.lote)||!enProg(d.lote))continue;
    const k=d.palma_id??(d.lote+'|'+d.linea+'|'+d.palma);const u=pri.get(k);if(!u||String(d.creado)<String(u.creado))pri.set(k,d);}
  return [...pri.values()].filter(d=>d.lat!=null);
}
/* Clases de los mapas (como los mapas oficiales de Sanidad Vegetal) */
const MC_COL=['#2c7bb6','#abdda4','#ffffbf','#fdae61','#d7191c'];
const MC_CLASES={incid:{titulo:'INCIDENCIA ACTUAL PC',ley:'Incidencia PC',cortes:[1,2,3,4],etq:['≤ 1,0 %','1,0 % – 2,0 %','2,0 % – 3,0 %','3,0 % – 4,0 %','> 4,0 %']},
  nuevos:{titulo:'CASOS NUEVOS PC',ley:'N.º casos nuevos PC',cortes:[3,6,9,12],etq:['≤ 3','3 – 6','6 – 9','9 – 12','> 12']}};
const claseMC=(v,c)=>{let k=0;while(k<c.length&&v>c[k])k++;return k;};
/* Superficie IDW (12 lotes más cercanos, potencia 2) en celdas de CEL metros, recortada a los lotes. Devuelve el lienzo y el área por clase. */
function superficieMC(feats,vals,cortes,CEL,pinta){
  pinta=pinta&&pinta.length?pinta:feats;   /* se pinta toda la plantación (si está disponible); el área por clase se cuenta solo en los lotes */
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;const anillos=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  for(const f of pinta.concat(feats))for(const pol of anillos(f))for(const r of pol)for(const [x,y] of r){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  const mx=111320*Math.cos((y0+y1)/2*Math.PI/180),my=110540,dlon=CEL/mx,dlat=CEL/my,W=Math.ceil((x1-x0)/dlon)+1,H=Math.ceil((y1-y0)/dlat)+1;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.fillStyle='#000';
  const mascara=fs=>{g.clearRect(0,0,W,H);for(const f of fs)for(const pol of anillos(f)){g.beginPath();for(const r of pol)r.forEach(([x,y],i)=>{const px=(x-x0)/dlon,py=(y1-y)/dlat;i?g.lineTo(px,py):g.moveTo(px,py);});g.fill('evenodd');}   /* cada polígono por separado */
    return g.getImageData(0,0,W,H).data;};
  const MA=mascara(feats),M=pinta===feats?MA:mascara(pinta);
  const P=[];for(const f of feats){const l=f.properties._lote,c=centroLote(l);if(c)P.push([(c[1]-x0)*mx,(y1-c[0])*my,vals.get(l)||0]);}
  const K=Math.min(12,P.length),bd=new Float64Array(K),bv=new Float64Array(K);
  const img=g.createImageData(W,H),D=img.data,area=[0,0,0,0,0],RGB=MC_COL.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const o=(j*W+i)*4;if(M[o+3]<128)continue;
    const px=i*CEL+CEL/2,py=j*CEL+CEL/2;let n=0,exacto=null;
    for(const q of P){const dx=q[0]-px,dy=q[1]-py,d2=dx*dx+dy*dy;if(d2<1){exacto=q[2];break;}
      if(n<K){let k=n++;while(k>0&&bd[k-1]>d2){bd[k]=bd[k-1];bv[k]=bv[k-1];k--;}bd[k]=d2;bv[k]=q[2];}
      else if(d2<bd[K-1]){let k=K-1;while(k>0&&bd[k-1]>d2){bd[k]=bd[k-1];bv[k]=bv[k-1];k--;}bd[k]=d2;bv[k]=q[2];}}
    let v=exacto;if(v==null){let sw=0,sv=0;for(let k=0;k<n;k++){const w=1/bd[k];sw+=w;sv+=w*bv[k];}v=sw?sv/sw:0;}
    const c=claseMC(v,cortes);if(MA[o+3]>=128)area[c]++;const rgb=RGB[c];D[o]=rgb[0];D[o+1]=rgb[1];D[o+2]=rgb[2];D[o+3]=255;}
  g.clearRect(0,0,W,H);g.putImageData(img,0,0);
  // Hectáreas: proporción de cada clase × área oficial de los lotes (Area_ha); sin ese dato, el área de las celdas
  const oficial=feats.reduce((a,f)=>a+(Number(f.properties.Area_ha)||0),0),celdas=area.reduce((a,b)=>a+b,0);
  return {cv,limites:[[y1-H*dlat,x0],[y1,x0+W*dlon]],ha:area.map(n=>oficial&&celdas?n/celdas*oficial:n*CEL*CEL/10000)};
}
/* Límite de la plantación (cartografia/plantacion.geojson del repositorio de datos, el mismo que usa la App) */
async function cargarPlantacionGer(){
  try{const t=await (await gh(`/contents/cartografia/plantacion.geojson?ref=${encodeURIComponent(SES.repo.rama)}`,'application/vnd.github.raw+json')).text();const g=JSON.parse(t);
    const fs=(g.type==='FeatureCollection'?g.features:g.type==='Feature'?[g]:[{type:'Feature',properties:{},geometry:g}]).filter(f=>f&&f.geometry&&/Polygon/.test(f.geometry.type));
    GER.plant=fs.length?fs:null;}catch(e){GER.plant=null;}
}
/* Nombre del lote en su centro (marcador de texto fijo, no tapa los clics) */
function etiquetaLoteMC(m,lo){const c=centroLote(lo);if(c)L.marker(c,{icon:L.divIcon({className:'mc-etq',html:`<span>${esc(lo)}</span>`,iconSize:null}),interactive:false,keyboard:false}).addTo(m);}
/* Control con la flecha del norte (como los mapas impresos) */
const NorteMC=L.Control.extend({onAdd(){const d=L.DomUtil.create('div');d.innerHTML='<div style="font:700 13px sans-serif;color:#222;text-align:center;line-height:1">N<br><span style="font-size:24px">⬆</span></div>';return d;}});
function montarMapaCalor(){
  const el=$('#gerMapaCalor');if(!el)return;
  if(GER.mc){try{GER.mcVista={c:GER.mc.getCenter(),z:GER.mc.getZoom()};GER.mc.off();GER.mc.remove();}catch(e){}GER.mc=null;}
  const modo=GER.mcModo||'incid',C=MC_CLASES[modo];
  if(GER.plant===undefined){GER.plant=null;cargarPlantacionGer().then(()=>{if(GER.plant&&$('#gerMapaCalor'))montarMapaCalor();});}
  const sinFiltro=!FIL.lote.size&&!FIL.prog.size,plant=sinFiltro&&GER.plant?GER.plant:null;
  const feats=LOTES?LOTES.features.filter(f=>f.geometry&&/Polygon/.test(f.geometry.type)&&enProg(f.properties._lote)&&loteSel(f.properties._lote)):[];
  const casos=modo==='incid'?casosPCActivos():casosPCNuevos();
  const n=new Map();for(const d of casos)n.set(d.lote,(n.get(d.lote)||0)+1);
  const vals=new Map();for(const f of feats){const l=f.properties._lote,c=n.get(l)||0,tl=totalLote(l);vals.set(l,modo==='incid'?(tl?c/tl*100:0):c);}
  const m=L.map(el,{zoomControl:true,attributionControl:false,preferCanvas:true,minZoom:11,maxZoom:20,zoomSnap:.25});GER.mc=m;
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(m);new NorteMC({position:'topright'}).addTo(m);
  let sup=null;
  if(feats.length){const key=modo+'|'+feats.length+'|'+[...vals].map(x=>x[0]+':'+x[1].toFixed(3)).join(',');
    if(GER.mcCache&&GER.mcCache.key===key+(plant?'|P':''))sup=GER.mcCache.sup;else{sup=superficieMC(feats,vals,C.cortes,20,plant);GER.mcCache={key:key+(plant?'|P':''),sup};}
    L.imageOverlay(sup.cv.toDataURL(),sup.limites,{opacity:1,interactive:false}).addTo(m);}
  const capaL=L.geoJSON({type:'FeatureCollection',features:feats},{style:{color:'#111',weight:.8,fill:true,fillOpacity:0}}).addTo(m);
  if(plant)L.geoJSON({type:'FeatureCollection',features:plant},{style:{color:'#000',weight:3,fill:false},interactive:false}).addTo(m);
  const fmt=v=>modo==='incid'?num(v,2)+' %':num(v)+' caso'+(v===1?'':'s');
  capaL.eachLayer(l=>{const lo=l.feature.properties._lote,v=vals.get(lo)||0;
    l.bindTooltip(`<b>${esc(lo)}</b> · ${modo==='incid'?`${num(n.get(lo)||0)} casos activos · incidencia ${num(v,2)} %`:`${num(v)} casos nuevos`}`,{sticky:true});
    if(GER.mcNombres!==false)etiquetaLoteMC(m,lo);});
  // Etiquetas solo con suficiente acercamiento (si no, se tapan)
  const etq=()=>{const z=m.getZoom();el.classList.toggle('mc-sin-etq',z<12);};m.on('zoomend',etq);
  // Cada palma con caso al acercarse (zoom 17 o más)
  const pal=L.layerGroup();for(const d of casos)L.circleMarker([d.lat,d.lng],{radius:3.5,color:'#000',weight:1,fillColor:'#d7191c',fillOpacity:1})
    .bindTooltip(`${esc(d.lote)} · L${esc(d.linea??'?')} · P${esc(d.palma??'?')}<br>${esc(d.nivel2||'')} · ${esc(String(d.creado||'').slice(0,10))}`).addTo(pal);
  const verPal=()=>{if(m.getZoom()>=17)pal.addTo(m);else m.removeLayer(pal);};m.on('zoomend',verPal);
  if(GER.mcVista&&GER.mcVistaModo===modo)m.setView(GER.mcVista.c,GER.mcVista.z);else if(feats.length)m.fitBounds(capaL.getBounds(),{padding:[10,10]});else m.setView([1.52,-78.77],13);
  GER.mcVistaModo=modo;verPal();etq();setTimeout(()=>m.invalidateSize(),60);
  GER.mcCasos=casos.length;GER.mcHa=sup?sup.ha:[0,0,0,0,0];
  $('#mcResumen').innerHTML=`<b>${num(casos.length)}</b> ${modo==='incid'?'casos activos':'casos nuevos'} en <b>${num(n.size)}</b> lotes`;
  // Convenciones: incidencia → solo color y rango; casos nuevos → color, rango y número de casos de los lotes en cada rango
  const casosClase=[0,0,0,0,0];if(modo==='nuevos')for(const [,v] of vals)casosClase[claseMC(v,C.cortes)]+=v;
  $('#mcLeyenda').innerHTML=`<div style="background:#fff;color:#222;border-radius:12px;padding:12px 14px">
      <div style="font-family:var(--t);font-size:17px;letter-spacing:1px;color:#555;margin-bottom:6px">${C.titulo}</div>
      <table style="border-collapse:collapse;font-size:13px"><thead><tr style="color:#555"><th style="text-align:left;padding:3px 4px">${C.ley}</th>${modo==='nuevos'?'<th style="text-align:right;padding:3px 4px 3px 18px">Casos</th>':''}</tr></thead>
      <tbody>${C.etq.map((t,i)=>`<tr data-mcc="${i}"><td style="padding:4px"><span style="display:inline-block;width:26px;height:14px;background:${MC_COL[i]};border:1px solid #555;vertical-align:middle;margin-right:8px"></span>${t}</td>${
        modo==='nuevos'?`<td style="text-align:right;padding:4px 4px 4px 18px">${num(casosClase[i])}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
  const top=[...vals.entries()].filter(x=>x[1]>0).map(([l,v])=>({l,v,c:n.get(l)||0})).sort((a,b)=>b.v-a.v);
  $('#mcTop').innerHTML=tablaGer([{t:'Lote',f:x=>`<b>${esc(x.l)}</b>`},{t:modo==='incid'?'Casos':'Casos nuevos',n:1,f:x=>num(x.c)},...(modo==='incid'?[{t:'Incidencia',n:1,f:x=>num(x.v,2)+' %'}]:[])],top,x=>`class="clic" data-mcl="${esc(x.l)}"`);
  $$('#mcTop [data-mcl]').forEach(tr=>tr.onclick=()=>{const l=tr.dataset.mcl;let bb=null;capaL.eachLayer(y=>{if(y.feature.properties._lote===l)bb=y.getBounds();});if(bb)m.fitBounds(bb,{padding:[30,30],maxZoom:17});});
  $$('#gerPanel [data-mcm]').forEach(b=>b.onclick=()=>{GER.mcModo=b.dataset.mcm;pintarGer();});
  const nn=$('#mcNombres');if(nn)nn.onchange=()=>{GER.mcNombres=nn.checked;montarMapaCalor();};
}
/* Mapa de calor de los casos de PC vigentes sobre el mapa principal (ortofoto). */
function alternarCalor(){
  if(GER.calor){mapa.removeLayer(GER.calor);GER.calor=null;const c=$('#chCalor');if(c)c.remove();return;}
  const casos=casosPCActivos();
  GER.calor=L.layerGroup();
  for(const d of casos){L.circle([d.lat,d.lng],{radius:45,stroke:false,fillColor:'#ff3d00',fillOpacity:.10,interactive:false}).addTo(GER.calor);
    L.circle([d.lat,d.lng],{radius:18,stroke:false,fillColor:'#ffd600',fillOpacity:.22,interactive:false}).addTo(GER.calor);}
  GER.calor.addTo(mapa);
  const ch=document.createElement('span');ch.className='chip';ch.id='chCalor';ch.title='Quitar el mapa de calor';ch.innerHTML=`🔥 Calor PC: ${num(casos.length)} casos ✕`;ch.onclick=()=>alternarCalor();$('#btDatos').after(ch);
  if(casos.length){try{mapa.fitBounds(L.latLngBounds(casos.map(d=>[d.lat,d.lng])),{padding:[40,40],maxZoom:16});}catch(e){}}
  else toast('No hay casos de PC vigentes en el periodo y filtros cargados.');
}

/* ---------------- CIRUGÍA: ciclo censo → cirugía ---------------- */
/* Programador de cirugías: trabaja sobre el mapa (casos de PC, parejas y rutas), por eso se abre en el modo de cirugías del visor. */
function pintarProgCir(){
  return `<div class="ger-sec"><h3>Programador de cirugías</h3>
    <p class="tenue">Reparte los casos de pudrición de cogollo entre las parejas de cirugía (cirujano + auxiliar) según su eficiencia, con rutas óptimas sobre el mapa,
      calendario al día hábil siguiente, correcciones versionadas y seguimiento de lo operado. Lo programado llega a la App de cada cirujano y auxiliar.</p>
    <div class="ger-par"><button class="btn prim" id="gerAbrirCir">✚ Abrir el programador de cirugías en el mapa</button>
      <button class="btn mini" data-gt-ir="cirugia">Ver indicadores de cirugía</button></div>
    <p class="tenue">También se abre con el botón <b>✚ CIRUGÍAS</b> de la parte superior. Para volver, toque de nuevo <b>✚ CIRUGÍAS</b> y luego <b>🧭 COORDINACIÓN</b>.</p></div>`;
}
ENLACES_GER.progcir=()=>{const b=$('#gerAbrirCir');if(b)b.onclick=()=>{alternarGerencia(false);if(!CIR.on)alternarCirugia(true);};
  const v=document.querySelector('#gerPanel [data-gt-ir]');if(v)v.onclick=()=>{GER.tab=v.dataset.gtIr;pintarGer();};};
function pintarCirGer(){
  if(!CIR.cargado)return `<div class="ger-aviso">${CIR.cargando?'Cargando el censo de los últimos 45 días y las cirugías…':'Los indicadores de cirugía usan el censo de los últimos 45 días y las jornadas de cirugía.'}
    ${CIR.cargando?'':'<div style="margin-top:8px"><button class="btn mini prim" id="gerCirCargar">Cargar datos de cirugía</button></div>'}</div>`;
  const hoy=hoyISO();const casos=new Map();
  for(const d of [...CIR.diags,...CIR.correcciones]){if(!esCasoCirugia(d))continue;const k=String(d.palma_id);const t=tDe(d);const u=casos.get(k);if(!u||t<u.t)casos.set(k,{t,d});}
  const filas=[];
  for(const [k,{t,d}] of casos){const vence=habilMas(fechaISO(new Date(t)));const c=CIR.cirugias.filter(x=>String(x.palma_id)===k&&tDe(x)>=t-60000).sort((a,b)=>tDe(a)-tDe(b))[0];
    const tc=c?tDe(c):null;filas.push({palma_id:k,lote:d.lote,linea:d.linea,palma:d.palma,n2:d.nivel2||'',censo:fechaISO(new Date(t)),vence,cir:tc?fechaISO(new Date(tc)):null,
      horas:tc?(tc-t)/3600000:null,atiempo:tc?fechaISO(new Date(tc))<=vence:null,vencido:!tc&&vence<hoy,pareja:c&&c._j&&c._j.pareja?`${nombreCorto(c._j.pareja.cirujano&&c._j.pareja.cirujano.nombre)} + ${nombreCorto(c._j.pareja.auxiliar&&c._j.pareja.auxiliar.nombre)}`:''});}
  const oper=filas.filter(x=>x.cir),hs=oper.map(x=>x.horas).sort((a,b)=>a-b),med=hs.length?hs[Math.floor(hs.length/2)]:null,prom=hs.length?hs.reduce((a,b)=>a+b,0)/hs.length:null;
  const venc=filas.filter(x=>x.vencido),evaluables=filas.filter(x=>x.vence<=hoy),aTiempo=evaluables.filter(x=>x.atiempo).length;
  const cump=evaluables.length?aTiempo/evaluables.length*100:null;
  const kp=`<div class="ger-kpis">${kpi(num(filas.length),'Casos de cirugía (45 días)')}${kpi(num(oper.length),'Operados')}${kpi(num(CIR.pend.length),'Pendientes hoy',CIR.pend.length?'med':'ok')}
    ${kpi(num(venc.length),'Vencidos sin operar',venc.length?'mal':'ok')}${kpi(cump==null?'—':num(cump,0)+' %','Operados a tiempo (D+1 hábil)',cump==null?'':cump>=90?'ok':cump>=70?'med':'mal')}
    ${kpi(prom==null?'—':num(prom/24,1)+' d','Tiempo promedio caso → cirugía')}${kpi(med==null?'—':num(med/24,1)+' d','Mediana caso → cirugía')}</div>`;
  // Por pareja
  const pm=new Map();for(const c of CIR.cirugias){const j=c._j||{};const p=j.pareja?`${nombreCorto(j.pareja.cirujano&&j.pareja.cirujano.nombre)} + ${nombreCorto(j.pareja.auxiliar&&j.pareja.auxiliar.nombre)}`:(j.evaluador||'—');
    let f=pm.get(p);if(!f)pm.set(p,f={pareja:p,cir:0,dias:new Set(),atiempo:0,eval:0});f.cir++;f.dias.add(fechaISO(new Date(tDe(c))));}
  for(const x of oper){const f=pm.get(x.pareja);if(f&&x.vence<=hoy){f.eval++;if(x.atiempo)f.atiempo++;}}
  const tPar=tablaGer([{t:'Pareja',f:x=>esc(x.pareja)},{t:'Cirugías',n:1,f:x=>num(x.cir)},{t:'Días con cirugía',n:1,f:x=>num(x.dias.size)},{t:'Cirugías/día',n:1,f:x=>num(x.cir/Math.max(1,x.dias.size),1)},
    {t:'A tiempo',n:1,f:x=>x.eval?num(x.atiempo/x.eval*100,0)+' %':'—'}],[...pm.values()].sort((a,b)=>b.cir-a.cir));
  // Por lote
  const lm=new Map();for(const x of filas){let f=lm.get(x.lote);if(!f)lm.set(x.lote,f={lote:x.lote,casos:0,oper:0,pend:0,venc:0});f.casos++;if(x.cir)f.oper++;else f.pend++;if(x.vencido)f.venc++;}
  const tLote=tablaGer([{t:'Lote',f:x=>`<b>${esc(x.lote)}</b>`},{t:'Casos',n:1,f:x=>num(x.casos)},{t:'Operados',n:1,f:x=>num(x.oper)},{t:'Pendientes',n:1,f:x=>num(x.pend)},{t:'Vencidos',n:1,f:x=>x.venc?`<span class="ger-chip mal">${x.venc}</span>`:'0'}],
    [...lm.values()].sort((a,b)=>b.venc-a.venc||b.pend-a.pend||ordenNat(a.lote,b.lote)));
  const tVenc=tablaGer([{t:'Palma',f:x=>`<b>${esc(x.lote)} · L${esc(x.linea??'?')} · P${esc(x.palma??'?')}</b>`},{t:'Diagnóstico',f:x=>esc(x.n2)},{t:'Censo',f:x=>esc(x.censo)},{t:'Vencía',f:x=>esc(x.vence)},
    {t:'Atraso',n:1,f:x=>`<span class="ger-chip mal">${diasEntre(x.vence,hoy)} d</span>`}],venc.sort((a,b)=>a.vence.localeCompare(b.vence)).slice(0,60));
  return `<p class="tenue">Censo de los últimos 45 días y jornadas de cirugía. Un caso cuenta desde la primera vez que la palma queda como caso de cirugía (PC inicial, avanzada o reincidente).</p>${kp}
    <div class="ger-sec"><h3>Por pareja</h3>${tPar}</div><div class="ger-sec"><h3>Por lote</h3>${tLote}</div>
    <div class="ger-sec"><h3>Casos vencidos sin operar (${num(venc.length)})</h3>${tVenc}</div>
    <div style="margin-top:12px"><button class="btn mini" id="gerCirRecargar">↻ Volver a cargar</button></div>`;
}
ENLACES_GER.cirugia=()=>{const b=$('#gerCirCargar')||$('#gerCirRecargar');if(b)b.onclick=async()=>{CIR.cargado=false;const t=cirCargar();pintarGer();await t;pintarGer();};};

/* ---------------- SINCRONIZACIÓN ---------------- */
const normN=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
async function cargarSync(){
  GER.cargandoSync=true;pintarGer();
  try{
    const us=await cirUsuarios();
    const desde=new Date(Date.now()-30*86400000).toISOString();const envios=[];
    for(let page=1;page<=30;page++){
      const l=await (await gh(`/commits?sha=${encodeURIComponent(SES.repo.rama)}&since=${encodeURIComponent(desde)}&per_page=100&page=${page}`)).json();
      if(!Array.isArray(l)||!l.length)break;
      for(const c of l){const m=String(c.commit&&c.commit.message||'');if(!m.startsWith('Sanidad Vegetal'))continue;
        const u=(m.match(/·\s*u:([^\s·]+)\s*$/m)||[])[1]||null;const cir=/· Cirugía ·/.test(m);
        const partes=m.split('\n')[0].split('·').map(s=>s.trim());const ev=cir?partes[2]:partes[1];const fecha=(m.match(/\d{4}-\d{2}-\d{2}/)||[])[0]||null;
        envios.push({u,ev,cir,fecha,t:Date.parse(c.commit.committer&&c.commit.committer.date||c.commit.author.date)});}
      if(l.length<100)break;}
    const porNombre=new Map(us.map(x=>[normN(x.nombre),x.u]));
    const ult=new Map();
    for(const e of envios){const u=e.u||porNombre.get(normN(e.ev))||('?'+normN(e.ev));let f=ult.get(u);if(!f)ult.set(u,f={t:0,fecha:null,n7:0,n30:0,cir:0});
      if(e.t>f.t){f.t=e.t;f.fecha=e.fecha;}f.n30++;if(Date.now()-e.t<=7*86400000)f.n7++;if(e.cir)f.cir++;}
    const filas=[];
    for(const x of us){if(x.inactivo)continue;const lab=x.labores&&x.labores.length?x.labores:(['admin','analista','superadmin','supervisor'].includes(x.rol)?['censo','cirugia']:['censo']);
      if(x.rol!=='operario')continue; // solo operarios de campo
      const f=ult.get(x.u)||null;filas.push({u:x.u,nombre:x.nombre,cargo:x.cargo||'',lab,ult:f&&f.t||null,fecha:f&&f.fecha,n7:f?f.n7:0,n30:f?f.n30:0});}
    GER.sync={filas,cuando:Date.now(),envios:envios.length};
  GER.syncErr=null;}catch(e){toast(e.message,6000);GER.sync=GER.sync||null;GER.syncErr=e.message;}   // sin reintento automático: se consulta con el botón
  finally{GER.cargandoSync=false;pintarGer();}
}
function pintarSync(){
  if(!GER.sync)return `<div class="ger-aviso ${GER.syncErr&&!GER.cargandoSync?'ger-mal':''}">${GER.syncErr&&!GER.cargandoSync?'⚠ No se pudo consultar: '+esc(GER.syncErr)+'<br>':''}${GER.cargandoSync?'Consultando los envíos de los últimos 30 días en GitHub…':'Revisa cuándo envió cada operario su última jornada (últimos 30 días).'}
    ${GER.cargandoSync?'':'<div style="margin-top:8px"><button class="btn mini prim" id="gerSyncCargar">Consultar sincronización</button></div>'}</div>`;
  const N=GER.umbralSync,ahora=Date.now();
  const filas=GER.sync.filas.map(f=>{const dias=f.ult?Math.floor((ahora-f.ult)/86400000):null;return {...f,dias,estado:f.ult==null?'nunca':dias>N?'mal':dias>=1?'med':'ok'};})
    .sort((a,b)=>({nunca:0,mal:1,med:2,ok:3}[a.estado]-{nunca:0,mal:1,med:2,ok:3}[b.estado])||(b.dias??1e9)-(a.dias??1e9)||ordenNat(a.nombre,b.nombre));
  const nMal=filas.filter(x=>x.estado==='mal').length,nNunca=filas.filter(x=>x.estado==='nunca').length,nOk=filas.filter(x=>x.estado==='ok'||x.estado==='med').length;
  const chip=x=>x.estado==='nunca'?'<span class="ger-chip gris">Sin envíos en 30 días</span>':x.estado==='mal'?`<span class="ger-chip mal">${x.dias} días sin sincronizar</span>`:x.estado==='med'?`<span class="ger-chip med">Hace ${x.dias} día(s)</span>`:'<span class="ger-chip ok">Hoy</span>';
  const t=tablaGer([{t:'Operario',f:x=>`<b>${esc(x.nombre)}</b><br><span class="tenue">${esc(x.u)}${x.cargo?' · '+esc(x.cargo):''}</span>`},{t:'Labores',f:x=>esc(x.lab.map(l=>l==='cirugia'?'Cirugía':'Censo').join(', '))},
    {t:'Último envío',f:x=>x.ult?esc(new Date(x.ult).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})):'—'},{t:'Jornada',f:x=>esc(x.fecha||'—')},{t:'Estado',f:chip},
    {t:'Envíos 7 días',n:1,f:x=>num(x.n7)},{t:'Envíos 30 días',n:1,f:x=>num(x.n30)}],filas);
  return `<div class="ger-kpis">${kpi(num(filas.length),'Operarios activos')}${kpi(num(nOk),'Al día',nOk?'ok':'')}${kpi(num(nMal),`Más de ${N} días sin sincronizar`,nMal?'mal':'ok')}${kpi(num(nNunca),'Sin envíos en 30 días',nNunca?'med':'ok')}</div>
    ${nMal?`<div class="ger-aviso ger-mal">⚠ <b>${nMal}</b> operario(s) llevan más de ${N} días sin enviar jornadas. Revise su celular: puede tener jornadas sin internet, sin finalizar o un problema con la app.</div>`:''}
    <div class="ger-par">Alerta si pasan más de <input type="number" id="gerSyncN" min="1" max="30" value="${N}"> días sin sincronizar · <button class="btn mini" id="gerSyncCargar">↻ Actualizar</button>
      <span>Consultado ${esc(new Date(GER.sync.cuando).toLocaleTimeString('es-CO',{timeStyle:'short'}))} · ${num(GER.sync.envios)} envíos en 30 días</span></div>
    <p class="tenue">Cuenta las jornadas que llegaron al repositorio de datos. Una jornada en curso, sin finalizar o en un celular sin internet no aparece hasta que se envía.</p>${t}`;
}
ENLACES_GER.sync=()=>{const b=$('#gerSyncCargar');if(b)b.onclick=()=>cargarSync();const n=$('#gerSyncN');if(n)n.onchange=()=>{GER.umbralSync=Math.max(1,Number(n.value)||2);pintarGer();};
  if(!GER.sync&&!GER.cargandoSync&&!GER.syncErr)cargarSync();};

/* ---------------- CALIDAD: diagnósticos sospechosos ---------------- */
const MOTIVOS={lejos:'Lejos de la palma',gps:'GPS impreciso',foto:'Sin foto',rapido:'Muy rápido',racha:'Racha de iguales',fuera:'Fuera del horario de la jornada'};
function alertasCalidad(){
  const C=GER.cal,out=[];
  for(const j of JORF){const ds=j.diags.filter(d=>loteSel(d.lote)&&enProg(d.lote)).slice().sort((a,b)=>String(a.creado).localeCompare(String(b.creado)));
    const ini=Date.parse(j.inicio),fin=Date.parse(j.fin);
    let racha=[];const cierraRacha=()=>{if(racha.length>=C.racha)for(const d of racha)out.push({d,j,m:'racha',txt:`${racha.length} seguidos iguales (${d.nivel2||d.nivel1||d.estado_nombre||d.estado})`});racha=[];};
    ds.forEach((d,i)=>{const t=Date.parse(d.creado);
      if(Number(d.dist_gps_palma_m)>C.dist)out.push({d,j,m:'lejos',txt:`A ${num(d.dist_gps_palma_m,1)} m de la palma`});
      if(Number(d.gps_precision_m)>C.prec)out.push({d,j,m:'gps',txt:`GPS ±${num(d.gps_precision_m,0)} m`});
      if(!(Number(d.n_fotos)>0))out.push({d,j,m:'foto',txt:'Sin fotografía'});
      if(i>0){const s=(t-Date.parse(ds[i-1].creado))/1000;if(s>=0&&s<C.seg)out.push({d,j,m:'rapido',txt:`${num(s,0)} s después del anterior`});}
      if(Number.isFinite(ini)&&Number.isFinite(t)&&(t<ini-60000||(Number.isFinite(fin)&&t>fin+5*60000)))out.push({d,j,m:'fuera',txt:'Registrado fuera de la jornada'});
      const clave=(d.n1_codigo||codN1(d))+'|'+(d.nivel2||'');if(racha.length&&clave!==((racha[0].n1_codigo||codN1(racha[0]))+'|'+(racha[0].nivel2||'')))cierraRacha();racha.push(d);});
    cierraRacha();}
  return out;
}
const claveAlerta=a=>`${a.j.id}|${a.d.id}|${a.m}`;
function pintarCalidad(){
  if(!JOR.length)return sinDatos();
  const C=GER.cal,todas=alertasCalidad();
  const vis=todas.filter(a=>(!C.tipo||a.m===C.tipo)&&(!C.op||a.j.usuario===C.op)&&(!C.solo||!GER.revisados.has(claveAlerta(a))));
  const porOp=new Map();for(const j of JORF){let f=porOp.get(j.usuario);if(!f)porOp.set(j.usuario,f={u:j.usuario,nombre:j.evaluador,diag:0,al:new Set(),m:{}});f.diag+=j.diags.length;}
  for(const a of todas){const f=porOp.get(a.j.usuario);if(!f)continue;f.al.add(a.j.id+'|'+a.d.id);f.m[a.m]=(f.m[a.m]||0)+1;}
  const ops=[...porOp.values()].map(f=>({...f,n:f.al.size,pct:f.diag?f.al.size/f.diag*100:0})).sort((a,b)=>b.pct-a.pct);
  const tOps=tablaGer([{t:'Operario',f:x=>esc(x.nombre)},{t:'Diagnósticos',n:1,f:x=>num(x.diag)},{t:'Con alerta',n:1,f:x=>num(x.n)},
    {t:'% con alerta',n:1,f:x=>`<span class="ger-chip ${x.pct>20?'mal':x.pct>8?'med':'ok'}">${num(x.pct,1)} %</span>`},
    ...Object.keys(MOTIVOS).map(k=>({t:MOTIVOS[k],n:1,f:x=>num(x.m[k]||0)}))],ops,f=>`class="clic" data-op="${esc(f.u)}"`);
  const tAl=tablaGer([{t:'',f:a=>`<input type="checkbox" data-rev="${esc(claveAlerta(a))}" ${GER.revisados.has(claveAlerta(a))?'checked':''} title="Revisado">`},{t:'Motivo',f:a=>`<span class="ger-chip med">${esc(MOTIVOS[a.m])}</span>`},{t:'Detalle',f:a=>esc(a.txt)},
    {t:'Palma',f:a=>`<b>${esc(a.d.lote)} · L${esc(a.d.linea??'?')} · P${esc(a.d.palma??'?')}</b>`},{t:'Diagnóstico',f:a=>esc([a.d.nivel1,a.d.nivel2].filter(Boolean).join(' › ')||a.d.estado_nombre||a.d.estado)},
    {t:'Operario',f:a=>esc(a.j.evaluador)},{t:'Fecha',f:a=>esc(String(a.d.creado||'').slice(0,16).replace('T',' '))},{t:'',f:(a)=>`<button class="btn mini" data-ver="${esc(a.j.id)}|${esc(a.d.id)}">Ver</button>`}],vis.slice(0,400));
  return `<p class="tenue">Diagnósticos de las jornadas cargadas (${esc(rangoTxt())}) que conviene revisar. Una alerta no es un error: es una señal para verificar.</p>
    <div class="ger-kpis">${Object.keys(MOTIVOS).map(k=>kpi(num(todas.filter(a=>a.m===k).length),MOTIVOS[k],todas.some(a=>a.m===k)?'med':'ok')).join('')}</div>
    <div class="ger-par">Lejos de la palma: más de <input type="number" id="calDist" value="${C.dist}" min="1"> m · GPS impreciso: más de ±<input type="number" id="calPrec" value="${C.prec}" min="1"> m ·
      Muy rápido: menos de <input type="number" id="calSeg" value="${C.seg}" min="1"> s · Racha: <input type="number" id="calRacha" value="${C.racha}" min="3"> o más iguales seguidos</div>
    <div class="ger-sec"><h3>Por operario</h3><p class="tenue">Toque un operario para ver solo sus alertas.</p>${tOps}</div>
    <div class="ger-sec"><h3>Alertas (${num(vis.length)}${vis.length>400?', se muestran 400':''})</h3>
      <div class="ger-par"><select id="calTipo"><option value="">Todos los motivos</option>${Object.entries(MOTIVOS).map(([k,t])=>`<option value="${k}" ${C.tipo===k?'selected':''}>${t}</option>`).join('')}</select>
        <select id="calOp"><option value="">Todos los operarios</option>${ops.map(o=>`<option value="${esc(o.u)}" ${C.op===o.u?'selected':''}>${esc(o.nombre)}</option>`).join('')}</select>
        <label><input type="checkbox" id="calSolo" ${C.solo?'checked':''}> Ocultar las revisadas</label><span class="tenue">La casilla ☐ marca una alerta como revisada (se guarda en este navegador).</span></div>${tAl}</div>`;
}
ENLACES_GER.calidad=()=>{enlazarRango();const C=GER.cal;
  for(const [id,k] of [['calDist','dist'],['calPrec','prec'],['calSeg','seg'],['calRacha','racha']]){const e=$('#'+id);if(e)e.onchange=()=>{C[k]=Math.max(1,Number(e.value)||C[k]);pintarGer();};}
  const t=$('#calTipo');if(t)t.onchange=()=>{C.tipo=t.value;pintarGer();};const o=$('#calOp');if(o)o.onchange=()=>{C.op=o.value;pintarGer();};
  const s=$('#calSolo');if(s)s.onchange=()=>{C.solo=s.checked;pintarGer();};
  $$('#gerPanel tr[data-op]').forEach(tr=>tr.onclick=()=>{C.op=C.op===tr.dataset.op?'':tr.dataset.op;pintarGer();});
  $$('#gerPanel [data-rev]').forEach(c=>c.onchange=()=>{c.checked?GER.revisados.add(c.dataset.rev):GER.revisados.delete(c.dataset.rev);dput('kv','ger_revisados',[...GER.revisados]).catch(()=>{});if(C.solo)pintarGer();});
  $$('#gerPanel [data-ver]').forEach(b=>b.onclick=()=>{const [jid,did]=b.dataset.ver.split('|');const j=JOR.find(x=>x.id===jid);const d=j&&j.diags.find(x=>String(x.id)===did);if(!d)return;
    alternarGerencia(false);mapa.setView([d.lat,d.lng],19);setTimeout(()=>popupDiag({...d,_j:j},[d.lat,d.lng]),350);});};
/* Nombres y colores del formulario editable (config/ramas.json del repositorio de datos). */
async function cargarRamasVisor(){
  try{const cfg=JSON.parse(await (await gh(`/contents/config/ramas.json?ref=${encodeURIComponent(SES.repo.rama)}`,'application/vnd.github.raw+json')).text());
    const vistos=new Set();for(const r of cfg.ramas||[]){if(vistos.has(r.c))continue;vistos.add(r.c);
      PROBLEMAS[r.c]=r.n1.charAt(0)+r.n1.slice(1).toLowerCase().replace(/\(([a-z]+)\)/,(m,g)=>'('+g.toUpperCase()+')');}
    for(const [c,e] of Object.entries(cfg.enfermedades||{}))if(e&&e.color)COLOR_N1[c]=e.color;
    try{pintarLeyenda();}catch(e){}}catch(e){}
}
dget('kv','ger_revisados').then(v=>{if(Array.isArray(v))GER.revisados=new Set(v);}).catch(()=>{});

/* ---------------- AUDITORÍA POR MUESTREO ----------------
   El supervisor vuelve a diagnosticar, sin ver el diagnóstico original, una muestra aleatoria de palmas censadas.
   La muestra se guarda en el repositorio de datos (auditoria/AUD-AAAAMMDD-HHMM.json); la App la descarga para supervisores
   y marca los diagnósticos que hacen sobre esas palmas (campo «auditoria»). Aquí se mide la concordancia por operario. */
async function mapaUsuarios(){const us=await cirUsuarios();return new Map(us.map(x=>[x.u,x]));}
const esCensadorU=(u,m)=>{const x=m.get(u);return x?x.rol==='operario':/^\d+$/.test(String(u));};
async function generarMuestra(){
  const A=GER.aud,um=await mapaUsuarios();const porOp=new Map();
  for(const j of JORF){if(!esCensadorU(j.usuario,um))continue;for(const d of j.diags){if(d.lat==null||!loteSel(d.lote)||!enProg(d.lote))continue;
    if(!porOp.has(j.usuario))porOp.set(j.usuario,[]);porOp.get(j.usuario).push({d,j});}}
  const usadas=new Set(),sel=[];
  for(const arr of porOp.values()){let n=Math.min(arr.length,Math.max(A.min,Math.ceil(arr.length*A.pct/100)));
    const mez=arr.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
    for(const x of mez){if(n<=0)break;const k=String(x.d.palma_id);if(usadas.has(k))continue;usadas.add(k);sel.push(x);n--;}}
  const z=new Date(),p=v=>String(v).padStart(2,'0');
  const id=`AUD-${z.getFullYear()}${p(z.getMonth()+1)}${p(z.getDate())}-${p(z.getHours())}${p(z.getMinutes())}`;
  A.muestra={id,formato:'sanidad-auditoria-1',creado:z.toISOString(),creado_por:SES.u,rango:rangoTxt(),pct:A.pct,min_por_operario:A.min,
    palmas:sel.sort((a,b)=>ordenNat(a.d.lote,b.d.lote)||(Number(a.d.linea)||0)-(Number(b.d.linea)||0)||(Number(a.d.palma)||0)-(Number(b.d.palma)||0)).map(({d,j})=>({
      palma_id:String(d.palma_id),lote:d.lote,linea:d.linea,palma:d.palma,lat:d.lat,lng:d.lng,
      original:{diag_id:d.id,jornada_id:j.id,usuario:j.usuario,evaluador:j.evaluador,fecha:d.creado?hoyISO(new Date(d.creado)):String(j.fecha).slice(0,10),
        n1_codigo:codN1(d),nivel1:d.nivel1||'',nivel2:d.nivel2||'',nivel3:d.nivel3||'',estado:d.estado||''}}))};
  A.guardada=false;
}
async function listarMuestras(){
  try{const r=await (await gh(`/contents/auditoria?ref=${encodeURIComponent(SES.repo.rama)}`)).json();
    GER.aud.lista=(Array.isArray(r)?r:[]).filter(x=>x.type==='file'&&/^AUD-.*\.json$/.test(x.name)).sort((a,b)=>b.name.localeCompare(a.name));}
  catch(e){if(e.status===404)GER.aud.lista=[];else throw e;}
}
/* Resultados: diagnósticos de auditoría desde la fecha de la muestra (en jornadas/ y pruebas/jornadas/). */
async function resultadosMuestra(m){
  const um=await mapaUsuarios();const ids=new Map(m.palmas.map(x=>[x.palma_id,x]));const d1=hoyISO(new Date(m.creado)),hoy=hoyISO();/* fecha local (Colombia): en UTC, después de las 7 p. m. ya sería el día siguiente */const hall=[];
  for(const raiz of ['jornadas','pruebas/jornadas']){
    const dias=await listarDias(raiz,d1,hoy);const arch=[];
    await enParalelo(dias,6,async d=>{for(const f of await arbol(d.sha))if(f.type==='blob'&&f.path.endsWith('.geojson'))arch.push(f);});
    await enParalelo(arch,6,async f=>{try{const g=JSON.parse(await blobTexto(f.sha));const h=g.jornada||{};
      for(const ft of g.features||[]){const p=ft.properties||{};if(p.tipo!=='diagnostico')continue;const o=ids.get(String(p.palma_id));if(!o)continue;
        const t=Date.parse(p.creado);const aud=p.auditoria===m.id||(!esCensadorU(h.usuario,um)&&h.usuario!==o.original.usuario&&t>=Date.parse(m.creado));
        if(aud)hall.push({o,p,h,t});}}catch(e){}});}
  const porPalma=new Map();for(const x of hall){const u=porPalma.get(x.o.palma_id);if(!u||x.t>u.t)porPalma.set(x.o.palma_id,x);}
  const filas=m.palmas.map(o=>{const x=porPalma.get(o.palma_id);if(!x)return {o,hecha:false};
    const a={n1:x.p.n1_codigo||String(x.p.problemas||'').split('|')[0]||'',nivel1:x.p.nivel1||'',nivel2:x.p.nivel2||'',auditor:x.h.evaluador||x.h.usuario,fecha:x.p.creado?hoyISO(new Date(x.p.creado)):''};
    return {o,hecha:true,a,c1:(a.n1||'')===(o.original.n1_codigo||''),c2:(a.n1||'')===(o.original.n1_codigo||'')&&(a.nivel2||'')===(o.original.nivel2||'')};});
  GER.aud.res={id:m.id,filas,cuando:Date.now()};
}
function pintarAuditoria(){
  const A=GER.aud;
  if(A.lista==null&&!A.cargandoLista){A.cargandoLista=true;listarMuestras().catch(e=>toast(e.message,6000)).finally(()=>{A.cargandoLista=false;pintarGer();});}
  const gen=!JOR.length?sinDatos():`<div class="ger-par">Muestra de <input type="number" id="audPct" min="1" max="100" value="${A.pct}"> % de los diagnósticos de cada censador, mínimo
      <input type="number" id="audMin" min="1" max="200" value="${A.min}"> por censador · del periodo cargado (${esc(rangoTxt())}) y los filtros de la izquierda.
      <button class="btn mini prim" id="audGen">Generar muestra</button></div>
    ${A.muestra?`<div class="ger-aviso"><b>${esc(A.muestra.id)}</b>: ${num(A.muestra.palmas.length)} palmas de ${num(new Set(A.muestra.palmas.map(x=>x.original.usuario)).size)} censadores en ${num(new Set(A.muestra.palmas.map(x=>x.lote)).size)} lotes.
      ${A.guardada?'✅ Guardada: los supervisores ya la ven en la App (Menú → Auditoría).':'<button class="btn mini nar" id="audGuardar" style="margin-left:8px">Guardar y enviar a los supervisores</button>'}
      <button class="btn mini" id="audCsv" style="margin-left:6px">⬇ CSV</button></div>
      ${tablaGer([{t:'Palma',f:x=>`<b>${esc(x.lote)} · L${esc(x.linea??'?')} · P${esc(x.palma??'?')}</b>`},{t:'Censador',f:x=>esc(x.original.evaluador)},{t:'Fecha del censo',f:x=>esc(x.original.fecha)},
        {t:'Diagnóstico original',f:x=>esc([x.original.nivel1,x.original.nivel2].filter(Boolean).join(' › ')||x.original.estado)}],A.muestra.palmas.slice(0,300))}`:''}`;
  const lista=A.lista==null?'<p class="tenue">Consultando muestras guardadas…</p>':!A.lista.length?'<p class="tenue">Aún no hay muestras guardadas.</p>':
    `<div class="ger-par"><select id="audSel">${A.lista.map(x=>`<option value="${esc(x.name)}" ${A.sel===x.name?'selected':''}>${esc(x.name.replace(/\.json$/,''))}</option>`).join('')}</select>
      <button class="btn mini prim" id="audVer">${A.cargandoRes?'Calculando…':'Ver avance y concordancia'}</button></div>`;
  let res='';
  if(A.res){const F=A.res.filas,h=F.filter(x=>x.hecha);
    const porOp=new Map();for(const x of h){const u=x.o.original.usuario;let f=porOp.get(u);if(!f)porOp.set(u,f={nombre:x.o.original.evaluador,n:0,c1:0,c2:0});f.n++;if(x.c1)f.c1++;if(x.c2)f.c2++;}
    const pct=(a,b)=>b?a/b*100:null,chip=v=>v==null?'—':`<span class="ger-chip ${v>=90?'ok':v>=75?'med':'mal'}">${num(v,0)} %</span>`;
    const tot1=pct(h.filter(x=>x.c1).length,h.length),tot2=pct(h.filter(x=>x.c2).length,h.length);
    res=`<div class="ger-kpis">${kpi(num(F.length),'Palmas en la muestra')}${kpi(num(h.length),'Auditadas',h.length===F.length?'ok':'med')}${kpi(num(F.length-h.length),'Pendientes')}
        ${kpi(tot1==null?'—':num(tot1,0)+' %','Concordancia en la enfermedad',tot1==null?'':tot1>=90?'ok':tot1>=75?'med':'mal')}${kpi(tot2==null?'—':num(tot2,0)+' %','Concordancia en enfermedad y opción',tot2==null?'':tot2>=90?'ok':tot2>=75?'med':'mal')}</div>
      <div class="ger-sec"><h3>Concordancia por censador</h3>${tablaGer([{t:'Censador',f:x=>esc(x.nombre)},{t:'Auditadas',n:1,f:x=>num(x.n)},{t:'Misma enfermedad',n:1,f:x=>chip(pct(x.c1,x.n))},{t:'Misma enfermedad y opción',n:1,f:x=>chip(pct(x.c2,x.n))}],
        [...porOp.values()].sort((a,b)=>(pct(a.c1,a.n)||0)-(pct(b.c1,b.n)||0)))}</div>
      <div class="ger-sec"><h3>Diferencias (${num(h.filter(x=>!x.c2).length)})</h3>${tablaGer([{t:'Palma',f:x=>`<b>${esc(x.o.lote)} · L${esc(x.o.linea??'?')} · P${esc(x.o.palma??'?')}</b>`},
        {t:'Censador dijo',f:x=>esc([x.o.original.nivel1,x.o.original.nivel2].filter(Boolean).join(' › ')||x.o.original.estado)},{t:'Auditor dijo',f:x=>esc([x.a.nivel1,x.a.nivel2].filter(Boolean).join(' › ')||x.a.n1)},
        {t:'Censador',f:x=>esc(x.o.original.evaluador)},{t:'Auditor',f:x=>esc(x.a.auditor)},{t:'Fecha auditoría',f:x=>esc(x.a.fecha)}],h.filter(x=>!x.c2))}</div>`;}
  return `<p class="tenue">El supervisor vuelve a diagnosticar una muestra aleatoria de palmas <b>sin ver el diagnóstico original</b>. La concordancia mide qué tanto coinciden censador y auditor.</p>
    <div class="ger-sec"><h3>1. Generar una muestra</h3>${gen}</div><div class="ger-sec"><h3>2. Muestras guardadas</h3>${lista}${res}</div>`;
}
ENLACES_GER.auditoria=()=>{enlazarRango();const A=GER.aud;
  const p=$('#audPct');if(p)p.onchange=()=>{A.pct=Math.min(100,Math.max(1,Number(p.value)||5));};const m=$('#audMin');if(m)m.onchange=()=>{A.min=Math.max(1,Number(m.value)||5);};
  const g=$('#audGen');if(g)g.onclick=async()=>{g.disabled=true;try{await generarMuestra();if(!A.muestra.palmas.length)toast('No hay diagnósticos de censadores en el periodo cargado.');}catch(e){toast(e.message,6000);}pintarGer();};
  const s=$('#audGuardar');if(s)s.onclick=async()=>{s.disabled=true;s.textContent='Guardando…';try{await ghPut(`auditoria/${A.muestra.id}.json`,JSON.stringify(A.muestra,null,1),`Auditoría: muestra ${A.muestra.id} (${A.muestra.palmas.length} palmas)`);
    A.guardada=true;A.lista=null;A.sel=A.muestra.id+'.json';toast('✅ Muestra guardada. Los supervisores la verán en la App.');}catch(e){toast(e.message,6000);}pintarGer();};
  const c=$('#audCsv');if(c)c.onclick=()=>{const M=A.muestra;descargar(`${M.id}.csv`,'﻿'+['palma_id;lote;linea;palma;lat;lng;censador;fecha_censo;diagnostico_original'].concat(M.palmas.map(x=>[x.palma_id,x.lote,x.linea,x.palma,x.lat,x.lng,x.original.evaluador,x.original.fecha,[x.original.nivel1,x.original.nivel2].filter(Boolean).join(' > ')].join(';'))).join('\r\n'),'text/csv');};
  const sel=$('#audSel');if(sel)sel.onchange=()=>{A.sel=sel.value;A.res=null;pintarGer();};
  const v=$('#audVer');if(v)v.onclick=async()=>{if(A.cargandoRes)return;A.cargandoRes=true;A.sel=$('#audSel').value;pintarGer();
    try{const f=A.lista.find(x=>x.name===A.sel);const m=JSON.parse(await blobTexto(f.sha));await resultadosMuestra(m);}catch(e){toast(e.message,6000);}
    A.cargandoRes=false;pintarGer();};};

/* ---------------- PLANIFICACIÓN DEL CENSO ----------------
   Propone a cada operario los lotes más atrasados del ciclo (sin censo o con más días desde el último), agrupando lotes
   cercanos y respetando su meta de hectáreas por día. Se guarda en censo/plan/AAAA-MM-DD.json; la App lo muestra al iniciar. */
GER.plan={fecha:null,ops:null,res:null,guardado:false,sha:null};
function centroLote(l){const f=LOTES&&LOTES.features.find(x=>x.properties._lote===l);if(!f||!f.geometry)return null;
  const cs=(f.geometry.type==='Polygon'?f.geometry.coordinates[0]:f.geometry.coordinates.flatMap(p=>p[0]));if(!cs.length)return null;
  return [cs.reduce((a,c)=>a+c[1],0)/cs.length,cs.reduce((a,c)=>a+c[0],0)/cs.length];}
function haLote(l){const m=IND_LOTES[l];return m?Math.max(0,(Number(m.n)||0)-(Number(m.vacios)||0))/115:0;}
function candidatosPlan(){
  const ult=new Map();for(const j of JOR)for(const x of j.por_lote){const u=ult.get(x.lote);if(!u||j.fecha>u)ult.set(x.lote,j.fecha);}
  const hoy=hoyISO();
  return (LOTES?LOTES.features.map(f=>f.properties._lote):[]).filter(l=>l&&enProg(l)&&haLote(l)>0).map(l=>{const f=ult.get(l);return {lote:l,prog:PROG.get(l)||'',ultimo:f||null,dias:f?diasEntre(f,hoy):null,ha:+haLote(l).toFixed(1),c:centroLote(l)};})
    .sort((a,b)=>(a.dias==null?-1:0)-(b.dias==null?-1:0)||(b.dias??0)-(a.dias??0)||ordenNat(a.lote,b.lote));
}
function proponerPlan(ops){
  const pool=candidatosPlan().filter(x=>x.dias==null||x.dias>=7);const usados=new Set();const out=[];
  for(const o of ops){const meta=Math.max(1,Number(o.meta)||15);const sel=[];let ha=0;
    const semilla=pool.find(x=>!usados.has(x.lote));if(!semilla){out.push({...o,lotes:[]});continue;}
    sel.push(semilla);usados.add(semilla.lote);ha+=semilla.ha;
    while(ha<meta*.9){const c=semilla.c;let mejor=null,dm=Infinity;
      for(const x of pool){if(usados.has(x.lote)||!x.c||!c)continue;const d=dist(c[0],c[1],x.c[0],x.c[1])*(x.prog===semilla.prog?1:1.6);if(d<dm){dm=d;mejor=x;}}
      if(!mejor||ha+mejor.ha>meta*1.35&&sel.length)break;sel.push(mejor);usados.add(mejor.lote);ha+=mejor.ha;}
    out.push({...o,lotes:sel.map(x=>({lote:x.lote,ha:x.ha,dias:x.dias}))});}
  return out;
}
/* ---- Ciclo de censo aprobado (censo/programacion/ciclo.json): asignación del personal por bloque de persona (P1…P11).
   · Titular: cada P tiene un operario que recorre sus bloques D1·P, D2·P, D3·P… en orden y a su propio ritmo
     (no todo el ciclo avanza el mismo día: cada operario sigue con su siguiente bloque pendiente).
   · Avance automático: palmas distintas visitadas dentro de las calles del bloque, en las jornadas desde el inicio de la vuelta;
     con 90 % o más el bloque queda ejecutado. También se puede marcar terminado o reabrir a mano.
   · Plan del día: a cada titular su siguiente bloque; se puede cambiar el bloque, quitar a quien no asiste, reemplazar al operario
     o agregar bloques de apoyo (un operario con dos bloques, o el bloque de otra P) para ir barriendo la programación.
   Estado en censo/programacion/asignacion.json; el plan de cada fecha en censo/plan/AAAA-MM-DD.json (lo leen los celulares). ---- */
const UMBRAL_EJEC=90;
GER.cic={c:null,cargando:false,err:null,as:null,asSha:null,planes:[],av:null,avKey:'',calculando:false,dia:null,guardado:false};
const bloqueId=(d,p)=>`D${d}·P${p}`;
function bloquesCiclo(){const C=GER.cic;if(C._b&&C._bv===C.c)return C._b;const m=new Map();
  for(const D of C.c.dias)for(const p of D.personas)m.set(bloqueId(D.dia,p.persona),{id:bloqueId(D.dia,p.persona),dia:D.dia,persona:p.persona,palmas:p.palmas,ha:p.ha,detalle:p.detalle,tramos:p.tramos});
  C._b=m;C._bv=C.c;return m;}
async function guardarAsignacion(msg){const C=GER.cic;C.as.actualizado=new Date().toISOString();C.as.actualizado_por=SES.u;
  C.asSha=await ghPut('censo/programacion/asignacion.json',JSON.stringify(C.as,null,1),msg,C.asSha);}
async function cargarCiclo(){
  const C=GER.cic,rama=encodeURIComponent(SES.repo.rama),raw=async r=>JSON.parse(await (await gh(`/contents/${r}?ref=${rama}`,'application/vnd.github.raw+json')).text());
  try{C.c=await raw('censo/programacion/ciclo.json');}catch(e){C.c=false;if(e.status!==404)C.err=e.message;return;}
  try{const j=await (await gh(`/contents/censo/programacion/asignacion.json?ref=${rama}`)).json();C.asSha=j.sha;C.as=JSON.parse(DEC.decode(deB64(j.content.replace(/\s/g,''))));}
  catch(e){if(e.status!==404)throw e;C.as=null;}
  if(!C.as)C.as={formato:'sanidad-asignacion-censo-1',ciclo_version:C.c.version,vuelta:1,inicio:null,titulares:{},manual:{}};
  C.as.titulares=C.as.titulares||{};C.as.manual=C.as.manual||{};
  // Planes enviados en esta vuelta (para saber qué bloque tuvo cada quien y retomar el plan de una fecha)
  C.planes=[];
  try{const l=await (await gh(`/contents/censo/plan?ref=${rama}`)).json();
    const fs=(Array.isArray(l)?l:[]).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x.name)).map(x=>x.name).sort().reverse().filter(n=>!C.as.inicio||n.slice(0,10)>=C.as.inicio).slice(0,30);
    for(const n of fs){try{const p=await raw(`censo/plan/${n}`);if(p.ciclo_version||p.ciclo_dia||p.ciclo_dias)C.planes.push({fecha:n.slice(0,10),...p});}catch(e){}}}
  catch(e){}
  C.planes.sort((a,b)=>a.fecha.localeCompare(b.fecha));
  // Sin titulares guardados: se toman del último plan (cada operario con su P)
  if(!Object.keys(C.as.titulares).length)for(const p of C.planes)for(const a of p.asignaciones||[])if(a.persona&&(a.tipo||'titular')==='titular')C.as.titulares[a.persona]=a.usuario;
}
/* Avance de cada bloque con las jornadas cargadas (desde el inicio de la vuelta) */
async function calcularAvance(){
  const C=GER.cic,ini=C.as.inicio;const key=JOR.length+'|'+(JOR[0]&&JOR[0].id)+'|'+ini;if(C.avKey===key&&C.av)return;
  C.calculando=true;
  const vis=new Map();if(ini)for(const j of JOR){if(String(j.fecha)<ini)continue;for(const x of j.por_lote||[]){const ids=x.ids_palmas_visitadas||[];if(!ids.length)continue;let s=vis.get(x.lote);if(!s)vis.set(x.lote,s=new Set());ids.forEach(i=>s.add(String(i)));}}
  const av={};
  for(const b of bloquesCiclo().values()){let tot=0,v=0;
    for(const t of b.tramos){const s=vis.get(t.lote);
      if(t.desde==null||t.hasta==null){tot+=t.palmas;if(s){const lt=totalLote(t.lote)||t.palmas;v+=Math.min(t.palmas,Math.round(s.size*t.palmas/lt));}continue;}   // lote sin líneas: proporcional
      if(!s){tot+=t.palmas;continue;}
      const ch=await chunkLote(t.lote);let n=0,k=0;for(const a of ch){const l=Number(a[1]);if(l>=t.desde&&l<=t.hasta){n++;if(s.has(String(a[0])))k++;}}
      tot+=n||t.palmas;v+=k;}
    av[b.id]=tot?Math.min(100,v/tot*100):0;}
  C.av=av;C.avKey=key;C.calculando=false;
}
function estadoBloque(id){const C=GER.cic,m=C.as.manual[id],p=(C.av&&C.av[id])||0;
  if(m&&m.estado==='terminado')return {e:'ejecutado',p,manual:true};
  if(p>=UMBRAL_EJEC&&!(m&&m.estado==='reabierto'))return {e:'ejecutado',p};
  return {e:p>0?'curso':'pendiente',p,manual:!!m};}
const ultimoPlanBloque=id=>{let r=null;for(const p of GER.cic.planes)for(const a of p.asignaciones||[])if(a.bloque===id)r={fecha:p.fecha,usuario:a.usuario,nombre:a.nombre};return r;};
function siguienteBloque(persona,ocupados){const C=GER.cic;
  for(const D of C.c.dias){const id=bloqueId(D.dia,persona);if(ocupados.has(id))continue;if(estadoBloque(id).e!=='ejecutado'&&D.personas.some(p=>p.persona===persona))return id;}
  return null;}
/* Plan sugerido (o el ya enviado) para la fecha */
function armarDia(fecha,forzar){
  const C=GER.cic,P=GER.plan;
  const env=C.planes.find(p=>p.fecha===fecha);
  if(env&&!forzar){C.dia={fecha,enviado:true,filas:(env.asignaciones||[]).filter(a=>a.bloque).map(a=>({usuario:a.usuario,bloque:a.bloque}))};C.guardado=true;return;}
  const filas=[],ocup=new Set();
  for(let p=1;p<=C.c.reglas.personas_dia;p++){const u=C.as.titulares[p]||'';const b=siguienteBloque(p,ocup);if(!b)continue;ocup.add(b);filas.push({usuario:u,bloque:b});}
  C.dia={fecha,enviado:false,filas};C.guardado=false;
}
function tipoFila(f,filas){const C=GER.cic,b=bloquesCiclo().get(f.bloque);if(!f.usuario||!b)return '';
  if(C.as.titulares[b.persona]===f.usuario)return filas.filter(x=>x.usuario===f.usuario).length>1?'titular · 2+ bloques':'titular';
  const esTit=Object.values(C.as.titulares).includes(f.usuario);
  return esTit?'apoyo':'reemplazo';}
const chipEstado=s=>s.e==='ejecutado'?`<span class="ger-chip ok">✔ ${s.manual?'terminado':num(s.p,0)+' %'}</span>`:s.e==='curso'?`<span class="ger-chip med">${num(s.p,0)} %</span>`:`<span class="ger-chip gris">pendiente</span>`;
function pintarCiclo(){
  const C=GER.cic,P=GER.plan;
  if(C.c==null&&!C.cargando){C.cargando=true;cargarCiclo().catch(e=>{C.err=e.message;C.c=false;}).finally(()=>{C.cargando=false;pintarGer();});}
  if(C.c==null)return '<p class="tenue">Consultando el ciclo de censo aprobado…</p>';
  if(C.c===false)return `<p class="tenue">${C.err?'❌ '+esc(C.err):'Aún no hay un ciclo de censo aprobado (censo/programacion/ciclo.json).'}</p>`;
  const key=JOR.length+'|'+(JOR[0]&&JOR[0].id)+'|'+C.as.inicio;
  if((C.avKey!==key||!C.av)&&!C.calculando){calcularAvance().catch(e=>{C.calculando=false;C.av={};toast(e.message,6000);}).finally(()=>pintarGer());}
  if(!C.av)return '<p class="tenue">Calculando el avance de los bloques…</p>';
  if(!C.dia||C.dia.fecha!==P.fecha)armarDia(P.fecha);
  const c=C.c,R=c.reglas,B=bloquesCiclo(),ops=P.ops||[],nom=u=>(ops.find(o=>o.usuario===u)||{}).nombre||u||'—',K=R.personas_dia;
  const todos=[...B.values()],est=new Map(todos.map(b=>[b.id,estadoBloque(b.id)]));
  const nEj=todos.filter(b=>est.get(b.id).e==='ejecutado').length,nCu=todos.filter(b=>est.get(b.id).e==='curso').length;
  const palEj=todos.reduce((t,b)=>t+b.palmas*Math.min(1,(est.get(b.id).e==='ejecutado'?100:est.get(b.id).p)/100),0),palTot=todos.reduce((t,b)=>t+b.palmas,0);
  const desde=$('#fDesde')&&$('#fDesde').value;
  const avisoRango=C.as.inicio&&(!desde||desde>C.as.inicio)?`<div class="ger-aviso">El avance se calcula con las jornadas cargadas. Para contar toda la vuelta (desde el ${esc(C.as.inicio)}) <button class="btn mini prim" id="cDesdeIni">Cargar jornadas desde el ${esc(C.as.inicio)}</button></div>`:'';
  // 1. Titulares por P
  const selOp=(attr,val,vacio)=>`<select ${attr} style="min-width:170px"><option value="">${vacio}</option>${ops.map(o=>`<option value="${esc(o.usuario)}" ${val===o.usuario?'selected':''}>${esc(o.nombre)}</option>`).join('')}</select>`;
  const rep={};for(const k in C.as.titulares)if(C.as.titulares[k])rep[C.as.titulares[k]]=(rep[C.as.titulares[k]]||0)+1;
  const filasP=Array.from({length:K},(_,i)=>i+1).map(p=>{const bs=c.dias.filter(D=>D.personas.some(x=>x.persona===p)).map(D=>bloqueId(D.dia,p));
    return {p,ej:bs.filter(id=>est.get(id).e==='ejecutado').length,n:bs.length,sig:siguienteBloque(p,new Set())};});
  const tTit=P.ops==null?'<p class="tenue">Cargando operarios…</p>':tablaGer([{t:'Bloque',f:x=>`<b>P${x.p}</b>`},
    {t:'Operario titular',f:x=>selOp(`data-tit="${x.p}"`,C.as.titulares[x.p]||'','— Sin titular —')+(C.as.titulares[x.p]&&rep[C.as.titulares[x.p]]>1?' <b style="color:#ff8a8a">repetido</b>':'')},
    {t:'Bloques ejecutados',n:1,f:x=>`${x.ej} de ${x.n}`},{t:'Siguiente bloque',f:x=>x.sig?`<b>${esc(x.sig)}</b> ${chipEstado(est.get(x.sig))}`:'<span class="ger-chip ok">vuelta completa</span>'}],filasP);
  // 2. Plan del día
  const filas=C.dia.filas,usadas=new Map();filas.forEach(f=>{if(f.bloque)usadas.set(f.bloque,(usadas.get(f.bloque)||0)+1);});
  const pend=todos.filter(b=>est.get(b.id).e!=='ejecutado');
  const selB=(i,val)=>`<select data-fb="${i}" style="min-width:150px"><option value="">— Bloque —</option>${pend.concat(val&&!pend.some(b=>b.id===val)?[B.get(val)]:[]).filter(Boolean).map(b=>`<option value="${esc(b.id)}" ${b.id===val?'selected':''}>${esc(b.id)} · ${est.get(b.id).e==='curso'?num(est.get(b.id).p,0)+' %':'pend.'}</option>`).join('')}</select>${usadas.get(val)>1?' <b style="color:#ff8a8a">repetido</b>':''}`;
  const tDia=P.ops==null?'':tablaGer([{t:'Operario',f:x=>selOp(`data-fu="${x.i}"`,x.usuario,'— Operario —')},{t:'Bloque',f:x=>selB(x.i,x.bloque)},
    {t:'Tipo',f:x=>{const t=tipoFila(x,filas);return t?`<span class="ger-chip ${t.startsWith('titular')?'ok':'med'}">${esc(t)}</span>`:'';}},
    {t:'Lotes y calles',f:x=>{const b=B.get(x.bloque);return b?esc(b.detalle):'—';}},{t:'Palmas',n:1,f:x=>{const b=B.get(x.bloque);return b?num(b.palmas):'—';}},
    {t:'Avance',f:x=>x.bloque?chipEstado(est.get(x.bloque)):''},{t:'',f:x=>`<button class="btn mini" data-fq="${x.i}" title="Quitar (no asiste o no va hoy)">✕</button>`}],filas.map((f,i)=>({...f,i})));
  const sinAsignar=filasP.filter(x=>x.sig&&!filas.some(f=>f.bloque===x.sig)).map(x=>x.sig);
  // 3. Avance del ciclo (días × personas)
  const grid=`<div class="ger-tabla"><table class="ger-calor"><thead><tr><th>Día</th>${Array.from({length:K},(_,i)=>`<th class="c">P${i+1}</th>`).join('')}</tr></thead><tbody>${
    c.dias.map(D=>`<tr><td><b>D${D.dia}</b> <span class="tenue">${esc(D.programas.join(', '))}</span></td>${Array.from({length:K},(_,i)=>{const id=bloqueId(D.dia,i+1);if(!B.has(id))return '<td class="c tenue">—</td>';
      const s=est.get(id),u=ultimoPlanBloque(id),bg=s.e==='ejecutado'?'rgba(34,211,154,.35)':s.e==='curso'?'rgba(255,197,61,.30)':'transparent';
      return `<td class="c" data-cel="${esc(id)}" style="cursor:pointer;background:${bg};${u&&s.e!=='ejecutado'?'outline:1px solid #6fb3ff;outline-offset:-2px;':''}" title="${esc(id)} · ${esc(B.get(id).detalle)}${u?` · plan ${u.fecha}: ${u.nombre||u.usuario}`:''}\nClic: ${s.e==='ejecutado'?'reabrir':'marcar terminado'}">${s.e==='ejecutado'?'✔':s.e==='curso'?num(s.p,0):'·'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="ger-sec"><h3>Ciclo de censo aprobado · vuelta ${C.as.vuelta}</h3>
    <p class="tenue">Aprobado el ${esc(c.aprobado)} · ${c.dias.length} días · ${K} bloques por día (P1–P${K}) · ${R.ha_persona} ha (${num(R.palmas_persona)} palmas) por persona · calles completas.
      ${C.as.inicio?`Vuelta iniciada el ${esc(C.as.inicio)}.`:'La vuelta inicia con el primer plan que se envíe.'} Cada operario avanza por sus bloques a su ritmo; un bloque queda ejecutado con ${UMBRAL_EJEC} % de sus palmas visitadas.</p>
    ${avisoRango}
    <div class="ger-kpis">${kpi(`${nEj} / ${todos.length}`,'Bloques ejecutados',nEj===todos.length?'ok':'')}${kpi(num(nCu),'Bloques en curso')}${kpi(num(palTot?palEj/palTot*100:0,1)+' %','Avance del ciclo (palmas)')}${kpi(num(todos.length-nEj-nCu),'Bloques pendientes')}</div></div>
  <div class="ger-sec"><h3>1. Operario titular de cada bloque (P)</h3>
    <p class="tenue">El titular de P3 hace D1·P3, luego D2·P3, D3·P3… El plan de cada día le propone su siguiente bloque pendiente.</p>
    ${tTit}<div class="ger-par"><button class="btn mini prim" id="cTitGuardar">Guardar titulares</button> <button class="btn mini" id="cPdf">📄 PDF del ciclo</button></div></div>
  <div class="ger-sec"><h3>2. Plan del día</h3>
    <div class="ger-par">Fecha <input type="date" id="cFecha" value="${esc(P.fecha)}">
      <button class="btn mini" id="cAgregar" title="Un operario con dos bloques, o el bloque de alguien que no vino">＋ Agregar bloque (apoyo o emergencia)</button>
      <button class="btn mini" id="cSugerir">↺ Volver a la sugerencia</button>
      <button class="btn mini nar" id="cGuardar">${C.guardado?'✅ Enviado · enviar de nuevo':'Guardar y enviar a los celulares'}</button></div>
    ${C.dia.enviado?`<p class="tenue">Este es el plan ya enviado para el ${esc(C.dia.fecha)}. Puede modificarlo y enviarlo de nuevo.</p>`:''}
    ${tDia}
    ${sinAsignar.length?`<div class="ger-aviso">Bloques siguientes sin operario hoy: <b>${sinAsignar.map(esc).join(', ')}</b>. Agréguelos a un operario (＋ Agregar bloque) para no atrasar la programación.</div>`:''}</div>
  <div class="ger-sec"><h3>3. Avance del ciclo</h3>
    <p class="tenue">✔ ejecutado · número = % de avance · · pendiente · borde azul = asignado en un plan. Clic en un bloque para marcarlo terminado o reabrirlo.</p>
    ${grid}<div class="ger-par"><button class="btn mini" id="cVuelta">Iniciar una nueva vuelta del ciclo</button></div></div>`;
}
function enlazarCiclo(){
  const C=GER.cic,P=GER.plan;if(!C.c||!C.av||!C.dia)return;
  const f=$('#cFecha');if(f)f.onchange=()=>{P.fecha=f.value;armarDia(P.fecha);pintarGer();};
  const di=$('#cDesdeIni');if(di)di.onclick=async()=>{$('#fDesde').value=C.as.inicio;$('#fHasta').value=hoyISO();await cargar();pintarGer();};
  $$('#gerPanel [data-tit]').forEach(s=>s.onchange=()=>{C.as.titulares[s.dataset.tit]=s.value;if(!C.dia.enviado)armarDia(P.fecha,true);pintarGer();});
  const tg=$('#cTitGuardar');if(tg)tg.onclick=async()=>{tg.disabled=true;tg.textContent='Guardando…';
    try{await guardarAsignacion('Censo: operarios titulares de los bloques del ciclo');toast('✅ Titulares guardados.');}catch(e){toast(e.message,6000);}pintarGer();};
  $$('#gerPanel [data-fu]').forEach(s=>s.onchange=()=>{C.dia.filas[s.dataset.fu].usuario=s.value;C.guardado=false;pintarGer();});
  $$('#gerPanel [data-fb]').forEach(s=>s.onchange=()=>{C.dia.filas[s.dataset.fb].bloque=s.value;C.guardado=false;pintarGer();});
  $$('#gerPanel [data-fq]').forEach(b=>b.onclick=()=>{C.dia.filas.splice(Number(b.dataset.fq),1);C.guardado=false;pintarGer();});
  const ag=$('#cAgregar');if(ag)ag.onclick=()=>{const us=new Set(C.dia.filas.map(x=>x.bloque));
    const sig=Array.from({length:C.c.reglas.personas_dia},(_,i)=>siguienteBloque(i+1,us)).find(Boolean)||'';
    C.dia.filas.push({usuario:'',bloque:sig});C.guardado=false;pintarGer();};
  const su=$('#cSugerir');if(su)su.onclick=()=>{armarDia(P.fecha,true);pintarGer();};
  $$('#gerPanel [data-cel]').forEach(td=>td.onclick=async()=>{const id=td.dataset.cel,s=estadoBloque(id);
    const term=s.e!=='ejecutado';if(!confirm(term?`¿Marcar ${id} como terminado? (avance calculado: ${num(s.p,0)} %)`:`¿Reabrir ${id}? Volverá a quedar pendiente en la programación.`))return;
    C.as.manual[id]={estado:term?'terminado':'reabierto',por:SES.u,fecha:new Date().toISOString()};
    try{await guardarAsignacion(`Censo: ${id} ${term?'marcado terminado':'reabierto'}`);if(!C.dia.enviado)armarDia(P.fecha,true);}catch(e){delete C.as.manual[id];toast(e.message,6000);}pintarGer();});
  const vu=$('#cVuelta');if(vu)vu.onclick=async()=>{if(!confirm('¿Iniciar una nueva vuelta? Todos los bloques vuelven a quedar pendientes; el avance se cuenta desde el próximo plan que envíe.'))return;
    const prev=JSON.parse(JSON.stringify(C.as));C.as.vuelta=(C.as.vuelta||1)+1;C.as.inicio=null;C.as.manual={};
    try{await guardarAsignacion(`Censo: inicia la vuelta ${C.as.vuelta} del ciclo`);C.planes=[];C.av=null;C.avKey='';C.dia=null;}catch(e){C.as=prev;toast(e.message,6000);}pintarGer();};
  const pdf=$('#cPdf');if(pdf)pdf.onclick=async()=>{pdf.disabled=true;const w=window.open('','_blank');
    try{const b=await (await gh(`/contents/censo/programacion/programacion_censo.pdf?ref=${encodeURIComponent(SES.repo.rama)}`,'application/vnd.github.raw+json')).arrayBuffer();
      const u=URL.createObjectURL(new Blob([b],{type:'application/pdf'}));if(w)w.location.href=u;else window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),300000);}
    catch(e){if(w)w.close();toast(e.message,6000);}pdf.disabled=false;};
  const g=$('#cGuardar');if(g)g.onclick=async()=>{
    const B=bloquesCiclo(),fl=C.dia.filas;
    if(!fl.length){toast('El plan no tiene bloques.',5000);return;}
    const mal=fl.findIndex(x=>!x.usuario||!x.bloque);if(mal>=0){toast(`Complete el operario y el bloque de la fila ${mal+1}.`,6000);return;}
    const bs=fl.map(x=>x.bloque);if(new Set(bs).size!==bs.length){toast('Hay un bloque asignado dos veces.',6000);return;}
    g.disabled=true;g.textContent='Guardando…';
    const ruta=`censo/plan/${P.fecha}.json`;let sha=null;try{sha=(await (await gh(`/contents/${ruta}?ref=${encodeURIComponent(SES.repo.rama)}`)).json()).sha;}catch(e){}
    const nom=u=>(P.ops.find(o=>o.usuario===u)||{}).nombre||u;
    const dias=[...new Set(fl.map(x=>B.get(x.bloque).dia))].sort((a,b)=>a-b);
    const plan={formato:'sanidad-plan-censo-2',fecha:P.fecha,ciclo_version:C.c.version,vuelta:C.as.vuelta,ciclo_dia:dias[0],ciclo_dias:dias,creado:new Date().toISOString(),creado_por:SES.u,
      asignaciones:fl.map(x=>{const b=B.get(x.bloque);return {usuario:x.usuario,nombre:nom(x.usuario),persona:b.persona,bloque:b.id,tipo:tipoFila(x,fl).replace(/ ·.*/,''),palmas:b.palmas,avance_pct:+(estadoBloque(b.id).p.toFixed(1)),
        lotes:b.tramos.map(t=>({lote:t.lote,ha:+(t.palmas/115).toFixed(1),palmas:t.palmas,desde:t.desde,hasta:t.hasta,lineas_calculadas:!!t.lineas_calculadas}))};})};
    try{await ghPut(ruta,JSON.stringify(plan,null,1),`Plan de censo ${P.fecha} · ${fl.length} bloques (${bs.join(', ')})`,sha);
      if(!C.as.inicio||P.fecha<C.as.inicio){C.as.inicio=P.fecha;await guardarAsignacion(`Censo: vuelta ${C.as.vuelta} del ciclo inicia el ${P.fecha}`);C.avKey='';}
      C.planes=C.planes.filter(p=>p.fecha!==P.fecha).concat([{...plan}]).sort((a,b)=>a.fecha.localeCompare(b.fecha));C.dia.enviado=true;C.guardado=true;
      toast(`✅ Plan del ${P.fecha} enviado: cada operario verá su bloque (lotes y calles) al planificar la jornada.`,7000);}
    catch(e){toast(e.message,6000);}pintarGer();};
}
function pintarPlanCenso(){
  const P=GER.plan;if(!P.fecha)P.fecha=(()=>{const h=new Date();const f=hoyISO();return h.getHours()<10&&esHabil(f)?f:habilMas(f);})();
  if(P.ops==null&&!P.cargandoOps){P.cargandoOps=true;cirUsuarios().then(us=>{const O=resumenOperarios();
      P.ops=us.filter(x=>!x.inactivo&&x.rol==='operario'&&(!x.labores||!x.labores.length||x.labores.includes('censo'))).map(x=>{const r=O.find(o=>o.usuario===x.u);return {usuario:x.u,nombre:x.nombre,activo:true,meta:r&&r.ha_dia>0?+r.ha_dia.toFixed(1):15};});})
    .catch(e=>toast(e.message,6000)).finally(()=>{P.cargandoOps=false;pintarGer();});}
  const ciclo=tarjetaModoProg('censo')+pintarCiclo();
  if(GER.cic.c)return ciclo+`<details class="ger-sec"><summary style="cursor:pointer"><b>Propuesta automática por días sin censo</b> (alternativa al ciclo aprobado)</summary>${pintarPropuesta()}</details>`;
  return ciclo+pintarPropuesta();
}
function pintarPropuesta(){
  const P=GER.plan;
  if(!JOR.length)return sinDatos().replace('No hay jornadas cargadas.','Para la propuesta automática se usa el avance del ciclo de censo: cargue al menos 60 a 90 días.');
  const tOps=P.ops==null?'<p class="tenue">Cargando operarios…</p>':tablaGer([{t:'',f:o=>`<input type="checkbox" data-pa="${esc(o.usuario)}" ${o.activo?'checked':''}>`},{t:'Operario disponible',f:o=>esc(o.nombre)},
    {t:'Meta ha/día',f:o=>`<input type="number" data-pm="${esc(o.usuario)}" value="${o.meta}" min="1" max="80" step="0.5" style="width:80px">`}],P.ops);
  const tRes=P.res?tablaGer([{t:'Operario',f:a=>`<b>${esc(a.nombre)}</b>`},{t:'Lotes asignados (puede editarlos, separados por coma)',f:a=>`<input type="text" data-pl="${esc(a.usuario)}" value="${esc(a.lotes.map(x=>x.lote).join(', '))}" style="width:100%;min-width:260px">`},
    {t:'Ha',n:1,f:a=>num(a.lotes.reduce((t,x)=>t+x.ha,0),1)},{t:'Días sin censo',f:a=>esc(a.lotes.map(x=>x.dias==null?'s/c':x.dias).join(', '))}],P.res):'';
  return `<p class="tenue">Propone a cada operario los lotes más atrasados del ciclo de censo (primero los que no tienen censo en el periodo cargado, luego los de más días), agrupando lotes cercanos hasta su meta de hectáreas por día. La meta parte de su productividad real (ha/día) y se puede cambiar.</p>
    <div class="ger-par">Fecha del plan <input type="date" id="plFecha" value="${esc(P.fecha)}"> <button class="btn mini prim" id="plProp">Proponer plan</button>
      ${P.res?`<button class="btn mini nar" id="plGuardar">${P.guardado?'✅ Guardado · guardar de nuevo':'Guardar y enviar a los celulares'}</button>`:''}</div>
    <div class="ger-sec"><h3>Operarios</h3>${tOps}</div>${P.res?`<div class="ger-sec"><h3>Plan propuesto · ${esc(P.fecha)}</h3>${tRes}</div>`:''}`;
}
function leerPlanEditado(){const P=GER.plan;if(!P.res)return;const cand=new Map(candidatosPlan().map(x=>[x.lote,x]));
  for(const a of P.res){const e=document.querySelector(`#gerPanel [data-pl="${CSS.escape(a.usuario)}"]`);if(!e)continue;
    a.lotes=e.value.split(/[,;\s]+/).map(x=>x.trim().toUpperCase()).filter(Boolean).map(l=>{const c=cand.get(l);return {lote:l,ha:c?c.ha:+haLote(l).toFixed(1),dias:c?c.dias:null};});}}
ENLACES_GER.plan=()=>{enlazarRango();enlazarCiclo();enlazarModoProg();const P=GER.plan;
  const f=$('#plFecha');if(f)f.onchange=()=>{P.fecha=f.value;P.guardado=false;};
  $$('#gerPanel [data-pa]').forEach(c=>c.onchange=()=>{const o=P.ops.find(x=>x.usuario===c.dataset.pa);if(o)o.activo=c.checked;});
  $$('#gerPanel [data-pm]').forEach(c=>c.onchange=()=>{const o=P.ops.find(x=>x.usuario===c.dataset.pm);if(o)o.meta=Number(c.value)||15;});
  const b=$('#plProp');if(b)b.onclick=()=>{if(!P.ops)return;P.res=proponerPlan(P.ops.filter(o=>o.activo));P.guardado=false;pintarGer();};
  const g=$('#plGuardar');if(g)g.onclick=async()=>{leerPlanEditado();g.disabled=true;g.textContent='Guardando…';
    const ruta=`censo/plan/${P.fecha}.json`;let sha=null;try{const r=await (await gh(`/contents/${ruta}?ref=${encodeURIComponent(SES.repo.rama)}`)).json();sha=r.sha;}catch(e){}
    const plan={formato:'sanidad-plan-censo-1',fecha:P.fecha,creado:new Date().toISOString(),creado_por:SES.u,asignaciones:P.res.filter(a=>a.lotes.length).map(a=>({usuario:a.usuario,nombre:a.nombre,lotes:a.lotes}))};
    try{await ghPut(ruta,JSON.stringify(plan,null,1),`Plan de censo ${P.fecha} (${plan.asignaciones.length} operarios)`,sha);P.guardado=true;toast('✅ Plan guardado: cada operario verá sus lotes al iniciar la jornada.');}
    catch(e){toast(e.message,6000);}pintarGer();};};
/* ---------------- LÍNEA DE TIEMPO DE LA PALMA ----------------
   Censo → cirugía → recuperación → alta, con los diagnósticos cargados en el visor y, si están cargados, los de cirugía. */
function historiaPalma(pid){
  const ev=[];const k=String(pid);
  for(const j of JOR)for(const d of j.diags)if(String(d.palma_id)===k)ev.push({t:Date.parse(d.creado),tipo:'Censo',txt:[d.nivel1,d.nivel2].filter(Boolean).join(' › ')||d.estado_nombre||d.estado,quien:j.evaluador,d:{...d,_j:j}});
  if(CIR.cargado){for(const d of CIR.correcciones)if(String(d.palma_id)===k)ev.push({t:tDe(d),tipo:d.origen==='caso_nuevo'?'Caso nuevo (cirujano)':'Corrección (cirujano)',txt:[d.nivel1,d.nivel2].filter(Boolean).join(' › '),quien:d.evaluador||''});
    for(const c of CIR.cirugias)if(String(c.palma_id)===k)ev.push({t:tDe(c),tipo:'Cirugía',txt:[c.tipo_cirugia,c.producto].filter(Boolean).join(' · ')||'Cirugía realizada',quien:c._j&&c._j.evaluador||''});}
  return ev.filter(e=>Number.isFinite(e.t)).sort((a,b)=>a.t-b.t);
}
function verHistoriaPalma(d){
  const ev=historiaPalma(d.palma_id);const ult=ev[ev.length-1];
  const enRec=ult&&/RECUPERACI/i.test(ult.txt||'');const dias=ult?Math.floor((Date.now()-ult.t)/864e5):0;
  const html=`<b class="h">🕘 ${esc(etiquetaDiag(d))}</b><div style="margin:6px 0 2px" class="tenue">${ev.length} evento(s) en los datos cargados${CIR.cargado?'':' (cargue Cirugías para ver también las cirugías)'}</div>
    <div style="max-height:260px;overflow:auto">${ev.map(e=>`<div style="border-left:3px solid ${e.tipo==='Cirugía'?'#2f93d5':/RECUPERACI/i.test(e.txt)?'#ff9f1c':/DE ALTA/i.test(e.txt)?'#00e676':'#e53935'};padding:3px 8px;margin:4px 0">
      <b>${esc(new Date(e.t).toLocaleDateString('es-CO'))}</b> · ${esc(e.tipo)}<br>${esc(e.txt)}<br><span class="tenue">${esc(e.quien||'')}</span></div>`).join('')}</div>
    ${enRec&&dias>30?`<div class="aviso" style="margin-top:6px">⏰ En recuperación sin nueva revisión hace ${dias} días.</div>`:''}`;
  L.popup({maxWidth:340,minWidth:260}).setLatLng([d.lat,d.lng]).setContent(html).openOn(mapa);
}
/* ---------------- REPORTES (diarios 3:00 p. m. y semanales) ----------------
   Los generan flujos automáticos del repositorio de datos: reportes/diario/AAAA-MM-DD/ y reportes/AAAA-Snn/ (PDF con mapa, HTML interactivo y Excel). */
async function listarReportes(){
  const rama=encodeURIComponent(SES.repo.rama);const out={diarios:[],semanales:[]};
  try{const r=await (await gh(`/contents/reportes?ref=${rama}`)).json();const dirs=(Array.isArray(r)?r:[]).filter(x=>x.type==='dir');
    for(const s of dirs.filter(x=>/^\d{4}-S\d{2}$/.test(x.name)).sort((a,b)=>b.name.localeCompare(a.name)).slice(0,20))out.semanales.push({nombre:s.name,archivos:(await arbol(s.sha)).filter(f=>f.type==='blob')});
    const d=dirs.find(x=>x.name==='diario');
    if(d){const dias=(await arbol(d.sha)).filter(x=>x.type==='tree').sort((a,b)=>b.path.localeCompare(a.path)).slice(0,30);
      for(const x of dias)out.diarios.push({nombre:x.path,archivos:(await arbol(x.sha)).filter(f=>f.type==='blob'&&!/\.json$/.test(f.path))});}}
  catch(e){if(e.status!==404)toast(e.message,6000);}
  GER.reportes=out;
}
const tipoRep=p=>/\.pdf$/i.test(p)?['📄 PDF','nar','application/pdf']:/\.html$/i.test(p)?['🗺 Interactivo','prim','text/html']:/\.xlsx$/i.test(p)?['📊 Excel','','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']:['⬇ '+p,'','application/octet-stream'];
function pintarReportes(){
  if(GER.reportes==null&&!GER.cargandoRep){GER.cargandoRep=true;listarReportes().finally(()=>{GER.cargandoRep=false;pintarGer();});}
  const R=GER.reportes,repo=SES.repo;const RM=GER.rm||(GER.rm={tipo:'diario',fecha:hoyISO(),envio:'todos',para:'',msg:''});
  const t=(lista,col)=>tablaGer([{t:col,f:x=>`<b>${esc(x.nombre)}</b>`},{t:'Archivos',f:x=>x.archivos.map(f=>{const [et,cl]=tipoRep(f.path);return `<button class="btn mini ${cl}" data-rep="${esc(f.sha)}|${esc(f.path)}">${et}</button>`;}).join(' ')+` <button class="btn mini" data-repzip="${esc(x.nombre)}">⬇ Todo (ZIP)</button>`}],lista);
  return `<p class="tenue">El <b>reporte diario</b> se genera de lunes a sábado a las <b>3:00 p. m.</b> (sin festivos) con las jornadas finalizadas y sincronizadas hasta esa hora; el <b>semanal</b>, los lunes a las 6:00 a. m. Cada uno trae <b>PDF con mapa y registro fotográfico</b>, <b>reporte interactivo</b> (mapa satelital con fotos y reproducción de recorridos, todos a la vez o uno a uno) y <b>Excel</b>, y se envía por correo y WhatsApp a los destinatarios configurados en la administración.</p>
    <div class="ger-sec"><h3>📤 Generar y enviar ahora (manual)</h3>
      <div class="ger-par">Reporte <select id="rmTipo">${[['diario','Diario'],['semanal','Semanal (semana de la fecha)']].map(([v,t])=>`<option value="${v}" ${RM.tipo===v?'selected':''}>${t}</option>`).join('')}</select>
        Fecha <input type="date" id="rmFecha" value="${esc(RM.fecha)}">
        Enviar a <select id="rmEnvio">${[['todos','Todos los destinatarios configurados'],['correos','Solo a estos correos…'],['ninguno','No enviar: solo generar y descargar']].map(([v,t])=>`<option value="${v}" ${RM.envio===v?'selected':''}>${t}</option>`).join('')}</select>
        <input type="text" id="rmPara" placeholder="correo1@palmares.com.co, correo2@…" style="min-width:260px" value="${esc(RM.para)}" ${RM.envio==='correos'?'':'hidden'}>
        <button class="btn mini nar" id="rmIr">📤 Generar y enviar</button></div>
      <p class="tenue" id="rmMsg">${RM.msg?RM.msg+'<br>':''}Tarda de 3 a 5 minutos: queda en la lista de abajo y llega por correo (y WhatsApp si es a todos los destinatarios). <a href="https://github.com/${esc(repo.owner)}/${esc(repo.repo)}/actions/workflows/reporte-manual.yml" target="_blank" rel="noopener">Ver ejecución en GitHub</a></p></div>
    ${RM.listo?`<div class="ger-sec" style="border:2px solid var(--verde,#00a651);border-radius:10px;padding:8px 12px"><h3>✅ Reporte listo · ${esc(RM.listo.nombre)}</h3>
      <div class="ger-par">${RM.listo.archivos.map(f=>{const [et,cl]=tipoRep(f.path);return `<button class="btn mini ${cl}" data-rep="${esc(f.sha)}|${esc(f.path)}">${et}</button>`;}).join(' ')}
      <button class="btn mini nar" data-repzip="${esc(RM.listo.nombre)}">⬇ Descargar todo (ZIP)</button></div></div>`:RM.pend?`<p class="tenue">⏳ Generando el reporte ${esc(RM.pend.nombre)}… (se revisa cada 20 segundos)</p>`:''}
    <div class="ger-par"><button class="btn mini" id="repRecargar">↻ Actualizar lista</button></div>
    ${R==null?'<p class="tenue">Consultando reportes…</p>':`<div class="ger-sec"><h3>Reportes diarios</h3>${R.diarios.length?t(R.diarios,'Fecha'):'<p class="tenue">Aún no hay reportes diarios.</p>'}</div>
      <div class="ger-sec"><h3>Reportes semanales</h3>${R.semanales.length?t(R.semanales,'Semana'):'<p class="tenue">Aún no hay reportes semanales.</p>'}</div>`}`;
}
/* ---- Exportar reportes: archivos sueltos o todo en un ZIP; seguimiento de la solicitud manual hasta que el reporte esté listo ---- */
async function carpetaReporte(tipo,nombre){
  const rama=encodeURIComponent(SES.repo.rama);
  try{const l=await (await gh(`/contents/${tipo==='semanal'?'reportes':'reportes/diario'}?ref=${rama}`)).json();const x=(Array.isArray(l)?l:[]).find(y=>y.type==='dir'&&y.name===nombre);return x||null;}
  catch(e){return null;}
}
function bajar(blob,nombre){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),120000);}
async function descargarRepZip(nombre){
  const R=GER.reportes||{diarios:[],semanales:[]};let it=[...R.diarios,...R.semanales].find(x=>x.nombre===nombre)||(GER.rm&&GER.rm.listo&&GER.rm.listo.nombre===nombre?GER.rm.listo:null);
  if(!it)throw new Error('No se encontró el reporte '+nombre);
  toast('Preparando el ZIP…',4000);const z=new JSZip();
  await Promise.all(it.archivos.map(async f=>z.file(f.path.split('/').pop(),await (await gh(`/git/blobs/${f.sha}`,'application/vnd.github.raw+json')).arrayBuffer())));
  bajar(await z.generateAsync({type:'blob'}),`reporte_sanidad_${nombre}.zip`);
}
function seguirSolicitud(){
  const RM=GER.rm,P=RM.pend;if(!P)return;clearTimeout(RM.tm);
  RM.tm=setTimeout(async()=>{if(GER.rm!==RM||RM.pend!==P)return;
    const c=await carpetaReporte(P.tipo,P.nombre);
    if(c&&c.sha!==P.antes){const archivos=(await arbol(c.sha)).filter(f=>f.type==='blob'&&!/\.json$/.test(f.path));
      RM.pend=null;RM.listo={nombre:P.nombre,archivos};RM.msg='';GER.reportes=null;toast(`✅ Reporte ${P.nombre} listo.`,6000);
      if(!document.querySelector('#gerPanel').hidden&&GER.tab==='reportes')pintarGer();
      if(P.descargar)try{await descargarRepZip(P.nombre);}catch(e){toast(e.message,6000);}
      return;}
    if(Date.now()-P.t0>15*60000){RM.pend=null;RM.msg='⚠ El reporte tarda más de lo normal. Revise la ejecución en GitHub o actualice la lista más tarde.';if(GER.tab==='reportes')pintarGer();return;}
    seguirSolicitud();},GER.rmPaso||20000);
}
async function solicitarReporte(sol){
  const ruta='solicitudes/reporte.json';let sha=null;
  try{sha=(await (await gh(`/contents/${ruta}?ref=${encodeURIComponent(SES.repo.rama)}`)).json()).sha;}catch(e){}
  await ghPut(ruta,JSON.stringify({formato:'sanidad-solicitud-1',...sol,solicitado_por:SES.nombre||SES.u,creado:new Date().toISOString()},null,1),
    `Reporte ${sol.tipo} a pedido (${SES.nombre||SES.u})`,sha);
}
ENLACES_GER.reportes=()=>{const r=$('#repRecargar');if(r)r.onclick=()=>{GER.reportes=null;pintarGer();};
  const RM=GER.rm,ev=$('#rmEnvio');
  if(ev){ev.onchange=()=>{RM.envio=ev.value;$('#rmPara').hidden=ev.value!=='correos';};$('#rmTipo').onchange=e=>RM.tipo=e.target.value;$('#rmFecha').onchange=e=>RM.fecha=e.target.value;$('#rmPara').oninput=e=>RM.para=e.target.value;}
  const ir=$('#rmIr');if(ir)ir.onclick=async()=>{const m=$('#rmMsg');const tipo=$('#rmTipo').value,fecha=$('#rmFecha').value,envio=ev.value;
    const para=$('#rmPara').value.split(/[,;\s]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);
    if(envio==='correos'&&(!para.length||para.some(x=>!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))){m.textContent='❌ Escriba uno o más correos válidos, separados por coma.';return;}
    const dest=envio==='todos'?'todos los destinatarios':envio==='correos'?para.join(', '):'nadie';
    if(!confirm(envio==='ninguno'?`¿Generar el reporte ${tipo} del ${fecha} para descargarlo (sin enviarlo)?`:`¿Generar el reporte ${tipo} del ${fecha} y enviarlo a ${dest}?`))return;
    const nombre=tipo==='semanal'?semanaISO(fecha):fecha;const antes=await carpetaReporte(tipo,nombre);
    ir.disabled=true;ir.textContent='Solicitando…';
    try{await solicitarReporte({tipo,fecha,envio,para:envio==='correos'?para:[]});
      RM.msg=`✅ Solicitado a las ${esc(new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}))}. En 3 a 5 minutos queda listo para descargar aquí${envio==='ninguno'?' (se descarga solo)':' y llega a '+esc(dest)}.`;
      RM.listo=null;RM.pend={tipo,nombre,antes:antes&&antes.sha,t0:Date.now(),descargar:envio==='ninguno'};seguirSolicitud();pintarGer();}
    catch(e){RM.msg='';m.textContent='❌ '+e.message;}finally{ir.disabled=false;ir.textContent='📤 Generar y enviar';}};
  $$('#gerPanel [data-repzip]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await descargarRepZip(b.dataset.repzip);}catch(e){toast(e.message,6000);}b.disabled=false;});
  $$('#gerPanel [data-rep]').forEach(b=>b.onclick=async()=>{const [sha,path]=b.dataset.rep.split('|');const tipo=tipoRep(path)[2];b.disabled=true;
    const w=tipo==='text/html'?window.open('','_blank'):null;
    try{const buf=await (await gh(`/git/blobs/${sha}`,'application/vnd.github.raw+json')).arrayBuffer();const u=URL.createObjectURL(new Blob([buf],{type:tipo}));
      if(w){w.location.href=u;}else{const a=document.createElement('a');a.href=u;a.download=path.split('/').pop();document.body.appendChild(a);a.click();a.remove();}setTimeout(()=>URL.revokeObjectURL(u),120000);}
    catch(e){if(w)w.close();toast(e.message,6000);}b.disabled=false;});};


/* =====================================================================
   INTERRUPTOR «LIBRE / SEGÚN PROGRAMACIÓN» por labor (censo y plagas).
   Se guarda en config/modo_programacion.json; la App lo lee al abrir la labor.
   ===================================================================== */
const MPROG={c:null,sha:null,cargando:false,err:null,guardando:false};
async function cargarModoProg(){
  const rama=encodeURIComponent(SES.repo.rama);
  try{const j=await (await gh(`/contents/${MODO_PROG_RUTA}?ref=${rama}`)).json();MPROG.sha=j.sha;MPROG.c=JSON.parse(DEC.decode(deB64(j.content.replace(/\s/g,''))));}
  catch(e){if(e.status!==404)throw e;MPROG.sha=null;MPROG.c={formato:'sanidad-modo-programacion-1',historial:[]};}
  MPROG.c.historial=MPROG.c.historial||[];MPROG.err=null;
}
const fechaHoraCO=s=>{try{return new Date(s).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'});}catch(e){return s;}};
function tarjetaModoProg(labor){
  if(MPROG.c==null&&!MPROG.cargando&&!MPROG.err){MPROG.cargando=true;cargarModoProg().catch(e=>{MPROG.err=e.message;}).finally(()=>{MPROG.cargando=false;pintarGer();});}
  if(MPROG.err)return `<div class="ger-sec"><div class="ger-aviso ger-mal">⚠ No se pudo leer el modo de programación: ${esc(MPROG.err)} <button class="btn mini" data-mprog-re>Reintentar</button></div></div>`;
  if(MPROG.c==null)return '<div class="ger-sec"><p class="tenue">Consultando el modo de programación…</p></div>';
  const prog=modoProgDe(MPROG.c,labor)==='programado',x=MPROG.c[labor]||{},quien=labor==='plagas'?'auxiliar':'operario';
  return `<div class="ger-sec" id="mprog_${labor}" style="border-left:4px solid ${prog?'#22d39a':'#ffc53d'}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><b>Elección de lotes en la App · ${esc(LABORES_MODO_PROG[labor])}:</b> <span class="ger-chip ${prog?'ok':'med'}" data-mprog-estado="${labor}">${prog?'🔒 SEGÚN PROGRAMACIÓN':'🔓 LIBRE'}</span>
        <div class="tenue" style="margin-top:4px">${prog?`Cada ${quien} solo puede trabajar su bloque de hoy (el plan enviado). Si no tiene bloque asignado, la App no inicia la jornada.`:`Cada ${quien} elige los lotes que quiera; su bloque de hoy aparece como sugerencia.`}</div>
        ${x.fecha?`<div class="tenue" style="font-size:12px;margin-top:2px">Último cambio: ${esc(x.nombre||x.por||'')} · ${esc(fechaHoraCO(x.fecha))}</div>`:''}</div>
      <button class="btn ${prog?'':'prim'}" data-mprog="${labor}" ${MPROG.guardando?'disabled':''}>${prog?'🔓 Dejar libre':'🔒 Activar programación'}</button></div></div>`;
}
function enlazarModoProg(){
  $$('#gerPanel [data-mprog-re]').forEach(b=>b.onclick=()=>{MPROG.err=null;MPROG.c=null;pintarGer();});
  $$('#gerPanel [data-mprog]').forEach(b=>b.onclick=async()=>{
    const labor=b.dataset.mprog,nuevo=modoProgDe(MPROG.c,labor)==='programado'?'libre':'programado',nom=LABORES_MODO_PROG[labor];
    if(!confirm(nuevo==='programado'?`¿Activar la programación en ${nom}?\n\nDesde la próxima jornada cada persona solo podrá trabajar su bloque del plan del día.`:`¿Dejar libre ${nom}?\n\nDesde la próxima jornada cada persona podrá elegir cualquier lote.`))return;
    MPROG.guardando=true;pintarGer();
    try{await cargarModoProg();   // la versión más reciente, por si otra persona lo cambió
      const ahora=new Date().toISOString(),c=MPROG.c;
      c[labor]={modo:nuevo,por:SES.u,nombre:SES.nombre||SES.u,fecha:ahora};
      c.historial=[{labor,modo:nuevo,por:SES.u,nombre:SES.nombre||SES.u,fecha:ahora},...c.historial].slice(0,200);c.actualizado=ahora;
      MPROG.sha=await ghPut(MODO_PROG_RUTA,JSON.stringify(c,null,1),`${nom}: elección de lotes ${nuevo==='programado'?'según programación':'libre'} (${SES.u})`,MPROG.sha);
      toast(nuevo==='programado'?`🔒 ${nom}: programación activa.`:`🔓 ${nom}: elección libre de lotes.`,4500);}
    catch(e){MPROG.c=null;toast(e.message,6000);}
    MPROG.guardando=false;pintarGer();});
}

/* =====================================================================
   FILTROS DE GERENCIA (fecha, programa, operario, lote, estado y enfermedad con sus opciones)
   Son los mismos filtros del visor: cambian a la vez el tablero, el mapa y las tablas.
   ===================================================================== */
const usaFiltrosGer=()=>GER.mod==='ger'?GER.tab==='tablero':['calidad','auditoria'].includes(GER.tab);
(function(){const css=document.createElement('style');css.textContent=`
  .ger-fil{background:#081e16;border:1px solid var(--borde);border-radius:14px;padding:10px 12px;margin-top:10px}
  .ger-fil .gf-fila{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
  .ger-fil .gf-fila+.gf-fila{margin-top:8px}
  .ger-fil label.gf{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--tenue);min-width:150px;flex:1}
  .ger-fil input[type=date]{background:#0a1d16;color:var(--texto);border:1px solid var(--borde);border-radius:9px;padding:6px 8px;min-height:34px}
  .ger-fil .gf-res{font-size:12.5px;color:var(--tenue);margin-top:6px}
  .ger-sub{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
  .ger-sub button{border:1px solid var(--borde);background:transparent;color:var(--texto);border-radius:10px;padding:6px 12px;font-weight:700;cursor:pointer}
  .ger-sub button.on{background:rgba(34,211,154,.18);border-color:var(--acento);color:#bff5e0}
  .enf-bar{display:grid;grid-template-columns:minmax(110px,34%) minmax(0,1fr) 112px;gap:8px;align-items:center;font-size:13px;padding:3px 0}
  .enf-bar .b{height:14px;border-radius:4px;min-width:2px}
  .enf-bar .v{text-align:right;font-variant-numeric:tabular-nums;color:var(--texto)}
  .enf-bar.clic{cursor:pointer}.enf-bar.clic:hover{background:rgba(255,255,255,.04)}
  .enf-card{border:1px solid var(--borde);border-radius:14px;padding:10px 12px;margin-top:10px;background:rgba(255,255,255,.02)}
  .enf-card h4{margin:0 0 6px;font-family:var(--t);letter-spacing:.8px;font-size:15.5px}
  .enf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:10px}
  #gerMapaAv .leaflet-control-scale-line{background:rgba(255,255,255,.85);color:#222;border-color:#222}`;document.head.appendChild(css);})();
function barraFiltrosGer(){
  const ms=(k,t)=>`<label class="gf">${t}<div class="ms" data-k="${k}"><button type="button" class="ms-bt" aria-haspopup="listbox">Todos</button></div></label>`;
  const hay=Object.values(FIL).some(s=>s.size);
  return `<div class="ger-fil" id="gerFil">
    <div class="gf-fila"><label class="gf" style="flex:0 0 auto">Desde<input type="date" id="gDesde" value="${esc($('#fDesde').value||'')}"></label>
      <label class="gf" style="flex:0 0 auto">Hasta<input type="date" id="gHasta" value="${esc($('#fHasta').value||'')}"></label>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn mini" data-gd="0">Hoy</button><button class="btn mini" data-gd="6">7 días</button><button class="btn mini" data-gd="29">30 días</button><button class="btn mini" data-gd="89">90 días</button><button class="btn mini" data-gd="mes">Este mes</button>
        <button class="btn mini prim" id="gCargar">CARGAR</button>${hay?'<button class="btn mini" id="gLimpiar" title="Quitar todos los filtros (no cambia las fechas)">✕ Quitar filtros</button>':''}</div></div>
    <div class="gf-fila">${ms('prog','Programa')}${ms('lote','Lote')}${ms('op','Operario')}${ms('est','Estado')}</div>
    <div class="gf-fila">${ms('n1','Enfermedad')}${ms('n2','Opción de la enfermedad')}${ms('n3','Tipo de seguimiento')}</div>
    <div class="gf-res" id="gfRes">${esc(rangoTxt())} · <b>${num(JORF.length)}</b> jornadas · <b>${num(DIAGF.length)}</b> diagnósticos con los filtros</div></div>`;
}
function enlazarFiltrosGer(){
  for(const k of Object.keys(FIL))msPintar(k);
  const ir=async(d1,d2)=>{$('#fDesde').value=d1;$('#fHasta').value=d2;try{await cargar();}catch(e){toast(e.message,6000);}pintarGer();};
  $$('#gerPanel [data-gd]').forEach(b=>b.onclick=()=>{const h=hoyISO();if(b.dataset.gd==='mes')return ir(h.slice(0,8)+'01',h);ir(hoyISO(new Date(Date.now()-Number(b.dataset.gd)*86400000)),h);});
  const c=$('#gCargar');if(c)c.onclick=()=>{const a=$('#gDesde').value,b=$('#gHasta').value;if(!a||!b||a>b){toast('Revise el rango de fechas.');return;}c.disabled=true;c.textContent='Cargando…';ir(a,b);};
  const l=$('#gLimpiar');if(l)l.onclick=()=>{for(const k of Object.keys(FIL))FIL[k].clear();opcionesLote();opcionesEnf();for(const k of Object.keys(FIL))msPintar(k);aplicarFiltros(true);};
}
/* Al cambiar cualquier filtro se repinta también el panel de Gerencia */
{const _af=aplicarFiltros;aplicarFiltros=function(a){_af(a);if(GER.on){clearTimeout(GER._rep);GER._rep=setTimeout(()=>{if(GER.on)pintarGer();},60);}};}

/* ---------- Tablero con secciones: Resumen · Enfermedades · Mapa de avance ---------- */
{const _p=pintarTablero,_e=ENLACES_GER.tablero;
  pintarTablero=function(){const s=GER.tsub||'resumen';
    const sub=`<div class="ger-sub">${[['resumen','📊 Resumen'],['enf','🦠 Enfermedades'],['avance','🗺️ Mapa de avance del censo']].map(([k,t])=>`<button data-tsub="${k}" class="${s===k?'on':''}">${t}</button>`).join('')}</div>`;
    if(!JOR.length)return sub+sinDatos();
    return sub+(s==='enf'?pintarEnfGer():s==='avance'?pintarAvanceGer():_p());};
  ENLACES_GER.tablero=()=>{$$('#gerPanel [data-tsub]').forEach(b=>b.onclick=()=>{GER.tsub=b.dataset.tsub;pintarGer();});
    if(!JOR.length){enlazarRango();return;}
    const s=GER.tsub||'resumen';if(s==='enf')enlazarEnfGer();else if(s==='avance')montarMapaAvance();else _e();};}

/* ---------- ENFERMEDADES: datos y gráficos por enfermedad y sus opciones (nivel 2) y tipos (nivel 3) ---------- */
const nomEnf=c=>PROBLEMAS[c]||c||'Sin enfermedad';
const keyPalma=d=>String(d.palma_id??(d.lote+'|'+d.linea+'|'+d.palma));
function agruparEnf(ds){
  const m=new Map();
  for(const d of ds){const c=codN1(d)||'—';let e=m.get(c);if(!e)m.set(c,e={c,n:0,p:new Set(),lotes:new Set(),n2:new Map(),est:new Map(),sem:new Map()});
    e.n++;e.p.add(keyPalma(d));e.lotes.add(d.lote);e.est.set(d.estado||'—',(e.est.get(d.estado||'—')||0)+1);
    const s=semanaISO(String(d.creado||d._j&&d._j.fecha||'').slice(0,10)||hoyISO());e.sem.set(s,(e.sem.get(s)||new Set()).add(keyPalma(d)));
    const k2=d.nivel2||'';if(k2){let o=e.n2.get(k2);if(!o)e.n2.set(k2,o={t:k2,n:0,p:new Set(),n3:new Map()});o.n++;o.p.add(keyPalma(d));
      const k3=d.nivel3||'';if(k3){let q=o.n3.get(k3);if(!q)o.n3.set(k3,q={t:k3,n:0,p:new Set()});q.n++;q.p.add(keyPalma(d));}}}
  return [...m.values()].sort((a,b)=>b.p.size-a.p.size);
}
const ESTN=id=>{try{return (ESTADOS.find(e=>e.id===id)||{}).n||id;}catch(e){return id;}};
function barras(items,max,col,attr){return items.map((x,i)=>`<div class="enf-bar ${attr?'clic':''}" ${attr?attr(x):''}><span title="${esc(x.t)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.t)}</span>
  <span><span class="b" style="display:inline-block;width:${Math.max(.5,x.v/max*100).toFixed(1)}%;background:${typeof col==='function'?col(x,i):col}"></span></span><span class="v">${x.txt}</span></div>`).join('');}
function columnasSemana(enfs){   // palmas con diagnóstico por semana, apiladas por enfermedad (las 6 con más palmas)
  const top=enfs.slice(0,6),sems=[...new Set(top.flatMap(e=>[...e.sem.keys()]))].sort();if(!sems.length)return '';
  const tot=s=>top.reduce((a,e)=>a+((e.sem.get(s)||new Set()).size),0),max=Math.max(1,...sems.map(tot)),W=Math.max(320,sems.length*46),H=200;
  const bw=Math.min(34,W/sems.length-10);let svg='';
  sems.forEach((s,i)=>{let y=H-22;const x=i*(W/sems.length)+(W/sems.length-bw)/2;
    top.forEach((e,k)=>{const v=(e.sem.get(s)||new Set()).size;if(!v)return;const h=v/max*(H-46);y-=h;svg+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${PALETA[k%PALETA.length]}"><title>${esc(nomEnf(e.c))} · ${s}: ${v} palmas</title></rect>`;});
    svg+=`<text x="${(x+bw/2).toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle" font-size="11" fill="#cfe">${tot(s)}</text><text x="${(x+bw/2).toFixed(1)}" y="${H-6}" text-anchor="middle" font-size="10.5" fill="#9bb">${s.slice(5)}</text>`;});
  return `<div class="ger-sec"><h3>Palmas con diagnóstico por semana</h3><div style="overflow-x:auto"><svg width="${W}" height="${H}" role="img" aria-label="Palmas con diagnóstico por semana">${svg}</svg></div>
    <div class="ger-par">${top.map((e,k)=>`<span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${PALETA[k%PALETA.length]};vertical-align:middle;margin-right:4px"></span>${esc(nomEnf(e.c))}</span>`).join('')}</div></div>`;
}
function pintarEnfGer(){
  const ds=DIAGF,enfs=agruparEnf(ds),pal=new Set(ds.map(keyPalma)).size;
  if(!ds.length)return `<div class="ger-aviso">No hay diagnósticos con los filtros elegidos (${esc(rangoTxt())}).</div>`;
  const maxP=Math.max(1,...enfs.map(e=>e.p.size));
  const kp=`<div class="ger-kpis" style="margin-top:12px">${kpi(num(ds.length),'Diagnósticos')}${kpi(num(pal),'Palmas diagnosticadas')}${kpi(num(enfs.length),'Enfermedades')}${kpi(num(new Set(ds.map(d=>d.lote)).size),'Lotes')}</div>`;
  const g1=`<div class="ger-sec"><h3>Palmas por enfermedad</h3><p class="tenue">Palmas distintas con diagnóstico en el periodo; entre paréntesis, el número de diagnósticos. Clic en una enfermedad para filtrar todo por ella.</p>
    ${barras(enfs.map(e=>({t:nomEnf(e.c),c:e.c,v:e.p.size,txt:`${num(e.p.size)} · ${num(e.p.size/pal*100,1)} % (${num(e.n)})`})),maxP,(x,i)=>PALETA[i%PALETA.length],x=>`data-enf="${esc(x.c)}" title="Filtrar por ${esc(x.t)}"`)}</div>`;
  const tarjetas=enfs.map((e,i)=>{const subs=[...e.n2.values()].sort((a,b)=>b.p.size-a.p.size),col=PALETA[i%PALETA.length];
    const est=[...e.est.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="ger-chip gris">${esc(ESTN(k))}: ${num(v)}</span>`).join(' ');
    const sinSub=e.n-subs.reduce((a,o)=>a+o.n,0);
    let cuerpo='';
    if(subs.length){const mx=Math.max(1,...subs.map(o=>o.p.size));
      cuerpo=barras(subs.map(o=>({t:o.t,v:o.p.size,txt:`${num(o.p.size)} · ${num(o.p.size/e.p.size*100,1)} %`})),mx,col,o=>`data-enf2="${esc(e.c)}|${esc(o.t)}" title="Filtrar por esta opción"`);
      const con3=subs.filter(o=>o.n3.size);
      if(con3.length)cuerpo+=`<div class="ger-tabla" style="margin-top:8px"><table><thead><tr><th>Opción</th><th>Tipo de seguimiento</th><th class="n">Palmas</th><th class="n">Diagnósticos</th><th class="n">% de la opción</th></tr></thead><tbody>${
        con3.flatMap(o=>[...o.n3.values()].sort((a,b)=>b.p.size-a.p.size).map((q,k)=>`<tr><td>${k?'':`<b>${esc(o.t)}</b>`}</td><td>${esc(q.t)}</td><td class="n">${num(q.p.size)}</td><td class="n">${num(q.n)}</td><td class="n">${num(q.p.size/o.p.size*100,1)} %</td></tr>`)).join('')}</tbody></table></div>`;
      if(sinSub>0)cuerpo+=`<p class="tenue" style="font-size:12px">${num(sinSub)} diagnóstico(s) sin opción registrada.</p>`;}
    else cuerpo='<p class="tenue" style="font-size:12.5px">Esta enfermedad no tiene subdivisiones registradas.</p>';
    return `<div class="enf-card" style="border-left:4px solid ${col}"><h4>${esc(nomEnf(e.c))}</h4>
      <div class="ger-par" style="margin:0 0 6px"><b style="color:var(--texto)">${num(e.p.size)}</b> palmas · ${num(e.n)} diagnósticos · ${num(e.lotes.size)} lotes · ${est}</div>${cuerpo}</div>`;}).join('');
  // Por lote: palmas diagnosticadas y las tres enfermedades principales
  const pl=new Map();for(const d of ds){let x=pl.get(d.lote);if(!x)pl.set(d.lote,x={lote:d.lote,p:new Set(),c:new Map()});x.p.add(keyPalma(d));const c=codN1(d)||'—';x.c.set(c,(x.c.get(c)||new Set()).add(keyPalma(d)));}
  const filasL=[...pl.values()].map(x=>({...x,tl:totalLote(x.lote)})).sort((a,b)=>b.p.size-a.p.size);
  const tL=tablaGer([{t:'Lote',f:x=>`<b>${esc(x.lote)}</b>`},{t:'Programa',f:x=>esc(PROG.get(x.lote)||'—')},{t:'Palmas diagnosticadas',n:1,f:x=>num(x.p.size)},{t:'% del lote',n:1,f:x=>x.tl?num(x.p.size/x.tl*100,2)+' %':'—'},
    {t:'Principales enfermedades',f:x=>[...x.c.entries()].sort((a,b)=>b[1].size-a[1].size).slice(0,3).map(([c,s])=>`${esc(c)} ${num(s.size)}`).join(' · ')}],filasL.slice(0,300));
  return `${kp}${g1}${columnasSemana(enfs)}<div class="ger-sec"><h3>Detalle por enfermedad y sus opciones</h3><p class="tenue">Cada opción (nivel 2) con sus palmas y porcentaje dentro de la enfermedad; si tiene tipos de seguimiento (nivel 3), van en la tabla. Clic en una opción para filtrar todo por ella.</p>
    <div class="enf-grid">${tarjetas}</div></div>
    <div class="ger-sec"><h3>Por lote</h3>${tL}</div>`;
}
function enlazarEnfGer(){
  $$('#gerPanel [data-enf]').forEach(b=>b.onclick=()=>{msSolo('n1',b.dataset.enf);FIL.n2.clear();FIL.n3.clear();opcionesEnf();aplicarFiltros(true);});
  $$('#gerPanel [data-enf2]').forEach(b=>b.onclick=()=>{const [c,o]=b.dataset.enf2.split('|');msSolo('n1',c);opcionesEnf();msSolo('n2',o);FIL.n3.clear();opcionesEnf();aplicarFiltros(true);});
}

/* ---------- MAPA DE AVANCE DEL CENSO: palmas visitadas (1.ª, 2.ª… entrada) y sin intervenir, como los mapas oficiales ---------- */
const AV_CLASES=[{k:0,t:'Sin intervenir',c:'#c8191f'},{k:1,t:'1ra Entrada',c:'#47c21b'},{k:2,t:'2da Entrada',c:'#24631b'},{k:3,t:'3ra Entrada o más',c:'#0c3a10'}];
const fechaLarga=f=>{try{return new Date(f+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});}catch(e){return f;}};
function pintarAvanceGer(){
  const d1=$('#fDesde').value,d2=$('#fHasta').value;
  return `<div class="ger-sec"><h3>Mapa de avance del censo</h3>
    <p class="tenue">Cada palma según las veces que fue visitada en el periodo cargado (${esc(rangoTxt())}): <b>1ra entrada</b> = una visita, <b>2da entrada</b> = visitada en dos días distintos, <b>sin intervenir</b> = no visitada. Hectáreas en proporción a las palmas sobre el área oficial de los lotes. Con los filtros de programa, lote y operario.</p>
    <div class="ger-par"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="avNombres" ${GER.avNombres!==false?'checked':''}> Nombres de lote</label>
      <button class="btn mini" id="avPng" disabled>⬇ Descargar imagen (PNG)</button><span id="avEstado" class="tenue">Calculando las palmas visitadas…</span></div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px" class="mc-grid">
      <div id="gerMapaAv" style="height:720px;border-radius:14px;border:1px solid var(--borde);background:#fff"></div>
      <div><div id="avLeyenda"></div><div id="avTabla" class="ger-tabla" style="max-height:380px;overflow:auto;margin-top:10px"></div></div></div>
    <input type="hidden" id="avRango" value="${esc(d1)}|${esc(d2)}"></div>`;
}
async function calcularAvanceMapa(feats){
  const key=JORF.map(j=>j.id).join(',')+'|'+feats.map(f=>f.properties._lote).join(',');
  if(GER.avCache&&GER.avCache.key===key)return GER.avCache;
  // Veces visitada = días distintos con la palma en las palmas visitadas de las jornadas filtradas
  const vis=new Map(),ult=new Map();let sinIds=0;const lotesSel=new Set(feats.map(f=>f.properties._lote));
  for(const j of [...JORF].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))))for(const x of j.por_lote){if(!lotesSel.has(x.lote))continue;
    const ids=x.ids_palmas_visitadas||[];if(!ids.length){sinIds+=Number(x.palmas_visitadas)||0;continue;}
    for(const id0 of ids){const id=String(id0);if(ult.get(id)===j.fecha)continue;ult.set(id,j.fecha);vis.set(id,(vis.get(id)||0)+1);}}
  const palmas=[],porLote=new Map();
  for(const f of feats){const l=f.properties._lote;const d=await chunkLote(l);const r={lote:l,tot:0,v:0,c:[0,0,0,0]};
    for(const a of d){if(a[3]===0||a[4]==null||(typeof VAJ!=='undefined'&&VAJ.has(String(a[0]))))continue;const n=Math.min(3,vis.get(String(a[0]))||0);
      palmas.push(a[4],a[5],n);r.tot++;r.c[n]++;if(n)r.v++;}
    porLote.set(l,r);}
  GER.avCache={key,palmas,porLote,sinIds};return GER.avCache;
}
/* Lienzo con las palmas pintadas por clase (proyección simple, celdas de CEL metros) */
function lienzoAvance(feats,palmas,CEL){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;const an=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  for(const f of feats)for(const pol of an(f))for(const r of pol)for(const [x,y] of r){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  const mx=111320*Math.cos((y0+y1)/2*Math.PI/180),my=110540,dlon=CEL/mx,dlat=CEL/my,W=Math.ceil((x1-x0)/dlon)+1,H=Math.ceil((y1-y0)/dlat)+1;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');const s=Math.max(2,Math.ceil(9.5/CEL));
  for(let k=0;k<4;k++){g.fillStyle=AV_CLASES[k].c;for(let i=0;i<palmas.length;i+=3){if(palmas[i+2]!==k)continue;g.fillRect(Math.round((palmas[i]-x0)/dlon-s/2),Math.round((y1-palmas[i+1])/dlat-s/2),s,s);}}
  return {cv,CEL,x0,y1,dlon,dlat,W,H,limites:[[y1-H*dlat,x0],[y1,x0+W*dlon]]};
}
async function montarMapaAvance(){
  const el=$('#gerMapaAv');if(!el)return;
  if(GER.av){try{GER.avVista={c:GER.av.getCenter(),z:GER.av.getZoom()};GER.av.off();GER.av.remove();}catch(e){}GER.av=null;}
  if(GER.plant===undefined){GER.plant=null;cargarPlantacionGer().then(()=>{if(GER.plant&&$('#gerMapaAv'))montarMapaAvance();});}
  const feats=LOTES?LOTES.features.filter(f=>f.geometry&&/Polygon/.test(f.geometry.type)&&enProg(f.properties._lote)&&loteSel(f.properties._lote)):[];
  const sinFiltro=!FIL.lote.size&&!FIL.prog.size,plant=sinFiltro&&GER.plant?GER.plant:null;
  if(!feats.length){$('#avEstado').textContent='No hay lotes con los filtros elegidos.';return;}
  const A=await calcularAvanceMapa(feats);if(!$('#gerMapaAv')||$('#gerMapaAv')!==el)return;
  const sup=lienzoAvance(feats,A.palmas,6);GER.avSup=sup;GER.avFeats=feats;GER.avPlant=plant;
  const m=L.map(el,{zoomControl:true,attributionControl:false,preferCanvas:true,minZoom:11,maxZoom:20,zoomSnap:.25});GER.av=m;
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(m);new NorteMC({position:'topright'}).addTo(m);
  L.imageOverlay(sup.cv.toDataURL(),sup.limites,{opacity:1,interactive:false}).addTo(m);
  const capaL=L.geoJSON({type:'FeatureCollection',features:feats},{style:{color:'#111',weight:.8,fill:true,fillOpacity:0}}).addTo(m);
  if(plant)L.geoJSON({type:'FeatureCollection',features:plant},{style:{color:'#000',weight:3,fill:false},interactive:false}).addTo(m);
  capaL.eachLayer(l=>{const lo=l.feature.properties._lote,r=A.porLote.get(lo)||{tot:0,v:0,c:[0,0,0,0]};
    l.bindTooltip(`<b>${esc(lo)}</b> · ${num(r.v)} de ${num(r.tot)} palmas visitadas (${r.tot?num(r.v/r.tot*100,1):0} %)${r.c[2]+r.c[3]?` · ${num(r.c[2]+r.c[3])} con 2 o más entradas`:''}`,{sticky:true});
    if(GER.avNombres!==false)etiquetaLoteMC(m,lo);});
  const etq=()=>el.classList.toggle('mc-sin-etq',m.getZoom()<12);m.on('zoomend',etq);
  if(GER.avVista)m.setView(GER.avVista.c,GER.avVista.z);else m.fitBounds(capaL.getBounds(),{padding:[10,10]});etq();setTimeout(()=>m.invalidateSize(),60);
  // Totales por clase: hectáreas proporcionales a las palmas sobre el área oficial (Area_ha)
  const R=resumenAvance(feats,A);GER.avRes=R;
  $('#avLeyenda').innerHTML=leyendaAvanceHTML(R);
  $('#avEstado').innerHTML=`<b>${num(R.vis)}</b> de <b>${num(R.tot)}</b> palmas visitadas${A.sinIds?` · ⚠ ${num(A.sinIds)} palmas de jornadas antiguas sin el detalle de palmas no se pueden ubicar en el mapa`:''}`;
  const filas=[...A.porLote.values()].map(r=>({...r,p:r.tot?r.v/r.tot*100:0})).sort((a,b)=>a.p-b.p||ordenNat(a.lote,b.lote));
  $('#avTabla').innerHTML=tablaGer([{t:'Lote',f:x=>`<b>${esc(x.lote)}</b>`},{t:'Visitadas',n:1,f:x=>num(x.v)},{t:'Palmas',n:1,f:x=>num(x.tot)},{t:'Avance',n:1,f:x=>num(x.p,1)+' %'}],filas,x=>`class="clic" data-avl="${esc(x.lote)}"`);
  $$('#avTabla [data-avl]').forEach(tr=>tr.onclick=()=>{let bb=null;capaL.eachLayer(y=>{if(y.feature.properties._lote===tr.dataset.avl)bb=y.getBounds();});if(bb)m.fitBounds(bb,{padding:[30,30],maxZoom:17});});
  const nn=$('#avNombres');if(nn)nn.onchange=()=>{GER.avNombres=nn.checked;montarMapaAvance();};
  const pb=$('#avPng');if(pb){pb.disabled=false;pb.onclick=()=>descargarAvancePNG();}
}
function resumenAvance(feats,A){
  const c=[0,0,0,0];let tot=0,lotesI=0;for(const r of A.porLote.values()){for(let k=0;k<4;k++)c[k]+=r.c[k];tot+=r.tot;if(r.v)lotesI++;}
  const oficial=feats.reduce((a,f)=>a+(Number(f.properties.Area_ha)||0),0),ha=c.map(n=>oficial&&tot?n/tot*oficial:n/115);
  return {c,tot,vis:tot-c[0],ha,haTot:ha.reduce((a,b)=>a+b,0),lotes:A.porLote.size,lotesI};
}
function leyendaAvanceHTML(R){
  const fila=k=>{const x=AV_CLASES[k];return `<tr data-avc="${k}"><td style="padding:5px 4px;vertical-align:top"><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${x.c};margin-top:2px"></span></td>
    <td style="padding:4px 6px"><div style="font-size:15px">${x.t}</div><div style="font-size:14px">${num(R.ha[k],0)} HA | ${num(R.haTot?R.ha[k]/R.haTot*100:0,1)}%</div></td></tr>`;};
  const ks=[1,2,3].filter(k=>k<3||R.c[3]>0);
  return `<div style="background:#fff;color:#222;border-radius:12px;padding:12px 14px">
    <div style="font-family:var(--t);font-size:16px;letter-spacing:.8px;color:#555">AVANCE CENSO DE ENFERMEDADES</div>
    <div style="font-size:12.5px;color:#666;margin-bottom:8px">${esc(rangoAvTxt())}</div>
    <div style="font-size:16px;margin-bottom:2px">N° Entradas</div>
    <table style="border-collapse:collapse">${ks.map(fila).join('')}${fila(0)}</table>
    <div style="font-size:15px;margin-top:8px">Total Intervenido</div><div style="font-size:15px"><b>${num(R.lotesI)}</b> Lotes | ${num(R.lotes?R.lotesI/R.lotes*100:0,1)}%</div>
    <div style="font-size:12px;color:#666;margin-top:4px">${num(R.vis)} de ${num(R.tot)} palmas visitadas (${num(R.tot?R.vis/R.tot*100:0,1)} %)</div></div>`;
}
function rangoAvTxt(){const d1=$('#fDesde').value,d2=$('#fHasta').value;if(!d1||!d2)return '';return d1===d2?fechaLarga(d1):`Del ${fechaLarga(d1)} al ${fechaLarga(d2)}`;}
/* Imagen para imprimir o compartir: título, mapa con lotes y nombres, convenciones y escala */
function descargarAvancePNG(){
  const S=GER.avSup,R=GER.avRes,feats=GER.avFeats;if(!S||!R)return;
  const k=Math.min(3,Math.max(1,2400/Math.max(S.W,S.H))),M=40,PW=380,TH=110,W=Math.round(S.W*k)+PW+M*3,H=Math.max(Math.round(S.H*k)+TH+M*2,760);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);
  const ox=M,oy=TH+M,P=(x,y)=>[ox+(x-S.x0)/S.dlon*k,oy+(S.y1-y)/S.dlat*k];
  g.imageSmoothingEnabled=false;g.drawImage(S.cv,ox,oy,S.W*k,S.H*k);
  const an=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  const traza=(fs,w)=>{g.lineWidth=w;g.strokeStyle='#111';for(const f of fs)for(const pol of an(f))for(const r of pol){g.beginPath();r.forEach(([x,y],i)=>{const [a,b]=P(x,y);i?g.lineTo(a,b):g.moveTo(a,b);});g.closePath();g.stroke();}};
  traza(feats,1);if(GER.avPlant)traza(GER.avPlant,4);
  if(GER.avNombres!==false){g.font='600 10px sans-serif';g.textAlign='center';g.textBaseline='middle';
    for(const f of feats){const c=centroLote(f.properties._lote);if(!c)continue;const [a,b]=P(c[1],c[0]);const t=f.properties._lote;const w=g.measureText(t).width+6;
      g.fillStyle='rgba(255,255,255,.9)';g.fillRect(a-w/2,b-7,w,14);g.fillStyle='#111';g.fillText(t,a,b);}}
  g.textAlign='center';g.textBaseline='alphabetic';g.fillStyle='#6b6b6b';g.font='700 34px sans-serif';g.fillText('AVANCE CENSO DE ENFERMEDADES',W/2,M+30);
  g.font='700 24px sans-serif';g.fillText(rangoAvTxt().toUpperCase(),W/2,M+66);
  // Convenciones
  let x=W-PW-M,y=oy+10;g.textAlign='left';g.fillStyle='#111';g.font='26px sans-serif';g.fillText('N° Entradas',x,y+24);y+=46;
  const ks=[1,2,3].filter(q=>q<3||R.c[3]>0).concat([0]);
  for(const q of ks){g.fillStyle=AV_CLASES[q].c;g.beginPath();g.arc(x+12,y+12,11,0,7);g.fill();g.fillStyle='#111';g.font='24px sans-serif';g.fillText(AV_CLASES[q].t,x+36,y+20);
    g.fillText(`${num(R.ha[q],0)} HA | ${num(R.haTot?R.ha[q]/R.haTot*100:0,1)}%`,x+36,y+50);y+=74;}
  y+=10;g.fillText('Total Intervenido',x,y+20);g.fillText(`${num(R.lotesI)} Lotes | ${num(R.lotes?R.lotesI/R.lotes*100:0,1)}%`,x,y+50);
  // Escala (1 km) y norte
  let u=1;while(1000*u/S.CEL*k*2>PW-70&&u>0.05)u/=2;const pu=1000*u/S.CEL*k,et=v=>v>=1?num(v,v%1?1:0)+' km':num(v*1000)+' m';   // escala que cabe en el panel
  y+=100;g.fillStyle='#555';g.fillRect(x,y,pu,10);g.strokeStyle='#111';g.lineWidth=1;g.strokeRect(x,y,pu*2,10);
  g.fillStyle='#111';g.font='18px sans-serif';g.textAlign='center';g.fillText('0',x,y-6);g.fillText(et(u).replace(/ k?m$/,''),x+pu,y-6);g.fillText(et(2*u),x+pu*2,y-6);
  g.font='700 22px sans-serif';g.textAlign='center';g.fillText('N',W-M-20,TH+M-10);g.beginPath();g.moveTo(W-M-20,TH+M);g.lineTo(W-M-32,TH+M+36);g.lineTo(W-M-20,TH+M+28);g.lineTo(W-M-8,TH+M+36);g.closePath();g.fill();
  g.font='13px sans-serif';g.fillStyle='#888';g.fillText('Palmas de Tumaco S.A.S. · Sanidad Vegetal · generado desde el visor',W/2,H-14);
  cv.toBlob(b=>bajar(b,`avance_censo_${($('#fDesde').value||'')}_${($('#fHasta').value||'')}.png`),'image/png');
}
