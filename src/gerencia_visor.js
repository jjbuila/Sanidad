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
const TABS_GER=[['tablero','TABLERO'],['cirugia','CIRUGÍA'],['sync','SINCRONIZACIÓN'],['calidad','CALIDAD'],['auditoria','AUDITORÍA'],['reportes','REPORTES']];
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
  #chCalor{cursor:pointer}`;
  document.head.appendChild(css);
  const bt=document.createElement('button');bt.className='btn mini';bt.id='btGer';bt.innerHTML='📊 GERENCIA';bt.title='Tablero gerencial, cirugía, sincronización, calidad, auditoría y reportes';
  $('#chDatos').before(bt);bt.onclick=()=>alternarGerencia();
  const p=document.createElement('div');p.id='gerPanel';p.hidden=true;document.body.appendChild(p);
})();
function alternarGerencia(on){
  GER.on=on==null?!GER.on:on;const p=$('#gerPanel');$('#btGer').classList.toggle('prim',GER.on);
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
  const cab=`<div class="ger-cab"><h2>📊 GERENCIA</h2><div class="ger-tabs">${TABS_GER.map(([k,t])=>`<button data-gt="${k}" class="${GER.tab===k?'on':''}">${t}</button>`).join('')}</div>
    <button class="btn mini" id="gerX" title="Cerrar y volver al mapa">✕ Cerrar</button></div>`;
  let cuerpo='';
  try{cuerpo={tablero:pintarTablero,cirugia:pintarCirGer,sync:pintarSync,calidad:pintarCalidad,auditoria:pintarAuditoria,reportes:pintarReportes}[GER.tab]();}
  catch(e){console.error(e);cuerpo=`<div class="ger-aviso ger-mal">⚠ ${esc(e.message)}</div>`;}
  P.innerHTML=cab+cuerpo;
  $$('#gerPanel [data-gt]').forEach(b=>b.onclick=()=>{GER.tab=b.dataset.gt;pintarGer();});
  $('#gerX').onclick=()=>alternarGerencia(false);
  (ENLACES_GER[GER.tab]||(()=>{}))();
}
const ENLACES_GER={};
const sinDatos=()=>`<div class="ger-aviso">No hay jornadas cargadas. Cargue un rango de fechas (a la izquierda) o use un atajo:
  <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn mini prim" data-rango="30">Últimos 30 días</button><button class="btn mini" data-rango="60">60 días</button><button class="btn mini" data-rango="90">90 días</button></div></div>`;
function enlazarRango(){$$('#gerPanel [data-rango]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Cargando…';try{await cargarRango(+b.dataset.rango);}catch(e){toast(e.message,6000);}});}

/* ---------------- TABLERO ---------------- */
function pintarTablero(){
  if(!JOR.length)return sinDatos();
  const L=resumenLotes(),O=resumenOperarios();
  const pc=L.reduce((a,x)=>a+(x.pc||0),0),tot=L.reduce((a,x)=>a+(x.total_lote||0),0);
  const ha=JORF.reduce((a,j)=>a+(Number(j.ha)||0),0),palmas=JORF.reduce((a,j)=>a+(Number(j.palmas)||0),0),diags=JORF.reduce((a,j)=>a+j.diags.length,0);
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
    const k=d.palma_id??(d.lote+'|'+d.linea+'|'+d.palma);const f=String(d.creado||j.fecha).slice(0,10);const u=primera.get(k);if(!u||f<u.f)primera.set(k,{f,lote:d.lote});}
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
  return `<p class="tenue">Datos: ${esc(rangoTxt())} · ${num(JORF.length)} jornadas con los filtros de la izquierda (programa, operario, lote).</p>${kp}
    <div class="ger-sec"><h3>Productividad por operario</h3><p class="tenue">Ha/hora y palmas/hora sobre el tiempo efectivo (sin paradas). Ordenado de mayor a menor rendimiento.</p>${tProd}</div>
    <div class="ger-sec"><h3>Casos nuevos de PC por lote y semana</h3><p class="tenue">Primera vez que cada palma aparece como caso de PC en el periodo. Más rojo = más casos. La incidencia actual es casos vigentes ÷ palmas del lote.</p>
      <div class="ger-par"><button class="btn mini ${GER.calor?'prim':''}" id="gerCalor">🔥 ${GER.calor?'Quitar':'Ver'} mapa de calor de PC en el mapa</button></div>${tCalor}</div>
    <div class="ger-sec"><h3>Avance del ciclo de censo</h3>${nMal||nSin?`<div class="ger-aviso ${nMal?'ger-mal':''}">⚠ ${nMal?`<b>${nMal}</b> lote(s) llevan más de ${X} días sin censo`:''}${nMal&&nSin?' · ':''}${nSin?`<b>${nSin}</b> lote(s) sin censo en el periodo cargado (cargue un rango más largo para verlos)`:''}.</div>`:''}
      <div class="ger-par">Alerta si pasan más de <input type="number" id="gerCiclo" min="1" max="365" value="${X}"> días sin censo</div>${tCiclo}</div>`;
}
ENLACES_GER.tablero=()=>{enlazarRango();
  const c=$('#gerCiclo');if(c)c.onchange=()=>{GER.umbralCiclo=Math.max(1,Number(c.value)||30);pintarGer();};
  const b=$('#gerCalor');if(b)b.onclick=()=>{alternarCalor();pintarGer();if(GER.calor)alternarGerencia(false);};};
/* Mapa de calor de los casos de PC vigentes (último diagnóstico de cada palma). */
function alternarCalor(){
  if(GER.calor){mapa.removeLayer(GER.calor);GER.calor=null;const c=$('#chCalor');if(c)c.remove();return;}
  const ult=new Map();for(const j of JORF)for(const d of j.diags){if(!loteSel(d.lote)||!enProg(d.lote))continue;const k=d.palma_id??(d.lote+'|'+d.linea+'|'+d.palma);const u=ult.get(k);if(!u||String(d.creado)>String(u.creado))ult.set(k,d);}
  const casos=[...ult.values()].filter(d=>esCasoPC(codN1(d),d.nivel2,d.estado)&&d.lat!=null);
  GER.calor=L.layerGroup();
  for(const d of casos){L.circle([d.lat,d.lng],{radius:45,stroke:false,fillColor:'#ff3d00',fillOpacity:.10,interactive:false}).addTo(GER.calor);
    L.circle([d.lat,d.lng],{radius:18,stroke:false,fillColor:'#ffd600',fillOpacity:.22,interactive:false}).addTo(GER.calor);}
  GER.calor.addTo(mapa);
  const ch=document.createElement('span');ch.className='chip';ch.id='chCalor';ch.title='Quitar el mapa de calor';ch.innerHTML=`🔥 Calor PC: ${num(casos.length)} casos ✕`;ch.onclick=()=>alternarCalor();$('#btGer').after(ch);
  if(casos.length){try{mapa.fitBounds(L.latLngBounds(casos.map(d=>[d.lat,d.lng])),{padding:[40,40],maxZoom:16});}catch(e){}}
  else toast('No hay casos de PC vigentes en el periodo y filtros cargados.');
}

/* ---------------- CIRUGÍA: ciclo censo → cirugía ---------------- */
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
    for(const x of us){if(x.inactivo)continue;const lab=x.labores&&x.labores.length?x.labores:(x.rol==='admin'||x.rol==='supervisor'?['censo','cirugia']:['censo']);
      if(x.rol!=='operario')continue; // solo operarios de campo
      const f=ult.get(x.u)||null;filas.push({u:x.u,nombre:x.nombre,cargo:x.cargo||'',lab,ult:f&&f.t||null,fecha:f&&f.fecha,n7:f?f.n7:0,n30:f?f.n30:0});}
    GER.sync={filas,cuando:Date.now(),envios:envios.length};
  }catch(e){toast(e.message,6000);GER.sync=GER.sync||null;}
  finally{GER.cargandoSync=false;pintarGer();}
}
function pintarSync(){
  if(!GER.sync)return `<div class="ger-aviso">${GER.cargandoSync?'Consultando los envíos de los últimos 30 días en GitHub…':'Revisa cuándo envió cada operario su última jornada (últimos 30 días).'}
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
  if(!GER.sync&&!GER.cargandoSync)cargarSync();};

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
      original:{diag_id:d.id,jornada_id:j.id,usuario:j.usuario,evaluador:j.evaluador,fecha:String(d.creado||j.fecha).slice(0,10),
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
  const um=await mapaUsuarios();const ids=new Map(m.palmas.map(x=>[x.palma_id,x]));const d1=m.creado.slice(0,10),hoy=hoyISO();const hall=[];
  for(const raiz of ['jornadas','pruebas/jornadas']){
    const dias=await listarDias(raiz,d1,hoy);const arch=[];
    await enParalelo(dias,6,async d=>{for(const f of await arbol(d.sha))if(f.type==='blob'&&f.path.endsWith('.geojson'))arch.push(f);});
    await enParalelo(arch,6,async f=>{try{const g=JSON.parse(await blobTexto(f.sha));const h=g.jornada||{};
      for(const ft of g.features||[]){const p=ft.properties||{};if(p.tipo!=='diagnostico')continue;const o=ids.get(String(p.palma_id));if(!o)continue;
        const t=Date.parse(p.creado);const aud=p.auditoria===m.id||(!esCensadorU(h.usuario,um)&&h.usuario!==o.original.usuario&&t>=Date.parse(m.creado));
        if(aud)hall.push({o,p,h,t});}}catch(e){}});}
  const porPalma=new Map();for(const x of hall){const u=porPalma.get(x.o.palma_id);if(!u||x.t>u.t)porPalma.set(x.o.palma_id,x);}
  const filas=m.palmas.map(o=>{const x=porPalma.get(o.palma_id);if(!x)return {o,hecha:false};
    const a={n1:x.p.n1_codigo||String(x.p.problemas||'').split('|')[0]||'',nivel1:x.p.nivel1||'',nivel2:x.p.nivel2||'',auditor:x.h.evaluador||x.h.usuario,fecha:String(x.p.creado).slice(0,10)};
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

/* ---------------- REPORTES SEMANALES ----------------
   Los genera cada lunes un flujo automático en el repositorio de datos (reportes/AAAA-Snn/): Excel con el detalle y PDF de resumen. */
async function listarReportes(){
  try{const r=await (await gh(`/contents/reportes?ref=${encodeURIComponent(SES.repo.rama)}`)).json();const sem=(Array.isArray(r)?r:[]).filter(x=>x.type==='dir').sort((a,b)=>b.name.localeCompare(a.name));
    const out=[];for(const s of sem.slice(0,26)){const fs=await arbol(s.sha);out.push({semana:s.name,archivos:fs.filter(f=>f.type==='blob')});}GER.reportes=out;}
  catch(e){if(e.status===404)GER.reportes=[];else{GER.reportes=[];toast(e.message,6000);}}
}
function pintarReportes(){
  if(GER.reportes==null&&!GER.cargandoRep){GER.cargandoRep=true;listarReportes().finally(()=>{GER.cargandoRep=false;pintarGer();});}
  const R=GER.reportes;
  const lista=R==null?'<p class="tenue">Consultando reportes…</p>':!R.length?'<div class="ger-aviso">Aún no hay reportes. El primero se genera el próximo lunes a las 6:00 a. m.; también puede generarlo ahora desde GitHub (botón de abajo).</div>':
    tablaGer([{t:'Semana',f:x=>`<b>${esc(x.semana)}</b>`},{t:'Archivos',f:x=>x.archivos.map(f=>`<button class="btn mini ${/\.pdf$/i.test(f.path)?'nar':''}" data-rep="${esc(f.sha)}|${esc(f.path)}">${/\.pdf$/i.test(f.path)?'📄 PDF':/\.xlsx$/i.test(f.path)?'📊 Excel':'⬇ '+esc(f.path)}</button>`).join(' ')}],R);
  return `<p class="tenue">Cada lunes a las 6:00 a. m. se genera el reporte de la semana anterior (lunes a domingo): <b>PDF</b> de resumen para la gerencia y <b>Excel</b> con el detalle por operario, lote, diagnósticos y cirugía. Quedan guardados en el repositorio de datos (carpeta <code>reportes/</code>).</p>
    <div class="ger-par"><a class="btn mini" href="https://github.com/${esc(SES.repo.owner)}/${esc(SES.repo.repo)}/actions/workflows/reporte-semanal.yml" target="_blank" rel="noopener">▶ Generar ahora en GitHub (Run workflow)</a>
      <button class="btn mini" id="repRecargar">↻ Actualizar lista</button></div>${lista}`;
}
ENLACES_GER.reportes=()=>{const r=$('#repRecargar');if(r)r.onclick=()=>{GER.reportes=null;pintarGer();};
  $$('#gerPanel [data-rep]').forEach(b=>b.onclick=async()=>{const [sha,path]=b.dataset.rep.split('|');b.disabled=true;
    try{const buf=await (await gh(`/git/blobs/${sha}`,'application/vnd.github.raw+json')).arrayBuffer();const u=URL.createObjectURL(new Blob([buf],{type:/\.pdf$/i.test(path)?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a=document.createElement('a');a.href=u;a.download=path.split('/').pop();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);}
    catch(e){toast(e.message,6000);}b.disabled=false;});};

