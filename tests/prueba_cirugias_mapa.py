"""Cirugías realizadas en el mapa del visor: cruz verde ✚ por palma operada (mapa principal con el rango cargado y módulo de
cirugías), respeta el filtro de lote, ficha con los datos y botón de fotos, casilla de la capa con el número y leyenda."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, time, json
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

def gj(lote, n, dia):
    return {'type': 'FeatureCollection', 'jornada': {'id': 'C' + lote, 'labor': 'cirugia', 'fecha': dia, 'evaluador': 'CIRUJANO UNO'},
            'features': [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [-78.80 + i * 0.0003, 1.62]},
                          'properties': {'tipo': 'cirugia', 'palma_id': f'{lote}-{i}', 'lote': lote, 'linea': 10 + i, 'palma': 5, 'tipo_cirugia': 'Cirugía de cogollo',
                                         'producto': 'Mancozeb', 'cirujano_nombre': 'PEREZ GOMEZ JUAN', 'auxiliar_nombre': 'DIAZ RUIZ ANA', 'duracion_min': 12,
                                         'hora_foto_antes': '08:10', 'hora_foto_despues': '08:22', 'fotos': 'a.jpg|b.jpg', 'creado': dia + 'T13:10:00Z'}} for i in range(n)]
            + [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [-78.8, 1.62]}, 'properties': {'tipo': 'diagnostico', 'lote': lote}}]}
DATOS = {'d1': [{'type': 'blob', 'path': 'CIT01.geojson', 'sha': 's1'}, {'type': 'blob', 'path': 'CIT01_fotos.zip', 'sha': 'z1'}],
         'd2': [{'type': 'blob', 'path': 'CIT02.geojson', 'sha': 's2'}]}
BLOBS = {'s1': json.dumps(gj('IT01', 3, '2026-11-17')), 's2': json.dumps(gj('IT02', 2, '2026-11-18'))}
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1400, 'height': 900})
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200]))
    pg.goto('http://127.0.0.1:8765/visor.html'); pg.wait_for_function("typeof cargarCirMapa==='function'&&typeof mapa!=='undefined'", timeout=30000); time.sleep(1)
    r = pg.evaluate("""async([datos,blobs])=>{
      listarDias=async(raiz,d1,d2)=>raiz==='cirugia/jornadas'?[{path:'2026-11-17',sha:'d1'},{path:'2026-11-18',sha:'d2'}]:[];
      arbol=async sha=>datos[sha]||[];blobTexto=async sha=>blobs[sha];
      await cargarCirMapa('2026-11-17','2026-11-18');
      const ms=[];capaCirR.eachLayer(l=>ms.push(l));
      return {n:ms.length,cruz:ms.every(m=>m.options.icon===ICONO_CRUZ),cnt:document.querySelector('#cCirN').textContent,
        zip:CIRM.lista.find(c=>c.lote==='IT01')._j.zipSha,enMapa:mapa.hasLayer(capaCirR)};}""", [DATOS, BLOBS])
    check('Mapa principal: una cruz por cirugía del rango cargado (5)', r['n'] == 5 and r['cruz'], r)
    check('La casilla «Cirugías realizadas» muestra el número', r['cnt'] == '(5)', r['cnt'])
    check('Capa visible por defecto y con las fotos de la jornada', r['enMapa'] and r['zip'] == 'z1')
    n = pg.evaluate("FIL.lote=new Set(['IT02']);aplicarFiltros();let n=0;capaCirR.eachLayer(()=>n++);n")
    check('Respeta el filtro de lote', n == 2, n)
    pg.evaluate("FIL.lote=new Set();aplicarFiltros()")
    pop = pg.evaluate("""(()=>{let m;capaCirR.eachLayer(l=>{if(!m)m=l;});m.openPopup();const e=m.getPopup().getElement();
      return {t:e.innerText,b:!!e.querySelector('[data-cirfot]')};})()""")
    t = pop['t']
    check('Ficha: cirugía, palma, fecha, horas, producto y pareja', 'Cirugía realizada' in t and 'L10' in t and '08:10–08:22' in t and 'Mancozeb' in t and '12 min' in t, t.replace('\n', ' | '))
    check('Ficha: botón para ver las fotos', pop['b'] and '(2)' in t)
    llamado = pg.evaluate("(()=>{let x=null;const v=verFotos;verFotos=d=>{x=d;};document.querySelector('.leaflet-popup [data-cirfot]').click();verFotos=v;return x&&{l:x.lote,z:x._j.zipSha,f:x.fotos};})()")
    check('El botón abre las fotos de esa cirugía', llamado and llamado['z'] == 'z1' and llamado['f'] == 'a.jpg|b.jpg', llamado)
    off = pg.evaluate("const c=document.querySelector('#cCir');c.checked=false;c.dispatchEvent(new Event('change'));!mapa.hasLayer(capaCirR)")
    check('La casilla oculta la capa', off)
    pg.evaluate("const c=document.querySelector('#cCir');c.checked=true;c.dispatchEvent(new Event('change'))")
    check('Leyenda: «Cirugía realizada» con la cruz', 'Cirugía realizada' in pg.evaluate("document.querySelector('#leyenda').innerText"))
    # Módulo de cirugías: cruces de las cirugías de 45 días; la capa del mapa principal se oculta en el módulo
    r = pg.evaluate("""(()=>{CIR.cirugias=CIRM.lista.slice();CIR.pend=[];CIR.prog=null;CIR.cargado=true;CIR.on=true;
      for(const c of [capaRec,capaDiag,capaPar,capaCirR])mapa.removeLayer(c);CIR.capa.addTo(mapa);pintarMapaCir();
      let n=0;CIR.capa.eachLayer(l=>{if(l.options&&l.options.icon===ICONO_CRUZ)n++;});return {n,principal:mapa.hasLayer(capaCirR)};})()""")
    check('Módulo de cirugías: cruz en cada palma operada', r['n'] == 5, r)
    check('En el módulo no se duplica con la capa del mapa principal', not r['principal'])
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
