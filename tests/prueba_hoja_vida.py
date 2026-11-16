"""Hoja de vida de la palma: App (en la ficha de la palma, sin internet, oculta en auditoría) y visor (ventana con el archivo central
más lo cargado, sin duplicados, alertas y foto). GitHub simulado."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, json, time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
HV = {'formato': 'sanidad-hoja-vida-1', 'lote': 'IT01', 'generado': '2026-11-16T10:00:00+00:00', 'palmas': {
  '501': {'lote': 'IT01', 'linea': '3', 'palma': '7', 'll': [1.5, -78.7], 'ev': [
    {'t': '2026-09-01T13:00:00Z', 'l': 'censo', 'x': 'PUDRICIÓN DE COGOLLO (PC) › PC INICIAL › PC CASO NUEVO', 'e': 'enferma', 'n2': 'PC INICIAL', 'q': 'GOMEZ PEREZ ANDRES', 'id': 'd1'},
    {'t': '2026-09-03T15:00:00Z', 'l': 'cirugia', 'x': 'Cirugía · Cicatrizante', 'q': 'RUIZ MORA JUAN + DIAZ LOPEZ PEDRO', 'id': 'c1'},
    {'t': '2026-10-20T13:00:00Z', 'l': 'plagas', 'x': 'Daño por Sagalassa', 'q': 'TORRES ELVIS', 'id': 'p1'},
    {'t': '2026-11-10T13:00:00Z', 'l': 'censo', 'x': 'PUDRICIÓN DE COGOLLO (PC) › CRATER › SEGUIMIENTO PC', 'e': 'enferma', 'n2': 'CRATER', 'q': 'LOPEZ DIAZ CARLOS', 'id': 'd2',
     'f': 'jornadas/2026-11-10/J9_fotos.zip|f9.jpg'}]}}}
IND = {'formato': 'sanidad-hoja-vida-1', 'generado': 'x', 'lotes': {'IT01': {'archivo': 'IT01.json', 'palmas': 1, 'eventos': 4, 'generado': HV['generado']}}}
def gh(route):
    u = route.request.url
    if 'palmas/hoja_vida/IT01.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(HV))
    if 'palmas/hoja_vida/indice.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(IND))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1300, 'height': 900})
    ctx.route('https://api.github.com/**', gh)
    # ---------------- Visor ----------------
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof hojaVidaVisor==='function'", timeout=30000); time.sleep(1)
    vz.evaluate("""()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();
      SES={u:'an1',nombre:'ANALISTA',rol:'analista',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
      const j={id:'J9',ruta:'2026-11-16/J10.geojson',fecha:'2026-11-16',evaluador:'MORA RUIZ JAVIER',usuario:'op3',inicio:'2026-11-16T12:00:00Z',fin:'2026-11-16T13:00:00Z',hora_inicio:'07:00',hora_fin:'08:00',duracion_min:60,km:1,ha:1,palmas:10,metodo:'calle',
        n_paradas:0,min_paradas:0,min_mov:60,por_lote:[],densidad:115,app:'',lotes:new Set(['IT01']),paradas:[],track:null,header:{},secuencias:null,tiempos:{},vel:2,diags:[]};
      const d=(id,h,n2)=>({tipo:'diagnostico',id,palma_id:'501',lote:'IT01',linea:3,palma:7,n1_codigo:'PC',nivel1:'PUDRICIÓN DE COGOLLO (PC)',nivel2:n2,estado:'enferma',creado:h,lat:1.5,lng:-78.7,evaluador:'MORA RUIZ JAVIER',n_fotos:0});
      j.diags=[d('d2','2026-11-10T13:00:00Z','CRATER'),d('d3','2026-11-16T12:30:00Z','PC EN RECUPERACIÓN')];
      JOR=[j];document.querySelector('#fDesde').value='2026-11-16';document.querySelector('#fHasta').value='2026-11-16';aplicarFiltros(true);
      popupDiag({...j.diags[1],_j:j});}""")
    vz.wait_for_selector('.ppHist'); check('Visor: botón «📋 Hoja de vida» en la ficha', 'Hoja de vida' in vz.inner_text('.ppHist'))
    vz.click('.ppHist'); vz.wait_for_selector('#hvCuerpo .ev', timeout=8000)
    T = vz.inner_text('#hvCuerpo'); n = vz.evaluate("document.querySelectorAll('#hvCuerpo .ev').length")
    check('Visor: une el archivo central con lo cargado sin duplicar (5 registros)', n == 5 and T.count('CRATER') == 1, n)
    check('Visor: incluye cirugía y plagas de otras labores', 'Cirugía' in T and 'Daño por Sagalassa' in T)
    orden = vz.evaluate("[...document.querySelectorAll('#hvCuerpo .ev b')].map(b=>b.innerText)")
    check('Visor: lo más reciente primero y el último diagnóstico manda', orden[0] == 'Censo' and 'RECUPERACI' in vz.inner_text('#hvCuerpo .est').upper(), orden)
    check('Visor: registro con foto tiene «Ver foto»', vz.evaluate("document.querySelectorAll('#hvCuerpo [data-hvf]').length") == 1)
    vz.click('#hvX'); check('Visor: se cierra', vz.evaluate("document.querySelector('#hvModal').hidden"))
    # Palma sin hoja de vida
    vz.evaluate("verHistoriaPalma({palma_id:'999',lote:'IT01',linea:1,palma:1,lat:1.5,lng:-78.7})"); vz.wait_for_timeout(500)
    check('Visor: palma sin diagnósticos ni novedades no tiene hoja de vida', 'no tiene hoja de vida' in vz.inner_text('#hvCuerpo'))
    # ---------------- App ----------------
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof mostrarHojaVida==='function'", timeout=30000); time.sleep(2)
    r = pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'op1',nombre:'Operario',rol:'operario'};S.cfg.gh={...S.cfg.gh,token:'tok',owner:'jjbuila',repo:'SanidadData',rama:'main'};
      await cargarHojaVida();
      for(const [id,lin,num] of [['501','3','7'],['502','3','8']])S.idx.set(id,{type:'Feature',geometry:{type:'Point',coordinates:[-78.7,1.5]},properties:{_id:id,_lote:'IT01',_linea:lin,_num:num}});
      abrirPalma('501');await new Promise(r=>setTimeout(r,600));const c=document.querySelector('#hojaCuerpo');
      const hv=c.querySelector('.hv');const res={hay:!!hv,txt:hv?hv.innerText:'',n:hv?hv.querySelectorAll('.ev').length:0,antesHist:!!(hv&&hv.nextElementSibling&&/Historial/.test(c.innerText.slice(c.innerText.indexOf('Hoja de vida'))))};
      cerrarHoja&&cerrarHoja();abrirPalma('502');await new Promise(r=>setTimeout(r,500));res.sinHV=!document.querySelector('#hojaCuerpo .hv');
      HV.mem.clear();const off=Object.getOwnPropertyDescriptor(Navigator.prototype,'onLine');Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});
      cerrarHoja&&cerrarHoja();abrirPalma('501');await new Promise(r=>setTimeout(r,500));res.offline=!!document.querySelector('#hojaCuerpo .hv');
      AUD.ids=new Set(['501']);AUD.m={id:'A1',palmas:[]};cerrarHoja&&cerrarHoja();abrirPalma('501');await new Promise(r=>setTimeout(r,500));res.aud=!document.querySelector('#hojaCuerpo .hv');
      return res;}""")
    check('App: la ficha de la palma muestra la hoja de vida con todos los registros', r['hay'] and r['n'] == 4 and 'GOMEZ' in r['txt'] and 'Cirugía' in r['txt'], r['txt'][:200])
    check('App: alerta de cráter pendiente de erradicar', 'PC CRÁTER: pendiente de erradicar' in r['txt'])
    check('App: palma sin novedades no muestra hoja de vida', r['sinHV'])
    check('App: funciona sin internet (copia guardada)', r['offline'])
    check('App: oculta en palmas de auditoría', r['aud'])
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
