"""Ciclo de censo aprobado: asignación del personal por bloque (P). El visor propone a cada titular su siguiente bloque pendiente según el
avance real (palmas visitadas en las calles del bloque), permite dar un bloque adicional (apoyo/emergencia), marcar bloques terminados y
envía el plan; la App muestra «Sus bloques de hoy» y selecciona sus calles. GitHub simulado, datos ficticios."""
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
         'dias': [{'dia': 1, 'programas': ['IT'], 'palmas': 100, 'ha': 1, 'lotes': ['IT01'], 'personas': [
                      {'persona': 1, 'palmas': 50, 'ha': 0.4, 'detalle': 'IT01 (L1-L50)', 'tramos': [tr('IT01', 1, 50, 50)]},
                      {'persona': 2, 'palmas': 50, 'ha': 0.4, 'detalle': 'IT01 (L51-L100)', 'tramos': [tr('IT01', 51, 100, 50)]}]},
                  {'dia': 2, 'programas': ['IT', 'RI'], 'palmas': 4300, 'ha': 37.4, 'lotes': ['IT05', 'RI03'], 'personas': [
                      {'persona': 1, 'palmas': 2150, 'ha': 18.7, 'detalle': 'IT05 (L1-L40) + IT06 (L1-L12)', 'tramos': [tr('IT05', 1, 40, 1600), tr('IT06', 1, 12, 550)]},
                      {'persona': 2, 'palmas': 2150, 'ha': 18.7, 'detalle': 'RI03 (Lc1-Lc30)', 'tramos': [tr('RI03', None, None, 2150, True)]}]}]}
PLAN_ANT = {'fecha': '2026-11-13', 'ciclo_version': 'v1', 'ciclo_dia': 1, 'asignaciones': [{'usuario': 'op2', 'persona': 1, 'bloque': 'D1·P1'}, {'usuario': 'op1', 'persona': 2, 'bloque': 'D1·P2'}]}
EST = {'plan': None, 'asig': None, 'asig_puts': 0}
def b64(o): return base64.b64encode(json.dumps(o).encode('utf-8')).decode()
def gh(route):
    req = route.request; u = req.url; m = req.method
    if '/contents/censo/programacion/ciclo.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(CICLO))
    if '/contents/censo/programacion/asignacion.json' in u:
        if m == 'PUT':
            EST['asig'] = json.loads(base64.b64decode(json.loads(req.post_data)['content']).decode('utf-8')); EST['asig_puts'] += 1
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': {'sha': 's%d' % EST['asig_puts']}}))
        if EST['asig']: return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': 's0', 'content': b64(EST['asig'])}))
        return route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
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
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200])); vz.on('dialog', lambda d: d.accept())
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof pintarCiclo==='function'", timeout=30000); vz.wait_for_timeout(800)
    # IT01: L1–L100, una palma por línea (id = 'a'+línea). Jornada del 13-nov: L1–L50 completas (D1·P1 ejecutado) y L51–L75 (D1·P2 al 50 %).
    vz.evaluate("""()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;
      window.chunkLote=async l=>l==='IT01'?Array.from({length:100},(_,i)=>['a'+(i+1),i+1,1,1,0,0]):[];
      JOR=[{id:'j1',fecha:'2026-11-13',usuario:'op2',por_lote:[{lote:'IT01',ids_palmas_visitadas:Array.from({length:75},(_,i)=>'a'+(i+1))}]}];
      SES={u:'admin1',nombre:'Admin',rol:'admin',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
      window.cirUsuarios=async()=>[{u:'op1',nombre:'PEDRO PEREZ',rol:'operario',labores:['censo']},{u:'op2',nombre:'MARIA LOPEZ',rol:'operario',labores:['censo']},{u:'op3',nombre:'JUAN RUIZ',rol:'operario',labores:['censo']}];}""")
    EST['asig'] = {'formato': 'sanidad-asignacion-censo-1', 'ciclo_version': 'v1', 'vuelta': 1, 'inicio': '2026-11-13', 'titulares': {}, 'manual': {}}
    vz.evaluate("document.querySelector('#btGer').click()"); vz.wait_for_timeout(300); vz.click('[data-gt=plan]')
    vz.wait_for_function("GER.cic.av&&GER.plan.ops&&document.querySelector('[data-fu]')", timeout=15000); vz.wait_for_timeout(300)
    T = vz.inner_text('#gerPanel')
    check('Visor: titulares tomados del último plan (P1 María, P2 Pedro)', vz.input_value('[data-tit="1"]') == 'op2' and vz.input_value('[data-tit="2"]') == 'op1')
    av = vz.evaluate("({p1:estadoBloque('D1·P1'),p2:estadoBloque('D1·P2')})")
    check('Visor: avance real por bloque (D1·P1 ejecutado, D1·P2 al 50 %)', av['p1']['e'] == 'ejecutado' and av['p2']['e'] == 'curso' and round(av['p2']['p']) == 50, av)
    filas = vz.evaluate("GER.cic.dia.filas")
    check('Visor: cada titular sigue con su siguiente bloque (María D2·P1, Pedro continúa D1·P2)', filas == [{'usuario': 'op2', 'bloque': 'D2·P1'}, {'usuario': 'op1', 'bloque': 'D1·P2'}], filas)
    # Emergencia: María además hace D2·P2
    vz.click('#cAgregar'); vz.wait_for_timeout(200)
    check('Visor: «Agregar bloque» propone el siguiente pendiente sin asignar', vz.evaluate("GER.cic.dia.filas[2].bloque") == 'D2·P2')
    vz.select_option('[data-fu="2"]', 'op2'); vz.wait_for_timeout(200)
    T = vz.inner_text('#gerPanel')
    check('Visor: el bloque extra queda como apoyo y la titular con 2 bloques', 'apoyo' in T and 'titular · 2+ bloques' in T)
    vz.select_option('[data-fb="2"]', 'D2·P1'); vz.wait_for_timeout(200); vz.click('#cGuardar'); vz.wait_for_timeout(400)
    check('Visor: no envía un bloque repetido', EST['plan'] is None and 'repetido' in vz.inner_text('#gerPanel'))
    vz.select_option('[data-fb="2"]', 'D2·P2'); vz.fill('#cFecha', HOY); vz.dispatch_event('#cFecha', 'change'); vz.wait_for_timeout(300)
    vz.click('#cAgregar'); vz.wait_for_timeout(200); vz.select_option('[data-fu="2"]', 'op2'); vz.wait_for_timeout(200)
    vz.click('#cGuardar')
    for _ in range(30):
        if EST['plan']: break
        vz.wait_for_timeout(200)
    P = EST['plan'] or {}; A = P.get('asignaciones', [])
    mia = [a for a in A if a['usuario'] == 'op2']
    check('Visor: plan con 3 bloques, María con dos (titular + apoyo)', len(A) == 3 and sorted(a['bloque'] for a in mia) == ['D2·P1', 'D2·P2'] and {a['bloque']: a['tipo'] for a in mia} == {'D2·P1': 'titular', 'D2·P2': 'apoyo'}, A)
    check('Visor: el plan lleva días del ciclo, avance y calles', P.get('ciclo_dias') == [1, 2] and P.get('formato') == 'sanidad-plan-censo-2' and next(a for a in A if a['bloque'] == 'D1·P2')['avance_pct'] == 50
          and next(a for a in A if a['bloque'] == 'D2·P1')['lotes'][0] == {'lote': 'IT05', 'ha': 13.9, 'palmas': 1600, 'desde': 1, 'hasta': 40, 'lineas_calculadas': False}, P)
    # Marcar terminado a mano (clic en la grilla)
    vz.click('[data-cel="D1·P2"]'); vz.wait_for_timeout(600)
    check('Visor: marcar un bloque terminado queda guardado', EST['asig'] and EST['asig']['manual'].get('D1·P2', {}).get('estado') == 'terminado' and vz.evaluate("estadoBloque('D1·P2').e") == 'ejecutado', EST['asig'])
    vz.select_option('[data-tit="2"]', 'op3'); vz.click('#cTitGuardar'); vz.wait_for_timeout(500)
    check('Visor: guardar titulares', EST['asig']['titulares'].get('2') == 'op3' and EST['asig']['titulares'].get('1') == 'op2', EST['asig']['titulares'])
    # ---------------- App ----------------
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof bannerPlan==='function'", timeout=30000); pg.wait_for_timeout(1500)
    r = pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'op2',nombre:'MARIA LOPEZ',rol:'operario'};S.cfg.gh={...S.cfg.gh,token:'tok',owner:'jjbuila',repo:'SanidadData',rama:'main'};
      await cargarPlanCenso();abrirHoja('Planificar jornada','<div id="plLista"></div>');
      CARTO.lotes={IT05:{linea_min:1,linea_max:80},IT06:{linea_min:1,linea_max:30},RI03:{linea_min:0,linea_max:0}};S.plan=[];window.dibujarLotes=()=>{};window.pintarPlanLista=()=>{};window.pintarPlanSel=()=>{};
      bannerPlan();const t=document.querySelector('#plAsig').innerText;document.querySelector('#plUsar').click();return {t,plan:S.plan.map(x=>({lote:x.lote,desde:x.desde??null,hasta:x.hasta??null}))};}""")
    check('App: «Sus bloques de hoy» con los dos bloques', 'Sus bloques de hoy' in r['t'] and 'D2·P1' in r['t'] and 'D2·P2 (apoyo)' in r['t'] and 'IT05 L1–L40' in r['t'] and 'RI03' in r['t'], r['t'])
    check('App: «Usar mis bloques» selecciona las calles de ambos', sorted((x['lote'], x['desde'], x['hasta']) for x in r['plan'] if x['lote'] != 'RI03') == [('IT05', 1, 40), ('IT06', 1, 12)] and any(x['lote'] == 'RI03' for x in r['plan']), r['plan'])
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
