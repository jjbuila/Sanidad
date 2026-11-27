"""Hora real: todo se registra con la fecha y hora del GPS (APK) o del servidor, no con la del celular;
alerta fija cuando el celular está desfasado más de 10 minutos."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, time
from email.utils import formatdate
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

STUB = """
window.__off=25*60000;
const L=n=>(...a)=>Promise.resolve({});
window.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>false,Plugins:{
  Energia:{estado:async()=>({sinRestriccion:true,fabricante:'samsung',modelo:'X',android:34,activo:true}),solicitarSinRestriccion:L(),abrirInicioAutomatico:L(),abrirAhorroBateria:L(),abrirAjustesApp:L(),mantenerActivo:L()},
  Recorrido:{iniciar:async()=>({}),detener:async()=>{},configurar:async()=>{},estado:async()=>({ubicacion:true,ubicacionFondo:true,alarmasExactas:true}),
    addListener:async()=>({remove:async()=>{}}),puntos:async()=>({puntos:[],mas:false}),eventos:async()=>({eventos:[]}),
    reloj:async()=>({ok:true,off:window.__off,gps:Date.now()+window.__off})},
  Jornada:{iniciar:async()=>({}),terminar:async()=>{},ahorro:async()=>{},estado:async()=>({}),addListener:async()=>({remove:async()=>{}})},
  BackgroundGeolocation:new Proxy({},{get:(o,k)=>k==='then'?undefined:L()}),
  LocalNotifications:new Proxy({checkPermissions:async()=>({display:'granted'})},{get:(o,k)=>k in o?o[k]:k==='then'?undefined:L()}),
  TextToSpeech:new Proxy({},{get:(o,k)=>k==='then'?undefined:L()})}};
"""
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    # ---- APK: hora del GPS ----
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900},
                          user_agent='Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile SanidadVegetalAPK/1 v1.0.12')
    ctx.add_init_script(STUB)
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200]))
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof relojAjustar==='function'", timeout=30000)
    pg.wait_for_function("RELOJ.cal===true", timeout=15000)
    d = pg.evaluate("(Date.now()-RELOJ.dev())/60000")
    check('Con la APK toma la hora del GPS (celular atrasado 25 min)', abs(d - 25) < 0.1 and pg.evaluate("RELOJ.fuente") == 'gps', d)
    check('new Date() da la hora real', abs((pg.evaluate("new Date().getTime()-RELOJ.dev()")) / 60000 - 25) < 0.1)
    av = pg.evaluate("(()=>{const b=document.querySelector('#relojAviso');return b&&!b.hidden?b.innerText:''})()")
    check('Alerta fija: fecha u hora incorrecta, atrasada 25 min, con la hora real', 'incorrecta' in av and 'atrasada' in av and '25 min' in av and 'automáticas' in av, av[:120])
    check('La alerta dice que puede seguir trabajando con la fecha y hora del GPS', 'seguir trabajando' in av and 'fecha y hora del GPS' in av, av[:220])
    pg.evaluate("document.querySelector('#relojAviso').click()")
    mini = pg.evaluate("(()=>{const b=document.querySelector('#relojAviso');const r=b.getBoundingClientRect();return {t:b.innerText,h:r.height,w:r.width,vis:!b.hidden};})()")
    check('Queda como indicador pequeño con la fecha y hora del GPS, sin tapar la labor', mini['vis'] and mini['t'].startswith('⚠ GPS ') and '+25 min' in mini['t'] and mini['h'] < 40 and mini['w'] < 240, mini)
    pg.evaluate("document.querySelector('#relojAviso').click()")
    check('Tocándolo se ve completa otra vez', 'incorrecta' in pg.evaluate("document.querySelector('#relojAviso').innerText"))
    pg.evaluate("document.querySelector('#relojAviso').dataset.min='1';pintarAvisoReloj()")
    # jornada: inicio con la hora real y desfase en el reporte
    pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'sa',nombre:'Super Prueba',rol:'superadmin'};await iniciarJornada([{lote:'IT01'}],'Super Prueba');}"""); time.sleep(.8)
    di = pg.evaluate("(Date.parse(S.jornada.inicio)-RELOJ.dev())/60000")
    check('La jornada inicia con la hora real (no la del celular)', abs(di - 25) < 0.5, di)
    pg.evaluate("relojAjustar(25*60000,'gps')")
    t0 = pg.evaluate("Date.now()")
    pg.evaluate(f"registrarPunto({{lat:1.55,lng:-78.8,acc:3,t:{t0},nat:1}})")
    check('El punto del recorrido queda con la hora del GPS', pg.evaluate("TRACK.ultimo&&TRACK.ultimo.t") == t0)
    check('Diagnóstico: la fecha de registro es la real', abs(pg.evaluate("(Date.parse(new Date().toISOString())-RELOJ.dev())/60000") - 25) < 0.1)
    h = pg.evaluate("async()=>{const j=S.jornada;return geoJornada(j,[],[],new Date().toISOString(),null).jornada;}")
    check('Reporte de la jornada: desfase del reloj y fuente', h.get('reloj_desfase_min') == 25 and h.get('reloj_fuente') == 'gps', (h.get('reloj_desfase_min'), h.get('reloj_fuente')))
    # Jornada iniciada antes de conocer la hora real: el inicio se corrige
    pg.evaluate("async()=>{relojAjustar(0,'gps');await finalizarJornada('volumen');}"); time.sleep(.8)
    pg.evaluate("cerrarHoja()")
    check('Con la hora correcta la alerta desaparece', pg.evaluate("document.querySelector('#relojAviso').hidden"))
    pg.evaluate("async()=>{RELOJ.off=0;RELOJ.fuente='';await iniciarJornada([{lote:'IT01'}],'Super Prueba');S.jornada.relojCal=false;}"); time.sleep(.6)
    i0 = pg.evaluate("Date.parse(S.jornada.inicio)")
    pg.evaluate("relojAjustar(-40*60000,'gps')")
    i1 = pg.evaluate("Date.parse(S.jornada.inicio)")
    check('Jornada iniciada antes de conocer la hora: el inicio se corrige', abs((i1 - i0) / 60000 + 40) < 0.1, (i1 - i0) / 60000)
    av = pg.evaluate("document.querySelector('#relojAviso').innerText")
    check('Celular adelantado 40 min: alerta «−40 min»', '40 min' in av and ('adelantada' in av or '−' in av), av[:90])
    pg.evaluate("relojAjustar(5*60000,'gps')")
    check('Desfase de 5 min: se corrige la hora pero sin alerta', pg.evaluate("document.querySelector('#relojAviso').hidden") and abs(pg.evaluate("(Date.now()-RELOJ.dev())/60000") - 5) < 0.1)
    check('La hora del servidor no reemplaza a la del GPS reciente', pg.evaluate("relojAjustar(3*3600000,'red'),(Date.now()-RELOJ.dev())/60000") < 6)
    # ---- Navegador (sin APK): hora del servidor ----
    ctx2 = nav.new_context(service_workers='block')
    ctx2.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    ctx2.route('**/version.json*', lambda r: r.fulfill(status=200, body='{"version":"x"}', headers={'Content-Type': 'application/json', 'Date': formatdate(time.time() + 2 * 3600, usegmt=True)}))
    pb = ctx2.new_page(); pb.on('pageerror', lambda e: errores.append('nav: ' + str(e)[:200]))
    pb.goto('http://127.0.0.1:8765/index.html'); pb.wait_for_function("typeof relojAjustar==='function'", timeout=30000)
    pb.wait_for_function("RELOJ.cal===true", timeout=15000)
    d2 = pb.evaluate("(Date.now()-RELOJ.dev())/60000")
    check('Sin APK: toma la hora del servidor (celular atrasado 2 h)', abs(d2 - 120) < 0.2 and pb.evaluate("RELOJ.fuente") == 'red', d2)
    tx = pb.evaluate("(()=>{const b=document.querySelector('#relojAviso');return b?b.innerText:'(sin alerta)';})()")
    check('Alerta «atrasada 2 h»', '2 h' in tx, tx[:150])
    # ---- Visor ----
    pv = ctx2.new_page(); pv.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    pv.goto('http://127.0.0.1:8765/visor.html'); pv.wait_for_function("typeof bloqueMarcacionJ==='function'", timeout=30000)
    t = pv.evaluate("bloqueMarcacionJ({header:{reloj_desfase_min:25,reloj_fuente:'gps'},diags:[]})")
    check('Visor: aviso del desfase del reloj en el detalle de la jornada', 'atrasada 25 min' in t and 'GPS' in t, t[:120])
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
