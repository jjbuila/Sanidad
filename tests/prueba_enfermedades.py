"""Botón 🦠 ENFERMEDADES, casos críticos que titilan (PE partida y PC cráter) en el visor y la App, y DATOS → palmas pendientes
por marcar inexistentes (PE partida y sitio vacío / faltante → existencia 0 con aprobación del analista o super administrador). GitHub simulado."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, json, base64, time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
EST = {'aj': None}
def gh(route):
    u = route.request.url; req = route.request
    if 'cartografia/ajustes_existencia.json' in u:
        if req.method == 'PUT':
            EST['aj'] = json.loads(base64.b64decode(json.loads(req.post_data)['content']).decode('utf-8'))
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': {'sha': 'a1'}}))
        if EST['aj'] is None: return route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': 'a1', 'content': base64.b64encode(json.dumps(EST['aj']).encode()).decode()}))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
DATOS = """async(rol)=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();
  SES={u:'an1',nombre:'ANALISTA',rol,token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
  const hoy=hoyISO();const j={id:'J1',fecha:hoy,evaluador:'OPERARIO',usuario:'op1',inicio:hoy+'T12:00:00Z',fin:hoy+'T13:00:00Z',hora_inicio:'07:00',hora_fin:'08:00',duracion_min:60,km:1,ha:1,palmas:10,metodo:'calle',
    n_paradas:0,min_paradas:0,min_mov:60,por_lote:[{lote:'IT01',palmas_visitadas:4}],densidad:115,app:'',lotes:new Set(['IT01']),paradas:[],track:{c:[[-78.7,1.5],[-78.7,1.501]],t:[0,60000],acc:[4,4]},header:{},secuencias:null,tiempos:{},vel:2,diags:[]};
  const d=(id,p,c,n1,n2,h)=>({tipo:'diagnostico',id,palma_id:String(p),lote:'IT01',linea:1,palma:p,n1_codigo:c,nivel1:n1,nivel2:n2,estado:'enferma',creado:hoy+'T'+h+':00Z',lat:1.5+p*0.0002,lng:-78.7,evaluador:'OPERARIO',_j:j});
  j.diags=[d('a',1,'PE','PUDRICIÓN DE ESTÍPITE (PE)','PE PARTIDA','12:10'),d('b',2,'PC','PUDRICIÓN DE COGOLLO (PC)','CRATER','12:20'),d('c',3,'PE','PUDRICIÓN DE ESTÍPITE (PE)','PE PARTIDA','12:30'),
    d('d',4,'PE','PUDRICIÓN DE ESTÍPITE (PE)','PE PARTIDA','12:05'),d('e',4,'PE','PUDRICIÓN DE ESTÍPITE (PE)','PE INICIAL','12:40'),d('f',5,'PC','PUDRICIÓN DE COGOLLO (PC)','PC INICIAL','12:50'),
    {...d('g',6,'EV','ESPACIO VACÍO','','12:55'),estado:'faltante'},{...d('h',7,'EV','ESPACIO VACÍO','','12:56'),estado:'faltante'}];
  PALMASZIP={file:()=>null};chunkLote=async l=>{const d=l==='IT01'?[['6',1,6,1,-78.7,1.5012],['7',1,7,0,-78.7,1.5014]]:[];CHUNK.set(l,d);return d;}; // la 7 ya tiene existencia 0 en la cartografía
  JOR=[j];document.querySelector('#fDesde').value=hoy;document.querySelector('#fHasta').value=hoy;ERR.aj=null;await cargarAjustesVisor();aplicarFiltros(true);}"""
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1400, 'height': 950})
    ctx.route('https://api.github.com/**', gh)
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    vz.on('dialog', lambda d: d.accept('No está partida, es otra palma') if d.type == 'prompt' else d.accept())
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof verCensoEnf==='function'", timeout=30000); time.sleep(1)
    vz.evaluate(DATOS, 'analista'); vz.wait_for_timeout(500)
    orden = vz.evaluate("[...document.querySelectorAll('header button')].map(b=>b.id).filter(Boolean)")
    check('Cabecera: botón 🦠 ENFERMEDADES antes de ✚ CIRUGÍAS', 'btEnf' in orden and orden.index('btEnf') < orden.index('btCir') and 'ENFERMEDADES' in vz.inner_text('#btEnf'), orden)
    n = vz.evaluate("document.querySelectorAll('#mapa .alerta-critica').length")
    et = vz.evaluate("[...document.querySelectorAll('#mapa .alerta-critica .et')].map(e=>e.innerText).sort()")
    check('Titilan solo las palmas cuyo último diagnóstico es PE partida o PC cráter', n == 3 and et == ['⚠ CRÁTER · ERRADICAR', '✝ PE PARTIDA · MUERTA', '✝ PE PARTIDA · MUERTA'], (n, et))
    anim = vz.evaluate("getComputedStyle(document.querySelector('#mapa .alerta-critica .a2')).animationName")
    fr = vz.inner_text('#critFranja')
    check('Franja de alerta con la gravedad y contador en el botón', 'critParpadeo' in anim and vz.evaluate("document.querySelector('#critFranja').classList.contains('on')") and '2 palmas con PE PARTIDA' in fr and '1 palma con PC CRÁTER' in fr and vz.inner_text('#btEnfN') == '3', (anim, fr))
    vz.click('#btGer'); vz.wait_for_timeout(300)
    vz.wait_for_timeout(700)
    check('Con otro módulo abierto el botón se apaga y la franja se oculta', not vz.evaluate("document.querySelector('#btEnf').classList.contains('prim')") and not vz.evaluate("document.querySelector('#critFranja').classList.contains('on')"))
    vz.click('#btEnf'); vz.wait_for_timeout(700)
    check('🦠 ENFERMEDADES vuelve al censo en el mapa', not vz.evaluate("GER.on") and vz.evaluate("document.querySelector('#btEnf').classList.contains('prim')"))
    # DATOS → pendientes por marcar inexistentes
    vz.click('#btDatos'); vz.wait_for_timeout(300); vz.click('[data-gt=inexist]'); vz.wait_for_selector('[data-inx]', timeout=8000)
    T = vz.inner_text('#gerPanel')
    check('DATOS: pestaña «Palmas pendientes por marcar inexistentes» con las PE partida (no la que se recuperó)', 'PALMAS PENDIENTES POR MARCAR INEXISTENTES' in T.upper() and vz.evaluate("[...document.querySelectorAll('[data-inx]')].map(x=>x.dataset.inx).sort().join()") == '1,3,6', vz.evaluate("[...document.querySelectorAll('[data-inx]')].map(x=>x.dataset.inx).sort().join()"))
    check('Incluye el sitio vacío / faltante (no el que la cartografía ya tiene en 0)', 'ESPACIO VACÍO' in T and 'Sitios vacíos pendientes' in T, T[:400])
    vz.check('[data-inx="1"]'); vz.wait_for_timeout(300); vz.click('#inxAprob')
    for _ in range(30):
        if EST['aj']: break
        vz.wait_for_timeout(200)
    vz.wait_for_timeout(500)
    A = (EST['aj'] or {}).get('ajustes', [])
    check('Aprobar: existencia 0 en ajustes_existencia.json con quién aprobó', len(A) == 1 and A[0]['palma_id'] == '1' and A[0]['existe'] == 0 and A[0]['tipo'] == 'PE_PARTIDA' and A[0]['aprobado_por'] == 'an1' and A[0]['diagnostico_id'] == 'a', A)
    check('La aprobada sale de pendientes y deja de titilar', vz.evaluate("[...document.querySelectorAll('[data-inx]')].map(x=>x.dataset.inx).join()") == '3,6' and vz.evaluate("CRIT.lista.length") == 2 and vz.evaluate("VAJ.has('1')"))
    vz.click('[data-inxrech="3"]'); vz.wait_for_timeout(1200)
    R = (EST['aj'] or {}).get('rechazos', [])
    check('Rechazar: queda con motivo y sale de pendientes', len(R) == 1 and R[0]['diagnostico_id'] == 'c' and R[0]['motivo'] and vz.evaluate("[...document.querySelectorAll('[data-inx]')].map(x=>x.dataset.inx).join()") == '6', (R, vz.evaluate("[...document.querySelectorAll('[data-inx]')].map(x=>x.dataset.inx).join()")))
    vz.check('[data-inx="6"]'); vz.wait_for_timeout(300); vz.click('#inxAprob'); vz.wait_for_timeout(1500)
    A = (EST['aj'] or {}).get('ajustes', [])
    v = [a for a in A if a['palma_id'] == '6']
    check('Aprobar el sitio vacío: existencia 0 con tipo y motivo propios', len(v) == 1 and v[0]['existe'] == 0 and v[0]['tipo'] == 'ESPACIO_VACIO' and v[0]['motivo'] == 'Sitio vacío / faltante' and not vz.evaluate("document.querySelector('[data-inx]')"), (v, vz.evaluate("[...document.querySelectorAll('[data-inx]')].map(x=>x.dataset.inx).join()")))
    check('Últimas aprobadas muestra el tipo', 'Sitio vacío / faltante' in vz.inner_text('#gerPanel'))
    # Un administrador ve la lista pero no aprueba
    EST['aj'] = None
    vz.evaluate("alternarGerencia(false)"); vz.evaluate(DATOS, 'admin'); vz.evaluate("alternarGerencia(true,'datos');GER.tab='inexist';pintarGer()"); vz.wait_for_timeout(800)
    check('Solo analista o super administrador aprueban', not vz.evaluate("!!document.querySelector('#inxAprob')") and 'Solo el analista de datos o el super administrador pueden aprobar' in vz.inner_text('#gerPanel'))
    # ---------------- App ----------------
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200]))
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof dibujarCriticas==='function'", timeout=30000); time.sleep(1)
    na = pg.evaluate("""()=>{document.querySelector('#login').hidden=true;mapa.setView([1.5,-78.7],18,{animate:false});
      S.ultimo=new Map([['p1',{palma_id:'p1',n1_codigo:'PE',n2:'PE PARTIDA',lat:1.5,lng:-78.7}],['p2',{palma_id:'p2',n1_codigo:'PC',n2:'CRATER',lat:1.5001,lng:-78.7}],['p3',{palma_id:'p3',n1_codigo:'PC',n2:'PC INICIAL',lat:1.5002,lng:-78.7}]]);
      dibujarCriticas();return [...document.querySelectorAll('.alerta-critica')].map(e=>e.classList.contains('crater')?'crater':e.classList.contains('partida')?'partida':'?').sort()}""")
    check('App: titilan las palmas con PE partida y PC cráter', na == ['crater', 'partida'], na)
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
