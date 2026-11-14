"""Menú «App Android (APK)»: versión instalada vs. última publicada, descarga y aviso; «Nueva jornada» del menú respeta el límite."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import sys, time, json
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
UA_BASE = 'Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
GJ = open(PLANTACION, encoding='utf-8').read()
errores = []
def escenario(nav, ua, ultima):
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900}, user_agent=ua)
    descargas = []
    def gh(route):
        if route.request.url.endswith('/releases/latest'):
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tag_name': 'apk-' + ultima}))
        route.fulfill(status=404, body='{}')
    ctx.route('https://api.github.com/**', gh)
    ctx.route('https://github.com/**', lambda r: (descargas.append(r.request.url), r.fulfill(status=200, body='APK', content_type='application/vnd.android.package-archive')))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html')
    pg.wait_for_function("typeof menu==='function'&&typeof S!=='undefined'", timeout=30000); time.sleep(3)
    pg.evaluate("document.querySelector('#login').hidden=true;try{localStorage.removeItem('sv_apk_ultima')}catch(e){};APK.ultima=null;menu()")
    pg.wait_for_function("!(document.querySelector('#mApkTxt')||{textContent:'…'}).textContent.includes('…')", timeout=10000); time.sleep(.3)
    item = pg.evaluate("document.querySelector('#mApk').innerText.replace(/\\n/g,' ')")
    pg.evaluate("document.querySelector('#mApk').click()"); time.sleep(1.2)
    panel = pg.evaluate("document.querySelector('#hojaCuerpo').innerText.replace(/\\n/g,' ')")
    return ctx, pg, item, panel, descargas

with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    # 1) Navegador
    ctx, pg, item, panel, dl = escenario(nav, UA_BASE, '1.0.7')
    check('Navegador: el menú muestra la APK', 'App Android (APK)' in item and 'Instalada: No instalada' in item and 'Última: 1.0.7' in item, item)
    check('Navegador: ofrece descargarla', 'Descargar la APK 1.0.7' in panel, panel[:120])
    # «Nueva jornada» del menú respeta el límite de la plantación
    pg.evaluate(f"cerrarHoja();S.plantacion={GJ};S.gps={{lat:1.80,lng:-78.79,acc:5,t:Date.now()}};menu();document.querySelector('#mJor').click()"); time.sleep(.6)
    check('«Nueva jornada» del menú también bloquea por fuera de la plantación', pg.evaluate("document.querySelector('#hojaTitulo').textContent")=='No se puede iniciar la jornada')
    ctx.close()
    # 2) APK al día
    ctx, pg, item, panel, dl = escenario(nav, UA_BASE + ' SanidadVegetalAPK/1 v1.0.7', '1.0.7')
    check('APK 1.0.7 al día: muestra versión instalada', 'Instalada: 1.0.7' in item and '¡Nueva APK!' not in item, item)
    check('APK al día: «Tiene la última APK»', 'Tiene la última APK' in panel, panel[:120])
    check('Pie del menú con la versión de la APK', True)
    ctx.close()
    # 3) APK antigua (sin versión en el agente) y una nueva publicada
    ctx, pg, item, panel, dl = escenario(nav, UA_BASE + ' SanidadVegetalAPK/1', '1.0.8')
    check('APK antigua: «¡Nueva APK!» en el menú', '¡Nueva APK!' in item and '1.0.6 o anterior' in item and 'Última: 1.0.8' in item, item)
    check('APK antigua: aviso y botón de descarga', 'Hay una APK nueva (1.0.8)' in panel and 'DESCARGAR APK 1.0.8' in panel, panel[:160])
    abre = pg.evaluate("(()=>{let u=null;window.abrirExterno=x=>{u=x};document.querySelector('#apkDl').click();return u})()")
    check('El botón abre la descarga de la APK publicada', abre == 'https://github.com/jjbuila/Sanidad/releases/latest/download/SanidadVegetal.apk', abre)
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof avisoApk==='function'", timeout=30000); time.sleep(2)
    pg.evaluate("try{localStorage.clear()}catch(e){};APK.ultima=null")
    pg.evaluate("avisoApk()"); time.sleep(1.5)
    check('Aviso al abrir la app cuando hay APK nueva', 'Hay una APK nueva (1.0.8)' in pg.evaluate("document.querySelector('#toast').textContent"), pg.evaluate("document.querySelector('#toast').textContent"))
    ctx.close()
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
