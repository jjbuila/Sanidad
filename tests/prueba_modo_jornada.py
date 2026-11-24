"""Modo jornada y modo ahorro (APK simulada con el complemento «Jornada»):
al iniciar la jornada se fija la App, se ocultan los botones que no son de la labor y el menú queda reducido; modo ahorro
automático a los 60 s sin tocar, con el botón «Ahorro» y al presionar el botón de encendido; se desbloquea con 2 s en el botón
o subiendo el volumen 2 s; una alerta de palma pendiente lo desbloquea; al finalizar todo vuelve a la normalidad."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

STUB = """
window.__jor={llam:[],cb:{},fijada:false};
window.__bat={level:.9,charging:false};navigator.getBattery=async()=>({get level(){return __bat.level},get charging(){return __bat.charging},addEventListener(){}});
const L=n=>(...a)=>Promise.resolve({abierto:true,display:'granted'});
const P=new Proxy({},{get:(o,k)=>k==='then'?undefined:L(String(k))});
window.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>false,Plugins:{
  Energia:{estado:async()=>({sinRestriccion:true,fabricante:'samsung',modelo:'SM-A135M',android:34,activo:true}),solicitarSinRestriccion:L(),abrirInicioAutomatico:L(),abrirAhorroBateria:L(),abrirAjustesApp:L(),mantenerActivo:L()},
  Recorrido:{iniciar:async()=>({}),detener:async()=>{},configurar:async()=>{},estado:async()=>({ubicacion:true,ubicacionFondo:true,alarmasExactas:true}),
    addListener:async()=>({remove:async()=>{}}),puntos:async()=>({puntos:[],mas:false}),eventos:async()=>({eventos:[]})},
  Jornada:{
    iniciar:async o=>{__jor.llam.push(['iniciar',o.fijar]);__jor.fijada=true;return {activa:true,fijada:true};},
    terminar:async()=>{__jor.llam.push(['terminar']);__jor.fijada=false;},
    ahorro:async o=>{__jor.llam.push(['ahorro',o.on]);},
    estado:async()=>({activa:true,fijada:__jor.fijada}),
    addListener:async(n,cb)=>{__jor.cb[n]=cb;return {remove:async()=>{}};}},
  BackgroundGeolocation:new Proxy({},{get:(o,k)=>k==='then'?undefined:L()}),
  LocalNotifications:new Proxy({checkPermissions:async()=>({display:'granted'})},{get:(o,k)=>k in o?o[k]:k==='then'?undefined:L()}),
  TextToSpeech:P}};
"""
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900},
                          user_agent='Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile SanidadVegetalAPK/1 v1.0.9')
    ctx.add_init_script(STUB)
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof modoJornada==='function'&&typeof S!=='undefined'", timeout=30000); time.sleep(2)
    pg.evaluate("document.querySelector('#login').hidden=true;SES={u:'op1',nombre:'Operario Uno',rol:'operario'}")
    vis = lambda sel: pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}');return !!e&&!e.hidden&&getComputedStyle(e).display!=='none';}})()")
    check('Sin jornada: «Datos» visible y «Ahorro» oculto', vis('#btBD') and not vis('#btAhorro'))
    pg.evaluate("async()=>{await iniciarJornada([{lote:'IT01'}],'Operario Uno');}"); time.sleep(1)
    check('Al iniciar la jornada se fija la App (Android)', ['iniciar', True] in pg.evaluate("__jor.llam") and pg.evaluate("document.body.classList.contains('en-jornada')"))
    check('Se oculta «Datos» y aparece «Ahorro»', not vis('#btBD') and vis('#btAhorro'))
    n1 = pg.evaluate("__jor.llam.filter(x=>x[0]==='iniciar').length")
    for _ in range(3):
        pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); time.sleep(.3)
    check('Volver a primer plano NO vuelve a pedir fijar la App (ciclo en Xiaomi)', pg.evaluate("__jor.llam.filter(x=>x[0]==='iniciar').length") == n1)
    pg.evaluate("async()=>{MJ.on=false;await modoJornada(true);}"); time.sleep(.5)
    check('Al reabrir la App con la jornada abierta no se pide fijar otra vez', pg.evaluate("__jor.llam.filter(x=>x[0]==='iniciar').slice(-1)[0]") == ['iniciar', False], pg.evaluate("__jor.llam.filter(x=>x[0]==='iniciar')"))
    pg.evaluate("menu()"); time.sleep(.4)
    ids = pg.evaluate("[...document.querySelectorAll('#hojaCuerpo .menu-grid .mosaico')].map(b=>b.id)")
    check('Menú reducido: solo la jornada en curso y la pantalla bloqueada', ids == ['mJor', 'mBg'], ids)
    pg.evaluate("cerrarHoja()"); time.sleep(.3)
    pg.evaluate("document.querySelector('#chSync').click()"); time.sleep(.3)
    check('No abre la sincronización durante la jornada', pg.evaluate("document.querySelector('#hoja').classList.contains('oculto')") and 'finalizar la jornada' in pg.evaluate("document.querySelector('#toast').textContent"))
    # Ahorro automático a los 60 s
    pg.evaluate("AH.t=Date.now()-50000"); time.sleep(5.5)
    check('No entra en ahorro antes de 60 s', not vis('#ahorro'))
    pg.evaluate("AH.t=Date.now()-61000"); time.sleep(5.5)
    check('Entra solo en ahorro a los 60 s sin tocar (brillo mínimo)', vis('#ahorro') and ['ahorro', True] in pg.evaluate("__jor.llam"))
    check('La pantalla de ahorro muestra el tiempo y los km', 'km' in pg.inner_text('#ahDatos'), pg.inner_text('#ahDatos'))
    # Toques cortos no desbloquean; mantener 2 s sí
    pg.evaluate("document.querySelector('#ahBt').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))"); time.sleep(.5)
    pg.evaluate("document.querySelector('#ahBt').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))"); time.sleep(.2)
    check('Un toque corto no desbloquea', vis('#ahorro'))
    pg.evaluate("document.querySelector('#ahBt').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))"); time.sleep(2.3)
    check('Mantener presionado 2 s desbloquea (brillo normal)', not vis('#ahorro') and pg.evaluate("__jor.llam.slice(-1)[0]") == ['ahorro', False])
    pg.evaluate("document.querySelector('#ahBt').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))")
    # Botón Ahorro y botón de encendido; volumen 2 s
    pg.evaluate("document.querySelector('#btAhorro').click()"); time.sleep(.3)
    check('El botón «Ahorro» lo activa', vis('#ahorro'))
    pg.evaluate("__jor.cb.desbloquear()"); time.sleep(.3)
    check('Subir volumen 2 s (APK) desbloquea', not vis('#ahorro'))
    pg.evaluate("__jor.cb.pantallaApagada()"); time.sleep(.3)
    check('Botón de encendido: la App vuelve en modo ahorro', vis('#ahorro'))
    pg.evaluate("avisarSaltadas([{l:'IT01',ln:3,p:7}])"); time.sleep(.3)
    check('Una alerta de palma pendiente desbloquea la pantalla', not vis('#ahorro'))
    # Con una hoja abierta no entra solo
    pg.evaluate("abrirHoja('Prueba','<p>x</p>');AH.t=Date.now()-120000"); time.sleep(5.5)
    check('Con un formulario u hoja abierta no entra solo en ahorro', not vis('#ahorro'))
    pg.evaluate("cerrarHoja()")
    # Finalizar: se libera todo
    jid = pg.evaluate("S.jornada.id"); pg.evaluate("__bat.level=.72")
    pg.evaluate("async()=>{await finalizarJornada();}"); time.sleep(1.2)
    bt = pg.evaluate(f"async()=>{{const j=await dbGet('jornadas','{jid}');const g=geoJornada(j,[],await puntosTrack(j.id),new Date().toISOString(),null);return {{b:j.bateria,h:[g.jornada.bateria_inicio_pct,g.jornada.bateria_fin_pct,g.jornada.bateria_consumo_pct]}};}}")
    check('Batería al inicio y al fin de la jornada (y en la jornada enviada)', bt['b'] and bt['b']['inicio']['nivel'] == 90 and bt['b']['fin']['nivel'] == 72 and bt['h'] == [90, 72, 18], bt)
    check('El resumen final muestra la batería', '90→72 %' in pg.evaluate("document.querySelector('#hojaCuerpo').innerText"))
    check('Al finalizar se libera la App y vuelve «Datos»', ['terminar'] in pg.evaluate("__jor.llam") and vis('#btBD') and not vis('#btAhorro') and not pg.evaluate("document.body.classList.contains('en-jornada')"))
    pg.evaluate("cerrarHoja();menu()"); time.sleep(.4)
    check('El menú completo vuelve después de la jornada', pg.evaluate("document.querySelectorAll('#hojaCuerpo .menu-grid .mosaico').length") > 6)
    pg.evaluate("cerrarHoja();AH.t=Date.now()-120000"); time.sleep(5.5)
    check('Sin jornada no entra en ahorro', not vis('#ahorro'))
    pg2 = ctx.new_page(); pg2.on('pageerror', lambda e: errores.append(str(e)[:200]))
    pg2.goto('http://127.0.0.1:8765/index.html'); pg2.wait_for_function("typeof modoJornada==='function'", timeout=30000)
    pg2.evaluate("S.cfg.jornadaActiva=null"); time.sleep(9.5)
    check('Al abrir sin jornada se libera el estado de una jornada anterior (App fijada)', ['terminar'] in pg2.evaluate("__jor.llam"))
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
