"""Pruebas de los cambios: sincronización solo de jornadas finalizadas, edición a 20 m,
botón de mantener presionado y bloqueo de cierre por otro usuario. GitHub simulado."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import json, sys, time
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/index.html'
errores, commits, dialogos = [], [], []
ok = True

def check(nombre, cond, extra=''):
    global ok
    print(('OK   ' if cond else 'FALLA') + ' ' + nombre + (' · ' + str(extra) if extra != '' else ''))
    ok = ok and bool(cond)

def gh(route):
    req = route.request
    if req.method == 'POST' and req.url.endswith('/git/trees'):
        commits.append([t['path'] for t in json.loads(req.post_data)['tree']])
    route.fulfill(status=200, content_type='application/json',
                  body=json.dumps({'sha': 'abc123', 'object': {'sha': 'base1'}, 'tree': {'sha': 'tree1'}}))

with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900}, has_touch=False)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errores.append('console: ' + m.text))
    def on_dialog(d):
        dialogos.append((d.type, d.message))
        d.accept() if d.type != 'prompt' else d.dismiss()
    pg.on('dialog', on_dialog)
    ctx.route('https://api.github.com/**', gh)
    pg.goto(URL)
    pg.wait_for_function("typeof S!=='undefined' && typeof dbPut==='function' && !!document.querySelector('#toast')", timeout=30000)
    time.sleep(2)

    # ---------- 1) Sincronización: solo B ----------
    pg.evaluate("""async()=>{
      SES={u:'op1',nombre:'Operario Uno',rol:'operario'};S.cfg.gh={...S.cfg.gh,token:'tok-prueba'};
      const base=(id,extra)=>({id,evaluador:'Operario Uno',usuario:'op1',inicio:'2026-11-13T13:00:00.000Z',seleccion:[],densidad:115,buffer:5,
        paradas:[],resumen_paradas:{},visita:{},secuencias:[],tiempos:{},...extra});
      await dbPut('jornadas',base('A',{estado:'activa'}));
      await dbPut('jornadas',base('B',{estado:'finalizada',fin:'2026-11-13T20:00:00.000Z',sync:'pendiente'}));
      await dbPut('jornadas',base('C',{estado:'finalizada',sync:'pendiente'}));
      await dbPut('jornadas',base('D',{estado:'finalizada',fin:'2026-11-13T20:00:00.000Z',sync:'sincronizado'}));
      await dbPut('jornadas',base('E',{estado:'finalizada',fin:'2026-11-13T20:00:00.000Z',sync:'pendiente'}));
      S.cfg.jornadaActiva='E';
      await sincronizar(true);
    }""")
    enviados = [c[0].split('/')[-1] for c in commits]
    check('Sincronización: solo se envía B', enviados == ['B.geojson'], enviados)
    est = pg.evaluate("async()=>Object.fromEntries((await dbAll('jornadas')).map(j=>[j.id,j.sync||j.estado]))")
    check('B queda sincronizada y E sigue pendiente', est.get('B') == 'sincronizado' and est.get('E') == 'pendiente', est)

    # ---------- 4) Edición a 20 m ----------
    def abrir_edicion(metros):
        return pg.evaluate("""async(m)=>{
          cerrarHoja&&cerrarHoja();
          const lat=1.70,lng=-78.70;const dlat=m/111320;
          S.gps={lat:lat+dlat,lng,acc:4,t:Date.now()};
          const r={id:'R1',palma_id:'PX',jornada_id:'B2',evaluador:'Operario Uno',estado:'sana',n1_codigo:'SN',n1:'Sana',n2:'',n3:'',rama:null,problemas:[],sintomas:[],
            produccion:'Sí',transitabilidad:'',observaciones:'',fotos:[],sync:'pendiente',lat,lng,lote:'IT01',linea:3,numero:14,creado:new Date().toISOString()};
          await abrirFormulario(r);
          const h=document.querySelector('#hojaCuerpo')||document;
          return {d:dist(S.gps.lat,S.gps.lng,lat,lng),titulo:(document.querySelector('#hojaTitulo')||{}).textContent||'',
            disabled:!!h.querySelector('#frm fieldset[disabled]'),guardar:!!h.querySelector('#frm button[type=submit]'),
            aviso:[...h.querySelectorAll('.aviso')].map(a=>a.textContent).join(' | '),lejos:F.lejos};
        }""", metros)
    r33 = abrir_edicion(33)
    check('Edición a ~33 m: solo lectura', r33['disabled'] and not r33['guardar'] and r33['lejos'] and 'debe estar a 20 m o menos' in r33['aviso'],
          f"{r33['d']:.1f} m · {r33['aviso'][:90]}")
    r11 = abrir_edicion(11)
    check('Edición a ~11 m: editable', (not r11['disabled']) and r11['guardar'] and not r11['lejos'], f"{r11['d']:.1f} m")
    pg.evaluate("cerrarHoja()")

    # ---------- 3) Botón mantener presionado (#jFin real del panel de jornada) ----------
    pg.evaluate("""()=>{window.__fin=0;window.finalizarJornada=()=>{window.__fin++;};
      const btn=document.createElement('button');btn.id='btPrueba';btn.className='btn peligro ancho mantener';btn.innerHTML='FINALIZAR<small class="subMant">Mantenga presionado 2 segundos</small>';
      document.body.appendChild(btn);btn.style.cssText='position:fixed;left:20px;top:200px;width:300px;height:60px;z-index:99999;flex-direction:column';
      botonMantener(btn,()=>window.finalizarJornada());}""")
    caja = pg.locator('#btPrueba').bounding_box()
    cx, cy = caja['x'] + caja['width'] / 2, caja['y'] + caja['height'] / 2
    pg.mouse.move(cx, cy); pg.mouse.down(); time.sleep(0.6); pg.mouse.up(); time.sleep(0.3)
    toast = pg.evaluate("document.querySelector('#toast').textContent")
    check('Toque de 0,6 s no finaliza y avisa', pg.evaluate('window.__fin') == 0 and 'Mantenga presionado' in toast, toast)
    pg.mouse.move(cx, cy); pg.mouse.down(); time.sleep(2.3); pg.mouse.up(); time.sleep(0.3)
    check('Mantener 2,3 s finaliza', pg.evaluate('window.__fin') == 1)
    # Cableado del botón real de la jornada de censo
    try:
        pg.evaluate("""()=>{S.jornada={id:'A',estado:'activa',evaluador:'Operario Uno',usuario:'op1',inicio:new Date(Date.now()-3600e3).toISOString(),seleccion:[],densidad:115,buffer:5,km:0};document.querySelector('#login').hidden=true;document.querySelector('#splash')&&(document.querySelector('#splash').style.display='none');panelJornada();}""")
        b0 = pg.locator('#jFin'); b0.scroll_into_view_if_needed()
        b = pg.locator('#jFin')
        check('#jFin tiene la clase mantener y el subtítulo', 'mantener' in (b.get_attribute('class') or '') and 'Mantenga presionado 2 segundos' in b.inner_text())
        bb = b.bounding_box(); pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        pg.mouse.down(); time.sleep(0.6); pg.mouse.up(); time.sleep(0.2); n1 = pg.evaluate('window.__fin')
        pg.mouse.down(); time.sleep(2.3); pg.mouse.up(); time.sleep(0.3); n2 = pg.evaluate('window.__fin')
        check('#jFin real: toque corto no, 2,3 s sí', n1 == 1 and n2 == 2, (n1, n2))
    except Exception as e:
        check('#jFin real', False, e)
    pg.evaluate("S.jornada=null;cerrarHoja()")

    # ---------- 2) Otro usuario no puede cerrar la jornada en curso ----------
    dialogos.clear()
    pg.evaluate("""async()=>{S.cfg.jornadaActiva='A';await guardarCfg();SES={u:'op2',nombre:'Operario Dos',rol:'operario'};
      despuesDeIngresar();await new Promise(r=>setTimeout(r,4000));}""")
    ja = pg.evaluate("async()=>{const j=await dbGet('jornadas','A');return {estado:j.estado,fin:j.fin||null,act:S.cfg.jornadaActiva};}")
    msj = ' '.join(m for _, m in dialogos)
    check('Otro usuario: jornada A sigue activa', ja['estado'] == 'activa' and not ja['fin'] and ja['act'] == 'A', ja)
    check('Otro usuario: aviso de que solo el dueño puede', 'Solo su dueño puede continuarla o finalizarla' in msj, msj[:120])
    check('Sin confirm «¿Finalizarla ahora?»', not any(t == 'confirm' for t, _ in dialogos))

    check('Sin errores de JavaScript', not errores, errores[:5])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS')
sys.exit(0 if ok else 1)
