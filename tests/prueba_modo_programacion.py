"""Interruptor «Libre / Según programación» de Coordinación (config/modo_programacion.json) y su efecto en la App:
censo y monitoreo de plagas. GitHub simulado, datos ficticios."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, json, base64
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
HOY = datetime.now().strftime('%Y-%m-%d')
EST = {'modo': None, 'puts': 0}
PLAN_CENSO = {'formato': 'sanidad-plan-censo-2', 'fecha': HOY, 'asignaciones': [{'usuario': 'op1', 'nombre': 'PEDRO PEREZ', 'bloque': 'D1·P1', 'tipo': 'titular',
              'lotes': [{'lote': 'IT05', 'desde': 1, 'hasta': 10, 'palmas': 300, 'ha': 2.6}]}]}
PLAN_PLG = {'formato': 'sanidad-plan-plagas-1', 'fecha': HOY, 'asignaciones': [{'usuario': 'p1', 'nombre': 'MONITOR UNO', 'unidad': 'D01_02-P1-1', 'dia': 1, 'posicion': 1, 'tipo': 'titular', 'palmas': 300, 'ha': 2.6, 'muestreo': '10x10',
            'lotes': [{'lote': 'IT05', 'palmas': 300, 'rangos': [[1, 300]]}]}]}
def gh(route):
    u = route.request.url; req = route.request; raw = 'raw' in (req.headers.get('accept') or '')
    if 'config/modo_programacion.json' in u:
        if req.method == 'PUT':
            EST['modo'] = json.loads(base64.b64decode(json.loads(req.post_data)['content']).decode('utf-8')); EST['puts'] += 1
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': {'sha': 's%d' % EST['puts']}}))
        if EST['modo'] is None: return route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
        if raw: return route.fulfill(status=200, content_type='application/json', body=json.dumps(EST['modo']))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': 's', 'content': base64.b64encode(json.dumps(EST['modo']).encode()).decode()}))
    if f'/contents/censo/plan/{HOY}.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(PLAN_CENSO))
    if f'/contents/plagas/plan/{HOY}.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(PLAN_PLG))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1400, 'height': 950})
    ctx.route('https://api.github.com/**', gh)
    # ---------------- Visor: interruptor en Coordinación ----------------
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200])); vz.on('dialog', lambda d: d.accept())
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof tarjetaModoProg==='function'", timeout=30000); vz.wait_for_timeout(800)
    vz.evaluate("()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;SES={u:'coord1',nombre:'COORDINADORA',rol:'supervisor',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};window.cirUsuarios=async()=>[];}")
    vz.click('#btCoord'); vz.wait_for_timeout(300); vz.click('[data-gt=plan]')
    vz.wait_for_selector('[data-mprog=censo]', timeout=10000)
    t0 = vz.inner_text('#mprog_censo')
    check('Visor: Coordinación muestra el interruptor del censo (sin archivo = libre)', 'LIBRE' in t0.upper() and 'Activar programación' in t0, t0[:120])
    vz.click('[data-mprog=censo]')
    vz.wait_for_function("document.querySelector('[data-mprog-estado=censo]')&&document.querySelector('[data-mprog-estado=censo]').innerText.toUpperCase().includes('SEGÚN')", timeout=10000)
    M = EST['modo'] or {}
    check('Visor: activar guarda config/modo_programacion.json con quién y cuándo', M.get('censo', {}).get('modo') == 'programado' and M['censo'].get('por') == 'coord1' and M.get('historial', [{}])[0].get('labor') == 'censo' and 'plagas' not in M, M)
    t1 = vz.inner_text('#mprog_censo')
    check('Visor: muestra «Según programación», el botón «Dejar libre» y el último cambio', 'Dejar libre' in t1 and 'COORDINADORA' in t1, t1[:200])
    vz.click('[data-gt=plagas]'); vz.wait_for_selector('[data-mprog=plagas]', timeout=10000)
    check('Visor: el interruptor de plagas es independiente (sigue libre)', 'LIBRE' in vz.inner_text('#mprog_plagas').upper())
    vz.click('[data-mprog=plagas]')
    vz.wait_for_function("document.querySelector('[data-mprog-estado=plagas]')&&document.querySelector('[data-mprog-estado=plagas]').innerText.toUpperCase().includes('SEGÚN')", timeout=10000)
    M = EST['modo']
    check('Visor: activar plagas conserva el censo y suma al historial', M['plagas']['modo'] == 'programado' and M['censo']['modo'] == 'programado' and len(M['historial']) == 2, M)
    # ---------------- App: censo ----------------
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.accept())
    pg.set_viewport_size({'width': 412, 'height': 900})
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof abrirPlanificador==='function'&&typeof abrirInicioPlg==='function'", timeout=30000); pg.wait_for_timeout(1500)
    pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;S.cfg.gh={...S.cfg.gh,token:'tok',owner:'jjbuila',repo:'SanidadData',rama:'main'};
      const pol=(x)=>({type:'Polygon',coordinates:[[[x,1.5],[x+.01,1.5],[x+.01,1.51],[x,1.5]]]});
      S.lotes={type:'FeatureCollection',features:[{type:'Feature',properties:{_lote:'IT05',Programa:'IT'},geometry:pol(-78.7)},{type:'Feature',properties:{_lote:'IT06',Programa:'IT'},geometry:pol(-78.68)}]};
      CARTO.lotes={IT05:{n:750,linea_min:1,linea_max:25},IT06:{n:300,linea_min:1,linea_max:30}};
      const d=[];let id=1;for(let l=1;l<=25;l++)for(let q=1;q<=30;q++)d.push([id++,l,q,1,-78.70+l*1e-4,1.50+q*1e-4]);await dbPut('palmas_lote',{lote:'IT05',d});
      window.dibujarLotes=()=>{};window.contarItem=async()=>1;}""")
    estado = """()=>({plan:S.plan.map(x=>[x.lote,x.desde,x.hasta]),aviso:!!document.querySelector('#plProgAviso'),usar:!!document.querySelector('#plUsar'),
      lista:[...document.querySelectorAll('#plLista [data-l]')].map(i=>i.dataset.l),ro:[...document.querySelectorAll('#plSel input')].every(i=>i.readOnly),sin:!!document.querySelector('#plSinBloque')})"""
    pg.evaluate("SES={u:'op1',nombre:'PEDRO PEREZ',rol:'operario',labores:['censo']};S.plan=[];abrirPlanificador('nueva')"); pg.wait_for_selector('#plOk', timeout=10000); pg.wait_for_timeout(500)
    e = pg.evaluate(estado)
    check('App censo programado: su bloque queda seleccionado con sus líneas', e['plan'] == [['IT05', 1, 10]] and e['aviso'] and not e['usar'], e)
    check('App censo programado: solo ve los lotes del bloque y no puede cambiar las líneas', e['lista'] == ['IT05'] and e['ro'], e)
    pg.evaluate("alternarPlan('IT06')"); pg.wait_for_timeout(200)
    check('App censo programado: no deja agregar otro lote', pg.evaluate("S.plan.map(x=>x.lote)") == ['IT05'])
    pg.evaluate("S.plan[0].hasta=25;window.iniciarJornada=async(sel)=>{window._sel=sel;};"); pg.evaluate("confirmarPlan()"); pg.wait_for_timeout(400)
    check('App censo programado: al iniciar se respetan las líneas del bloque', pg.evaluate("window._sel&&window._sel.map(x=>[x.lote,x.desde,x.hasta])") == [['IT05', 1, 10]], pg.evaluate("window._sel"))
    pg.evaluate("SES={u:'op9',nombre:'SIN BLOQUE',rol:'operario',labores:['censo']};S.plan=[];abrirPlanificador('nueva')"); pg.wait_for_timeout(1200)
    check('App censo programado: sin bloque asignado no deja iniciar', pg.evaluate("!!document.querySelector('#plSinBloque')&&!document.querySelector('#plOk')"))
    pg.evaluate("cerrarHoja()")
    EST['modo']['censo']['modo'] = 'libre'
    pg.evaluate("SES={u:'op1',nombre:'PEDRO PEREZ',rol:'operario',labores:['censo']};S.plan=[];abrirPlanificador('nueva')"); pg.wait_for_selector('#plUsar', timeout=10000); pg.wait_for_timeout(300)
    e = pg.evaluate(estado)
    check('App censo libre: elige cualquier lote y el bloque es solo sugerencia', e['plan'] == [] and not e['aviso'] and e['usar'] and e['lista'] == ['IT05', 'IT06'], e)
    pg.evaluate("alternarPlan('IT06')"); pg.wait_for_timeout(200)
    check('App censo libre: agrega otro lote', pg.evaluate("S.plan.map(x=>x.lote)") == ['IT06'])
    pg.evaluate("cerrarHoja()")
    # ---------------- App: monitoreo de plagas ----------------
    pg.evaluate("SES={u:'p1',nombre:'MONITOR UNO',rol:'operario',labores:['plagas']};PLG.sel=[];abrirInicioPlg()")
    pg.wait_for_function("document.querySelector('#plgProgAviso')&&document.querySelector('#plgProgAviso').innerText.includes('D01_02-P1-1')", timeout=10000); pg.wait_for_timeout(600)
    e = pg.evaluate("({sel:PLG.sel.map(x=>[x.lote,x.unidad]),qp:!!document.querySelector('[data-qp]'),usar:!!document.querySelector('#plgUsar'),lote:getComputedStyle(document.querySelector('#plgLote').parentElement).display,txt:document.querySelector('#plgSel').innerText})")
    check('App plagas programado: su unidad queda seleccionada y no se pueden agregar ni quitar lotes', e['sel'] == [['IT05', 'D01_02-P1-1']] and not e['qp'] and not e['usar'] and e['lote'] == 'none' and '3 palmas en la muestra' in e['txt'], e)
    pg.evaluate("cerrarHoja()")
    pg.evaluate("SES={u:'p9',nombre:'SIN UNIDAD',rol:'operario',labores:['plagas']};PLG.sel=[];abrirInicioPlg()")
    pg.wait_for_function("document.querySelector('#plgProgAviso')&&document.querySelector('#plgProgAviso').innerText.includes('No tiene bloque')", timeout=10000)
    check('App plagas programado: sin unidad asignada no deja iniciar', pg.evaluate("document.querySelector('#plgIni').disabled"))
    pg.evaluate("cerrarHoja()")
    EST['modo']['plagas']['modo'] = 'libre'
    pg.evaluate("SES={u:'p1',nombre:'MONITOR UNO',rol:'operario',labores:['plagas']};PLG.sel=[];abrirInicioPlg()"); pg.wait_for_selector('#plgUsar', timeout=10000)
    check('App plagas libre: puede escribir lotes y el bloque es sugerencia', pg.evaluate("!document.querySelector('#plgProgAviso')&&getComputedStyle(document.querySelector('#plgLote').parentElement).display==='flex'"))
    pg.evaluate("cerrarHoja()")
    # Sin señal: usa la última copia descargada
    EST['modo']['plagas']['modo'] = 'programado'
    pg.evaluate("cargarModoProgApp()"); pg.wait_for_timeout(500)
    ctx.set_offline(True)
    r = pg.evaluate("async()=>{MPROG_APP.c=null;await cargarModoProgApp();return progActiva('plagas')}")
    ctx.set_offline(False)
    check('App sin señal: usa el último modo descargado', r is True, r)
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
