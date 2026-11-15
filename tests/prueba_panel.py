"""App: Panel del día (supervisor), lotes asignados por el plan de censo y línea de tiempo de la palma.
Visor: pestaña PLANIFICACIÓN (propone y guarda censo/plan/AAAA-MM-DD.json) e historia de la palma. GitHub simulado."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, TMP
import sys, time, json, re, base64, os
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
HOY = datetime.now().strftime('%Y-%m-%d')
RESUMEN = {'fecha': HOY, 'resumen': {'Ha recorridas': 12.5, 'Diagnósticos': 40, 'Casos de PC (palmas)': 3, 'PC vencidos sin cirugía': 1},
           'alertas': [{'tipo': 'cirugia', 'nivel': 'alta', 'texto': '1 caso de PC vencido sin cirugía'}],
           'operarios': [{'Operario': 'PEDRO PEREZ', 'Inicio': '06:10', 'Fin': '14:20', 'Ha': 12.5, 'Diagnósticos': 40}],
           'lotes_pc': [{'Lote': 'IT01', 'Casos PC': 3, 'Incidencia PC %': 0.3}]}
PLAN = {'fecha': HOY, 'asignaciones': [{'usuario': 'op1', 'nombre': 'PEDRO PEREZ', 'lotes': [{'lote': 'IT01', 'ha': 8.7}, {'lote': 'IT05', 'ha': 6.9}]}]}
EST = {'plan': None}
def gh(route):
    req = route.request; u = req.url; m = req.method
    if f'/contents/jornadas/{HOY}?' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'file', 'name': f'J{k}.geojson'} for k in range(4)]))
    if '/contents/reportes/diario?' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'dir', 'name': '2026-11-01', 'sha': 'd01'}, {'type': 'dir', 'name': HOY, 'sha': 'dhoy'}]
        + ([{'type': 'dir', 'name': '2026-11-02', 'sha': 'dnew'}] if EST.get('listo') else [])))
    if u.endswith('/git/trees/dnew'): return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tree': [{'path': 'reporte_2026-11-02.pdf', 'type': 'blob', 'sha': 'bp'}, {'path': 'reporte_2026-11-02.xlsx', 'type': 'blob', 'sha': 'bx'}, {'path': 'resumen.json', 'type': 'blob', 'sha': 'bj'}]}))
    if u.endswith('/git/blobs/bp') or u.endswith('/git/blobs/bx'): return route.fulfill(status=200, body=b'%PDF-prueba')
    if f'/contents/reportes/diario/{HOY}/reporte_{HOY}.pdf' in u: return route.fulfill(status=200, body=b'%PDF-1.4 prueba')
    if f'/contents/reportes/diario/{HOY}/resumen.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(RESUMEN))
    if f'/contents/censo/plan/{HOY}.json' in u and m == 'GET': return route.fulfill(status=200, content_type='application/json', body=json.dumps(PLAN))
    if '/contents/config/servicios.json' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ia': {'activo': True, 'url': 'https://ia.prueba.dev/', 'usuarios': []}}))
    if '/contents/solicitudes/reporte.json' in u:
        if m == 'PUT':
            b = json.loads(req.post_data); EST.setdefault('sol', []).append(json.loads(base64.b64decode(b['content']).decode('utf-8')))
            if EST['sol'][-1].get('fecha') == '2026-11-02': EST['listo'] = True
            return route.fulfill(status=201, content_type='application/json', body=json.dumps({'content': {'sha': 'solsha'}}))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': 'solsha'}))
    if '/contents/reportes?' in u: return route.fulfill(status=200, content_type='application/json', body='[]')
    if '/contents/censo/plan/' in u and m == 'PUT':
        b = json.loads(req.post_data); EST['plan'] = json.loads(base64.b64decode(b['content']).decode('utf-8'))
        return route.fulfill(status=201, content_type='application/json', body=json.dumps({'content': {'sha': 'plansha'}}))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1300, 'height': 950}, accept_downloads=True)
    ctx.route('https://api.github.com/**', gh)
    IAP = []
    def ia(route):
        if route.request.method == 'OPTIONS': return route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST'})
        IAP.append(json.loads(route.request.post_data)); h = route.request.headers.get('authorization', '')
        if h != 'Bearer tok': return route.fulfill(status=401, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body='{"error":"Sin acceso"}')
        route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body=json.dumps({'codigo': 'PC', 'opcion': 'PC AVANZADA', 'sintomas': ['Colapso de la flecha'], 'confianza': 'media', 'explicacion': 'Se ve la flecha caída.', 'modelo': 'claude-opus-5-5'}))
    ctx.route('https://ia.prueba.dev/**', ia)
    # ---------------- App ----------------
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof panelDia==='function'", timeout=30000); pg.wait_for_timeout(2000)
    r = pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'sup1',nombre:'Sara',rol:'supervisor'};S.cfg.gh={...S.cfg.gh,token:'tok',owner:'jjbuila',repo:'SanidadData',rama:'main'};
      menu();const tile=!!document.querySelector('#mDia');await panelDia();return {tile,txt:document.querySelector('#hojaCuerpo').innerText};}""")
    T = r['txt']
    check('App: menú «Panel del día» para supervisor', r['tile'])
    check('App: panel con jornadas de hoy, ha, PC y alertas del reporte', '4' in T and '12,5' in T and 'vencido sin cirugía' in T and 'PEDRO PEREZ' in T and 'IT01' in T and 'corte 3:00' in T, re.sub(r'\s+', ' ', T)[:300])
    pg.evaluate("window.confirm=()=>true"); pg.click('#pdEnviar'); pg.wait_for_timeout(800)
    sol = (EST.get('sol') or [{}])[-1]
    check('App: «Generar y enviar el reporte de hoy» deja la solicitud', sol.get('tipo') == 'diario' and sol.get('envio') == 'todos' and sol.get('fecha') == HOY and sol.get('solicitado_por') == 'Sara', sol)
    pg.evaluate('navigator.canShare=undefined')
    with pg.expect_download(timeout=10000) as dlp: pg.click('[data-pdx=pdf]')
    check('App: exporta el PDF del último reporte', dlp.value.suggested_filename == f'reporte_{HOY}.pdf', dlp.value.suggested_filename)
    op = pg.evaluate("()=>{SES={u:'op1',nombre:'PEDRO PEREZ',rol:'operario'};menu();return !!document.querySelector('#mDia')}")
    check('App: un operario no ve el panel del día', not op)
    r = pg.evaluate("""async()=>{await cargarPlanCenso();const ls=misLotesPlan().map(x=>x.lote);
      abrirHoja('Planificar jornada','<div id="plLista"></div>');const sel=[];window.alternarPlan=l=>sel.push(l);window.enPlan=()=>false;window.pintarPlanLista=()=>{};window.pintarPlanSel=()=>{};
      CARTO.lotes={IT01:{},IT05:{}};bannerPlan();const b=document.querySelector('#plAsig');const t=b?b.innerText:'';
      try{document.querySelector('#plUsar').click();}catch(e){}return {ls,t,sel};}""")
    check('App: lee los lotes asignados al operario', r['ls'] == ['IT01', 'IT05'], r['ls'])
    check('App: aviso «Lotes asignados para hoy» con hectáreas', 'IT01 · IT05' in r['t'] and '15,6' in r['t'], r['t'])
    check('App: «Usar los lotes asignados» los selecciona', r['sel'] == ['IT01', 'IT05'], r['sel'])
    t = pg.evaluate("""()=>{const d=n=>new Date(Date.now()-n*86400000).toISOString();
      return lineaTiempoPalma([{creado:d(60),n1:'PC',n2:'PC INICIAL',estado:'enferma'},{creado:d(40),n1:'PC',n2:'EN RECUPERACIÓN',estado:'tratamiento'}]);}""")
    check('App: línea de tiempo de la palma con aviso de recuperación vencida', 'PC INICIAL' in t and 'EN RECUPERACIÓN' in t and 'hace 40 días' in t, re.sub('<[^>]+>', ' ', t)[:200])
    # ---------------- Piloto de IA ----------------
    r = pg.evaluate("""async()=>{try{SES={u:'op1',nombre:'PEDRO PEREZ',rol:'operario'};await cargarServiciosIA();const disp=iaDisponible();
      const pid='IAP1';const j={id:'JIA',estado:'activa',evaluador:'PEDRO PEREZ',usuario:'op1',inicio:new Date().toISOString(),seleccion:[{lote:'IT01'}],densidad:115,buffer:5,km:0,sync:'pendiente'};await dbPut('jornadas',j);S.jornada=j;
      S.idx.set(pid,{type:'Feature',geometry:{type:'Point',coordinates:[-78.7,1.5]},properties:{_id:pid,_lote:'IT01',_linea:3,_num:4}});S.gps={lat:1.50002,lng:-78.7,acc:4,t:Date.now()};
      await abrirFormulario({palma_id:pid});const bt=document.querySelector('#btIA');if(!bt)return {disp,err:'sin botón'};
      const cv=document.createElement('canvas');cv.width=1600;cv.height=1200;cv.getContext('2d').fillRect(0,0,50,50);const bl=await new Promise(ok=>cv.toBlob(ok,'image/jpeg',.9));
      F.fotosNuevas.push({id:'FIA',buf:await bl.arrayBuffer(),type:'image/jpeg'});bt.click();
      for(let k=0;k<40&&!document.querySelector('#iaUsar');k++)await new Promise(ok=>setTimeout(ok,100));const sug=document.querySelector('#iaBox').innerText;
      document.querySelector('#iaUsar').click();await new Promise(ok=>setTimeout(ok,200));const frm=document.querySelector('#frm');
      const chk=n=>[...frm.querySelectorAll(`input[name="${n}"]:checked`)].map(x=>x.value);const sel={n1:chk('n1'),n2:chk('n2'),s:chk('sintomas')};
      const m=v=>{const i=frm.querySelector(`input[name="${v[0]}"][value="${v[1]}"]`);if(i){i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));}};
      m(['n2','PC INICIAL']);for(const v of [['cirugia','No'],['produccion','Sí'],['transitabilidad',TRANSIT[0]]])m(v);
      await guardarRegistro(frm);const reg=S.registros.find(x=>x.palma_id===pid);return {disp,sug,sel,ia:reg&&reg.ia,pl:reg&&planos(reg)};}catch(e){return {err:e.message,st:String(e.stack).slice(0,400)};}}""")
    check('IA: botón disponible con config/servicios.json activo', r.get('disp') and not r.get('err'), r.get('err', '') + str(r.get('st', '')))
    if not r.get('err'):
        check('IA: envía la foto reducida (1024 px) con el token y las opciones del formulario', IAP and len(IAP[-1]['opciones']) > 20 and IAP[-1]['contexto']['lote'] == 'IT01' and len(IAP[-1]['imagen']) > 100)
        check('IA: muestra la sugerencia con confianza y explicación', 'PC AVANZADA' in r['sug'] and 'media' in r['sug'] and 'flecha caída' in r['sug'], r['sug'])
        check('IA: «Aplicar sugerencia» marca enfermedad, opción y síntomas', r['sel']['n1'] == ['PC'] and r['sel']['n2'] == ['PC AVANZADA'] and 'Colapso de la flecha' in r['sel']['s'], r['sel'])
        check('IA: registra la sugerencia y si coincidió con el diagnóstico final (el operario la corrigió)', r['ia'] and r['ia']['sugerido'] == 'PC' and r['ia']['aplicada'] and r['ia']['acerto'] is False and r['pl'].get('ia_sugerido') == 'PC › PC AVANZADA', r['ia'])
    # ---------------- Visor ----------------
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof pintarPlanCenso==='function'", timeout=30000); vz.wait_for_timeout(1000)
    vz.evaluate("""()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();window.chunkLote=async()=>[];
      SES={u:'admin1',nombre:'Admin',rol:'admin',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
      CIR.usuarios=[{u:'op1',nombre:'PEDRO PEREZ',rol:'operario',labores:['censo']},{u:'op2',nombre:'MARIA LOPEZ',rol:'operario',labores:['censo']},{u:'sup1',nombre:'Sara',rol:'supervisor'},{u:'x',nombre:'Susp',rol:'operario',inactivo:true}];
      window.cirUsuarios=async()=>CIR.usuarios;
      const hoy=hoyISO();const mk=(id,u,nom,fecha,lote,pid)=>{const t0=Date.parse(fecha+'T07:00:00-05:00');const c=[],t=[];for(let i=0;i<=60;i++){c.push([-78.70,1.50+i*0.0001]);t.push(t0+i*60000);}
        const ds=[{tipo:'diagnostico',id:id+'d',palma_id:pid,lote,linea:3,palma:1,nivel1:'PUDRICIÓN DE COGOLLO (PC)',n1_codigo:'PC',nivel2:id==='J2'?'EN RECUPERACIÓN':'PC INICIAL',estado:'enferma',evaluador:nom,creado:new Date(t0+600000).toISOString(),lat:1.5,lng:-78.70,n_fotos:0}];
        const j={id,fecha,evaluador:nom,usuario:u,inicio:new Date(t0).toISOString(),fin:new Date(t0+3600000).toISOString(),hora_inicio:'07:00',hora_fin:'08:00',duracion_min:60,km:1,ha:8,palmas:900,metodo:'calle',
          n_paradas:0,min_paradas:0,min_mov:60,por_lote:[{lote,palmas_visitadas:900,ha:8}],densidad:115,app:'',lotes:new Set([lote]),paradas:[],track:{c,t,acc:c.map(()=>4)},header:{},secuencias:null,tiempos:{min_efectivo_labor:60},vel:2,diags:ds};
        ds.forEach(d=>d._j=j);return j;};
      JOR=[mk('J1','op1','PEDRO PEREZ',hoyISO(new Date(Date.now()-50*86400000)),'IT01','PX'),mk('J2','op2','MARIA LOPEZ',hoyISO(new Date(Date.now()-10*86400000)),'IT01','PX'),mk('J3','op2','MARIA LOPEZ',hoyISO(new Date(Date.now()-3*86400000)),'IT09','PY')];
      LOTES={type:'FeatureCollection',features:['IT01','IT05','IT09','IT12'].map((l,k)=>({type:'Feature',properties:{_lote:l},geometry:{type:'Polygon',coordinates:[[[-78.701+k*0.01,1.499],[-78.699+k*0.01,1.499],[-78.699+k*0.01,1.512],[-78.701+k*0.01,1.512],[-78.701+k*0.01,1.499]]]}}))};
      IND_LOTES={IT01:{n:1000},IT05:{n:800},IT09:{n:500},IT12:{n:900}};
      document.querySelector('#fDesde').value=hoyISO(new Date(Date.now()-60*86400000));document.querySelector('#fHasta').value=hoy;aplicarFiltros(false);}""")
    vz.evaluate("document.querySelector('#btCoord').click()"); vz.wait_for_timeout(300); vz.click('[data-gt=plan]')
    vz.wait_for_function("GER.plan.ops&&GER.plan.ops.length", timeout=10000); vz.wait_for_timeout(300)
    ops = vz.evaluate("GER.plan.ops.map(o=>o.usuario)")
    check('Visor: operarios activos de censo (sin supervisores ni suspendidos)', ops == ['op1', 'op2'], ops)
    vz.click('#plProp'); vz.wait_for_timeout(300)
    res = vz.evaluate("GER.plan.res.map(a=>({u:a.usuario,l:a.lotes.map(x=>x.lote)}))")
    todos = [l for a in res for l in a['l']]
    check('Visor: propone primero los lotes sin censo, sin repetir ni incluir los censados hace menos de 7 días', 'IT09' not in todos and len(todos) == len(set(todos)) and {res[0]['l'][0], res[1]['l'][0]} == {'IT05', 'IT12'}, res)
    vz.evaluate("GER.plan.ops.forEach(o=>o.meta=40)"); vz.click('#plProp'); vz.wait_for_timeout(300)
    res = vz.evaluate("GER.plan.res.map(a=>({u:a.usuario,l:a.lotes.map(x=>x.lote)}))")
    check('Visor: con más meta de ha agrega lotes cercanos atrasados (IT01, 10 días)', 'IT01' in [l for a in res for l in a['l']], res)
    vz.locator('[data-pl="op2"]').fill('it12, IT05')
    vz.click('#plGuardar')
    for _ in range(40):
        if EST['plan']: break
        vz.wait_for_timeout(250)
    P = EST['plan'] or {}
    a2 = next((a for a in P.get('asignaciones', []) if a['usuario'] == 'op2'), {})
    check('Visor: guarda el plan editado en censo/plan', P.get('formato') == 'sanidad-plan-censo-1' and [x['lote'] for x in a2.get('lotes', [])] == ['IT12', 'IT05'] and a2['lotes'][0]['ha'] > 7, P)
    vz.click('[data-gt=reportes]'); vz.wait_for_selector('#rmIr', timeout=8000)
    vz.select_option('#rmTipo', 'semanal'); vz.select_option('#rmEnvio', 'correos'); vz.fill('#rmPara', 'gerente@ejemplo.com; Jefe@Ejemplo.com')
    vz.evaluate("GER.reportes=null;pintarGer()"); vz.wait_for_function("GER.reportes&&!GER.cargandoRep", timeout=8000); vz.wait_for_timeout(200)
    check('Visor: lo elegido se conserva al recargar la lista de reportes', vz.input_value('#rmTipo') == 'semanal' and vz.input_value('#rmEnvio') == 'correos' and 'gerente' in vz.input_value('#rmPara'))
    check('Visor: «Solo a estos correos» muestra el campo', vz.is_visible('#rmPara'))
    vz.fill('#rmPara', 'gerente@ejemplo.com; Jefe@Ejemplo.com'); vz.once('dialog', lambda d: d.accept()); vz.click('#rmIr')
    vz.wait_for_function("document.querySelector('#rmMsg').textContent.includes('Solicitado')", timeout=8000)
    sol = EST['sol'][-1]
    check('Visor: solicitud manual con tipo, fecha y correos puntuales', sol['tipo'] == 'semanal' and sol['envio'] == 'correos' and sol['para'] == ['gerente@ejemplo.com', 'jefe@ejemplo.com'] and sol['solicitado_por'] == 'Admin', sol)
    vz.select_option('#rmEnvio', 'correos'); vz.fill('#rmPara', 'no-es-correo'); vz.click('#rmIr'); vz.wait_for_timeout(300)
    check('Visor: valida los correos antes de solicitar', 'correos válidos' in vz.inner_text('#rmMsg') and len(EST['sol']) == 2)
    sem = vz.evaluate("['2026-11-14','2026-01-01','2027-01-04','2026-12-31'].map(semanaISO)")
    check('Visor: semana ISO del reporte semanal', sem == ['2026-S46', '2026-S01', '2027-S01', '2026-S53'], sem)
    vz.evaluate("GER.rmPaso=500;window.confirm=()=>true"); vz.select_option('#rmTipo', 'diario'); vz.fill('#rmFecha', '2026-11-02'); vz.select_option('#rmEnvio', 'ninguno')
    with vz.expect_download(timeout=15000) as dlv: vz.click('#rmIr')
    import zipfile
    zp = os.path.join(TMP, 'rep.zip'); dlv.value.save_as(zp); nombres = sorted(zipfile.ZipFile(zp).namelist())
    check('Visor: «solo generar y descargar» espera el reporte y descarga el ZIP', dlv.value.suggested_filename == 'reporte_sanidad_2026-11-02.zip' and nombres == ['reporte_2026-11-02.pdf', 'reporte_2026-11-02.xlsx'], nombres)
    vz.wait_for_timeout(300)
    check('Visor: muestra «Reporte listo» con sus archivos', 'REPORTE LISTO' in vz.inner_text('#gerPanel').upper() and EST['sol'][-1]['envio'] == 'ninguno', vz.evaluate('JSON.stringify({l:GER.rm.listo,p:GER.rm.pend,t:GER.tab})')[:300])
    vz.click('#gerX'); vz.wait_for_timeout(200)
    h = vz.evaluate("()=>{const d=JOR[1].diags[0];verHistoriaPalma(d);return document.querySelector('.leaflet-popup-content').innerText}")
    check('Visor: historia de la palma con sus censos en orden', h.count('Censo') == 2 and h.index('PC INICIAL') < h.index('EN RECUPERACI'), h[:200])
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
