"""Límite de la plantación: admin cifra plantacion.enc → la app lo descifra → no deja iniciar jornada por fuera."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import sys, time, json, math
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

GJ = open(PLANTACION, encoding='utf-8').read()
anillo = json.loads(GJ)['features'][0]['geometry']['coordinates'][0][0]
def dentro_py(lat, lng):
    c = False
    for i in range(len(anillo)):
        xi, yi = anillo[i]; xj, yj = anillo[i - 1]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi) + xi: c = not c
    return c
# Punto interior: el promedio de vértices puede caer fuera; se busca en una rejilla
xs = [p[0] for p in anillo]; ys = [p[1] for p in anillo]
INTERIOR = next((y, x) for y in [min(ys) + (max(ys) - min(ys)) * k / 20 for k in range(5, 16)] for x in [min(xs) + (max(xs) - min(xs)) * k / 20 for k in range(5, 16)] if dentro_py(y, x))
# Punto justo afuera del borde (~4 m hacia afuera del vértice más al norte)
vn = max(anillo, key=lambda p: p[1]); BORDE = (vn[1] + 4 / 111320, vn[0])
LEJOS = (1.80, -78.79)  # casco urbano de Tumaco, por fuera de la plantación
print('interior', INTERIOR, 'borde', BORDE, dentro_py(*BORDE))

errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900})
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    # ---------- admin.html: cifrar el polígono ----------
    ad = ctx.new_page(); ad.on('pageerror', lambda e: errores.append('admin: ' + str(e)))
    ad.goto('http://127.0.0.1:8765/admin.html'); ad.wait_for_function("typeof cifrarPlantacion==='function'", timeout=20000)
    res = ad.evaluate("""async(gj)=>{const raw=crypto.getRandomValues(new Uint8Array(32));const dk=await llaveDatos(raw);
      const f=new File([gj],'plantacion.geojson',{type:'application/geo+json'});const r=await cifrarPlantacion(dk,f);
      const cabe=new TextDecoder().decode(r.bytes.slice(0,4));
      const plano=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:r.bytes.slice(4,16)},dk,r.bytes.slice(16)));
      let err='';try{await cifrarPlantacion(dk,new File(['{"type":"FeatureCollection","features":[]}'],'x.geojson'));}catch(e){err=e.message;}
      return {cabe,n:JSON.parse(plano).features.length,raw:Array.from(raw),enc:Array.from(r.bytes),err};}""", GJ)
    check('Admin genera plantacion.enc (SPC1, AES-GCM) descifrable', res['cabe'] == 'SPC1' and res['n'] == 1, len(res['enc']))
    check('Admin rechaza un archivo sin polígonos', 'no contiene polígonos' in res['err'], res['err'])
    check('Admin muestra la sección del límite', ad.evaluate("!!document.querySelector('#ePlant')"))
    ENC = bytes(res['enc'])
    # ---------- app: descifrar y restringir ----------
    ctx.route('**/datos/plantacion.enc', lambda r: r.fulfill(status=200, body=ENC, content_type='application/octet-stream'))
    pg = ctx.new_page(); dichos = []
    pg.on('pageerror', lambda e: errores.append('app: ' + str(e) + ' ' + (e.stack or '')[:200]))
    pg.on('dialog', lambda d: d.dismiss())
    pg.add_init_script("window.__dichos=[];Object.defineProperty(window,'speechSynthesis',{value:{speak(u){window.__dichos.push(u.text);setTimeout(()=>u.onend&&u.onend(),10);},cancel(){},getVoices(){return [];}},configurable:true});")
    pg.goto('http://127.0.0.1:8765/index.html')
    pg.wait_for_function("typeof S!=='undefined'&&typeof cargarPlantacion==='function'", timeout=30000); time.sleep(2)
    cargo = pg.evaluate("""async(raw)=>{document.querySelector('#login').hidden=true;
      const dk=await crypto.subtle.importKey('raw',new Uint8Array(raw),{name:'AES-GCM'},false,['decrypt']);
      SES={u:'op1',nombre:'Operario Uno',rol:'operario',dk};ACCESO={...(ACCESO||{}),plantacion:{archivo:'plantacion.enc',version:'prueba'}};
      const r=await cargarPlantacion();return {r,n:S.plantacion&&S.plantacion.features.length,capa:!!capaPlantacion};}""", res['raw'])
    check('La app descarga, descifra y dibuja el límite', cargo['r'] and cargo['n'] == 1 and cargo['capa'], cargo)
    def intentar(punto, acc=5):
        pg.evaluate("cerrarHoja()")
        if punto is None: pg.evaluate("S.gps=null")
        else: pg.evaluate(f"S.gps={{lat:{punto[0]},lng:{punto[1]},acc:{acc},t:Date.now()}}")
        pg.evaluate("document.querySelector('#btJornada').click()"); time.sleep(0.5)
        bloq = pg.evaluate("!document.querySelector('#hoja').classList.contains('oculto')&&document.querySelector('#hojaTitulo').textContent==='No se puede iniciar la jornada'")
        return ('No se puede iniciar la jornada' if bloq else 'permitido · ' + str(pg.evaluate("motivoNoIniciar()"))), (pg.evaluate("document.querySelector('#hojaCuerpo').innerText") if bloq else '')
    t, c = intentar(LEJOS)
    check('Por fuera (Tumaco): no deja iniciar y explica', t == 'No se puede iniciar la jornada' and 'por fuera de la plantación' in c, c[:110])
    check('Lo dice por voz', any('por fuera de la plantación' in d for d in pg.evaluate("window.__dichos")))
    t, c = intentar(INTERIOR)
    check('Dentro: abre el inicio de jornada', t != 'No se puede iniciar la jornada', t)
    t, c = intentar(BORDE, acc=8)
    check('En el borde (4 m afuera, GPS ±8 m): se permite', t != 'No se puede iniciar la jornada', t)
    t, c = intentar(BORDE, acc=2)
    check('En el borde con GPS ±2 m (tolerancia mínima 5 m): se permite', t != 'No se puede iniciar la jornada', t)
    t, c = intentar(None)
    check('Sin GPS: pide esperar la señal', t == 'No se puede iniciar la jornada' and 'Esperando señal GPS' in c, c[:80])
    # Guardas finales (si se movió después de abrir el planificador)
    pg.evaluate(f"S.gps={{lat:{LEJOS[0]},lng:{LEJOS[1]},acc:5,t:Date.now()}}")
    g = pg.evaluate("""async()=>{await iniciarJornada([{lote:'IT01'}],'Operario Uno');const a=!!S.jornada;await iniciarCirugia('cirujano',{cirujano:{u:'a',nombre:'A'},auxiliar:{u:'b',nombre:'B'}},null,'2026-11-14');return {censo:a,cir:!!S.jornada};}""")
    check('iniciarJornada / iniciarCirugia no crean jornada por fuera', not g['censo'] and not g['cir'], g)
    # Sin polígono cargado: no hay restricción
    pg.evaluate("S.plantacion=null"); t, c = intentar(LEJOS)
    check('Sin polígono cargado: no restringe', t != 'No se puede iniciar la jornada', t)
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
