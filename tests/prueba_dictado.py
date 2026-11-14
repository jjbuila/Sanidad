"""Modo dictado: el operario dice todo seguido, la app marca sin preguntar, pide solo lo que falta y confirma lo registrado."""
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

INIT = INIT_VOZ
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True, args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900}, permissions=['camera', 'microphone'])
    ctx.add_init_script(INIT)
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errores.append(str(e) + ' ' + (e.stack or '')[:300]))
    pg.on('dialog', lambda d: (errores.append('DIALOGO: ' + d.message), d.dismiss()))
    pg.goto('http://127.0.0.1:8765/index.html')
    pg.wait_for_function("typeof S!=='undefined'&&typeof dbPut==='function'", timeout=30000); time.sleep(2)
    pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'op1',nombre:'Operario Uno',rol:'operario'};
      const j={id:'JV',estado:'activa',evaluador:'Operario Uno',usuario:'op1',inicio:new Date().toISOString(),seleccion:[{lote:'IT01'}],densidad:115,buffer:5,km:0,sync:'pendiente'};
      await dbPut('jornadas',j);S.jornada=j;S.cfg.jornadaActiva='JV';
      for(const [id,num] of [['PT1',14],['PT2',15]]){S.idx.set(id,{type:'Feature',geometry:{type:'Point',coordinates:[-78.70,1.70]},properties:{_id:id,_lote:'IT01',_linea:3,_num:num}});}
      VOZ.ultimaPalma='PT1';S.gps={lat:1.70004,lng:-78.70,acc:4,t:Date.now()};}""")
    def ultimo(): return pg.evaluate("window.__dichos[window.__dichos.length-1]||''")
    def esperar_dicho(sub, t=15, desde=0):
        fin = time.time() + t
        while time.time() < fin:
            if sub in ' || '.join(pg.evaluate("window.__dichos")[desde:]): return True
            time.sleep(0.1)
        return False
    def listo(estado=None, t=10):
        fin = time.time() + t
        while time.time() < fin:
            if pg.evaluate("!RV.hablando&&window.__srOn") and (estado is None or pg.evaluate("VD.estado") == estado): return True
            time.sleep(0.1)
        return False
    def decir(txt):
        listo(); assert pg.evaluate(f"window.__hablar({txt!r})"), 'sin micrófono: ' + txt
    marcado = lambda name: pg.evaluate(f"[...document.querySelectorAll('#frm input[name={name}]:checked')].map(i=>i.nextElementSibling.textContent)")

    pg.click('#btDxVoz'); esperar_dicho('Diagnóstico por voz activado'); listo('espera')
    decir('realizar diagnóstico')
    check('Pide dictar sin leer preguntas', esperar_dicho('palma 14. Dicte.') and listo('dictado') and 'Opciones' not in ' '.join(pg.evaluate("window.__dichos")), ultimo())
    # Dictado 1: enfermedad + opción + síntoma + cirugía, de corrido (sin decir producción ni transitabilidad)
    decir('pudrición de cogollo pc inicial síntomas manchas necróticas de color café en la flecha más joven cirugía no')
    time.sleep(0.6)
    check('Marca enfermedad y opción por su nombre', marcado('n1') == ['PUDRICIÓN DE COGOLLO (PC)'] and marcado('n2') == ['PC INICIAL'], (marcado('n1'), marcado('n2')))
    check('Marca el síntoma dictado', any('Manchas necróticas' in x for x in marcado('sintomas')), marcado('sintomas'))
    check('Marca «cirugía no»', marcado('cirugia') == ['No'], marcado('cirugia'))
    check('No preguntó nada', 'Opciones' not in ' '.join(pg.evaluate("window.__dichos")))
    # Dictado 2: transitabilidad (opción de dos palabras), observación y foto
    decir('transitabilidad poco transitable observación hojas amarillas en la corona tomar foto')
    for _ in range(80):
        if pg.evaluate("nFotosF()")>=1 and pg.evaluate("!RV.hablando"): break
        time.sleep(0.1)
    check('«poco transitable» (no confunde con «transitable»)', marcado('transitabilidad') == ['Poco transitable'], marcado('transitabilidad'))
    check('Observación dictada', pg.evaluate("document.querySelector('#frm textarea[name=observaciones]').value") == 'hojas amarillas en la corona')
    check('Foto tomada por comando', pg.evaluate("nFotosF()") == 1)
    # Corrección por dictado: volver a decir el campo lo cambia
    decir('cirugía sí'); time.sleep(0.6)
    check('Corrige un campo diciéndolo de nuevo', marcado('cirugia') == ['Sí'], marcado('cirugia'))
    # Registrar sin haber dicho «producción»: debe preguntar solo eso
    n0 = len(pg.evaluate("window.__dichos"))
    decir('guardar foto registrar diagnóstico')
    check('Pregunta solo lo que falta', esperar_dicho('Falta Producción', 10, n0) and listo('pregunta'), ultimo())
    decir('sí')
    check('Registra y confirma por voz', esperar_dicho('Se registró la palma 14, línea 3', 10, n0), ultimo())
    reg = pg.evaluate("(()=>{const r=S.registros.find(x=>x.palma_id==='PT1');return r?{n2:r.n2,sint:r.sintomas,cir:r.cirugia,prod:r.produccion,tra:r.transitabilidad,obs:r.observaciones,fotos:r.fotos.length}:null})()")
    check('Guardado completo', reg and reg['n2'] == 'PC INICIAL' and reg['cir'] == 'Sí' and reg['prod'] == 'Sí' and reg['tra'] == 'Poco transitable' and reg['fotos'] == 1 and reg['obs'], reg)
    print('     Validación:', [d for d in pg.evaluate("window.__dichos") if d.startswith('Se registró')][-1])
    # Segunda palma: todo en un solo dictado, incluido registrar
    listo('espera'); pg.evaluate("VOZ.ultimaPalma='PT2'")
    decir('realizar diagnóstico'); esperar_dicho('palma 15. Dicte.'); listo('dictado')
    n1 = len(pg.evaluate("window.__dichos"))
    decir('pudrición de cogollo pc inicial síntomas manchas necróticas cirugía no producción no transitabilidad transitable tomar foto guardar foto registrar diagnóstico')
    check('Todo en un solo dictado', esperar_dicho('Se registró la palma 15', 12, n1) and 'Falta' not in ' '.join(pg.evaluate("window.__dichos")[n1:]), ultimo())
    check('Síntoma abreviado («manchas necróticas»)', 'Síntomas: Manchas necróticas' in ' '.join(pg.evaluate("window.__dichos")[n1:]), ultimo()[-80:])
    # Resumen y cancelar
    listo('espera'); decir('realizar diagnóstico'); esperar_dicho('Corrección', 8); listo('dictado')
    n2 = len(pg.evaluate("window.__dichos")); decir('resumen')
    check('«Resumen» lee lo marcado', esperar_dicho('Enfermedad principal: PUDRICIÓN', 8, n2), ultimo()[:80])
    listo('dictado'); decir('cancelar')
    check('Cancelar', esperar_dicho('Diagnóstico cancelado', 8, n2))
    check('Sin errores de JavaScript ni alertas', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
