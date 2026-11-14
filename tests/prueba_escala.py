"""Administración: alertas y reportes (config/alertas.json), carga masiva de usuarios (CSV y Excel) e historial de cambios;
visor: lectura del índice diario y lista de reportes diarios/semanales. GitHub simulado."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, TMP
import sys, time, json, os, base64, re
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
ARCH = {}   # ruta → contenido (texto) del repositorio de datos simulado
SHA = {}
def gh(route):
    req = route.request; u = req.url
    m = re.search(r'/contents/([^?]+)', u)
    if m and m.group(1) in ('config/alertas.json', 'config/historial_usuarios.json'):
        ruta = m.group(1)
        if req.method == 'PUT':
            b = json.loads(req.post_data); ARCH[ruta] = base64.b64decode(b['content']).decode('utf-8'); SHA[ruta] = 's%d' % len(ARCH)
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': {'sha': SHA[ruta]}}))
        if ruta not in ARCH: return route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': SHA[ruta], 'content': base64.b64encode(ARCH[ruta].encode()).decode()}))
    # --- visor ---
    if '/contents/jornadas?' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'dir', 'name': '2026-11-13', 'sha': 'arbol13'}, {'type': 'dir', 'name': '2026-11-14', 'sha': 'arbol14'}]))
    if '/contents/indice?' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'file', 'name': '2026-11-13.json', 'sha': 'i13'}, {'type': 'file', 'name': '2026-11-14.json', 'sha': 'i14viejo'}]))
    if u.endswith('/git/blobs/i13'): return route.fulfill(status=200, body=json.dumps(INDICE(13, 'arbol13')))
    if u.endswith('/git/blobs/i14viejo'): return route.fulfill(status=200, body=json.dumps(INDICE(14, 'arbolANTERIOR')))
    if u.endswith('/git/trees/arbol14'): return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tree': [{'path': 'J14.geojson', 'type': 'blob', 'sha': 'g14'}]}))
    if u.endswith('/git/blobs/g14'): return route.fulfill(status=200, body=json.dumps(GEO('J14', '2026-11-14')))
    if '/contents/reportes?' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'dir', 'name': '2026-S46', 'sha': 'rs46'}, {'type': 'dir', 'name': 'diario', 'sha': 'rdia'}]))
    if u.endswith('/git/trees/rs46'): return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tree': [{'path': 'reporte_2026-S46.pdf', 'type': 'blob', 'sha': 'p'}, {'path': 'reporte_2026-S46_interactivo.html', 'type': 'blob', 'sha': 'h'}]}))
    if u.endswith('/git/trees/rdia'): return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tree': [{'path': '2026-11-14', 'type': 'tree', 'sha': 'd14'}]}))
    if u.endswith('/git/trees/d14'): return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tree': [{'path': 'reporte_2026-11-14.pdf', 'type': 'blob', 'sha': 'p2'}, {'path': 'reporte_2026-11-14.xlsx', 'type': 'blob', 'sha': 'x2'}, {'path': 'resumen.json', 'type': 'blob', 'sha': 'r2'}]}))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
def GEO(jid, fecha):
    c = [[-78.70, 1.50 + i * 0.0001] for i in range(30)]
    return {'type': 'FeatureCollection', 'jornada': {'id': jid, 'evaluador': 'OPERARIO ' + jid, 'usuario': '100000' + jid[-2:], 'fecha': fecha, 'inicio': fecha + 'T12:00:00Z', 'fin': fecha + 'T13:00:00Z',
            'hora_inicio': '07:00', 'hora_fin': '08:00', 'km': 1, 'ha_recorridas': 1, 'palmas_visitadas': 100, 'por_lote': []},
            'features': [{'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': c}, 'properties': {'tipo': 'recorrido', 'tiempos': [f'{fecha}T12:{i:02d}:00Z' for i in range(30)]}}]}
def INDICE(dia, arbol):
    f = f'2026-11-{dia}'
    return {'formato': 'sanidad-indice-1', 'fecha': f, 'arbol': arbol, 'archivos': [{'path': f'J{dia}{k}.geojson', 'sha': f'x{k}', 'zip': None, 'g': GEO(f'J{dia}{k}', f)} for k in range(3)]}
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1300, 'height': 950})
    ctx.route('https://api.github.com/**', gh)
    ad = ctx.new_page(); ad.on('pageerror', lambda e: errores.append('admin: ' + str(e)[:200])); dl = []
    ad.on('dialog', lambda d: (dl.append(d.message), d.accept()))
    ad.goto('http://127.0.0.1:8765/admin.html'); ad.wait_for_function("typeof entradaUsuario==='function'", timeout=20000)
    paq = ad.evaluate("""async()=>{const dkRaw=rnd(32),dk=await llaveDatos(dkRaw);const U=[];
      for(const [u,n,r] of [['admin1','ANA ADMIN','admin'],['op1','PEDRO PEREZ','operario']])U.push(await entradaUsuario(dk,dkRaw,u,n,r,'Clave1234',{}));
      return {formato:FORMATO,id:'p',creado:'',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'},kdf:{alg:'PBKDF2-SHA256',iter:ITER},token:await cifrar(dk,enc.encode('github_pat_prueba')),carto:{archivo:'carto.enc',version:'v1'},usuarios:U};}""")
    f = os.path.join(TMP, 'acceso_escala.json'); open(f, 'w', encoding='utf-8').write(json.dumps(paq))
    ad.click('#tabs button[data-t=editar]'); ad.set_input_files('#eArchivo', f); ad.fill('#eUser', 'admin1'); ad.fill('#eClave', 'Clave1234'); ad.click('#eAbrir')
    ad.wait_for_selector('#ePanel:not([hidden])', timeout=60000); time.sleep(.8)
    # --- Alertas y reportes ---
    ad.click('#aAbrir'); ad.wait_for_selector('#aEditor:not([hidden])', timeout=10000)
    ad.click('#aAdd'); ad.click('#aAdd'); time.sleep(.2)
    fl = ad.locator('#aDest tr')
    fl.nth(0).locator('[data-k=nombre]').fill('Gerencia'); fl.nth(0).locator('[data-k=correo]').fill('gerencia@ejemplo.com'); fl.nth(0).locator('[data-k=whatsapp]').fill('+57 300 111 2233')
    fl.nth(1).locator('[data-k=nombre]').fill('Supervisor'); fl.nth(1).locator('[data-k=whatsapp]').fill('+573004445566'); fl.nth(1).locator('[data-k=reporte_semanal]').uncheck()
    ad.fill('#aU2', '1,5'); ad.click('#aGuardar'); ad.wait_for_function("document.querySelector('#aMsg').textContent.includes('Guardado')", timeout=10000)
    c = json.loads(ARCH['config/alertas.json'])
    check('Alertas: guarda destinatarios, canales y umbrales', len(c['destinatarios']) == 2 and c['destinatarios'][0]['whatsapp'] == '+573001112233' and c['destinatarios'][1]['reporte_semanal'] is False
          and c['umbrales']['incidencia_lote_pct'] == 1.5 and c['whatsapp']['plantilla_reporte'] == 'sanidad_reporte_diario', c['destinatarios'])
    fl.nth(1).locator('[data-k=whatsapp]').fill('123'); ad.click('#aGuardar'); time.sleep(.4)
    check('Alertas: valida números de WhatsApp', 'no válido' in ad.inner_text('#aMsg'), ad.inner_text('#aMsg'))
    guia = ad.evaluate("document.querySelector('#aEditor').textContent")
    check('Alertas: guía de claves y plantillas', 'SMTP_USER' in guia and 'sanidad_alerta' in guia and 'WA_PHONE_ID' in guia)
    # --- Carga masiva: CSV ---
    csv = os.path.join(TMP, 'usuarios.csv')
    open(csv, 'w', encoding='utf-8-sig').write('Usuario;Nombre completo;Cargo;Cédula;Rol;Labores;Rol en cirugía;Contraseña;Estado\n'
        'op1;;Auxiliar líder;;;censo, cirugía;cirujano;;\nop2;Maria Lopez;Auxiliar;123;Operario;Censo;;Clave5678;Activo\nop3;Juan Ruiz;Auxiliar;;Supervisor;;;;\nmal usuario;X;;;;;;;\nop2;Repetido;;;;;;;\n')
    ad.set_input_files('#eImportF', csv); ad.wait_for_timeout(800)
    msg = dl[-1] if dl else ''
    check('CSV: resumen con nuevos, actualizados y errores', '2 usuario(s) nuevo(s)' in msg and '1 usuario(s) existente(s)' in msg and '2 fila(s) con error' in msg, msg[:200])
    filas = ad.evaluate("[...document.querySelectorAll('#eLista tr')].map(t=>t.innerText.replace(/\\s+/g,' '))")
    check('CSV: aplica los cambios (nuevos y existente actualizado)', any('op2' in r and 'MARIA LOPEZ' in r and 'NUEVO' in r for r in filas) and any('op3' in r and 'Supervisor' in r for r in filas)
          and any('op1' in r and 'Auxiliar líder' in r and 'Cirugía (cirujano)' in r and 'CAMBIOS' in r for r in filas), filas)
    # --- Excel ---
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active; ws.append(['usuario', 'nombre', 'rol', 'estado']); ws.append(['op4', 'Laura Gil', 'operario', '']); ws.append(['op1', '', '', 'Suspendido'])
    xl = os.path.join(TMP, 'usuarios.xlsx'); wb.save(xl)
    ad.set_input_files('#eImportF', xl); ad.wait_for_timeout(800)
    filas = ad.evaluate("[...document.querySelectorAll('#eLista tr')].map(t=>t.innerText.replace(/\\s+/g,' '))")
    check('Excel: crea op4 y suspende op1', any('op4' in r and 'LAURA GIL' in r for r in filas) and any('op1' in r and 'SUSPENDIDO' in r for r in filas), [r for r in filas if 'op4' in r or 'op1' in r])
    # --- Generar → historial ---
    ad.click('#eGuardar')
    for _ in range(40):
        if 'config/historial_usuarios.json' in ARCH: break
        ad.wait_for_timeout(250)
    h = json.loads(ARCH.get('config/historial_usuarios.json', '[]'))
    acc = {(x['u'], x['accion']) for x in h[0]['cambios']} if h else set()
    check('Historial: registra creados, editados y suspendidos con el administrador', h and h[0]['admin'] == 'ANA ADMIN' and ('op2', 'Creado') in acc and ('op4', 'Creado') in acc and ('op1', 'Suspendido') in acc and ('op1', 'Editado') in acc, sorted(acc))
    ad.click('#eHist'); ad.wait_for_function("document.querySelector('#eHistBox').innerText.includes('Creado')", timeout=8000)
    check('Historial: se puede consultar en la página', 'Suspendido' in ad.inner_text('#eHistBox'))
    # --- Visor: índice diario y reportes ---
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    pedidos = []; vz.on('request', lambda r: pedidos.append(r.url))
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof cargar==='function'", timeout=30000); time.sleep(1)
    vz.evaluate("""async()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;window.chunkLote=async()=>[];
      SES={u:'a',nombre:'A',rol:'admin',token:'t',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
      document.querySelector('#fDesde').value='2026-11-13';document.querySelector('#fHasta').value='2026-11-14';await cargar();}""")
    ids = vz.evaluate("JOR.map(j=>j.id).sort()")
    check('Visor: usa el índice al día (3 del 13) y lee una a una el día con índice viejo (1 del 14)', ids == ['J130', 'J131', 'J132', 'J14'], ids)
    check('Visor: el día con índice no se consulta archivo por archivo', not any('/git/trees/arbol13' in u for u in pedidos))
    vz.evaluate("document.querySelector('#btGer').click()"); time.sleep(.3); vz.click('[data-gt=reportes]')
    vz.wait_for_function("GER.reportes&&GER.reportes.diarios.length", timeout=10000); time.sleep(.3)
    T = vz.inner_text('#gerPanel')
    check('Visor: reportes diarios y semanales con PDF, interactivo y Excel', 'REPORTES DIARIOS' in T.upper() and '2026-11-14' in T and '2026-S46' in T and 'Interactivo' in T and 'Excel' in T, '')
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
