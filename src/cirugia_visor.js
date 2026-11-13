/* =====================================================================
   PROGRAMADOR Y SEGUIMIENTO DE CIRUGÍAS (visor web)
   · Casos pendientes: palmas cuyo último diagnóstico (censo o corrección del cirujano) es PC inicial, avanzada o
     reincidente y que no tienen cirugía posterior. Plazo: D+1 hábil (lunes a sábado, sin festivos).
   · Programación inteligente: reparte los casos entre las parejas según su eficiencia (palmas/día), prioriza
     vencidos y los que vencen en la fecha, y ordena cada ruta sobre vías y senderos desde la oficina central.
   · La programación se guarda en el repositorio (cirugia/programacion/AAAA-MM-DD.json) y la App la descarga.
   ===================================================================== */
const CIR={on:false,cargado:false,cargando:false,diags:[],cirugias:[],correcciones:[],marcas:[],jornadas:[],pend:[],usuarios:[],
  parejas:[],prog:null,progSha:null,capa:L.layerGroup(),fecha:null,tab:'prog'};
const COLORES_PAREJA=['#22d39a','#f2a33a','#4fb3ff','#c77dff'];
const OFICINA_DEF={lat:1.526032,lng:-78.734753};
function oficinaCentral(){const f=VIAS.gj&&VIAS.gj.features.find(x=>x.properties.tipo==='oficina');return f?{lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]}:OFICINA_DEF;}
const nombreCorto=n=>{const p=String(n||'').trim().split(/\s+/);if(p.length>=3)return (p[2]+' '+p[0]).toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());return String(n||'').toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());};
const etqPalma=o=>`${o.lote} · L${o.linea??'?'} · P${o.palma??'?'}`;

/* ---------- Interfaz ---------- */
(function montarCirugia(){
  const css=document.createElement('style');css.textContent=`
  body.modo-cir #filtros,body.modo-cir nav.tabs,body.modo-cir #panel{display:none!important}
  #cirPanel{flex:1;overflow:auto;padding:12px 14px 30px;display:none}
  body.modo-cir #cirPanel{display:block}
  .cir-num{background:none;border:0}
  .cir-num b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;color:#06140f;font:700 11.5px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)}
  .cir-par{border:1px solid var(--borde);border-radius:12px;padding:10px;margin:0 0 8px;display:grid;gap:6px}
  .cir-par .cab{display:flex;align-items:center;gap:8px}
  .cir-par .cab i{width:12px;height:12px;border-radius:3px;display:inline-block}
  .cir-par select{width:100%}
  .cir-ef{display:flex;align-items:center;gap:8px;font-size:12.5px}
  .cir-ef input{flex:1;accent-color:var(--acento)}
  .cir-aviso{border:1px solid var(--ambar);background:rgba(255,197,61,.08);border-radius:10px;padding:8px 10px;font-size:12.8px;margin:8px 0}
  .cir-tabs{display:flex;gap:6px;margin:0 0 10px}
  .cir-tabs button.on{border-color:var(--acento);background:rgba(34,211,154,.15)}
  .venc{color:#ff8a80;font-weight:700}.hoyv{color:var(--ambar);font-weight:600}
  .hist{border-left:2px solid var(--borde);margin:6px 0 0 4px;padding-left:10px;display:grid;gap:6px;font-size:12.5px}
  .hist .v{position:relative}.hist .v::before{content:'';position:absolute;left:-15px;top:4px;width:8px;height:8px;border-radius:50%;background:#5c6b64}
  .hist .v.vig::before{background:var(--acento)}.hist .v.vieja b{text-decoration:line-through;color:var(--tenue)}`;
  document.head.appendChild(css);
  const bt=document.createElement('button');bt.className='btn mini';bt.id='btCir';bt.innerHTML='✚ CIRUGÍAS';bt.title='Programador y seguimiento de cirugías';
  $('#chDatos').before(bt);
  const p=document.createElement('div');p.id='cirPanel';$('aside').appendChild(p);
  bt.onclick=()=>alternarCirugia();
})();
function alternarCirugia(on){
  CIR.on=on==null?!CIR.on:on;document.body.classList.toggle('modo-cir',CIR.on);$('#btCir').classList.toggle('prim',CIR.on);
  for(const c of [capaRec,capaDiag,capaPar])CIR.on?mapa.removeLayer(c):(c.addTo(mapa));
  if(CIR.on){CIR.capa.addTo(mapa);if(!CIR.cargado&&!CIR.cargando)cirCargar();else pintarCir();}
  else{mapa.removeLayer(CIR.capa);}
}

/* ---------- Usuarios del paquete (nombres, cargos y labores) ---------- */
async function cirUsuarios(){
  if(CIR.usuarios.length)return CIR.usuarios;
  const out=[];for(const x of ACCESO.usuarios){try{const m=JSON.parse(DEC.decode(await desObj(SES.dk,x.meta)));out.push({u:x.u,...m});}catch(e){}}
  CIR.usuarios=out.sort((a,b)=>ordenNat(a.nombre,b.nombre));return CIR.usuarios;
}
const cirujanos=()=>CIR.usuarios.filter(x=>x.rol_cirugia==='cirujano');
const auxiliaresCir=()=>CIR.usuarios.filter(x=>(x.labores||[]).includes('cirugia'));

/* ---------- Carga de datos: censo (45 días) y jornadas de cirugía ---------- */
async function listarDias(raiz,d1,d2){
  let r;try{r=await (await gh(`/contents/${raiz}?ref=${encodeURIComponent(SES.repo.rama)}`)).json();}catch(e){if(e.status===404)return [];throw e;}
  return (Array.isArray(r)?r:[]).filter(x=>x.type==='dir'&&x.name>=d1&&x.name<=d2).map(x=>({path:x.name,sha:x.sha}));
}
async function cirCargar(){
  CIR.cargando=true;pintarCir('Cargando el censo de los últimos 45 días y las cirugías…');
  try{
    await cirUsuarios();
    const hoy=hoyISO(),d1=hoyISO(new Date(Date.now()-45*86400000));
    const [diasC,diasX]=await Promise.all([listarDias('jornadas',d1,hoy),listarDias('cirugia/jornadas',d1,hoy)]);
    const arch=[];
    await enParalelo(diasC,6,async d=>{for(const f of await arbol(d.sha))if(f.type==='blob')arch.push({...f,dia:d.path,cir:false});});
    await enParalelo(diasX,6,async d=>{for(const f of await arbol(d.sha))if(f.type==='blob')arch.push({...f,dia:d.path,cir:true});});
    const zips=new Map(arch.filter(f=>f.path.endsWith('_fotos.zip')).map(f=>[(f.cir?'c/':'')+f.dia+'/'+f.path,f.sha]));
    const diags=[],cirs=[],corr=[],marcas=[],jors=[];let n=0;const geos=arch.filter(f=>f.path.endsWith('.geojson'));
    await enParalelo(geos,6,async f=>{try{const g=JSON.parse(await blobTexto(f.sha));
      const zip=zips.get((f.cir?'c/':'')+f.dia+'/'+f.path.replace(/\.geojson$/,'_fotos.zip'));
      if(!f.cir){const j=normalizar(g,f,zip);for(const d of j.diags){d._j=j;diags.push(d);}}
      else{const h=g.jornada||{};const j={...h,zipSha:zip,ruta:f.dia+'/'+f.path,cirugias:0};jors.push(j);
        for(const ft of g.features||[]){const p=ft.properties||{};const ll=ft.geometry&&ft.geometry.type==='Point'?{lng:ft.geometry.coordinates[0],lat:ft.geometry.coordinates[1]}:{};
          const o={...p,...ll,_j:j};
          if(p.tipo==='cirugia'){cirs.push(o);j.cirugias++;}else if(p.tipo==='diagnostico')corr.push(o);else if(p.tipo==='marca')marcas.push(o);}}
    }catch(e){console.warn('archivo ilegible',f.path,e);}n++;pintarCir(`Leyendo archivos: ${n} de ${geos.length}`);});
    CIR.diags=diags;CIR.cirugias=cirs;CIR.correcciones=corr;CIR.marcas=marcas;CIR.jornadas=jors;
    calcularPendientes();CIR.cargado=true;
    const guard=await dget('kv','cir_parejas');CIR.parejas=Array.isArray(guard)&&guard.length?guard:parejasIniciales();
    if(!CIR.fecha)CIR.fecha=esHabil(hoyISO())&&new Date().getHours()<12?hoyISO():habilMas(hoyISO());
    await leerProgramacion(CIR.fecha);
  }catch(e){toast(e.message,6000);}
  finally{CIR.cargando=false;pintarCir();}
}
function parejasIniciales(){const c=cirujanos();const out=[];for(let i=0;i+1<c.length&&out.length<2;i+=2)out.push({cirujano:c[i].u,auxiliar:c[i+1].u,ef:20});if(!out.length)out.push({cirujano:'',auxiliar:'',ef:20});return out;}
const tDe=x=>Date.parse(x.modificado||x.creado||x.hora_fin||x.fecha)||0;
/* Historia por palma: diagnósticos del censo, correcciones y casos nuevos del cirujano y cirugías. */
function historia(pid){
  const ev=[];
  for(const d of CIR.diags)if(String(d.palma_id)===String(pid))ev.push({t:tDe(d),clase:'censo',d});
  for(const d of CIR.correcciones)if(String(d.palma_id)===String(pid))ev.push({t:tDe(d),clase:d.origen==='caso_nuevo'?'caso_nuevo':'correccion',d});
  for(const c of CIR.cirugias)if(String(c.palma_id)===String(pid))ev.push({t:tDe(c),clase:'cirugia',d:c});
  return ev.sort((a,b)=>a.t-b.t);
}
function calcularPendientes(){
  const ult=new Map(),ultCir=new Map();
  const ponD=(d,clase)=>{const k=String(d.palma_id);const t=tDe(d);const u=ult.get(k);if(!u||t>=u.t)ult.set(k,{t,d,clase});};
  CIR.diags.forEach(d=>ponD(d,'censo'));CIR.correcciones.forEach(d=>ponD(d,d.origen==='caso_nuevo'?'caso_nuevo':'correccion'));
  for(const c of CIR.cirugias){const k=String(c.palma_id);const t=tDe(c);const u=ultCir.get(k);if(!u||t>u.t)ultCir.set(k,{t,c});}
  const pend=[];
  for(const [k,{t,d,clase}] of ult){if(!esCasoCirugia(d))continue;const c=ultCir.get(k);if(c&&c.t>=t-60000)continue;
    const f=fechaISO(new Date(t));pend.push({palma_id:k,lote:d.lote,linea:d.linea,palma:d.palma,lat:d.lat,lng:d.lng,n1_codigo:d.n1_codigo||'PC',diagnostico:String(d.nivel2||'').toUpperCase(),
      seguimiento:d.nivel3||'',fecha_censo:f,vence:habilMas(f),censador:d.evaluador||'',diag_id:d.id||'',origen:clase,creado:new Date(t).toISOString()});}
  const prioN2={'PC AVANZADA':0,'PC REINCIDENTE':1,'PC INICIAL':2};
  CIR.pend=pend.sort((a,b)=>a.vence.localeCompare(b.vence)||(prioN2[a.diagnostico]??3)-(prioN2[b.diagnostico]??3)||ordenNat(a.lote,b.lote));
  // cumplimiento D+1 de los últimos 30 días: casos que se volvieron «de cirugía» y si se operaron a tiempo
  const desde=Date.now()-30*86400000;let tot=0,ok=0;
  for(const d of [...CIR.diags,...CIR.correcciones]){if(!esCasoCirugia(d))continue;const t=tDe(d);if(t<desde)continue;const vence=habilMas(fechaISO(new Date(t)));
    if(vence>hoyISO())continue;tot++;const c=CIR.cirugias.find(x=>String(x.palma_id)===String(d.palma_id)&&tDe(x)>=t-60000);if(c&&fechaISO(new Date(tDe(c)))<=vence)ok++;}
  CIR.cumplimiento=tot?Math.round(ok/tot*100):null;CIR.cumpTot=tot;
}

/* ---------- Programación inteligente ---------- */
function repartir(ordenes,parejas){
  const k=parejas.length;if(!k)return [];const cap=parejas.map(p=>Number(p.ef)||20);
  const P=ordenes.map(o=>aXY(o.lng,o.lat));
  // semillas: la más lejana a la oficina y luego la más lejana a las ya elegidas
  const of=aXY(oficinaCentral().lng,oficinaCentral().lat);const semillas=[];
  let i0=0,dm=-1;P.forEach((p,i)=>{const d=Math.hypot(p[0]-of[0],p[1]-of[1]);if(d>dm){dm=d;i0=i;}});if(P.length)semillas.push(P[i0]);
  while(semillas.length<k&&semillas.length<P.length){let bi=0,bd=-1;P.forEach((p,i)=>{const d=Math.min(...semillas.map(s=>Math.hypot(p[0]-s[0],p[1]-s[1])));if(d>bd){bd=d;bi=i;}});semillas.push(P[bi]);}
  while(semillas.length<k)semillas.push(of);
  let asig=new Array(P.length).fill(0),cent=semillas.map(s=>[...s]);
  for(let it=0;it<6;it++){
    const libre=[...cap];asig=new Array(P.length).fill(-1);
    // primero los puntos con más diferencia entre su mejor y segunda opción (los «indecisos» al final)
    const ord=P.map((p,i)=>{const ds=cent.map(c=>Math.hypot(p[0]-c[0],p[1]-c[1])).sort((a,b)=>a-b);return {i,reg:(ds[1]??ds[0])-ds[0]};}).sort((a,b)=>b.reg-a.reg);
    for(const {i} of ord){const p=P[i];const op=cent.map((c,j)=>({j,d:Math.hypot(p[0]-c[0],p[1]-c[1])})).sort((a,b)=>a.d-b.d);
      const el=op.find(x=>libre[x.j]>0)||op[0];asig[i]=el.j;libre[el.j]--;}
    cent=cent.map((c,j)=>{const m=P.filter((_,i)=>asig[i]===j);return m.length?[m.reduce((s,p)=>s+p[0],0)/m.length,m.reduce((s,p)=>s+p[1],0)/m.length]:c;});
  }
  return asig;
}
function generarProgramacion(){
  const fecha=CIR.fecha;const parejas=CIR.parejas.filter(p=>p.cirujano);
  if(!parejas.length){toast('Defina al menos una pareja con su cirujano.');return;}
  const cap=parejas.reduce((s,p)=>s+(Number(p.ef)||20),0);
  const cand=CIR.pend.filter(o=>o.fecha_censo<fecha||(o.fecha_censo<=fecha&&o.vence>=fecha)); // censados antes del día programado
  const sel=cand.slice(0,cap),quedan=cand.slice(cap);
  const asig=repartir(sel,parejas);const of=oficinaCentral();
  const out=parejas.map((p,j)=>{const cirj=CIR.usuarios.find(u=>u.u===p.cirujano)||{},aux=CIR.usuarios.find(u=>u.u===p.auxiliar)||{};
    const ords=sel.filter((_,i)=>asig[i]===j);let ruta={orden:ords.map((_,i)=>i),geometria:[],tramos_m:[],km:0};
    try{if(VIAS.gj&&ords.length)ruta=rutaOptima(VIAS.gj,of,ords);}catch(e){console.warn('ruta',e);}
    const ordenes=ruta.orden.map((ix,n)=>({...ords[ix],orden:n+1,id:`cir-${fecha}-${ords[ix].palma_id}`,tramo_m:ruta.tramos_m[n]||null}));
    return {n:j+1,color:COLORES_PAREJA[j%COLORES_PAREJA.length],cirujano:{u:p.cirujano,nombre:cirj.nombre||p.cirujano},auxiliar:{u:p.auxiliar||'',nombre:aux.nombre||''},
      eficiencia:Number(p.ef)||20,km:ruta.km,regreso_m:ruta.tramos_m[ruta.tramos_m.length-1]||null,ruta:ruta.geometria,ordenes};});
  CIR.prog={formato:'sanidad-programacion-cirugia-1',fecha,generado:new Date().toISOString(),por:SES.u,por_nombre:SES.nombre,oficina:of,parejas:out,
    sin_programar:quedan.map(o=>({palma_id:o.palma_id,lote:o.lote,linea:o.linea,palma:o.palma,diagnostico:o.diagnostico,vence:o.vence})),enviada:false};
  dput('kv','cir_parejas',CIR.parejas);pintarCir();toast(`Programación lista: ${sel.length} palma(s) en ${out.length} pareja(s). Revise y envíela a los celulares.`,4500);
}
async function leerProgramacion(fecha){
  CIR.prog=null;CIR.progSha=null;
  try{const r=await gh(`/contents/cirugia/programacion/${fecha}.json?ref=${encodeURIComponent(SES.repo.rama)}`);const j=await r.json();
    CIR.progSha=j.sha;CIR.prog={...JSON.parse(DEC.decode(deB64(j.content.replace(/\s/g,'')))),enviada:true};}
  catch(e){if(e.status!==404)toast(e.message,5000);}
}
async function ghPut(path,texto,mensaje,sha){
  const g=SES.repo;
  const r=await fetch(`${GHAPI}/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'PUT',cache:'no-store',
    headers:{'Authorization':'Bearer '+SES.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
    body:JSON.stringify({message:mensaje,content:aB64(ENC.encode(texto)),branch:g.rama,...(sha?{sha}:{})})});
  if(!r.ok){let m='';try{m=(await r.json()).message||'';}catch(e){}const e=new Error(errorGH(r.status,m));e.status=r.status;throw e;}
  return (await r.json()).content.sha;
}
async function enviarProgramacion(){
  if(!CIR.prog)return;const b=$('#cirEnviar');if(b){b.disabled=true;b.textContent='Enviando…';}
  try{const datos={...CIR.prog};delete datos.enviada;datos.enviado=new Date().toISOString();
    let sha=CIR.progSha;if(!sha){try{const r=await gh(`/contents/cirugia/programacion/${CIR.prog.fecha}.json?ref=${encodeURIComponent(SES.repo.rama)}`);sha=(await r.json()).sha;}catch(e){}}
    CIR.progSha=await ghPut(`cirugia/programacion/${CIR.prog.fecha}.json`,JSON.stringify(datos),`Programación de cirugías ${CIR.prog.fecha} · ${SES.nombre}`,sha);
    CIR.prog={...datos,enviada:true};toast('✓ Programación enviada. Las parejas la reciben al iniciar la jornada de cirugía.',5000);}
  catch(e){toast('No se pudo enviar: '+e.message,6000);}
  finally{pintarCir();}
}

/* ---------- Pintado ---------- */
function marcadorNum(o,color,n){return L.marker([o.lat,o.lng],{icon:L.divIcon({className:'cir-num',iconSize:[22,22],iconAnchor:[11,11],html:`<b style="background:${color}">${n}</b>`}),keyboard:false});}
function htmlHistoria(pid){
  const ev=historia(pid);if(!ev.length)return '';
  const ultD=[...ev].reverse().find(e=>e.clase!=='cirugia');
  return '<div class="hist">'+ev.map(e=>{const d=e.d;const f=new Date(e.t);const cuando=`${fechaCorta(f)} ${hhmm(f)}`;
    if(e.clase==='cirugia')return `<div class="v vig"><span class="tenue">Cirugía · ${cuando}</span><br><b>${esc(d.tipo_cirugia||'')}</b> · ${esc(d.producto||'')}<br><span class="tenue">${esc(nombreCorto(d.cirujano_nombre||d.cirujano))}${d.auxiliar_nombre?' + '+esc(nombreCorto(d.auxiliar_nombre)):''} · ${d.duracion_min??'—'} min</span></div>`;
    const et={censo:'Censo',correccion:'Corrección del cirujano',caso_nuevo:'Caso nuevo (cirujano)'}[e.clase];
    return `<div class="v ${e===ultD?'vig':'vieja'}"><span class="tenue">${et} · ${cuando}${e===ultD?' · vigente':''}</span><br><b>${esc([d.nivel1,d.nivel2].filter(Boolean).join(' · '))}</b><br><span class="tenue">${esc(nombreCorto(d.evaluador))}</span></div>`;}).join('')+'</div>';
}
function pintarMapaCir(){
  CIR.capa.clearLayers();
  if(CIR.prog){for(const p of CIR.prog.parejas){
      if(p.ruta&&p.ruta.length>1){L.polyline(p.ruta.map(([x,y])=>[y,x]),{renderer:rend,color:'#06140f',weight:7,opacity:.6,interactive:false}).addTo(CIR.capa);
        L.polyline(p.ruta.map(([x,y])=>[y,x]),{renderer:rend,color:p.color,weight:4,opacity:.95,dashArray:'8 6',interactive:false}).addTo(CIR.capa);}
      for(const o of p.ordenes)marcadorNum(o,p.color,o.orden).bindPopup(`<b>${esc(etqPalma(o))}</b><br>Pareja ${p.n} · orden ${o.orden}<br>${esc(o.diagnostico)} · vence ${fechaCorta(o.vence)}${htmlHistoria(o.palma_id)}`,{maxWidth:300}).addTo(CIR.capa);}
    const prog=new Set(CIR.prog.parejas.flatMap(p=>p.ordenes.map(o=>String(o.palma_id))));
    for(const o of CIR.pend)if(!prog.has(String(o.palma_id))&&o.lat!=null)L.circleMarker([o.lat,o.lng],{renderer:rend,radius:6,color:'#fff',weight:1.5,fillColor:'#e53935',fillOpacity:.9})
      .bindPopup(`<b>${esc(etqPalma(o))}</b><br>Sin programar · ${esc(o.diagnostico)} · vence ${fechaCorta(o.vence)}${htmlHistoria(o.palma_id)}`,{maxWidth:300}).addTo(CIR.capa);}
  else for(const o of CIR.pend)if(o.lat!=null)L.circleMarker([o.lat,o.lng],{renderer:rend,radius:6,color:'#fff',weight:1.5,fillColor:o.vence<CIR.fecha?'#ff1744':'#e53935',fillOpacity:.9})
      .bindPopup(`<b>${esc(etqPalma(o))}</b><br>${esc(o.diagnostico)} · censo ${fechaCorta(o.fecha_censo)} · vence ${fechaCorta(o.vence)}<br>${esc(nombreCorto(o.censador))}${htmlHistoria(o.palma_id)}`,{maxWidth:300}).addTo(CIR.capa);
  const of=oficinaCentral();
}
function pintarCir(msg){
  const P=$('#cirPanel');if(!P)return;
  if(!CIR.cargado){P.innerHTML=`<h3>Cirugías</h3><div class="tenue">${esc(msg||'Preparando…')}</div>`;return;}
  const f=CIR.fecha;const venc=CIR.pend.filter(o=>o.vence<f).length,venceF=CIR.pend.filter(o=>o.vence===f).length;
  const fest=esFestivo(f),hab=esHabil(f);
  const tabs=`<div class="cir-tabs"><button class="btn mini ${CIR.tab==='prog'?'on':''}" data-ct="prog">PROGRAMACIÓN</button><button class="btn mini ${CIR.tab==='seg'?'on':''}" data-ct="seg">CIRUGÍAS REALIZADAS</button><button class="btn mini" id="cirRec" title="Volver a leer los datos">↻</button></div>`;
  let h=tabs;
  if(CIR.tab==='prog'){
    h+=`<div class="kpis"><div class="kpi"><b>${num(CIR.pend.length)}</b><span>Casos pendientes</span></div><div class="kpi"><b class="venc">${num(venc)}</b><span>Vencidos</span></div><div class="kpi"><b class="hoyv">${num(venceF)}</b><span>Vencen el ${esc(fechaCorta(f))}</span></div></div>
    <div class="kpis"><div class="kpi"><b>${CIR.cumplimiento==null?'—':CIR.cumplimiento+' %'}</b><span>Cumplimiento D+1 (30 días)</span></div><div class="kpi"><b>${num(CIR.cirugias.length)}</b><span>Cirugías (45 días)</span></div><div class="kpi"><b>${num(CIR.correcciones.filter(c=>c.origen!=='caso_nuevo').length)}</b><span>Correcciones</span></div></div>
    <label class="campo" for="cirFecha">Programar para</label>
    <div style="display:flex;gap:8px;align-items:center"><input type="date" id="cirFecha" value="${f}"><span class="tenue">${fest?'⚠ Festivo: '+esc(fest):hab?esc(fechaCorta(f)):'⚠ Domingo'}</span></div>
    <h3>Parejas y eficiencia (palmas/día)</h3>
    ${CIR.parejas.map((p,i)=>`<div class="cir-par"><div class="cab"><i style="background:${COLORES_PAREJA[i%4]}"></i><b>Pareja ${i+1}</b>${CIR.parejas.length>1?`<button class="btn mini" data-quitar="${i}" style="margin-left:auto">Quitar</button>`:''}</div>
      <label class="campo" for="pc${i}">Cirujano</label><select id="pc${i}" data-p="${i}" data-k="cirujano"><option value="">—</option>${cirujanos().map(u=>`<option value="${esc(u.u)}" ${u.u===p.cirujano?'selected':''}>${esc(u.nombre)}</option>`).join('')}</select>
      <label class="campo" for="pa${i}">Auxiliar</label><select id="pa${i}" data-p="${i}" data-k="auxiliar"><option value="">—</option>${auxiliaresCir().filter(u=>u.u!==p.cirujano).map(u=>`<option value="${esc(u.u)}" ${u.u===p.auxiliar?'selected':''}>${esc(u.nombre)} · ${esc(u.rol_cirugia==='cirujano'?'cirujano':'aux. fumigación')}</option>`).join('')}</select>
      <div class="cir-ef"><span>Eficiencia</span><input type="range" min="12" max="30" value="${p.ef}" data-p="${i}" data-k="ef" aria-label="Eficiencia de la pareja ${i+1}"><b id="ef${i}">${p.ef}</b></div></div>`).join('')}
    ${CIR.parejas.length<4?'<button class="btn mini" id="cirMasPar">+ Agregar pareja</button>':''}
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn prim" id="cirGenerar">GENERAR PROGRAMACIÓN</button>${CIR.prog?`<button class="btn nar" id="cirEnviar" ${CIR.prog.enviada?'':''}>${CIR.prog.enviada?'REENVIAR A LOS CELULARES':'ENVIAR A LOS CELULARES'}</button>`:''}</div>`;
    if(CIR.prog){const tot=CIR.prog.parejas.reduce((s,p)=>s+p.ordenes.length,0);
      h+=`<p class="tenue" style="margin:8px 0">${CIR.prog.enviada?'✓ Enviada':'Sin enviar'} · generada ${esc(fechaCorta(CIR.prog.generado))} ${hhmm(CIR.prog.generado)} por ${esc(CIR.prog.por_nombre||CIR.prog.por)} · ${num(tot)} palmas</p>`;
      if(CIR.prog.sin_programar&&CIR.prog.sin_programar.length)h+=`<div class="cir-aviso">${num(CIR.prog.sin_programar.length)} caso(s) quedan para el siguiente día hábil (${esc(fechaCorta(habilMas(f)))}): la capacidad de las parejas no alcanza. Aumente la eficiencia o agregue una pareja.</div>`;
      for(const p of CIR.prog.parejas){h+=`<h3 style="color:${p.color}">Pareja ${p.n} · ${p.ordenes.length} palmas · ${p.km??'—'} km</h3><div class="tenue" style="font-size:12.5px;margin:-4px 0 6px">${esc(p.cirujano.nombre)} (cirujano)${p.auxiliar.nombre?' · '+esc(p.auxiliar.nombre)+' (auxiliar)':''}</div>
        <table class="t"><thead><tr><th>#</th><th>Palma</th><th>Diagnóstico</th><th>Censo</th><th>Vence</th></tr></thead><tbody>${p.ordenes.map(o=>`<tr data-ll="${o.lat},${o.lng}"><td>${o.orden}</td><td>${esc(etqPalma(o))}</td><td>${esc(o.diagnostico.replace('PC ',''))}${o.origen==='caso_nuevo'?' · nuevo':''}</td><td>${esc(fechaCorta(o.fecha_censo))}<br><span class="tenue">${esc(nombreCorto(o.censador))}</span></td><td class="${o.vence<f?'venc':o.vence===f?'hoyv':''}">${esc(fechaCorta(o.vence))}</td></tr>`).join('')}</tbody></table>`;}
    }else{h+=`<h3>Casos pendientes</h3>${CIR.pend.length?`<table class="t"><thead><tr><th>Palma</th><th>Diagnóstico</th><th>Censo</th><th>Vence</th></tr></thead><tbody>${CIR.pend.map(o=>`<tr data-ll="${o.lat},${o.lng}"><td>${esc(etqPalma(o))}</td><td>${esc(o.diagnostico)}</td><td>${esc(fechaCorta(o.fecha_censo))}<br><span class="tenue">${esc(nombreCorto(o.censador))}</span></td><td class="${o.vence<f?'venc':o.vence===f?'hoyv':''}">${esc(fechaCorta(o.vence))}</td></tr>`).join('')}</tbody></table>`:'<div class="tenue">No hay casos de PC pendientes de cirugía en los últimos 45 días.</div>'}`;}
  }else{
    const cs=[...CIR.cirugias].sort((a,b)=>tDe(b)-tDe(a));
    h+=`<div class="kpis"><div class="kpi"><b>${num(cs.length)}</b><span>Cirugías (45 días)</span></div><div class="kpi"><b>${num(cs.filter(c=>c.origen==='caso_nuevo').length)}</b><span>Casos nuevos operados</span></div><div class="kpi"><b>${(()=>{const d=cs.map(c=>Number(c.duracion_min)).filter(x=>x>0);return d.length?Math.round(d.reduce((a,b)=>a+b,0)/d.length)+' min':'—';})()}</b><span>Duración promedio</span></div></div>
    <h3>Cirugías realizadas</h3>${cs.length?`<table class="t"><thead><tr><th>Fecha</th><th>Palma</th><th>Cirugía</th><th>Producto</th><th>Pareja</th><th>Fotos</th></tr></thead><tbody>${cs.map((c,i)=>`<tr data-ll="${c.lat},${c.lng}"><td>${esc(fechaCorta(new Date(tDe(c))))}<br><span class="tenue">${esc(c.hora_foto_antes||'')}–${esc(c.hora_foto_despues||'')}</span></td><td>${esc(etqPalma(c))}</td><td>${esc(String(c.tipo_cirugia||'').replace('PC ',''))}${c.origen==='caso_nuevo'?'<br><span class="tenue">caso nuevo</span>':''}</td><td>${esc(c.producto||'')}<br><span class="tenue">${esc(c.producto_tipo||'')}</span></td><td>${esc(nombreCorto(c.cirujano_nombre||c.cirujano))}<br><span class="tenue">${esc(nombreCorto(c.auxiliar_nombre||''))}</span></td><td>${(c.fotos||'').split('|').filter(Boolean).length?`<button class="btn mini" data-fot="${i}">Ver</button>`:'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="tenue">Aún no hay cirugías sincronizadas.</div>'}
    <h3>Correcciones del diagnóstico</h3>${CIR.correcciones.filter(c=>c.origen!=='caso_nuevo').length?`<table class="t"><thead><tr><th>Palma</th><th>Censo (antes)</th><th>Cirujano (vigente)</th></tr></thead><tbody>${CIR.correcciones.filter(c=>c.origen!=='caso_nuevo').map(c=>`<tr data-ll="${c.lat},${c.lng}"><td>${esc(etqPalma(c))}</td><td class="tenue">${esc(c.corrige_texto||'')}<br>${esc(nombreCorto(c.corrige_evaluador||''))}</td><td><b>${esc([c.nivel1,c.nivel2].filter(Boolean).join(' · '))}</b><br><span class="tenue">${esc(nombreCorto(c.evaluador))} · ${esc(fechaCorta(new Date(tDe(c))))}</span></td></tr>`).join('')}</tbody></table>`:'<div class="tenue">Sin correcciones.</div>'}`;
    CIR._cs=cs;
  }
  P.innerHTML=h;
  P.querySelectorAll('[data-ct]').forEach(b=>b.onclick=()=>{CIR.tab=b.dataset.ct;pintarCir();});
  const rec=$('#cirRec');if(rec)rec.onclick=()=>{CIR.cargado=false;cirCargar();};
  const fi=$('#cirFecha');if(fi)fi.onchange=async()=>{CIR.fecha=fi.value||hoyISO();await leerProgramacion(CIR.fecha);pintarCir();};
  P.querySelectorAll('select[data-p]').forEach(s=>s.onchange=()=>{CIR.parejas[+s.dataset.p][s.dataset.k]=s.value;dput('kv','cir_parejas',CIR.parejas);pintarCir();});
  P.querySelectorAll('input[type=range][data-p]').forEach(s=>{s.oninput=()=>{$('#ef'+s.dataset.p).textContent=s.value;};s.onchange=()=>{CIR.parejas[+s.dataset.p].ef=+s.value;dput('kv','cir_parejas',CIR.parejas);};});
  P.querySelectorAll('[data-quitar]').forEach(b=>b.onclick=()=>{CIR.parejas.splice(+b.dataset.quitar,1);dput('kv','cir_parejas',CIR.parejas);pintarCir();});
  const mas=$('#cirMasPar');if(mas)mas.onclick=()=>{CIR.parejas.push({cirujano:'',auxiliar:'',ef:20});pintarCir();};
  const g=$('#cirGenerar');if(g)g.onclick=generarProgramacion;
  const en=$('#cirEnviar');if(en)en.onclick=enviarProgramacion;
  P.querySelectorAll('tr[data-ll]').forEach(tr=>tr.onclick=()=>{const [a,b]=tr.dataset.ll.split(',').map(Number);if(isFinite(a)&&isFinite(b))mapa.setView([a,b],18);});
  P.querySelectorAll('[data-fot]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const c=CIR._cs[+b.dataset.fot];verFotos({...c,_j:c._j,lote:c.lote,linea:c.linea,palma:c.palma});});
  pintarMapaCir();
}
