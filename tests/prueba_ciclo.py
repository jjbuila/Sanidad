"""Ciclo de censo aprobado (censo/programacion/ciclo.json): el visor asigna un operario a cada bloque del día y envía el plan
con lotes y calles; la App muestra «Su bloque de hoy» y lo selecciona con su rango de líneas. GitHub simulado, datos ficticios."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, json, re, base64
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
HOY = datetime.now().strftime('%Y-%m-%d')
def tr(l, d, h, p, calc=False): return {'lote': l, 'desde': None if calc else d, 'hasta': None if calc else h, 'lineas_calculadas': calc, 'palmas': p}
CICLO = {'formato': 'sanidad-ciclo-censo-1', 'aprobado': '2026-11-14', 'version': 'v1',
         'reglas': {'palmas_persona': 2070, 'ha_persona': 18, 'personas_dia': 2, 'conteo': 'palmas existentes (1) y no existentes (0)', 'calles_completas': True, 'bloque_continuo': True, 'inicio': 'IT', 'orden_programas': ['IT']},
         'dias': [{'dia': 1, 'programas': ['IT'], 'palmas': 4200, 'ha': 36.5, 'lotes': ['IT01'], 'personas': [
                      {'persona': 1, 'palmas': 2100, 'ha': 18.3, 'detalle': 'IT01 (L1-L50, 2.100 palmas)', 'tramos': [tr('IT01', 1, 50, 2100)]},
                      {'persona': 2, 'palmas': 2100, 'ha': 18.3, 'detalle': 'IT01 (L51-L100, 2.100 palmas)', 'tramos': [tr('IT01', 51, 100, 2100)]}]},
                  {'dia': 2, 'programas': ['IT', 'RI'], 'palmas': 4300, 'ha': 37.4, 'lotes': ['IT05', 'RI03'], 'personas': [
                      {'persona': 1, 'palmas': 2150, 'ha': 18.7, 'detalle': 'IT05 (L1-L40, 1.600 palmas) + IT06 (L1-L12, 550 palmas)', 'tramos': [tr('IT05', 1, 40, 1600), tr('IT06', 1, 12, 550)]},
                      {'persona': 2, 'palmas': 2150, 'ha': 18.7, 'detalle': 'RI03 (Lc1-Lc30, 2.150 palmas)', 'tramos': [tr('RI03', None, None, 2150, True)]}]}]}
PLAN_ANT = {'fecha': '2026-11-13', 'ciclo_dia': 1, 'asignaciones': [{'usuario': 'op2', 'persona': 1}, {'usuario': 'op1', 'persona': 2}]}
EST = {'plan': None}
def gh(route):
    req = route.request; u = req.url; m = req.method
    if '/contents/censo/programacion/ciclo.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(CICLO))
    if re.search(r'/contents/censo/plan\?', u): return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'file', 'name': '2026-11-13.json'}]))
    if '/contents/censo/plan/2026-11-13.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(PLAN_ANT))
    if '/contents/censo/plan/' in u and m == 'PUT':
        EST['plan'] = json.loads(base64.b64decode(json.loads(req.post_data)['content']).decode('utf-8'))
        return route.fulfill(status=201, content_type='application/json', body=json.dumps({'content': {'sha': 'x'}}))
    if f'/contents/censo/plan/{HOY}.json' in u and EST['plan']: return route.fulfill(status=200, content_type='application/json', body=json.dumps(EST['plan']))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1400, 'height': 950})
    ctx.route('https://api.github.com/**', gh)
    # ---------------- Visor ----------------
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof pintarCiclo==='function'", timeout=30000); vz.wait_for_timeout(800)
    vz.evaluate("""()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;window.chunkLote=async()=>[];
      SES={u:'admin1',nombre:'Admin',rol:'admin',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
      window.cirUsuarios=async()=>[{u:'op1',nombre:'PEDRO PEREZ',rol:'operario',labores:['censo']},{u:'op2',nombre:'MARIA LOPEZ',rol:'operario',labores:['censo']},{u:'op3',nombre:'JUAN RUIZ',rol:'operario',labores:['censo']}];}""")
    vz.evaluate("document.querySelector('#btGer').click()"); vz.wait_for_timeout(300); vz.click('[data-gt=plan]')
    vz.wait_for_function("GER.cic.c&&GER.plan.ops", timeout=10000); vz.wait_for_timeout(300)
    T = vz.inner_text('#gerPanel')
    check('Visor: muestra el ciclo aprobado y sigue con el día 2 (el último plan fue el día 1)', 'CICLO DE CENSO APROBADO' in T.upper() and vz.input_value('#cDia') == '2' and 'Último plan enviado: día 1' in T, re.sub(r'\s+', ' ', T)[:200])
    check('Visor: conserva el operario de cada bloque del día anterior', vz.input_value('[data-cp="1"]') == 'op2' and vz.input_value('[data-cp="2"]') == 'op1')
    vz.select_option('[data-cp="2"]', 'op2'); vz.wait_for_timeout(200)
    check('Visor: avisa si un operario queda en dos bloques', 'repetido' in vz.inner_text('#gerPanel'))
    vz.click('#cGuardar'); vz.wait_for_timeout(400)
    check('Visor: no envía con operarios repetidos', EST['plan'] is None)
    vz.select_option('[data-cp="2"]', 'op3'); vz.fill('#cFecha', HOY); vz.dispatch_event('#cFecha', 'change'); vz.click('#cGuardar')
    for _ in range(30):
        if EST['plan']: break
        vz.wait_for_timeout(200)
    P = EST['plan'] or {}; a = {x['persona']: x for x in P.get('asignaciones', [])}
    check('Visor: envía el plan del día con bloque, lotes y calles', P.get('ciclo_dia') == 2 and P.get('fecha') == HOY and a[1]['usuario'] == 'op2' and a[1]['bloque'] == 'D2·P1'
          and a[1]['lotes'][0] == {'lote': 'IT05', 'ha': 13.9, 'palmas': 1600, 'desde': 1, 'hasta': 40, 'lineas_calculadas': False} and a[2]['usuario'] == 'op3' and a[2]['lotes'][0]['lineas_calculadas'], P)
    # ---------------- App ----------------
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof bannerPlan==='function'", timeout=30000); pg.wait_for_timeout(1500)
    r = pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'op2',nombre:'MARIA LOPEZ',rol:'operario'};S.cfg.gh={...S.cfg.gh,token:'tok',owner:'jjbuila',repo:'SanidadData',rama:'main'};
      await cargarPlanCenso();abrirHoja('Planificar jornada','<div id="plLista"></div>');
      CARTO.lotes={IT05:{linea_min:1,linea_max:80},IT06:{linea_min:1,linea_max:30}};S.plan=[];window.dibujarLotes=()=>{};window.pintarPlanLista=()=>{};window.pintarPlanSel=()=>{};
      bannerPlan();const t=document.querySelector('#plAsig').innerText;document.querySelector('#plUsar').click();return {t,plan:S.plan};}""")
    check('App: «Su bloque de hoy» con lotes y calles', 'D2·P1' in r['t'] and 'IT05 L1–L40' in r['t'] and 'IT06 L1–L12' in r['t'], r['t'])
    check('App: «Usar mi bloque» deja solo las calles del bloque', sorted((x['lote'], x['desde'], x['hasta']) for x in r['plan']) == [('IT05', 1, 40), ('IT06', 1, 12)], r['plan'])
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
