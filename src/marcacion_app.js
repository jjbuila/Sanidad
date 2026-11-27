/* =====================================================================
   Marcación por lote, transitabilidad por lote y cierre de la jornada por pasos (jornada de censo de sanidad)
   (build.py lo inserta en index.html)
   · Entrada al lote programado = 3 puntos GPS seguidos dentro de su polígono.
   · Primera entrada al lote: se pregunta la transitabilidad (Transitable / Poco transitable / No transitable), una sola vez.
   · Lotes con líneas: la marcación es obligatoria: ▶ MARCAR (o decir «marcar»). No hay «Todavía no»; si cierran la ventana, vuelve a salir.
     Cuenta desde la entrada al lote. Termina sola a los 90 s fuera del lote, con ■ MARCANDO (mantener 2 s) o diciendo
     «finalizar marcación», o sola al finalizar la jornada. Al volver a entrar al lote, pide marcar otra vez.
   · Cada tramo se guarda con lote, hora de entrada, hora de marcación, hora de fin, minutos y cómo inició y terminó.
   ===================================================================== */
const MK={cand:null,dentro:null,fuera:null,cerrado:0,aviso:new Set(),dlg:null};
const MK_N=3,MK_SALIDA=90000,MK_REABRIR=6000;
const TRANSITS=['Transitable','Poco transitable','No transitable'];
const esMarcacionJ=j=>!!j&&j.metodoVisita==='marcacion'&&!(typeof esLaborRuta==='function'&&esLaborRuta(j));
/* Marcación de la jornada para el cálculo de palmas visitadas. vivo: mismo arreglo (la jornada en curso lo va completando). */
function marcaDe(j,vivo){
  if(!j||j.metodoVisita!=='marcacion')return null;const m=j.marcacion||(j.marcacion={tramos:[]});
  const fin=j.fin?Date.parse(j.fin):null;
  return {tramos:vivo?m.tramos:m.tramos.map(t=>({...t,fin:t.fin??fin})),buf:Number(j.bufferMarcacion)||4.5};}
function loteProg(lat,lng){const l=loteDe(lat,lng);if(!l||!S.jornada)return '';return S.jornada.seleccion.some(x=>String(x.lote)===l)?l:'';}
async function necesitaMarca(l){try{if(!CARTO.lotes[l])return false;const g=await indiceVisita(l);return g.tipo!=='terraza';}catch(e){return false;}}
const tramoAbierto=j=>{const t=j&&j.marcacion&&j.marcacion.tramos;if(!t)return null;for(let i=t.length-1;i>=0;i--)if(t[i].fin==null)return t[i];return null;};
const guardarJ=()=>{try{if(S.jornada)dbPut('jornadas',S.jornada);}catch(e){}};

/* Se llama con cada punto del recorrido, antes de calcular las palmas visitadas. */
async function marcaPunto(p){
  const j=S.jornada;if(!esMarcacionJ(j))return;
  const ab=tramoAbierto(j);if(!MK.dentro&&ab)MK.dentro=ab.lote; // la App se reabrió con un tramo abierto
  const l=loteProg(p.lat,p.lng);
  if(l){if(MK.cand&&MK.cand.l===l)MK.cand.n++;else MK.cand={l,n:1,t0:p.t};}else MK.cand=null;
  if(MK.dentro){if(l===MK.dentro)MK.fuera=null;else if(!MK.fuera)MK.fuera={t:p.t};}
  if(l&&MK.cand&&MK.cand.n>=MK_N&&MK.dentro!==l){
    if(MK.dentro)salirLote(MK.fuera?MK.fuera.t:p.t,'salida'); // pasó directo a otro lote programado
    await entrarLote(l,MK.cand.t0);}
  revisarSalida(p.t);
  mkPintar();
}
function revisarSalida(t){if(MK.dentro&&MK.fuera&&t-MK.fuera.t>=MK_SALIDA)salirLote(MK.fuera.t,'salida');}
setInterval(()=>{if(S.jornada&&MK.fuera)revisarSalida(Date.now());},5000);
function salirLote(tfin,modo){
  const j=S.jornada,tr=tramoAbierto(j);
  if(tr&&String(tr.lote)===String(MK.dentro))cerrarTramo(tr,modo,tfin);
  MK.dentro=null;MK.fuera=null;mkPintar();}
async function entrarLote(l,t0){
  const j=S.jornada;MK.dentro=l;MK.fuera=null;
  j.transit=j.transit||{};const primera=!j.transit[l];
  if(primera)j.transit[l]={valor:null,entrada:t0};
  const marca=await necesitaMarca(l);
  if(marca){const prev=tramoAbierto(j);if(!(prev&&String(prev.lote)===l))j.marcacion.tramos.push({lote:l,ini:t0,marca:null,fin:null,inicio_modo:null,fin_modo:null});}
  guardarJ();
  if(primera||marca){try{salirAhorro('marcacion');}catch(e){}
    pitido(660,160);setTimeout(()=>pitido(880,160),220);try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){}
    hablar(`Entró al lote ${paraVoz(l)}.${primera?' Indique la transitabilidad.':''}${marca?' Toque marcar, o diga marcar.':''}`,true);}
  MK.cerrado=0;mkPintar();
}
function cerrarTramo(tr,modo,fin){
  tr.fin=fin;tr.fin_modo=modo;
  if(tr.marca==null&&VIS&&VIS.pend)for(const [id,x] of VIS.pend)if(String(x.l)===String(tr.lote)&&x.t>=tr.ini)VIS.pend.delete(id); // no marcó: lo recorrido no cuenta
  guardarJ();
}
async function mkIniciar(modo){
  const j=S.jornada,tr=tramoAbierto(j);if(!tr||tr.marca!=null)return false;
  tr.marca=Date.now();tr.inicio_modo=modo||'boton';
  if(VIS){const nv=[];resolverPendientes(VIS,tr,nv);if(nv.length){nv.forEach(repintarPalma);actualizarVisitaUI();}}
  guardarJ();MK.cerrado=0;mkPintar();
  toast(`▶ Marcando el lote ${tr.lote}. Cuenta desde la entrada (${hhmm(tr.ini)}).`,3500);hablar(`Marcación iniciada en el lote ${paraVoz(tr.lote)}.`,true);
  try{navigator.vibrate&&navigator.vibrate(120);}catch(e){}
  return true;}
function mkFinalizar(modo){
  const j=S.jornada,tr=tramoAbierto(j);if(!tr||tr.marca==null)return false;
  cerrarTramo(tr,modo||'boton',Date.now());mkPintar();
  toast(`■ Marcación finalizada en el lote ${tr.lote}.`,3000);hablar(`Marcación finalizada en el lote ${paraVoz(tr.lote)}.`,true);return true;}
function mkTransit(v){
  const j=S.jornada,l=MK.dentro;if(!j||!l||!j.transit||!j.transit[l])return;
  j.transit[l].valor=v;j.transit[l].hora=Date.now();guardarJ();MK.cerrado=0;mkPintar();}
/* Transitabilidad del lote (la heredan los diagnósticos del lote). */
function transitDe(l){const j=S.jornada;const t=j&&j.transit&&j.transit[String(l)];return t&&t.valor||'';}

/* ---------- Interfaz: ventana obligatoria y botón ▶ MARCAR / ■ MARCANDO ---------- */
(function(){
  const st=document.createElement('style');
  st.textContent=`#mkDlg{position:fixed;inset:0;z-index:21000;background:rgba(2,10,7,.72);display:flex;align-items:flex-end;justify-content:center;padding:14px;backdrop-filter:blur(3px)}
#mkDlg[hidden]{display:none}
#mkDlg .mk-card{width:min(460px,100%);background:#0b2219;border:1px solid rgba(34,211,154,.35);border-radius:22px;padding:18px 16px 16px;box-shadow:0 20px 60px rgba(0,0,0,.5);position:relative}
#mkDlg .mk-x{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:var(--texto);font-size:18px}
#mkDlg h2{font-family:var(--t);letter-spacing:1px;font-size:21px;margin:0 30px 4px 0;color:var(--texto)}
#mkDlg p{margin:4px 0 12px;color:var(--tenue,#9fb8ad);font-size:14px}
#mkDlg .mk-lote{display:inline-block;background:rgba(34,211,154,.14);color:var(--acento);border-radius:9px;padding:2px 9px;font-weight:800}
#mkDlg .mk-op{display:flex;flex-direction:column;gap:9px}
#mkDlg .mk-op button{min-height:58px;border-radius:16px;font-size:18px;font-weight:800;font-family:var(--t);letter-spacing:.6px;border:1px solid rgba(255,255,255,.12);color:var(--texto);background:rgba(255,255,255,.05)}
#mkDlg .mk-op button.t0{border-color:#22d39a;color:#22d39a}#mkDlg .mk-op button.t1{border-color:#e8a33d;color:#e8a33d}#mkDlg .mk-op button.t2{border-color:#ef5350;color:#ef5350}
#mkDlg .mk-marcar{min-height:84px!important;font-size:26px!important;background:linear-gradient(135deg,#22d39a,#0fa877)!important;color:#03140d!important;border:0!important}
#mkPill{position:fixed;left:50%;transform:translateX(-50%);top:calc(var(--sup,0px) + var(--hud,56px) + 62px);z-index:960;border:0;border-radius:999px;padding:9px 18px;font-family:var(--t);font-weight:800;letter-spacing:.8px;font-size:15px;box-shadow:0 6px 20px rgba(0,0,0,.4);white-space:nowrap}
#mkPill[hidden]{display:none}
#mkPill.on{background:#ef5350;color:#fff}#mkPill.pend{background:#e8a33d;color:#1a1100;animation:mkLat 1.2s infinite}
#mkPill small{display:block;font-size:10.5px;font-weight:600;letter-spacing:.3px;opacity:.85}
@keyframes mkLat{50%{transform:translateX(-50%) scale(1.06)}}
#finPasos{list-style:none;padding:0;margin:8px 0}#finPasos li{display:flex;gap:10px;align-items:center;padding:7px 2px;border-bottom:1px solid rgba(255,255,255,.06);font-size:14.5px}
#finPasos li i{width:22px;text-align:center;font-style:normal}#finPasos li.ok i{color:#22d39a}#finPasos li.err i{color:#ef5350}#finPasos li.run{color:var(--texto);font-weight:700}#finPasos li.pend{opacity:.55}
#finPasos li small{margin-left:auto;color:#ef5350;font-size:12px;max-width:55%;text-align:right}
.acu-t{width:100%;border-collapse:collapse;font-size:12.5px;margin:4px 0 10px}.acu-t th,.acu-t td{padding:4px 5px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;vertical-align:top}.acu-t th{color:var(--acento);font-weight:700}.acu-t td.n{text-align:right}
.acu-chips{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 10px}.acu-chips span{background:rgba(255,255,255,.06);border-radius:9px;padding:3px 8px;font-size:12.5px}`;
  document.head.appendChild(st);
  const d=document.createElement('div');d.id='mkDlg';d.hidden=true;d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
  d.innerHTML='<div class="mk-card"><button class="mk-x" type="button" aria-label="Cerrar">✕</button><div id="mkCuerpo"></div></div>';
  document.body.appendChild(d);
  d.querySelector('.mk-x').onclick=()=>{MK.cerrado=Date.now();d.hidden=true;MK.dlg=null;};
  const b=document.createElement('button');b.id='mkPill';b.type='button';b.hidden=true;document.body.appendChild(b);
  b.onclick=()=>{const tr=tramoAbierto(S.jornada);if(tr&&tr.marca==null)mkIniciar('boton');};
  // ■ MARCANDO: mantener 2 s para finalizar la marcación (evita toques accidentales)
  let t=null;const soltar=()=>{if(t){clearTimeout(t);t=null;b.style.opacity='';}};
  b.addEventListener('pointerdown',()=>{const tr=tramoAbierto(S.jornada);if(!tr||tr.marca==null)return;b.style.opacity='.6';try{navigator.vibrate&&navigator.vibrate(30);}catch(e){}
    t=setTimeout(()=>{t=null;b.style.opacity='';mkFinalizar('boton');},2000);});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,soltar));
  setInterval(()=>{if(S.jornada&&!b.hidden)mkPintar();},15000);
})();
function mkPintar(){
  const j=S.jornada,dlg=$('#mkDlg'),pill=$('#mkPill');if(!dlg||!pill)return;
  if(MK.dlg==='confirmar')return; // hay una confirmación abierta
  if(!esMarcacionJ(j)){dlg.hidden=true;pill.hidden=true;MK.dlg=null;return;}
  const tr=tramoAbierto(j),l=MK.dentro;
  // botón flotante
  if(tr&&tr.marca!=null){pill.hidden=false;pill.className='on';pill.innerHTML=`■ MARCANDO ${esc(tr.lote)} · ${fmtDur(Date.now()-tr.ini).slice(0,5)}<small>Mantenga 2 s para finalizar</small>`;}
  else if(tr&&tr.marca==null&&String(tr.lote)===String(l)){pill.hidden=false;pill.className='pend';pill.innerHTML=`▶ MARCAR ${esc(tr.lote)}<small>Marcación obligatoria</small>`;}
  else pill.hidden=true;
  // ventana obligatoria: primero la transitabilidad, luego la marcación
  let que=null;
  if(l&&j.transit&&j.transit[l]&&!j.transit[l].valor)que='transit';
  else if(tr&&tr.marca==null&&String(tr.lote)===String(l))que='marcar';
  if(!que){dlg.hidden=true;MK.dlg=null;return;}
  if(!dlg.hidden&&MK.dlg===que+'|'+l)return;
  if(MK.cerrado&&Date.now()-MK.cerrado<MK_REABRIR)return; // la cerraron: vuelve a salir en unos segundos
  MK.dlg=que+'|'+l;MK.cerrado=0;
  const c=$('#mkCuerpo');
  if(que==='transit'){
    c.innerHTML=`<h2>Transitabilidad del lote</h2><p>Lote <span class="mk-lote">${esc(l)}</span> · entrada ${hhmm(j.transit[l].entrada)}. Se pregunta una sola vez por lote; la heredan los diagnósticos del lote.</p>
      <div class="mk-op">${TRANSITS.map((x,i)=>`<button type="button" class="t${i}" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
    c.querySelectorAll('button[data-v]').forEach(x=>x.onclick=()=>mkTransit(x.dataset.v));
  }else{
    c.innerHTML=`<h2>Marcación obligatoria</h2><p>Entró al lote <span class="mk-lote">${esc(l)}</span> a las ${hhmm(tr.ini)}. Inicie la marcación: cuenta desde la entrada, todas las palmas a ${String(Number(j.bufferMarcacion)||4.5).replace('.',',')} m o menos de su recorrido.</p>
      <div class="mk-op"><button type="button" class="mk-marcar" id="mkMarcar">▶ MARCAR</button></div><p style="margin:10px 0 0;font-size:12.5px">También puede decir <b>«marcar»</b> (con la voz activada).</p>`;
    $('#mkMarcar').onclick=()=>mkIniciar('boton');
  }
  try{salirAhorro('marcacion');}catch(e){}
  dlg.hidden=false;
}
/* Con la ventana de marcación abierta no entra solo el modo ahorro. */
{const _e=entrarAhorro;entrarAhorro=function(m){const d=$('#mkDlg');if(m==='auto'&&d&&!d.hidden)return;return _e.apply(this,arguments);};}

/* ---------- Tablas para la App: marcación, transitabilidad y acumulado por línea ---------- */
const MODO_TXT={boton:'Botón',voz:'Voz',salida:'Salió del lote (90 s)',jornada:'Fin de la jornada',volumen:'Volumen'};
function tramosCab(j){return ((j.marcacion&&j.marcacion.tramos)||[]).map(t=>{const fin=t.fin??(j.fin?Date.parse(j.fin):null);
  return {lote:t.lote,hora_entrada:hhmm(t.ini),hora_inicio:t.marca!=null?hhmm(t.marca):'',hora_fin:fin?hhmm(fin):'',minutos:fin&&t.marca!=null?+((fin-t.ini)/60000).toFixed(1):0,
    marcado:t.marca!=null,inicio:t.marca!=null?(t.inicio_modo||'boton'):'sin_marcar',fin_modo:t.fin_modo||(j.fin?'jornada':''),entrada:new Date(t.ini).toISOString(),fin_iso:fin?new Date(fin).toISOString():null};});}
function transitCab(j){return Object.entries(j.transit||{}).map(([l,t])=>({lote:l,transitabilidad:t.valor||'',hora_entrada:hhmm(t.entrada),entrada:new Date(t.entrada).toISOString()})).sort((a,b)=>a.entrada.localeCompare(b.entrada));}
function tablaMarcacion(j){const ts=tramosCab(j);if(!ts.length)return '<p class="tenue">Sin tramos de marcación.</p>';
  return `<table class="acu-t"><tr><th>Lote</th><th>Entrada</th><th>Inicio</th><th>Fin</th><th>Min</th><th>Cómo inició</th><th>Cómo terminó</th></tr>${ts.map(t=>`<tr><td><b>${esc(t.lote)}</b></td><td>${t.hora_entrada}</td><td>${t.hora_inicio||'—'}</td><td>${t.hora_fin||'—'}</td><td class="n">${t.marcado?num(t.minutos,1):'—'}</td><td>${t.marcado?esc(MODO_TXT[t.inicio]||t.inicio):'<b style="color:#ef5350">No marcó</b>'}</td><td>${esc(MODO_TXT[t.fin_modo]||t.fin_modo||'—')}</td></tr>`).join('')}</table>`;}
function tablaTransit(j){const ts=transitCab(j);if(!ts.length)return '<p class="tenue">Sin lotes con transitabilidad.</p>';
  return `<table class="acu-t"><tr><th>Lote</th><th>Transitabilidad</th><th>Entrada</th></tr>${ts.map(t=>`<tr><td><b>${esc(t.lote)}</b></td><td>${esc(t.transitabilidad||'Sin responder')}</td><td>${t.hora_entrada}</td></tr>`).join('')}</table>`;}
/* Acumulado por línea de cada lote: palmas visitadas, existentes, diagnósticos por enfermedad principal y por estado. */
function acumuladoLineas(E,regs){
  const m=new Map();const lin=v=>v==null||v===''?'T':(isNaN(v)?String(v):Number(v));
  const fila=(l,ln)=>{const k=l+'|'+ln;let r=m.get(k);if(!r)m.set(k,r={lote:String(l),linea:ln,palmas:0,existentes:0,diagnosticos:0,enf:{},est:{}});return r;};
  if(E&&E.qv)for(const [id,[q,l]] of E.qv){if(!E.set.has(id))continue;const r=fila(l,q.ln==null?'T':q.ln);r.palmas++;if(q.e)r.existentes++;}
  for(const x of regs||[]){const r=fila(x.lote||'—',lin(x.linea));r.diagnosticos++;const c=x.n1_codigo||'—';r.enf[c]=(r.enf[c]||0)+1;const e=x.estado||'—';r.est[e]=(r.est[e]||0)+1;}
  const k=v=>v==='T'?1e9:typeof v==='number'?v:1e8;
  return [...m.values()].sort((a,b)=>ordenNat(a.lote,b.lote)||k(a.linea)-k(b.linea));}
const nomEstado=e=>{try{const x=estadoDe(e);return x&&x.n||e;}catch(_){return e;}};
const txtConteo=(o,f)=>Object.entries(o||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${f?f(k):k} ${v}`).join(' · ');
function tablaAcumulado(acu){
  if(!acu||!acu.length)return '<p class="tenue">Sin palmas ni diagnósticos.</p>';
  const tot={enf:{},est:{}};for(const r of acu){for(const [k,v] of Object.entries(r.enf))tot.enf[k]=(tot.enf[k]||0)+v;for(const [k,v] of Object.entries(r.est))tot.est[k]=(tot.est[k]||0)+v;}
  const lotes=[...new Set(acu.map(r=>r.lote))];
  return `<div class="tenue" style="font-size:12.5px;margin-top:4px">Por enfermedad principal</div><div class="acu-chips">${Object.keys(tot.enf).length?Object.entries(tot.enf).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span><b>${esc(k)}</b> ${v}</span>`).join(''):'<span>Sin diagnósticos</span>'}</div>
    <div class="tenue" style="font-size:12.5px">Por estado</div><div class="acu-chips">${Object.keys(tot.est).length?Object.entries(tot.est).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span>${esc(nomEstado(k))} <b>${v}</b></span>`).join(''):'<span>Sin diagnósticos</span>'}</div>`+
    lotes.map(l=>{const rs=acu.filter(r=>r.lote===l);const sp=rs.reduce((a,r)=>a+r.palmas,0),sd=rs.reduce((a,r)=>a+r.diagnosticos,0);
      return `<div style="margin-top:6px"><b>Lote ${esc(l)}</b> <span class="tenue">· ${num(sp)} palmas · ${num(sd)} diagnósticos</span></div>
      <table class="acu-t"><tr><th>Línea</th><th>Palmas</th><th>Diag.</th><th>Enfermedad</th><th>Estado</th></tr>${rs.map(r=>`<tr><td>${r.linea==='T'?'Terraza':esc(r.linea)}</td><td class="n">${num(r.palmas)}</td><td class="n">${num(r.diagnosticos)}</td><td>${esc(txtConteo(r.enf))}</td><td>${esc(txtConteo(r.est,nomEstado))}</td></tr>`).join('')}</table>`;}).join('');}

/* ---------- Confirmación dentro de la App ---------- */
function confirmarApp(titulo,texto,si,no){return new Promise(res=>{
  const d=$('#mkDlg'),c=$('#mkCuerpo');MK.dlg='confirmar';
  c.innerHTML=`<h2>${esc(titulo)}</h2><p>${texto}</p><div class="mk-op"><button type="button" class="t2" id="cfSi">${esc(si||'Aceptar')}</button><button type="button" id="cfNo">${esc(no||'Cancelar')}</button></div>`;
  const fin=v=>{d.hidden=true;MK.dlg=null;d.querySelector('.mk-x').onclick=x0;res(v);setTimeout(mkPintar,50);};
  const x0=d.querySelector('.mk-x').onclick;d.querySelector('.mk-x').onclick=()=>fin(false);
  $('#cfSi').onclick=()=>fin(true);$('#cfNo').onclick=()=>fin(false);try{salirAhorro('confirmar');}catch(e){}d.hidden=false;});}
/* Ejecuta una promesa con tiempo límite. */
function conLimite(pr,ms,nombre){let t;return Promise.race([Promise.resolve(pr).finally(()=>clearTimeout(t)),new Promise((_,rej)=>{t=setTimeout(()=>rej(new Error(`tiempo límite (${Math.round(ms/1000)} s)`)),ms);})]);}
