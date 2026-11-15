"""Monitoreo de plagas: muestra por lote (10×10, 7×7, 5×5 con la primera palma viva), formulario por palma (hoja, varias plagas con
sus estados, daño, foto y transitabilidad), archivo de sincronización y la pestaña del visor. GitHub simulado, datos ficticios."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, json, re, time
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
HOY = datetime.now().strftime('%Y-%m-%d')
GEO = {'type': 'FeatureCollection', 'jornada': {'id': 'JP1', 'labor': 'plagas', 'fecha': HOY, 'evaluador': 'MONITOR UNO'}, 'features': [
    {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [-78.7, 1.5]}, 'properties': {'tipo': 'monitoreo', 'id': 'm1', 'palma_id': '101', 'lote': 'IT05', 'linea': 1, 'palma': 2, 'muestreo': '10x10', 'en_muestra': True,
     'hoja': 17, 'dano': True, 'transitabilidad': 'Transitable', 'evaluador': 'MONITOR UNO', 'creado': HOY + 'T13:00:00Z', 'fotos': 'f1.jpg',
     'plagas': [{'plaga': 'OPS', 'plaga_nombre': 'Opsiphanes cassina', 'lv': 3, 'huevo': 0, 'nido': 1, 'pm': 0, 'pv': 2, 'adulto': 1, 'dano': True}, {'plaga': 'HOR', 'plaga_nombre': 'Hormiga', 'lv': 0, 'huevo': 0, 'nido': 0, 'pm': 0, 'pv': 0, 'adulto': 5, 'dano': False}]}},
    {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [-78.7, 1.501]}, 'properties': {'tipo': 'monitoreo', 'id': 'm2', 'palma_id': '102', 'lote': 'IT06', 'linea': 1, 'palma': 1, 'muestreo': '7x7', 'en_muestra': True,
     'hoja': 9, 'dano': False, 'transitabilidad': 'Poco transitable', 'evaluador': 'MONITOR UNO', 'creado': HOY + 'T14:00:00Z', 'fotos': 'f2.jpg',
     'plagas': [{'plaga': 'SIB', 'plaga_nombre': 'Sibine fusca', 'lv': 4, 'huevo': 0, 'nido': 0, 'pm': 0, 'pv': 0, 'adulto': 0, 'dano': False}]}}]}
def gh(route):
    u = route.request.url
    if re.search(r'/contents/plagas/jornadas\?', u): return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'dir', 'name': HOY, 'sha': 'tdir'}]))
    if '/git/trees/tdir' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tree': [{'path': 'JP1.geojson', 'sha': 'bgeo', 'type': 'blob'}]}))
    if '/git/blobs/bgeo' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(GEO))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900})
    ctx.route('https://api.github.com/**', gh)
    # ---------------- App ----------------
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof abrirInicioPlg==='function'", timeout=30000); time.sleep(1.5)
    # IT05: 25 líneas × 30 palmas; muertas: L1 P1 (la primera de la línea 1) y L11 P21 (le toca a la cuenta)
    m = pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'p1',nombre:'MONITOR UNO',rol:'operario',labores:['plagas']};
      const d=[];let id=1;for(let l=1;l<=25;l++)for(let q=1;q<=30;q++)d.push([id++,l,q,(l===1&&q===1)||(l===11&&q===21)?0:1,-78.70+l*1e-4,1.50+q*1e-4]);
      await dbPut('palmas_lote',{lote:'IT05',d});CARTO.lotes={...CARTO.lotes,IT05:{n:750,linea_min:1,linea_max:25}};
      const a=muestraLote(d,10),b=muestraLote(d,7),c=muestraLote(d,5);
      return {n10:a.length,l1:a.filter(x=>x.linea===1).map(x=>x.palma),l11:a.filter(x=>x.linea===11).map(x=>x.palma),lin10:[...new Set(a.map(x=>x.linea))],lin7:[...new Set(b.map(x=>x.linea))],n5:c.length};}""")
    check('Muestra 10×10: líneas 1, 11 y 21', m['lin10'] == [1, 11, 21], m)
    check('Muestra: empieza en la primera palma viva (L1 empieza en P2)', m['l1'] == [2, 12, 22], m['l1'])
    check('Muestra: si la palma que toca está muerta, toma la siguiente viva (L11 P21 → P22)', m['l11'] == [1, 11, 22], m['l11'])
    check('Muestra 7×7 y 5×5', m['lin7'] == [1, 8, 15, 22] and m['n5'] == 30, m)
    pg.evaluate("elegirLabor()"); pg.wait_for_selector('#plgIni', timeout=5000)
    pg.fill('#plgLote', 'it05'); pg.click('#plgAg'); time.sleep(.8)
    t1 = pg.inner_text('#plgSel')
    pg.check('input[name="m_IT05"][value="7x7"]', force=True); time.sleep(.8)
    t2 = pg.inner_text('#plgSel')
    check('Inicio: tipo de muestreo por lote con el número de palmas', '9 palmas en la muestra' in t1 and '20 palmas en la muestra' in t2, (t1[:60], t2[:60]))
    pg.check('input[name="m_IT05"][value="10x10"]', force=True); time.sleep(.6)
    pg.evaluate("window.motivoNoIniciar=()=>null;window.iniciarGPS=()=>{};window.revisarSegundoPlano=()=>{};S.gps={lat:1.5002,lng:-78.6999,acc:4,t:Date.now()}")
    pg.click('#plgIni'); time.sleep(1.2)
    j = pg.evaluate("({l:S.jornada&&S.jornada.labor,n:S.jornada&&S.jornada.muestra.length,lm:S.jornada&&S.jornada.lotes_muestreo,panel:!document.querySelector('#pp').hidden,txt:document.querySelector('#pp').innerText})")
    check('Jornada de monitoreo con la muestra en el mapa', j['l'] == 'plagas' and j['n'] == 9 and j['lm'] == [{'lote': 'IT05', 'muestreo': '10x10'}] and j['panel'] and 'SIGUIENTE' in j['txt'], j)
    marcar = lambda sel: pg.evaluate("s=>{const e=document.querySelector(s);e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));}", sel)
    pulsar = lambda sel: pg.evaluate("s=>document.querySelector(s).click()", sel)
    pid = pg.evaluate("S.jornada.muestra[0].palma_id")
    pg.evaluate(f"abrirPalmaPlg('{pid}')"); time.sleep(.4); pg.click('#ppReg'); pg.wait_for_selector('#frmPlg', timeout=5000)
    marcar('#frmPlg input[name=hoja][value="17"]'); marcar('#frmPlg input[name=plaga][value=OPS]')
    for _ in range(3): pulsar('[data-mas=lv]')
    pulsar('[data-mas=adulto]'); marcar('#frmPlg input[name=dano][value=si]')
    pulsar('#plgOtra'); time.sleep(.3)
    lst = pg.inner_text('#plgLista')
    marcar('#frmPlg input[name=plaga][value=HOR]'); pulsar('[data-mas=adulto]'); pulsar('[data-mas=adulto]'); marcar('#frmPlg input[name=dano][value=no]')
    falta = pg.inner_text('#plgFalta')
    marcar('#frmPlg input[name=trans][value="Poco transitable"]')
    pg.evaluate("()=>{F.cir.antes={id:'fp1',buf:new ArrayBuffer(8),t:Date.now()};document.querySelector('#frmPlg').dispatchEvent(new Event('change'));document.querySelector('#frmPlg').requestSubmit();}"); time.sleep(1)
    check('Formulario: agrega otra plaga y pide foto y transitabilidad', 'Opsiphanes cassina' in lst and 'LV 3' in lst and 'con daño' in lst and 'foto' in falta and 'transitabilidad' in falta, (lst, falta))
    r = pg.evaluate("(()=>{const r=S.registros.find(x=>x.tipo==='monitoreo');return r?{hoja:r.hoja,m:r.muestreo,em:r.en_muestra,d:r.dano,t:r.transitabilidad,f:r.fotos.length,pl:r.plagas.map(x=>[x.plaga,x.lv,x.adulto,x.dano]),est:S.jornada.muestra[0].estado}:null})()")
    check('Palma guardada con hoja, dos plagas, estados, daño, foto y transitabilidad', r and r['hoja'] == 17 and r['m'] == '10x10' and r['em'] and r['d'] and r['t'] == 'Poco transitable' and r['f'] == 1
          and r['pl'] == [['OPS', 3, 1, True], ['HOR', 0, 2, False]] and r['est'] == 'registrada', r)
    g = pg.evaluate("(()=>{const j=S.jornada;const g=geoPlagas(j,S.registros.filter(r=>r.jornada_id===j.id),[],new Date().toISOString(),'x.zip');return {l:g.jornada.labor,n:g.jornada.palmas_registradas,d:g.jornada.con_dano,m:g.jornada.muestra.length,f:g.features.map(f=>f.properties.tipo)}})()")
    check('Archivo de sincronización de la jornada de plagas', g['l'] == 'plagas' and g['n'] == 1 and g['d'] == 1 and g['m'] == 9 and g['f'] == ['monitoreo'], g)
    # ---------------- Visor ----------------
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200])); vz.set_viewport_size({'width': 1400, 'height': 950})
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof pintarPlagasGer==='function'", timeout=30000); time.sleep(1)
    vz.evaluate("()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;SES={u:'admin1',nombre:'Admin',rol:'admin',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};}")
    vz.click('#btCoord'); vz.wait_for_timeout(300); vz.click('[data-gt=plagas]')
    vz.wait_for_function("GER.plg.datos&&GER.plg.datos.regs.length===2", timeout=10000); vz.wait_for_timeout(300)
    T = vz.inner_text('#gerPanel')
    check('Visor: pestaña Monitoreo de plagas con resumen por plaga y por lote', 'Palmas muestreadas' in T and 'Opsiphanes cassina' in T and 'Sibine fusca' in T and 'IT05' in T and 'IT06' in T and '50,0 %' in T, T[:300])
    vz.click('#plgMapa'); vz.wait_for_timeout(400)
    check('Visor: puntos de plagas en el mapa', vz.evaluate("!!GER.plg.capa&&!!document.querySelector('#chPlg')"))
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
