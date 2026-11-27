/* ---------- Hora real (GPS) ----------
   Todo se registra con la fecha y hora REALES, no con las del celular (que pueden estar mal configuradas):
   · APK 1.0.12+: el desfase sale de la hora del GPS (satélites) — al abrir la App, cada 5 min y con cada punto del recorrido.
   · Sin GPS (o en el navegador): con la hora del servidor cuando hay internet.
   La clase Date de la página queda corregida con ese desfase (new Date() y Date.now() dan la hora real).
   Si el celular está desfasado más de 10 minutos se muestra una alerta fija para que lo corrijan. */
const RELOJ=(function(){const D=Date;const R={off:0,fuente:'',tdev:0,cal:false,dev:()=>D.now()};
  class FechaReal extends D{constructor(...a){if(a.length)super(...a);else super(D.now()+R.off);}static now(){return D.now()+R.off;}}
  FechaReal.parse=D.parse;FechaReal.UTC=D.UTC;window.Date=FechaReal;return R;})();
const RELOJ_ALERTA_MS=10*60000;
function textoDesfase(ms){const t=Math.round(Math.abs(ms)/60000),d=Math.floor(t/1440),h=Math.floor(t/60)%24,m=t%60; // redondea primero a minutos
  return [d?d+(d>1?' días':' día'):'',h?h+' h':'',(m||(!d&&!h))?m+' min':''].filter(Boolean).join(' ');}
function relojAjustar(off,fuente){
  off=Number(off);if(!isFinite(off))return;
  if(fuente!=='gps'&&RELOJ.fuente==='gps'&&RELOJ.dev()-RELOJ.tdev<30*60000)return; // la hora del GPS manda
  const nuevo=Math.abs(off)<1500?0:Math.round(off),d=nuevo-RELOJ.off;
  RELOJ.off=nuevo;RELOJ.fuente=fuente;RELOJ.tdev=RELOJ.dev();
  try{const j=typeof S!=='undefined'&&S.jornada;
    if(j){if(!j.relojCal&&Math.abs(d)>60000&&j.inicio)j.inicio=new Date(Date.parse(j.inicio)+d).toISOString(); // jornada iniciada antes de conocer la hora real
      j.relojCal=true;const r=j.reloj||(j.reloj={max_min:0,fuente});const m=Math.round(off/60000);if(Math.abs(m)>Math.abs(r.max_min||0))r.max_min=m;r.fuente=fuente;
      if(Math.abs(d)>1000||Math.abs(m)>=10)dbPut('jornadas',j).catch(()=>{});}}catch(e){}
  RELOJ.cal=true;avisoReloj();
}
/* Alerta: no bloquea nada (la labor sigue normal y todo se guarda con la hora del GPS). Sale completa unos 10 s y luego
   queda como un indicador pequeño que no tapa la barra de la jornada ni los botones; tocándolo se ve completa otra vez.
   Voz y vibración una sola vez (o si el desfase cambia más de 5 min), para no interrumpir el diagnóstico por voz. */
function avisoReloj(){
  let b=document.getElementById('relojAviso');const mal=Math.abs(RELOJ.off)>RELOJ_ALERTA_MS;
  if(!mal){if(b)b.hidden=true;return;}
  const nuevoB=!b;
  if(!b){b=document.createElement('div');b.id='relojAviso';b.setAttribute('role','alert');document.body.appendChild(b);
    b.onclick=()=>{b.dataset.min=b.dataset.min==='1'?'':'1';pintarAvisoReloj();if(b.dataset.min!=='1')relojMinimizar(10000);};}
  if(nuevoB||b.hidden){b.dataset.min='';relojMinimizar(10000);}
  pintarAvisoReloj();b.hidden=false;
  const ya=avisoReloj.off;if(ya==null||Math.abs(ya-RELOJ.off)>5*60000){avisoReloj.off=RELOJ.off;
    try{navigator.vibrate&&navigator.vibrate([300,150,300]);}catch(e){}
    try{if(typeof hablar==='function')hablar(`Atención: la fecha u hora del celular está ${RELOJ.off>0?'atrasada':'adelantada'} ${textoDesfase(RELOJ.off)}. Puede seguir trabajando: se usa la hora del G P S. Corríjala cuando pueda.`,false);}catch(e){}}
}
function relojMinimizar(ms){clearTimeout(relojMinimizar.t);relojMinimizar.t=setTimeout(()=>{const b=document.getElementById('relojAviso');if(b&&!b.hidden){b.dataset.min='1';pintarAvisoReloj();}},ms);}
function pintarAvisoReloj(){
  const b=document.getElementById('relojAviso');if(!b)return;const min=b.dataset.min==='1';
  const sg=(RELOJ.off>0?'+':'−')+textoDesfase(RELOJ.off);
  b.style.cssText=min
    ?'position:fixed;left:10px;top:calc(var(--sup,0px) + var(--hud,56px) + 122px);z-index:961;background:#b3261e;color:#fff;border-radius:999px;padding:6px 11px;font:700 12.5px/1.2 Inter,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.4);max-width:56vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer'
    :'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 6px);z-index:22000;background:#b3261e;color:#fff;border-radius:14px;padding:10px 12px;font:600 13.5px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45);cursor:pointer';
  const r=new Date(),hm=`${String(r.getHours()).padStart(2,'0')}:${String(r.getMinutes()).padStart(2,'0')}`,txt=`${r.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})} ${hm}`;
  const fte=RELOJ.fuente==='gps'?'GPS':'Servidor',corta=`${r.toLocaleDateString('es-CO',{day:'numeric',month:'short'})} ${hm}`;
  b.title='Fecha u hora del celular incorrecta: '+sg;
  b.innerHTML=min?`⚠ ${fte} ${corta} · ${sg}`
    :`⚠ <b>Fecha u hora del celular incorrecta</b>: está ${RELOJ.off>0?'atrasada':'adelantada'} <b>${textoDesfase(RELOJ.off)}</b>.<br>Puede seguir trabajando normal: todo se guarda con la fecha y hora ${RELOJ.fuente==='gps'?'del GPS':'del servidor'}: <b>${txt}</b>. Corríjala cuando pueda: Ajustes del celular › Fecha y hora › «Fecha y hora automáticas».`;
}
setInterval(()=>{const b=document.getElementById('relojAviso');if(b&&!b.hidden)pintarAvisoReloj();},15000); // la fecha y hora del GPS se mantiene al día
/* Hora del GPS desde la APK (método «reloj» del complemento Recorrido, APK 1.0.12+). */
let RELOJ_NAT_T=0;
async function relojNativo(forzar){
  try{if(!(typeof NAT!=='undefined'&&NAT&&NAT.rec&&typeof NAT.rec.reloj==='function'))return false;
    const ahora=RELOJ.dev();if(!forzar&&ahora-RELOJ_NAT_T<60000)return false;RELOJ_NAT_T=ahora;
    const r=await NAT.rec.reloj();if(r&&r.ok&&r.off!=null){relojAjustar(r.off,'gps');return true;}}catch(e){}
  return false;}
/* Hora del servidor (cuando hay internet y no hay hora reciente del GPS). */
async function relojRed(){
  try{if(navigator.onLine===false)return false;if(RELOJ.fuente==='gps'&&RELOJ.dev()-RELOJ.tdev<30*60000)return false;
    const t0=RELOJ.dev();const r=await fetch('version.json?reloj='+t0,{cache:'no-store'});const t1=RELOJ.dev();
    const h=r.headers.get('date');if(!h||t1-t0>8000)return false;
    const srv=Date.parse(h)+(Number(r.headers.get('age'))||0)*1000+500; // la cabecera Date tiene precisión de 1 s
    const off=srv-(t0+t1)/2;relojAjustar(Math.abs(off)<60000?0:off,'red');return true;}catch(e){return false;}}
setTimeout(async()=>{if(!(await relojNativo(true)))await relojRed();},4000);
setInterval(async()=>{if(!(await relojNativo(false)))await relojRed();},5*60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')relojNativo(false);});
