"""Módulo de erradicación: casos (PC cráter, espontáneas y yarumos) a partir del censo, programación con equipos mixtos,
aprobación de existencia 0 (analista o super administrador) y labor de erradicación en la App (método, producto y dosis,
fotos, corrección del reporte). GitHub simulado, datos ficticios."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, json, re, base64, time
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
HOY = datetime.now().strftime('%Y-%m-%d')
EST = {'prog': None, 'aj': None, 'puts': []}
PROG_APP = {'formato': 'sanidad-programacion-erradicacion-1', 'fecha': HOY, 'equipos': [
    {'n': 1, 'color': '#ff8a65', 'erradicador': {'u': 'e1', 'nombre': 'ERRADICADOR UNO'}, 'auxiliar': None, 'eficiencia': 10, 'km': 1.2, 'km_campo': 0.8, 'ruta': [],
     'ordenes': [{'id': 'o1', 'orden': 1, 'palma_id': 'Q1', 'lote': 'IT01', 'linea': 3, 'palma': 7, 'lat': 1.5001, 'lng': -78.7001, 'tipo': 'CRATER', 'diagnostico': 'PUDRICIÓN DE COGOLLO (PC) · CRATER',
                  'fecha_censo': HOY, 'vence': HOY, 'censador': 'CENSADOR X', 'diag_id': 'dq1'},
                 {'id': 'o2', 'orden': 2, 'palma_id': 'Q2', 'lote': 'IT01', 'linea': 4, 'palma': 2, 'lat': 1.5003, 'lng': -78.7001, 'tipo': 'ESPONTANEA', 'diagnostico': 'ESPONTANEA',
                  'fecha_censo': HOY, 'vence': HOY, 'censador': 'CENSADOR X', 'diag_id': 'dq2'}]}]}
AJ_APP = {'formato': 'sanidad-ajustes-existencia-1', 'ajustes': [{'palma_id': '777', 'existe': 0, 'motivo': 'erradicada'}], 'rechazos': []}
def esperar(f, t=8):
    fin = time.time() + t
    while time.time() < fin:
        if f(): return True
        vz.wait_for_timeout(200)   # espera sin bloquear Playwright (las respuestas simuladas de GitHub se procesan aquí)
    return False
def b64(o): return base64.b64encode(json.dumps(o).encode('utf-8')).decode()
def gh(route):
    req = route.request; u = req.url; m = req.method
    if m == 'PUT':
        ruta = re.search(r'/contents/([^?]+)', u).group(1); cuerpo = json.loads(base64.b64decode(json.loads(req.post_data)['content']).decode('utf-8'))
        EST['puts'].append(ruta)
        if 'erradicacion/programacion/' in ruta: EST['prog'] = cuerpo
        if 'ajustes_existencia' in ruta: EST['aj'] = cuerpo
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': {'sha': 's%d' % len(EST['puts'])}}))
    if 'cartografia/ajustes_existencia.json' in u:
        a = EST['aj'] if EST['aj'] is not None else (AJ_APP if 'raw' in (req.headers.get('accept') or '') else None)
        if a is None: return route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
        if 'raw' in (req.headers.get('accept') or ''): return route.fulfill(status=200, content_type='application/json', body=json.dumps(a))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': 'aj0', 'content': b64(a)}))
    if f'erradicacion/programacion/{HOY}.json' in u and 'raw' in (req.headers.get('accept') or ''): return route.fulfill(status=200, content_type='application/json', body=json.dumps(PROG_APP))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
errores = []
ayer = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%dT10:00:00.000Z')
DATOS = """([ayer])=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();
  SES={u:'an1',nombre:'Ana Analista',rol:'analista',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
  const t=(m)=>new Date(Date.parse(ayer)+m*60000).toISOString();
  const d=(pid,n1c,n1,n2,m,extra={})=>({tipo:'diagnostico',id:'d'+pid+m,palma_id:pid,lote:'IT01',linea:3,palma:Number(pid.replace(/\\D/g,''))||1,n1_codigo:n1c,nivel1:n1,nivel2:n2,estado:'enferma',evaluador:'CENSADOR X',creado:t(m),lat:1.5+m*1e-5,lng:-78.7,...extra});
  const jc={fecha:ayer.slice(0,10)};
  ERR.usuarios=[{u:'e1',nombre:'ERRADICADOR UNO',labores:['erradicacion'],rol_erradicacion:'erradicador'},{u:'e2',nombre:'ERRADICADOR DOS',labores:['erradicacion'],rol_erradicacion:'erradicador'},
    {u:'a1',nombre:'AUXILIAR UNO',labores:['erradicacion'],rol_erradicacion:'auxiliar'},{u:'c9',nombre:'CIRUJANO',labores:['cirugia'],rol_cirugia:'cirujano'}];
  ERR.diags=[d('P1','PC','PUDRICIÓN DE COGOLLO (PC)','CRATER',1),d('P2','ESP','ESPONTANEA','',2),d('P3','YAR','YARUMO','YARUMO EN LOTE',3),d('P4','PC','PUDRICIÓN DE COGOLLO (PC)','PC INICIAL',4),
    d('P5','PC','PUDRICIÓN DE COGOLLO (PC)','CRATER',5),d('P6','PC','PUDRICIÓN DE COGOLLO (PC)','CRATER',6),d('P7','YAR','YARUMO','YARUMO EN CALLE',7),d('P8','ESP','ESPONTANEA','',8)].map(x=>({...x,_j:jc}));
  ERR.correcciones=[{...d('P5','PC','PUDRICIÓN DE COGOLLO (PC)','PC INICIAL',30),origen:'correccion',autor_rol:'erradicador',_labor:'erradicacion',corrige_texto:'CRATER',_j:jc}];
  const e=(pid,tipo,m,extra={})=>({tipo:'erradicacion',id:'E'+pid,palma_id:pid,lote:'IT01',linea:3,palma:Number(pid.replace(/\\D/g,'')),tipo_erradicacion:tipo,metodo:'Motosierra',creado:t(m),lat:1.5,lng:-78.7,
    requiere_aprobacion:tipo!=='YARUMO',erradicador:'e1',erradicador_nombre:'ERRADICADOR UNO',fotos:'fa.jpg|fd.jpg',_j:{zipSha:'z'},...extra});
  ERR.errs=[e('P6','CRATER',60,{metodo:'Química',producto:'Mesa Mate',dosis:25,dosis_unidad:'ml'}),e('P7','YARUMO',61),e('P8','ESPONTANEA',62)];
  ERR.aj={formato:'sanidad-ajustes-existencia-1',ajustes:[],rechazos:[]};VAJ=new Set();
  calcularPendErr();ERR.cargado=true;ERR.fecha=hoyISO();ERR.equipos=[{erradicador:'e1',auxiliar:'',ef:5},{erradicador:'e2',auxiliar:'a1',ef:5}];}"""
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1400, 'height': 950})
    ctx.route('https://api.github.com/**', gh)
    # ---------------- Visor ----------------
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200])); vz.on('dialog', lambda d: d.accept('Foto no corresponde') if d.type == 'prompt' else d.accept())
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof errCargar==='function'", timeout=30000); time.sleep(1)
    vz.evaluate(DATOS, [ayer])
    pend = vz.evaluate("ERR.pend.map(o=>o.palma_id+':'+o.tipo)")
    check('Casos: cráter, espontánea y yarumo pendientes, en orden de prioridad', pend == ['P1:CRATER', 'P2:ESPONTANEA', 'P3:YARUMO'], pend)
    check('Casos: PC inicial no se erradica; la corrección del erradicador y las ya erradicadas salen', not any(x.startswith(('P4', 'P5', 'P6', 'P7', 'P8')) for x in pend))
    check('Plazo: día hábil siguiente al reporte', vz.evaluate("ERR.pend[0].vence===habilMas(ERR.pend[0].fecha_censo)"))
    # Coordinación → Programador de erradicación
    vz.click('#btCoord'); time.sleep(.3); vz.click('[data-gt=progerr]'); time.sleep(.3)
    check('Coordinación: pestaña Programador de erradicación', 'PROGRAMADOR DE ERRADICACIÓN' in vz.inner_text('#gerPanel').upper())
    vz.click('#gerAbrirErr'); time.sleep(.6)
    check('Abre el programador en el mapa', vz.evaluate("ERR.on&&document.body.classList.contains('modo-err')&&!document.querySelector('#errPanel').hidden"))
    T = vz.inner_text('#errPanel')
    check('Equipos mixtos con eficiencia de 5 a 30', 'Trabaja solo' in T and vz.evaluate("[...document.querySelectorAll('#errPanel select[data-k=ef] option')].map(o=>+o.value).join(',')").startswith('5,10,15,20,25,30'), T[:200])
    vz.click('#errGenerar'); time.sleep(.5)
    pr = vz.evaluate("ERR.prog")
    check('Programación: reparte los 3 casos en 2 equipos', pr and len(pr['equipos']) == 2 and sum(len(e['ordenes']) for e in pr['equipos']) == 3 and pr['equipos'][0]['auxiliar'] is None and pr['equipos'][1]['auxiliar']['u'] == 'a1', pr and [len(e['ordenes']) for e in pr['equipos']])
    vz.click('#errEnviar'); esperar(lambda: EST['prog'])
    check('Programación enviada a erradicacion/programacion/', EST['prog'] and EST['prog']['formato'] == 'sanidad-programacion-erradicacion-1' and EST['prog']['fecha'] == vz.evaluate("ERR.fecha"), EST['puts'][-1:])
    # Aprobaciones
    vz.click('[data-et=aprob]'); time.sleep(.4)
    T = vz.inner_text('#errPanel')
    check('Aprobaciones: cráter y espontánea por aprobar (el yarumo no aplica)', vz.evaluate("porAprobar().map(e=>e.palma_id).join(',')") == 'P6,P8' and 'APROBACIONES (2)' in T.upper(), T[:160])
    vz.click('[data-apr="0"]'); esperar(lambda: EST['aj'] and EST['aj'].get('ajustes')); vz.wait_for_timeout(500)
    aj = EST['aj'] or {}
    check('Aprobar: P6 queda con existencia 0 en cartografia/ajustes_existencia.json', any(a['palma_id'] == 'P6' and a['existe'] == 0 and a['aprobado_por'] == 'an1' and a['producto'] == 'Mesa Mate' for a in aj.get('ajustes', [])) and vz.evaluate("VAJ.has('P6')"), aj)
    vz.click('[data-rec="0"]'); esperar(lambda: EST['aj'] and EST['aj'].get('rechazos')); vz.wait_for_timeout(500)
    aj = EST['aj'] or {}
    check('Rechazar: P8 queda rechazada y vuelve a pendientes', any(r['palma_id'] == 'P8' and r['motivo'] == 'Foto no corresponde' for r in aj.get('rechazos', [])) and 'P8:ESPONTANEA' in vz.evaluate("ERR.pend.map(o=>o.palma_id+':'+o.tipo)"), aj.get('rechazos'))
    sup = vz.evaluate("(()=>{SES={...SES,rol:'supervisor'};ERR.tab='aprob';pintarErr();const t=document.querySelector('#errPanel').innerText;SES={...SES,rol:'analista'};return t})()")
    check('Solo el analista o el super administrador ven las aprobaciones', 'APROBACIONES' not in sup.upper())
    vz.evaluate("ERR.tab='seg';pintarErr()"); time.sleep(.3)
    T = vz.inner_text('#errPanel')
    check('Seguimiento: método, producto y dosis, estado de aprobación', 'Mesa Mate' in T and 'existencia 0' in T and 'rechazada' in T and 'Exportar' in T, T[:200])
    # ---------------- App ----------------
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof abrirInicioErr==='function'", timeout=30000); time.sleep(1.5)
    r = pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'e1',nombre:'ERRADICADOR UNO',rol:'operario',labores:['censo','erradicacion'],rol_erradicacion:'erradicador'};
      S.cfg.gh={...S.cfg.gh,token:'tok',owner:'jjbuila',repo:'SanidadData',rama:'main'};ERRA.usuarios=[{u:'a1',nombre:'AUXILIAR UNO',rol_erradicacion:'auxiliar'}];
      elegirLabor();const lab=document.querySelector('#hojaCuerpo').innerText;
      await cargarAjustesExistencia();const f=featPalma(['P6',1,1,1,-78.7,1.5],'IT01'),f2=featPalma([778,1,2,1,-78.7,1.5],'IT01');
      return {lab,aj:f.properties._existe,aj2:f2.properties._existe,labores:laboresSES()};}""")
    check('App: la labor Erradicación aparece al iniciar', 'ERRADICACIÓN' in r['lab'] and 'CENSO' in r['lab'], r['lab'])
    check('App: palma con existencia 0 aprobada se ve como no existente', r['aj'] is False and r['aj2'] is True, r)
    pg.click('#lbErr'); pg.wait_for_selector('#eIni', timeout=8000); time.sleep(1)
    T = pg.inner_text('#hojaCuerpo')
    check('App: encuentra su equipo en la programación (trabaja solo)', 'Equipo 1' in T and '2 palmas' in T and 'trabaja solo' in T and pg.input_value('#ePar') == '__solo', T[-220:])
    pg.evaluate("window.motivoNoIniciar=()=>null;window.iniciarGPS=()=>{};window.revisarSegundoPlano=()=>{};S.gps={lat:1.5001,lng:-78.7001,acc:4,t:Date.now()}")
    pg.click('#eIni'); time.sleep(1.2)
    j = pg.evaluate("({l:S.jornada&&S.jornada.labor,n:S.jornada&&S.jornada.ordenes.length,solo:S.jornada&&S.jornada.equipo.auxiliar===null,panel:!document.querySelector('#pe').hidden,txt:document.querySelector('#pe').innerText})")
    check('App: jornada de erradicación con su ruta', j['l'] == 'erradicacion' and j['n'] == 2 and j['solo'] and j['panel'] and 'PC cráter' in j['txt'], j)
    pg.evaluate("abrirPalmaErr('Q1')"); time.sleep(.4); pg.click('#peErr'); pg.wait_for_selector('#frmErr', timeout=5000); time.sleep(.3)
    pg.check('#frmErr input[name=metodo][value="Química"]', force=True); time.sleep(.2)
    falta = pg.inner_text('#eFalta')
    pg.fill('#eDosis', '25')
    pg.evaluate("""()=>{const t=Date.now();F.cir.antes={id:'fa1',buf:new ArrayBuffer(8),t:t-180000};F.cir.despues={id:'fd1',buf:new ArrayBuffer(8),t};document.querySelector('#frmErr').dispatchEvent(new Event('change'));}""")
    check('App: química pide producto, dosis y fotos', 'dosis' in falta and 'foto' in falta and pg.evaluate("document.querySelector('#frmErr input[name=prod]:checked').value") == 'Mesa Mate', falta)
    pg.evaluate("document.querySelector('#frmErr').requestSubmit()"); time.sleep(1)
    reg = pg.evaluate("S.registros.filter(r=>r.tipo==='erradicacion').map(r=>({t:r.tipo_erradicacion,m:r.metodo,p:r.producto,d:r.dosis,u:r.dosis_unidad,a:r.requiere_aprobacion,f:r.fotos.length,dur:r.duracion_min,o:r.origen}))")
    check('App: erradicación química guardada con producto, dosis y fotos', reg == [{'t': 'CRATER', 'm': 'Química', 'p': 'Mesa Mate', 'd': 25, 'u': 'ml', 'a': True, 'f': 2, 'dur': 3, 'o': 'programada'}], reg)
    pg.evaluate("abrirPalmaErr('Q2')"); time.sleep(.4); pg.click('#peCorr'); pg.wait_for_selector('#frmCorrE', timeout=5000)
    pg.check('#frmCorrE input[name=cc][value=pc_inicial]', force=True)
    pg.evaluate("()=>{F.cir.antes={id:'fe1',buf:new ArrayBuffer(8),t:Date.now()};document.querySelector('#frmCorrE').dispatchEvent(new Event('change'));document.querySelector('#frmCorrE').requestSubmit();}"); time.sleep(1)
    c = pg.evaluate("(()=>{const r=S.registros.find(x=>x.tipo==='diagnostico'&&x.origen==='correccion');return r?{n2:r.n2,rol:r.autor_rol,antes:r.corrige_texto,cir:esCasoCirugia(r),est:S.jornada.ordenes[1].estado}:null})()")
    check('App: corrección del reporte con versión (PC inicial pasa a cirugía)', c and c['n2'] == 'PC INICIAL' and c['rol'] == 'erradicador' and c['antes'] == 'ESPONTANEA' and c['cir'] and c['est'] == 'corregida', c)
    g = pg.evaluate("(()=>{const j=S.jornada;const g=geoErradicacion(j,S.registros.filter(r=>r.jornada_id===j.id),[],new Date().toISOString(),'x.zip');return {l:g.jornada.labor,e:g.jornada.erradicaciones,q:g.jornada.quimicas,c:g.jornada.correcciones,n:g.features.length,tipos:g.features.map(f=>f.properties.tipo).sort()}})()")
    check('App: archivo de sincronización de la jornada de erradicación', g['l'] == 'erradicacion' and g['e'] == 1 and g['q'] == 1 and g['c'] == 1 and g['tipos'] == ['diagnostico', 'erradicacion'], g)
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
