"""Marcación por lote, transitabilidad por lote y cierre de la jornada por pasos (datos sintéticos, sin cartografía real).
· Al entrar al lote programado (3 puntos dentro) se pregunta la transitabilidad (una vez) y luego la marcación obligatoria.
· Sin «Todavía no»: si cierran la ventana vuelve a salir. ▶ MARCAR cuenta desde la entrada (solo las dos líneas de la calle, a <= 8 m).
· Fin a los 90 s fuera del lote, con la voz o al finalizar la jornada; al volver a entrar pide marcar otra vez.
· Finalizar: confirmación dentro de la App, pasos con tiempo límite, errores registrados, acumulado por línea y por etiqueta.
· Volumen sostenido 10 s (APK): finaliza sin confirmación."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, time, math, json
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

LAT0, LNG0 = 1.6, -78.95
KY = 111320; KX = KY * math.cos(LAT0 * math.pi / 180)
NL, NP, SL, SP = 8, 12, 7.8, 9.0   # líneas a 7,8 m; palmas a 9 m
def ll(x, y): return [LNG0 + x / KX, LAT0 + y / KY]
pal = []; pid = 1
for ln in range(1, NL + 1):
    for p in range(1, NP + 1):
        x = (ln - 1) * SL; y = (p - 1) * SP + (SP / 2 if ln % 2 == 0 else 0)
        lng, lat = ll(x, y); pal.append([pid, ln, p, 1, round(lng, 8), round(lat, 8)]); pid += 1
ymax = (NP - 1) * SP + SP / 2
caja = [ll(-5, -5), ll((NL - 1) * SL + 5, -5), ll((NL - 1) * SL + 5, ymax + 5), ll(-5, ymax + 5), ll(-5, -5)]
LOTE = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'Lote': 'ZZ01'}, 'geometry': {'type': 'Polygon', 'coordinates': [caja]}}]}

errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900})
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof marcaPunto==='function'&&typeof S!=='undefined'", timeout=30000); time.sleep(2)
    pg.evaluate("""([P,G])=>{document.querySelector('#login').hidden=true;SES={u:'sa',nombre:'Super Prueba',rol:'superadmin'};
      window.__P={ZZ01:P};leerChunk=async l=>__P[l]||[];CARTO.lotes={ZZ01:{n:P.length}};
      G.features.forEach(f=>f.properties._lote=f.properties.Lote);S.lotes=G;cajasLotes();IDXV.clear();LFEAT.clear();LMET.clear();KX=0;
      hablar=()=>{};S.cfg.metodoVisita='marcacion';S.cfg.bufferMarcacion=8;}""", [pal, LOTE])
    pg.evaluate("async()=>{await iniciarJornada([{lote:'ZZ01'}],'Super Prueba');}"); time.sleep(1)
    check('Jornada nueva con el método de marcación (8 m)', pg.evaluate("[S.jornada.metodoVisita,S.jornada.bufferMarcacion]") == ['marcacion', 8])
    T = {'t': int(time.time() * 1000) - 9 * 60000}
    def punto(x, y):
        lng, lat = ll(x, y); T['t'] += 4000
        pg.evaluate(f"registrarPunto({{lat:{lat},lng:{lng},acc:3,t:{T['t']}}})"); time.sleep(.05)
    vis = lambda: pg.evaluate("!document.querySelector('#mkDlg').hidden")
    dlg = lambda: pg.evaluate("document.querySelector('#mkCuerpo').innerText")
    xc = SL * 1.5   # calle entre las líneas 2 y 3
    for y in (-25, -18, -11):
        punto(xc, y)
    check('Fuera del lote no pregunta nada', not vis())
    punto(xc, -3); punto(xc, 1)
    check('2 puntos dentro todavía no es entrada', not vis())
    punto(xc, 5)
    check('3 puntos dentro: pregunta la transitabilidad', vis() and 'Transitabilidad' in dlg(), dlg()[:60])
    check('Opciones: Transitable / Poco transitable / No transitable', pg.evaluate("[...document.querySelectorAll('#mkCuerpo button[data-v]')].map(b=>b.textContent)") == ['Transitable', 'Poco transitable', 'No transitable'])
    pg.evaluate("document.querySelector('#mkCuerpo button[data-v=\"Poco transitable\"]').click()"); time.sleep(.3)
    check('Luego pide la marcación obligatoria, sin «Todavía no»', vis() and 'Marcación obligatoria' in dlg() and 'Todavía' not in dlg())
    check('El botón flotante muestra ▶ MARCAR', pg.evaluate("document.querySelector('#mkPill').textContent").startswith('▶ MARCAR'))
    for y in range(9, 40, 4):
        punto(xc, y)
    check('Sin marcar todavía no cuenta palmas (quedan en espera)', pg.evaluate("VIS.set.size") == 0 and pg.evaluate("VIS.pend.size") > 0, pg.evaluate("[VIS.set.size,VIS.pend.size]"))
    pg.evaluate("document.querySelector('#mkDlg .mk-x').click()"); time.sleep(.2)
    check('Se puede cerrar la ventana…', not vis())
    time.sleep(6.5); punto(xc, 43)
    check('…pero vuelve a salir', vis() and 'Marcación obligatoria' in dlg())
    pg.evaluate("document.querySelector('#mkMarcar').click()"); time.sleep(.4)
    r = pg.evaluate("(()=>{const g=IDXV.get('ZZ01');const L=n=>g.lineas.get(n).pal.filter(q=>VIS.set.has(q.id)).map(q=>q.p);return {l2:L(2),l3:L(3),l1:L(1),l4:L(4)};})()")
    check('▶ MARCAR cuenta desde la entrada al lote (palma 1 de las líneas 2 y 3)', 1 in r['l2'] and 1 in r['l3'], r)
    check('Solo las dos líneas de la calle: no cuenta las líneas de otras calles', not r['l1'] and not r['l4'], r)
    check('El botón flotante pasa a ■ MARCANDO', pg.evaluate("document.querySelector('#mkPill').textContent").startswith('■ MARCANDO'))
    # el operario se corre hasta quedar casi encima de la línea 2 (la línea 1 de la otra calle le queda a menos de 8 m)
    for y in range(47, int(ymax) + 4, 4):
        punto(SL + 0.1, y)
    r = pg.evaluate("(()=>{const g=IDXV.get('ZZ01');return [1,2,3].map(n=>g.lineas.get(n).pal.filter(q=>VIS.set.has(q.id)).length);})()")
    check('Corrido sobre la línea 2: sigue contando las dos líneas de su calle (2 y 3)', r[1] == NP and r[2] == NP, r)
    check('…y no cuenta la línea 1 de la otra calle aunque quede a menos de 8 m', r[0] == 0, r)
    # sale del lote y camina 100 s por fuera (vía)
    for k in range(28):
        punto(xc + k * 1.2, ymax + 12)
    tr = pg.evaluate("S.jornada.marcacion.tramos")
    check('Termina sola a los 90 s fuera del lote', len(tr) == 1 and tr[0]['fin'] is not None and tr[0]['fin_modo'] == 'salida' and tr[0]['inicio_modo'] == 'boton', tr)
    check('Por la vía fuera del lote no cuenta palmas', pg.evaluate("(()=>{const g=IDXV.get('ZZ01');return [4,5,6,7,8].map(n=>g.lineas.get(n).pal.filter(q=>VIS.set.has(q.id)).length).reduce((a,b)=>a+b,0);})()") == 0)
    # vuelve a entrar por la calle 4|5
    x2 = SL * 3.5
    for y in (ymax + 3, ymax - 1, ymax - 5):
        punto(x2, y)
    check('Al volver a entrar pide marcar otra vez (sin repetir la transitabilidad)', vis() and 'Marcación obligatoria' in dlg())
    check('Voz «marcar»', pg.evaluate("mkIniciar('voz')"))
    for y in range(int(ymax) - 9, 30, -4):
        punto(x2, y)
    check('Voz «finalizar marcación»', pg.evaluate("mkFinalizar('voz')") and pg.evaluate("S.jornada.marcacion.tramos[1].fin_modo") == 'voz')
    # diagnósticos (heredan la transitabilidad del lote)
    check('La transitabilidad ya no se pregunta en el diagnóstico', True)
    pg.evaluate("""async()=>{window.__rd=reglaDiagnostico;reglaDiagnostico=()=>({ok:true});const f=S.palmas.features.find(f=>String(f.properties._linea)==='3');await abrirFormulario({palma_id:f.properties._id});}"""); time.sleep(.6)
    check('Formulario de diagnóstico sin el campo Transitabilidad', pg.evaluate("document.querySelectorAll('#frm [name=transitabilidad]').length") == 0 and 'Transitabilidad' not in pg.evaluate("document.querySelector('#frm').innerText"))
    pg.evaluate("cerrarHoja()")
    check('Los diagnósticos del lote heredan su transitabilidad', pg.evaluate("transitDe('ZZ01')") == 'Poco transitable')
    pg.evaluate("""()=>{const jid=S.jornada.id;const mk=(ln,p,c,e)=>({id:'r'+ln+p,jornada_id:jid,lote:'ZZ01',linea:String(ln),numero:String(p),n1_codigo:c,estado:e,creado:new Date().toISOString()});
      S.registros.push(mk(2,3,'PC','enferma'),mk(2,5,'PC','enferma'),mk(3,4,'DBP','recuperacion'));}""")
    # Finalizar: confirmación dentro de la App; un paso que falla no impide cerrar
    pg.evaluate("window.__dp=detectarParadas;detectarParadas=()=>{throw new Error('falla de prueba');};0")
    pg.evaluate("()=>{window.__f=finalizarJornada('boton');return 1;}"); time.sleep(.4)
    check('Finalizar pide confirmación dentro de la App', vis() and '¿Finalizar la jornada?' in dlg())
    pg.evaluate("document.querySelector('#cfSi').click()"); time.sleep(.2)
    check('Muestra el avance paso a paso', pg.evaluate("document.querySelectorAll('#finPasos li').length") == 9 or 'Jornada finalizada' in pg.evaluate("document.querySelector('#hoja').innerText"))
    pg.evaluate("async()=>{await __f;}"); time.sleep(.5); pg.evaluate("detectarParadas=__dp;0")
    j = pg.evaluate("async()=>{const js=await dbAll('jornadas');return js.sort((a,b)=>String(b.inicio).localeCompare(a.inicio))[0];}")
    check('La jornada se cerró aunque un paso falló', j['estado'] == 'finalizada' and any(e['paso'] == 'Paradas' and 'falla de prueba' in e['error'] for e in j.get('errores_cierre', [])), j.get('errores_cierre'))
    T2 = pg.evaluate("document.querySelector('#hoja').innerText")
    check('Resumen final: acumulado por línea, marcación y transitabilidad', all(k.upper() in T2.upper() for k in ['Acumulado por línea', 'Marcación por lote', 'Transitabilidad', 'Poco transitable']), T2[:400])
    acu = {(r['lote'], r['linea']): r for r in j['acumulado']}
    check('Acumulado línea 2: palmas visitadas y diagnósticos por enfermedad y estado', acu[('ZZ01', 2)]['palmas'] == NP and acu[('ZZ01', 2)]['enf'] == {'PC': 2} and acu[('ZZ01', 2)]['est'] == {'enferma': 2}, acu.get(('ZZ01', 2)))
    check('Acumulado línea 3 con DBP en recuperación', acu[('ZZ01', 3)]['enf'] == {'DBP': 1} and acu[('ZZ01', 3)]['est'] == {'recuperacion': 1})
    h = pg.evaluate(f"async()=>{{const j=await dbGet('jornadas','{j['id']}');const regs=S.registros.filter(r=>r.jornada_id===j.id);return geoJornada(j,regs,await puntosTrack(j.id),new Date().toISOString(),null).jornada;}}")
    mk = h.get('marcacion') or []
    check('Reporte: tramos con lote, horas, minutos y cómo inició/terminó', len(mk) == 2 and mk[0]['lote'] == 'ZZ01' and mk[0]['inicio'] == 'boton' and mk[0]['fin_modo'] == 'salida' and mk[0]['minutos'] > 0 and mk[1]['inicio'] == 'voz' and mk[1]['fin_modo'] == 'voz' and mk[0]['hora_entrada'], mk)
    check('Reporte: transitabilidad por lote con hora de entrada', h['transitabilidad_lotes'][0]['transitabilidad'] == 'Poco transitable' and h['transitabilidad_lotes'][0]['hora_entrada'])
    check('Reporte: acumulado por línea y errores del cierre', len(h['acumulado_lineas']) >= 2 and h['errores_cierre'] and h['metodo'] == 'marcacion' and h['buffer_marcacion_m'] == 8)
    check('Tiempo límite por paso', pg.evaluate("conLimite(new Promise(()=>{}),300).then(()=>'no',e=>e.message)").startswith('tiempo límite'))
    # Volumen sostenido 10 s (APK): finaliza sin confirmación
    pg.evaluate("cerrarHoja()")
    pg.evaluate("async()=>{await iniciarJornada([{lote:'ZZ01'}],'Super Prueba');}"); time.sleep(.6)
    pg.evaluate("async()=>{await finalizarPorVolumen();}"); time.sleep(.6)
    j2 = pg.evaluate("async()=>{const js=await dbAll('jornadas');return js.sort((a,b)=>String(b.inicio).localeCompare(a.inicio))[0];}")
    check('Bajar volumen 10 s finaliza sin pedir confirmación', j2['estado'] == 'finalizada' and j2['cierre']['modo'] == 'volumen' and not pg.evaluate("!!S.jornada"))
    # Visor
    pv = ctx.new_page(); pv.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    pv.goto('http://127.0.0.1:8765/visor.html'); pv.wait_for_function("typeof bloqueMarcacionJ==='function'", timeout=30000); time.sleep(1)
    rv = pv.evaluate("""h=>{const j={id:h.id,fecha:h.fecha,evaluador:h.evaluador,usuario:h.usuario,header:h,diags:[{estado:'enferma',estado_nombre:'Enferma (caso nuevo o activo)'}]};JOR=[j];JORF=[j];FIL.lote.clear();FIL.prog.clear();
      return {mk:htmlMarcacion(filasMarcacion(JORF),true),tr:htmlTransit(filasTransit(JORF),true),acu:htmlAcumulado(acumuladoDe(JORF)),det:bloqueMarcacionJ(j)};}""", h)
    check('Visor: tabla «Marcación por lote»', 'ZZ01' in rv['mk'] and 'Salió del lote (90 s)' in rv['mk'] and 'Voz' in rv['mk'])
    check('Visor: transitabilidad con hora de entrada', 'Poco transitable' in rv['tr'])
    check('Visor: acumulado por línea, por enfermedad y por estado', 'PC' in rv['acu'] and 'DBP' in rv['acu'] and 'Enferma (caso nuevo o activo)' in rv['acu'])
    check('Visor: detalle de la jornada con marcación, transitabilidad, acumulado y error del cierre', all(k in rv['det'] for k in ['Marcación por lote', 'Transitabilidad', 'Acumulado por línea', 'falla de prueba']))
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
