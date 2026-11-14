"""Pantalla bloqueada: todas las opciones visibles siempre (APK simulada) y cada botón llama al plugin nativo correcto."""
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
def stub(fab, modelo, sin):
    return """window.__llamadas=[];const L=n=>(...a)=>{window.__llamadas.push(n);return Promise.resolve({abierto:true,display:'granted'});};
    const P=new Proxy({},{get:(o,k)=>k==='then'?undefined:L(String(k))});
    window.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>false,Plugins:{
      Energia:{estado:async()=>({sinRestriccion:%s,fabricante:'%s',modelo:'%s',android:33,activo:false}),solicitarSinRestriccion:L('bateria'),abrirInicioAutomatico:L('inicioAutomatico'),abrirAhorroBateria:L('ahorroBateria'),abrirAjustesApp:L('ajustesApp'),mantenerActivo:L('mantenerActivo')},
      BackgroundGeolocation:new Proxy({openSettings:L('ubicacionAjustes')},{get:(o,k)=>k in o?o[k]:k==='then'?undefined:L('bg.'+String(k))}),
      LocalNotifications:new Proxy({requestPermissions:L('notificaciones')},{get:(o,k)=>k in o?o[k]:k==='then'?undefined:L('ln.'+String(k))}),
      TextToSpeech:P}};""" % ('true' if sin else 'false', fab, modelo)
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    for fab, modelo, sin, esperado in [('samsung', 'SM-A135M', True, 6), ('Xiaomi', 'Redmi Note 12', False, 7)]:
        ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900}, user_agent='Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile SanidadVegetalAPK/1 v1.0.7')
        ctx.add_init_script(stub(fab, modelo, sin))
        ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:160])); pg.on('dialog', lambda d: d.dismiss())
        pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof revisarSegundoPlano==='function'", timeout=30000); time.sleep(2)
        pg.evaluate("document.querySelector('#login').hidden=true;menu();document.querySelector('#mBg').click()"); time.sleep(1)
        txt = pg.evaluate("document.querySelector('#hojaCuerpo').innerText")
        fichas = pg.evaluate("document.querySelectorAll('#hojaCuerpo .ficha').length")
        check(f'{fab}: aparecen todas las opciones ({esperado})', fichas == esperado, fichas)
        for t in ['Batería sin restricciones', 'Segundo plano e inicio automático', 'Ahorro de batería', 'Ubicación en segundo plano', 'Notificaciones', 'Todos los permisos']:
            if t not in txt: check(f'{fab}: falta «{t}»', False)
        check(f'{fab}: estado de la batería', ('✔ LISTO' if sin else 'PENDIENTE') in txt)
        pg.evaluate("window.__llamadas=[]")
        for b in ['sbBat', 'sbAuto', 'sbAhorro', 'sbUbic', 'sbNotif', 'sbApp']:
            pg.evaluate(f"document.querySelector('#{b}').click()"); time.sleep(.3)
        ll = pg.evaluate("window.__llamadas")
        check(f'{fab}: cada botón abre su ajuste nativo', all(x in ll for x in ['bateria', 'inicioAutomatico', 'ahorroBateria', 'ubicacionAjustes', 'notificaciones', 'ajustesApp']), ll)
        ctx.close()
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
