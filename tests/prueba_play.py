"""Reproducción: ficha automática del diagnóstico (pausa 3 s) y resumen Inicio/Fin/HA/T. efectivo, en app y visor."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import sys, time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900})
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    # ---------------- APP ----------------
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errores.append('app: ' + str(e) + ' ' + (e.stack or '')[:300]))
    pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html')
    pg.wait_for_function("typeof S!=='undefined'&&typeof dbPut==='function'", timeout=30000); time.sleep(2)
    pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;
      const t0=Date.parse('2026-11-13T13:00:00Z');const pts=[];for(let i=0;i<=60;i++)pts.push({j:'JP',t:t0+i*60000,lat:1.70+i*0.00005,lng:-78.70,acc:4,s:1});
      await dbPutVarios('track',pts);
      await dbPut('jornadas',{id:'JP',estado:'finalizada',sync:'sincronizado',evaluador:'Operario Uno',usuario:'op1',inicio:new Date(t0).toISOString(),fin:new Date(t0+3600e3).toISOString(),
        km:0.33,densidad:115,paradas:[],visita:{ha_recorridas:2.35,palmas_visitadas:270,por_lote:[]},tiempos:{min_efectivo_labor:47},secuencias:[]});
      const reg=(id,min,txt)=>({id,jornada_id:'JP',palma_id:'P'+id,lote:'IT01',linea:3,numero:min,evaluador:'Operario Uno',estado:'enferma',n1_codigo:'PC',n1:txt,n2:'',n3:'',sintomas:['Hojas secas'],
        problemas:[],observaciones:'obs '+id,fotos:[],sync:'sincronizado',creado:new Date(t0+min*60000).toISOString(),lat:1.70+min*0.00005,lng:-78.70});
      await dbPutVarios('registros',[reg('D1',10,'Pudrición del cogollo'),reg('D2',40,'Marchitez letal')]);
      S.registros=await dbAll('registros');recalcUltimo();await abrirPlay('JP');}""")
    res = pg.evaluate("document.querySelector('#plRes').innerText.replace(/\\n/g,' ')")
    check('App: resumen con Inicio, Fin, HA y T. efectivo', all(k in res for k in ('Inicio', 'Fin', 'Hectáreas', '2.35', 'T. efectivo', '0:47')), res)
    pg.select_option('#plVel', '300'); pg.click('#plBtn')
    pg.wait_for_function("!document.querySelector('#plCard').hidden", timeout=15000)
    c1 = pg.evaluate("document.querySelector('#plCard').innerText.replace(/\\n/g,' ')")
    check('App: ficha automática del 1er diagnóstico', 'Pudrición del cogollo' in c1 and 'IT01' in c1 and 'P10' in c1, c1)
    ta = pg.evaluate('PLAY.t'); time.sleep(1.5); tb = pg.evaluate('PLAY.t')
    check('App: la reproducción se pausa mientras muestra el diagnóstico', abs(tb - ta) < 1, (ta, tb))
    time.sleep(4.2); tc = pg.evaluate('PLAY.t')
    check('App: luego continúa sola', tc > tb, tc - tb)
    pg.wait_for_function("document.querySelector('#plCard').innerText.includes('Marchitez')", timeout=20000)
    check('App: ficha del 2.º diagnóstico', True)
    check('App: HA en vivo en el pie', pg.evaluate("document.querySelector('#plHa')!==null"))
    pg.evaluate("detenerPlay()")
    check('App: al cerrar se oculta la ficha', pg.evaluate("document.querySelector('#plCard').hidden"))
    # ---------------- VISOR ----------------
    vz = ctx.new_page()
    vz.on('pageerror', lambda e: errores.append('visor: ' + str(e) + ' ' + (e.stack or '')[:300]))
    vz.on('dialog', lambda d: d.dismiss())
    vz.goto('http://127.0.0.1:8765/visor.html')
    vz.wait_for_function("typeof abrirDetalle==='function'&&typeof mapa!=='undefined'", timeout=30000); time.sleep(1.5)
    vz.evaluate("""()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();
      window.chunkLote=async()=>[];
      const t0=Date.parse('2026-11-13T13:00:00Z');const c=[],t=[];for(let i=0;i<=60;i++){c.push([-78.70,1.70+i*0.00005]);t.push(t0+i*60000);}
      const d=(id,min,txt)=>({tipo:'diagnostico',id,palma_id:'P'+id,lote:'IT01',linea:3,palma:min,nivel1:txt,estado:'enferma',evaluador:'Operario Uno',creado:new Date(t0+min*60000).toISOString(),lat:1.70+min*0.00005,lng:-78.70,n_fotos:0});
      const j={id:'JV',fecha:'2026-11-13',evaluador:'Operario Uno',usuario:'op1',inicio:new Date(t0).toISOString(),fin:new Date(t0+3600e3).toISOString(),hora_inicio:'08:00',hora_fin:'09:00',duracion_min:60,
        km:0.33,ha:2.35,palmas:270,metodo:'calle',n_paradas:0,min_paradas:0,min_mov:60,por_lote:[],densidad:115,app:'',lotes:new Set(['IT01']),paradas:[],
        track:{c,t,acc:c.map(()=>4)},header:{},secuencias:null,tiempos:{min_efectivo_labor:47,hora_inicio_labor:'08:05',hora_fin_labor:'08:58'},vel:2};
      j.diags=[d('V1',10,'Pudrición del cogollo'),d('V2',40,'Marchitez letal')];j.diags.forEach(x=>x._j=j);
      abrirDetalle(j);}""")
    vr = vz.evaluate("document.querySelector('.play-res').innerText.replace(/\\n/g,' ')")
    check('Visor: resumen con Inicio, Fin, Ha y T. efectivo', all(k in vr for k in ('Inicio', '08:00', 'Fin', '09:00', '2,35', 'T. efectivo', '0:47')) or all(k in vr for k in ('Inicio', 'Fin', '2.35', '0:47')), vr)
    vz.select_option('#pVel', '600'); vz.click('#pBt')
    vz.wait_for_function("!!document.querySelector('.leaflet-popup-content')", timeout=15000)
    pc = vz.evaluate("document.querySelector('.leaflet-popup-content').innerText.replace(/\\n/g,' ')")
    check('Visor: ficha automática del diagnóstico', 'Pudrición del cogollo' in pc, pc[:100])
    va = vz.evaluate('PLAY.t'); time.sleep(1.5); vb = vz.evaluate('PLAY.t')
    check('Visor: pausa mientras muestra el diagnóstico', abs(vb - va) < 1, (va, vb))
    vz.wait_for_function("(document.querySelector('.leaflet-popup-content')||{innerText:''}).innerText.includes('Marchitez')", timeout=20000)
    check('Visor: ficha del 2.º diagnóstico', True)
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
