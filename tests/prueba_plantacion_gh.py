"""Límite leído desde el repositorio privado de datos (cartografia/plantacion.geojson) y su copia sin conexión."""
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
GJ = open(PLANTACION, encoding='utf-8').read()
estado = {'gh': True, 'pedidos': []}
def gh(route):
    u = route.request.url; estado['pedidos'].append(u)
    if 'contents/cartografia/plantacion.geojson' in u and estado['gh']:
        return route.fulfill(status=200, body=GJ, content_type='application/vnd.github.raw+json')
    route.fulfill(status=404, body='{}')
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900})
    ctx.route('https://api.github.com/**', gh)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e))); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof cargarPlantacion==='function'", timeout=30000); time.sleep(2)
    r = pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'op1',nombre:'Operario Uno',rol:'operario'};
      S.cfg.gh={...S.cfg.gh,token:'tok-prueba'};if(ACCESO)delete ACCESO.plantacion;
      const ok=await cargarPlantacion();return {ok,n:S.plantacion&&S.plantacion.features.length,capa:!!capaPlantacion};}""")
    check('Lee el límite desde el repositorio privado de datos', r['ok'] and r['n'] == 1 and r['capa'], r)
    check('Lo pide con el acceso de sincronización (repositorio de datos)', any('/contents/cartografia/plantacion.geojson' in u for u in estado['pedidos']), [u.split('/repos/')[-1][:70] for u in estado['pedidos']])
    pg.evaluate("S.gps={lat:1.80,lng:-78.79,acc:5,t:Date.now()};document.querySelector('#btJornada').click()"); time.sleep(.5)
    check('Por fuera: no deja iniciar', pg.evaluate("!document.querySelector('#hoja').classList.contains('oculto')&&document.querySelector('#hojaTitulo').textContent==='No se puede iniciar la jornada'"))
    estado['gh'] = False
    r2 = pg.evaluate("async()=>{cerrarHoja();S.plantacion=null;const ok=await cargarPlantacion();return {ok,n:S.plantacion&&S.plantacion.features.length};}")
    check('Sin acceso a GitHub usa la copia guardada en el celular', r2['ok'] and r2['n'] == 1, r2)
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
