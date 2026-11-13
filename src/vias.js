/* ---------- Vías, senderos y oficina central (cartografía cifrada: datos/vias.enc) ----------
   Compartido por la App y el visor (build.py lo inserta en ambos). Requiere: mapa, rend, aesDes, deB64, SES, ACCESO, esc.
   Vía principal: aspecto de vía pavimentada (asfalto, bordes blancos y línea central amarilla discontinua).
   Senderos principales: arcillosos (barro), más anchos. Senderos secundarios: arcillosos, angostos.
   Los anchos se dan en metros reales y se convierten a píxeles según el zoom. */
const VIAS={gj:null,capa:null,partes:[],oficina:null,visible:true};
const VIA_TIPO={
  via:{n:'Vía principal',sup:'Piedra y arena',orden:3},
  sendero_principal:{n:'Sendero principal',sup:'Arcilloso (barro)',orden:2},
  sendero_secundario:{n:'Sendero secundario',sup:'Arcilloso (barro), angosto',orden:1}
};
/* Capas de dibujo por tipo, de abajo hacia arriba: color, ancho en metros, ancho mínimo en píxeles, trazo discontinuo y zoom mínimo. */
const VIA_CAPAS={
  via:[
    {rol:'sombra',color:'#0b0d0e',m:7.4,min:5,op:.55},
    {rol:'borde',color:'#f4f4f0',m:6.6,min:3.8},
    {rol:'asfalto',color:'#2f3234',m:5.8,min:2.4,top:true},
    {rol:'centro',color:'#f2c230',m:.18,min:1.1,dash:[3,3],zmin:15}
  ],
  sendero_principal:[
    {rol:'borde',color:'#3d2511',m:3.8,min:3.2},
    {rol:'barro',color:'#9b6034',m:3.1,min:2.2,top:true},
    {rol:'charcos',color:'#6b3f1d',m:1,min:1,dash:[1.2,2.6],zmin:16,op:.85}
  ],
  sendero_secundario:[
    {rol:'borde',color:'#4b321b',m:2.2,min:2},
    {rol:'barro',color:'#bb8753',m:1.6,min:1.3,top:true}
  ]
};
function mppVias(){const z=mapa.getZoom(),lat=mapa.getCenter().lat;return 156543.03392*Math.cos(lat*Math.PI/180)/Math.pow(2,z);}
function estiloParteVia(c){
  const mpp=mppVias(),z=mapa.getZoom(),px=m=>m/mpp;
  const oculto=c.zmin&&z<c.zmin;
  const w=Math.max(c.min,px(c.m));
  const st={color:c.color,weight:oculto?0:w,opacity:oculto?0:(c.op??1),lineCap:c.dash?'butt':'round',lineJoin:'round'};
  st.dashArray=c.dash?c.dash.map(m=>Math.max(3,px(m)).toFixed(1)).join(' '):null;
  return st;
}
function longitudTxt(m){m=Number(m)||0;return m>=1000?(m/1000).toFixed(2).replace('.',',')+' km':Math.round(m)+' m';}
function popupVia(p){const t=VIA_TIPO[p.tipo]||{n:p.tipo,sup:''};
  return `<b>${esc(p.nombre||t.n)}</b><br>${esc(t.n)} · ${esc(t.sup)}${p.longitud_m?`<br>Longitud: ${longitudTxt(p.longitud_m)}`:''}`;}
const ICONO_OFICINA=()=>L.divIcon({className:'ic-oficina',iconSize:[34,34],iconAnchor:[17,17],
  html:'<svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true"><circle cx="17" cy="17" r="15.5" fill="#0F3D2E" stroke="#fff" stroke-width="2.5"/><path d="M9 25V15l8-6 8 6v10h-5.5v-6h-5v6z" fill="#fff"/><circle cx="17" cy="7.2" r="2.6" fill="#E8A33D"/></svg>'});
function dibujarVias(){
  if(VIAS.capa){mapa.removeLayer(VIAS.capa);VIAS.capa=null;}VIAS.partes=[];VIAS.oficina=null;
  if(!VIAS.gj||!VIAS.visible)return;
  VIAS.capa=L.layerGroup().addTo(mapa);
  const lineas=VIAS.gj.features.filter(f=>f.geometry&&f.geometry.type==='LineString'&&VIA_CAPAS[f.properties.tipo]);
  const tipos=Object.keys(VIA_TIPO).sort((a,b)=>VIA_TIPO[a].orden-VIA_TIPO[b].orden); // secundarios abajo, vías arriba
  for(const tipo of tipos){const fs=lineas.filter(f=>f.properties.tipo===tipo);
    for(const c of VIA_CAPAS[tipo])for(const f of fs){
      const ll=f.geometry.coordinates.map(([x,y])=>[y,x]);
      const pl=L.polyline(ll,{renderer:rend,interactive:!!c.top,...estiloParteVia(c)}).addTo(VIAS.capa);
      if(c.top)pl.bindPopup(popupVia(f.properties),{maxWidth:260});
      VIAS.partes.push({pl,c});}}
  const of=VIAS.gj.features.find(f=>f.properties.tipo==='oficina'&&f.geometry&&f.geometry.type==='Point');
  if(of){const [x,y]=of.geometry.coordinates;
    VIAS.oficina=L.marker([y,x],{icon:ICONO_OFICINA(),zIndexOffset:500,keyboard:false,title:of.properties.nombre||'Oficina central'})
      .bindPopup(`<b>${esc(of.properties.nombre||'Oficina central')}</b><br>${esc(of.properties.descripcion||'Punto de llegada y salida del personal')}`).addTo(VIAS.capa);}
  viasAlFondo();
}
/* Orden en el lienzo: lotes al fondo, luego vías y senderos; palmas, recorridos y diagnósticos quedan encima. */
function viasAlFondo(){
  for(let i=VIAS.partes.length-1;i>=0;i--)try{VIAS.partes[i].pl.bringToBack();}catch(e){}
  try{if(typeof capaLotes!=='undefined')capaLotes.eachLayer(g=>{if(g.bringToBack)g.bringToBack();});}catch(e){}
}
function reestilarVias(){for(const {pl,c} of VIAS.partes)pl.setStyle(estiloParteVia(c));}
mapa.on('zoomend',()=>{if(VIAS.partes.length)reestilarVias();});
function mostrarVias(on){VIAS.visible=on!==false;dibujarVias();}
/* Descarga y descifra datos/vias.enc (mismo formato SPC1 de la cartografía). guardar/leer: almacenamiento local opcional para uso sin conexión. */
async function cargarVias(guardar,leer){
  const v=ACCESO&&ACCESO.vias;if(!v||!SES||!SES.dk)return false;
  let gj=null;
  try{const r=await fetch('datos/'+(v.archivo||'vias.enc'),{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);
    const buf=new Uint8Array(await r.arrayBuffer());if(new TextDecoder().decode(buf.slice(0,4))!=='SPC1')throw new Error('formato');
    gj=JSON.parse(new TextDecoder().decode(await aesDes(SES.dk,buf.slice(4,16),buf.slice(16))));
    if(guardar)try{await guardar({version:v.version,gj});}catch(e){}}
  catch(e){if(leer)try{const c=await leer();if(c&&c.gj)gj=c.gj;}catch(_){}}
  if(!gj)return false;VIAS.gj=gj;dibujarVias();return true;
}
function leyendaVias(){
  const sw=(a,b,c)=>`<svg width="34" height="12" style="vertical-align:-2px;margin-right:6px" aria-hidden="true"><line x1="2" y1="6" x2="32" y2="6" stroke="${a}" stroke-width="10" stroke-linecap="round"/><line x1="2" y1="6" x2="32" y2="6" stroke="${b}" stroke-width="7" stroke-linecap="round"/>${c||''}</svg>`;
  return `<div style="font-weight:700;margin:6px 0 2px">Vías y senderos</div>
   <div>${sw('#f4f4f0','#2f3234','<line x1="5" y1="6" x2="30" y2="6" stroke="#f2c230" stroke-width="1.4" stroke-dasharray="4 3"/>')}Vía principal (piedra y arena)</div>
   <div>${sw('#3d2511','#9b6034')}Sendero principal (barro)</div>
   <div><svg width="34" height="12" style="vertical-align:-2px;margin-right:6px" aria-hidden="true"><line x1="4" y1="6" x2="30" y2="6" stroke="#4b321b" stroke-width="5" stroke-linecap="round"/><line x1="4" y1="6" x2="30" y2="6" stroke="#bb8753" stroke-width="3" stroke-linecap="round"/></svg>Sendero secundario (barro)</div>
   <div><svg width="18" height="18" viewBox="0 0 34 34" style="vertical-align:-4px;margin:0 14px 0 8px" aria-hidden="true"><circle cx="17" cy="17" r="15.5" fill="#0F3D2E" stroke="#fff" stroke-width="2.5"/><path d="M9 25V15l8-6 8 6v10h-5.5v-6h-5v6z" fill="#fff"/></svg>Oficina central</div>`;
}
