"""Visor: reproducir todas las jornadas filtradas (a la vez y una a una)."""
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
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1400, 'height': 900})
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200] + ' ' + (e.stack or '')[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/visor.html'); pg.wait_for_function("typeof abrirRep==='function'&&typeof mapa!=='undefined'", timeout=30000); time.sleep(1)
    pg.evaluate("""()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();window.chunkLote=async()=>[];
      const mk=(id,u,nom,fecha,h0,dlng,ndiag)=>{const t0=Date.parse(fecha+'T'+h0+':00-05:00');const c=[],t=[];for(let i=0;i<=40;i++){c.push([-78.70+dlng,1.50+i*0.0001]);t.push(t0+i*60000);}
        const diags=[...Array(ndiag)].map((_,k)=>({tipo:'diagnostico',id:id+'d'+k,palma_id:'P'+k,lote:'IT01',linea:3,palma:k+1,nivel1:'PUDRICIÓN DE COGOLLO (PC)',n1_codigo:'PC',estado:'enferma',evaluador:nom,creado:new Date(t0+(10+k*10)*60000).toISOString(),lat:1.50+(10+k*10)*0.0001,lng:-78.70+dlng,n_fotos:0}));
        const j={id,fecha,evaluador:nom,usuario:u,inicio:new Date(t0).toISOString(),fin:new Date(t0+40*60000).toISOString(),hora_inicio:h0,hora_fin:'',duracion_min:40,km:0.44,ha:1,palmas:100,metodo:'calle',
          n_paradas:0,min_paradas:0,min_mov:40,por_lote:[],densidad:115,app:'',lotes:new Set(['IT01']),paradas:[],track:{c,t,acc:c.map(()=>4)},header:{},secuencias:null,tiempos:null,vel:2,diags};
        diags.forEach(d=>d._j=j);return j;};
      JOR=[mk('J1','1000000001','GOMEZ PEREZ ANDRES','2026-11-13','07:00',0,2),mk('J2','1000000002','LOPEZ DIAZ CARLOS','2026-11-13','07:10',0.002,1),mk('J3','1000000003','MORA RUIZ JAVIER','2026-11-14','07:05',0.004,0)];
      aplicarFiltros(true);}""")
    time.sleep(.5)
    pg.click('#btRep'); time.sleep(1)
    t = pg.evaluate("({vis:!document.querySelector('#rep').hidden,tit:document.querySelector('#rep .t').textContent,n:REP.js.length,rec:mapa.hasLayer(capaRec),diag:mapa.hasLayer(capaDiag),ops:document.querySelectorAll('#repOps span').length,reloj:document.querySelector('#repReloj').textContent})")
    check('Todos a la vez: abre con las 3 jornadas y operarios', t['vis'] and t['n'] == 3 and t['ops'] == 3, t)
    check('Varias fechas: se superponen por hora del día', '2 fechas superpuestas' in t['tit'] and t['reloj'] == '07:00:00', (t['tit'], t['reloj']))
    check('Oculta los recorridos y diagnósticos estáticos', not t['rec'] and not t['diag'])
    pg.evaluate("ponerRep(REP.T0+12*60000)")
    a = pg.evaluate("({act:+document.querySelector('#repAct').textContent,nd:+document.querySelector('#repND').textContent,reloj:document.querySelector('#repReloj').textContent,km:+document.querySelector('#repKm').textContent})")
    check('A las 07:12: 3 activos, 1 diagnóstico, reloj y km', a['act'] == 3 and a['nd'] == 1 and a['reloj'] == '07:12:00' and a['km'] > 0, a)
    pg.evaluate("ponerRep(REP.T0+3*60000)")
    b = pg.evaluate("({act:+document.querySelector('#repAct').textContent,inact:document.querySelectorAll('#repOps span.inact').length})")
    check('A las 07:03 solo uno ha empezado (los otros, atenuados)', b['act'] == 1 and b['inact'] == 2, b)
    pg.select_option('#repVel', '3600'); pg.click('#repBt'); time.sleep(1.5)
    check('Play avanza el reloj', pg.evaluate("REP.T>REP.T0+5*60000"), pg.evaluate("document.querySelector('#repReloj').textContent"))
    pg.click('#repBt')
    # Uno a uno
    pg.click('#rep .modo button[data-m=uno]'); time.sleep(.8)
    u = pg.evaluate("({tit:document.querySelector('#rep .t').textContent,n:REP.js.length,reloj:document.querySelector('#repReloj').textContent})")
    check('Uno a uno: 1 de 3 con su hora real', u['n'] == 1 and u['tit'].startswith('1 de 3') and 'GOMEZ' in u['tit'] and u['reloj'] == '07:00:00', u)
    pg.click('#repSig'); time.sleep(.6)
    check('Siguiente: 2 de 3', pg.evaluate("document.querySelector('#rep .t').textContent").startswith('2 de 3'))
    pg.click('#repAnt'); time.sleep(.6)
    check('Anterior: 1 de 3', pg.evaluate("document.querySelector('#rep .t').textContent").startswith('1 de 3'))
    # Avance automático al terminar (sin pausas por diagnóstico, velocidad alta)
    pg.evaluate("REP.vel=12000;document.querySelector('#repDiag').checked=false;pausarRep();iniciarRep()")
    pg.wait_for_function("document.querySelector('#rep .t').textContent.startsWith('2 de 3')", timeout=15000)
    check('Al terminar una jornada pasa sola a la siguiente', True)
    # Pausa en diagnóstico (uno a uno)
    pg.evaluate("pausarRep();REP.i=0;prepararRep();REP.vel=3600;document.querySelector('#repDiag').checked=true;iniciarRep()")
    pg.wait_for_function("!!document.querySelector('.leaflet-popup-content')", timeout=15000)
    t1 = pg.evaluate("REP.T"); time.sleep(1.2); t2 = pg.evaluate("REP.T")
    check('Uno a uno: muestra el diagnóstico y pausa', abs(t2 - t1) < 1 and 'PUDRICIÓN' in pg.evaluate("document.querySelector('.leaflet-popup-content').innerText"))
    # Cerrar
    pg.click('#repX'); time.sleep(.5)
    c = pg.evaluate("({vis:!document.querySelector('#rep').hidden,rec:mapa.hasLayer(capaRec),diag:mapa.hasLayer(capaDiag),on:REP.on})")
    check('Cerrar restaura el mapa', not c['vis'] and c['rec'] and c['diag'] and not c['on'], c)
    # Pestaña Jornadas: botones
    pg.evaluate("document.querySelector('nav.tabs button[data-tab=jornadas]').click()"); time.sleep(.4)
    pg.click('#btRepU'); time.sleep(.6)
    check('Pestaña Jornadas: «Reproducir una a una»', pg.evaluate("REP.on&&REP.modo==='uno'"))
    pg.click('#repX')
    pg.evaluate("JOR=[];aplicarFiltros(false)"); pg.click('#btRep'); time.sleep(.3)
    check('Sin jornadas: avisa y no abre', pg.evaluate("document.querySelector('#rep').hidden") and 'No hay jornadas' in pg.evaluate("document.querySelector('#toast').textContent"))
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
