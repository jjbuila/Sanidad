"""Visor · GERENCIA: tablero, cirugía, sincronización, calidad, auditoría (y App), reportes. GitHub simulado."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import sys, time, json, re
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
from datetime import datetime, timedelta, timezone
AHORA = datetime.now(timezone.utc)
iso = lambda d: d.strftime('%Y-%m-%dT%H:%M:%SZ')
COMMITS = [
    {'commit': {'message': 'Sanidad Vegetal · GOMEZ PEREZ ANDRES · jornada 2026-11-14 · 3 diagnóstico(s) · u:1000000001', 'committer': {'date': iso(AHORA - timedelta(hours=3))}}},
    {'commit': {'message': 'Sanidad Vegetal · LOPEZ DIAZ CARLOS · jornada 2026-11-08 · 2 diagnóstico(s)', 'committer': {'date': iso(AHORA - timedelta(days=6))}}},
    {'commit': {'message': 'Pruebas fuera del visor', 'committer': {'date': iso(AHORA - timedelta(days=1))}}}]
EST = {'guardado': None, 'puts': []}
def gh(route):
    req = route.request; u = req.url; m = req.method
    if '/commits?' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(COMMITS if re.search(r'[?&]page=1(&|$)', u) else []))
    if m == 'PUT' and '/contents/auditoria/' in u:
        b = json.loads(req.post_data); import base64; EST['guardado'] = json.loads(base64.b64decode(b['content']).decode('utf-8')); EST['puts'].append(u)
        return route.fulfill(status=201, content_type='application/json', body=json.dumps({'content': {'sha': 'audsha'}}))
    if '/contents/auditoria?' in u:
        l = [{'type': 'file', 'name': EST['guardado']['id'] + '.json', 'sha': 'audsha'}] if EST['guardado'] else []
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(l))
    if u.endswith('/git/blobs/audsha'): return route.fulfill(status=200, body=json.dumps(EST['guardado']), content_type='application/json')
    if '/contents/auditoria/' in u and m == 'GET': return route.fulfill(status=200, body=json.dumps(EST['guardado']), content_type='application/json')
    if '/contents/jornadas?' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'dir', 'name': AHORA.strftime('%Y-%m-%d'), 'sha': 'dia1'}]))
    if u.endswith('/git/trees/dia1'): return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tree': [{'path': 'JSUP.geojson', 'type': 'blob', 'sha': 'gsup'}]}))
    if u.endswith('/git/blobs/gsup'):
        g = EST['guardado']; feats = []
        for k, x in enumerate(g['palmas'][:2]):  # el auditor registra 2 palmas: una coincide y otra no
            n1 = x['original']['n1_codigo'] if k == 0 else 'ML'
            feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [x['lng'], x['lat']]}, 'properties': {'tipo': 'diagnostico', 'palma_id': x['palma_id'], 'n1_codigo': n1,
                'nivel1': 'X', 'nivel2': x['original']['nivel2'] if k == 0 else '', 'creado': iso(AHORA), 'auditoria': g['id']}})
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'type': 'FeatureCollection', 'jornada': {'usuario': 'sup1', 'evaluador': 'Sara Supervisora'}, 'features': feats}))
    if '/contents/reportes?' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'type': 'dir', 'name': '2026-S45', 'sha': 'rep45'}]))
    if u.endswith('/git/trees/rep45'): return route.fulfill(status=200, content_type='application/json', body=json.dumps({'tree': [{'path': 'reporte_2026-S45.pdf', 'type': 'blob', 'sha': 'p1'}, {'path': 'reporte_2026-S45.xlsx', 'type': 'blob', 'sha': 'x1'}]}))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
DATOS = """()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();window.chunkLote=async()=>[];
  SES={u:'admin1',nombre:'Admin',rol:'admin',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
  CIR.usuarios=[{u:'1000000001',nombre:'GOMEZ PEREZ ANDRES',rol:'operario',labores:['censo']},{u:'1000000002',nombre:'LOPEZ DIAZ CARLOS',rol:'operario',labores:['censo']},
    {u:'1000000003',nombre:'MORA RUIZ JAVIER',rol:'operario',labores:['censo','cirugia'],rol_cirugia:'cirujano'},{u:'sup1',nombre:'Sara Supervisora',rol:'supervisor'},{u:'x9',nombre:'Suspendido',rol:'operario',inactivo:true}];
  const hoy=hoyISO();const mk=(id,u,nom,fecha,diags)=>{const t0=Date.parse(fecha+'T07:00:00-05:00');const c=[],t=[];for(let i=0;i<=60;i++){c.push([-78.70,1.50+i*0.0001]);t.push(t0+i*60000);}
    const ds=diags.map((x,k)=>({tipo:'diagnostico',id:id+'d'+k,palma_id:id+'P'+k,lote:x.lote||'IT01',linea:3,palma:k+1,nivel1:x.n1n||'PUDRICIÓN DE COGOLLO (PC)',n1_codigo:x.n1||'PC',nivel2:x.n2||'PC INICIAL',
      estado:x.est||'enferma',evaluador:nom,creado:new Date(t0+(x.min??(5+k*3))*60000+(x.s||0)*1000).toISOString(),lat:1.50+k*0.0002,lng:-78.70,n_fotos:x.sinFoto?0:1,fotos:'f.jpg',dist_gps_palma_m:x.dist||3,gps_precision_m:x.prec||5}));
    const j={id,fecha,evaluador:nom,usuario:u,inicio:new Date(t0).toISOString(),fin:new Date(t0+60*60000).toISOString(),hora_inicio:'07:00',hora_fin:'08:00',duracion_min:60,km:1.2,ha:2.5,palmas:280,metodo:'calle',
      n_paradas:1,min_paradas:10,min_mov:50,por_lote:[{lote:'IT01',palmas_visitadas:280,ha:2.5}],densidad:115,app:'',lotes:new Set(['IT01']),paradas:[],track:{c,t,acc:c.map(()=>4)},header:{},secuencias:null,tiempos:{min_efectivo_labor:50},vel:2,diags:ds};
    ds.forEach(d=>d._j=j);return j;};
  const lejos={dist:40},imp={prec:30};
  JOR=[mk('J1','1000000001','GOMEZ PEREZ ANDRES',hoy,[{},{...lejos},{...imp},{sinFoto:true},{min:20},{min:20,s:5}]),
       mk('J2','1000000002','LOPEZ DIAZ CARLOS',hoy,[...Array(9)].map((_,k)=>({n1:'SN',n1n:'SANA',n2:'',est:'sana',min:5+k*2}))),
       mk('J3','1000000003','MORA RUIZ JAVIER',hoyISO(new Date(Date.now()-40*86400000)),[{lote:'IT05'}])];
  JOR[2].por_lote=[{lote:'IT05',palmas_visitadas:100,ha:1}];JOR[2].lotes=new Set(['IT05']);
  LOTES={type:'FeatureCollection',features:['IT01','IT05','IT09'].map((l,k)=>({type:'Feature',properties:{_lote:l},geometry:{type:'Polygon',coordinates:[[[-78.701+k*0.01,1.499],[-78.699+k*0.01,1.499],[-78.699+k*0.01,1.512],[-78.701+k*0.01,1.512],[-78.701+k*0.01,1.499]]]}}))};IND_LOTES={IT01:{n:1000},IT05:{n:800},IT09:{n:500}};
  document.querySelector('#fDesde').value=hoyISO(new Date(Date.now()-45*86400000));document.querySelector('#fHasta').value=hoy;
  aplicarFiltros(false);
  // Cirugía: 3 casos (uno operado a tiempo, uno vencido sin operar, uno de hoy pendiente)
  const t=(d)=>new Date(Date.now()-d*86400000).toISOString();
  CIR.diags=[{palma_id:'C1',lote:'IT01',linea:1,palma:1,n1_codigo:'PC',nivel1:'PUDRICIÓN DE COGOLLO (PC)',nivel2:'PC INICIAL',creado:t(10),evaluador:'X'},
             {palma_id:'C2',lote:'IT01',linea:1,palma:2,n1_codigo:'PC',nivel1:'PUDRICIÓN DE COGOLLO (PC)',nivel2:'PC AVANZADA',creado:t(8),evaluador:'X'},
             {palma_id:'C3',lote:'IT05',linea:1,palma:3,n1_codigo:'PC',nivel1:'PUDRICIÓN DE COGOLLO (PC)',nivel2:'PC INICIAL',creado:t(0),evaluador:'X'}];
  const jc={pareja:{cirujano:{nombre:'MORA RUIZ JAVIER'},auxiliar:{nombre:'VEGA SOTO LUIS'}}};
  CIR.cirugias=[{palma_id:'C1',tipo:'cirugia',creado:new Date(Date.parse(t(10))+20*3600000).toISOString(),_j:jc}];CIR.correcciones=[];calcularPendientes();CIR.cargado=true;}"""
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1400, 'height': 950}, accept_downloads=True)
    ctx.route('https://api.github.com/**', gh)
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200] + ' ' + (e.stack or '')[:200]))
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof alternarGerencia==='function'", timeout=30000); time.sleep(1)
    vz.evaluate(DATOS)
    vz.click('#btGer'); time.sleep(.6)
    txt = lambda: vz.inner_text('#gerPanel')
    T = txt()
    check('Gerencia abre con el Tablero', 'GERENCIA' in T and 'PRODUCTIVIDAD POR OPERARIO' in T.upper(), T[:80])
    check('Tablero: KPIs', 'Jornadas' in T and 'Casos de PC' in T and 'Incidencia PC' in T)
    check('Tablero: productividad por operario (ha/hora)', vz.evaluate("[...document.querySelectorAll('#gerPanel table')][0].innerText").count('\n') >= 3)
    check('Tablero: casos de PC por lote y semana', 'IT01' in vz.evaluate("[...document.querySelectorAll('#gerPanel .ger-calor')].map(e=>e.innerText).join('')"))
    ciclo = vz.evaluate("[...document.querySelectorAll('#gerPanel table')].pop().innerText")
    check('Ciclo de censo: IT05 con 40 días (alerta) e IT09 sin censo', '40 días' in ciclo and 'Sin censo en el periodo' in ciclo, ciclo.replace('\n', ' | ')[:200])
    check('Ciclo de censo: aviso de lotes atrasados', 'más de 30 días sin censo' in T)
    vz.click('#gerCalor'); time.sleep(.6)
    check('Mapa de calor de PC sobre el mapa', vz.evaluate("!!GER.calor&&document.querySelector('#gerPanel').hidden&&!!document.querySelector('#chCalor')"))
    vz.click('#chCalor'); vz.click('#btGer'); time.sleep(.3)
    # Cirugía
    vz.click('[data-gt=cirugia]'); time.sleep(.5); T = txt()
    check('Cirugía: casos, operados, vencidos y a tiempo', 'Casos de cirugía' in T and 'Vencidos sin operar' in T and 'Operados a tiempo' in T, re.sub(r'\s+', ' ', T)[:260])
    check('Cirugía: pareja y caso vencido listados', 'Javier Mora' in T or 'MORA' in T.upper(), '')
    check('Cirugía: tiempo caso → cirugía ≈ 0,8 días', '0,8 d' in T, re.findall(r'[\d,]+ d', T)[:3])
    # Sincronización
    vz.click('[data-gt=sync]'); vz.wait_for_function("!!GER.sync", timeout=15000); time.sleep(.4); T = txt()
    check('Sincronización: solo operarios activos (3)', vz.evaluate("GER.sync.filas.length") == 3, vz.evaluate("GER.sync.filas.map(x=>x.u)"))
    check('Sincronización: estados hoy / 6 días / sin envíos', 'Hoy' in T and '6 días sin sincronizar' in T and 'Sin envíos en 30 días' in T, re.sub(r'\s+', ' ', T)[:200])
    check('Sincronización: reconoce envíos antiguos por nombre (sin u:)', any(f['u'] == '1000000002' and f['n30'] == 1 for f in vz.evaluate("GER.sync.filas")))
    check('Sincronización: alerta de más de 2 días', 'operario(s) llevan más de 2 días' in T)
    # Calidad
    vz.click('[data-gt=calidad]'); time.sleep(.4); T = txt()
    al = vz.evaluate("(()=>{const a=alertasCalidad();const c={};a.forEach(x=>c[x.m]=(c[x.m]||0)+1);return c})()")
    check('Calidad: detecta lejos, GPS, sin foto, rápido y racha', al.get('lejos') == 1 and al.get('gps') == 1 and al.get('foto') == 1 and al.get('rapido', 0) >= 1 and al.get('racha') == 9, al)
    check('Calidad: % de alertas por operario', '% con alerta' in T)
    vz.select_option('#calTipo', 'lejos'); time.sleep(.3)
    n = vz.evaluate("[...document.querySelectorAll('#gerPanel [data-rev]')].length")
    check('Calidad: filtro por motivo', n == 1, n)
    vz.evaluate("document.querySelector('#gerPanel [data-rev]').click()"); time.sleep(.3)
    check('Calidad: marcar como revisada la oculta', vz.evaluate("[...document.querySelectorAll('#gerPanel [data-rev]')].length") == 0)
    # Auditoría
    vz.click('[data-gt=auditoria]'); time.sleep(.6)
    vz.fill('#audPct', '50'); vz.dispatch_event('#audPct', 'change'); vz.fill('#audMin', '2'); vz.dispatch_event('#audMin', 'change')
    vz.click('#audGen'); time.sleep(.6)
    m = vz.evaluate("GER.aud.muestra")
    ops = {x['original']['usuario'] for x in m['palmas']}
    check('Auditoría: muestra solo de censadores, por operario', len(m['palmas']) >= 4 and ops <= {'1000000001', '1000000002', '1000000003'} and len(ops) >= 2, (len(m['palmas']), ops))
    check('Auditoría: sin palmas repetidas', len({x['palma_id'] for x in m['palmas']}) == len(m['palmas']))
    vz.click('#audGuardar'); vz.wait_for_function("GER.aud.guardada", timeout=10000)
    check('Auditoría: se guarda en auditoria/ del repositorio de datos', EST['guardado'] and EST['guardado']['id'] == m['id'] and '/contents/auditoria/' + m['id'] in EST['puts'][0], EST['puts'][:1])
    vz.wait_for_function("GER.aud.lista&&GER.aud.lista.length", timeout=10000); time.sleep(.3)
    vz.click('#audVer'); vz.wait_for_function("!!GER.aud.res", timeout=15000); time.sleep(.3); T = txt()
    check('Auditoría: avance (2 auditadas) y concordancia 50 %', vz.evaluate("GER.aud.res.filas.filter(x=>x.hecha).length") == 2 and '50 %' in T, re.sub(r'\s+', ' ', T)[-300:])
    check('Auditoría: lista la diferencia', 'DIFERENCIAS (1)' in T.upper())
    # Reportes
    vz.click('[data-gt=reportes]'); vz.wait_for_function("GER.reportes&&GER.reportes.length", timeout=10000); time.sleep(.3); T = txt()
    check('Reportes: lista semanas con PDF y Excel', '2026-S45' in T and 'PDF' in T and 'Excel' in T and 'Generar ahora' in T)
    vz.click('#gerX'); check('Cerrar vuelve al mapa', vz.evaluate("document.querySelector('#gerPanel').hidden"))
    # ---- App: auditoría para supervisores ----
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: (print('     ALERTA:', d.message), d.dismiss()))
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof panelAuditoria==='function'", timeout=30000); time.sleep(2)
    pal = EST['guardado']['palmas'][0]
    r = pg.evaluate("""async(pal)=>{try{ return await (async()=>{document.querySelector('#login').hidden=true;SES={u:'sup1',nombre:'Sara',rol:'supervisor'};S.cfg.gh={...S.cfg.gh,token:'tok',owner:'jjbuila',repo:'SanidadData',rama:'main'};
      await cargarAuditoria();menu();const tile=!!document.querySelector('#mAud');
      const j={id:'JA',estado:'activa',evaluador:'Sara',usuario:'sup1',inicio:new Date().toISOString(),seleccion:[{lote:pal.lote}],densidad:115,buffer:5,km:0,sync:'pendiente'};await dbPut('jornadas',j);S.jornada=j;
      S.idx.set(pal.palma_id,{type:'Feature',geometry:{type:'Point',coordinates:[pal.lng,pal.lat]},properties:{_id:pal.palma_id,_lote:pal.lote,_linea:pal.linea,_num:pal.palma}});
      S.gps={lat:pal.lat+0.00003,lng:pal.lng,acc:4,t:Date.now()};
      await panelAuditoria();const txt=document.querySelector('#hojaCuerpo').innerText;
      abrirPalma(pal.palma_id);const ficha=document.querySelector('#hojaCuerpo').innerText;
      await abrirFormulario({palma_id:pal.palma_id});const frm=document.querySelector('#frm');if(!frm)return {err:'sin formulario',h:document.querySelector('#hojaCuerpo').innerText.slice(0,200),toast:document.querySelector('#toast').textContent};const i=frm.querySelector('input[name=n1][value=EV]');if(!i)return {err:'sin n1',n1:[...frm.querySelectorAll('input')].map(x=>x.name+'='+x.value).slice(0,8)};i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));
      for(const n of ['produccion','transitabilidad']){const x=frm.querySelector(`input[name=${n}]`);if(x){x.checked=true;x.dispatchEvent(new Event('change',{bubbles:true}));}}
      F.fotosNuevas.push({id:'FX',buf:new ArrayBuffer(4),type:'image/jpeg'});await guardarRegistro(frm);
      const reg=S.registros.find(x=>x.palma_id===pal.palma_id);
      return {tile,ciega:!txt.includes(pal.original.nivel2||'@@')&&!txt.includes(pal.original.evaluador),cuenta:txt.toUpperCase().includes('PALMAS'),ficha:ficha.includes('Palma de la auditoría'),tag:reg&&reg.auditoria,plano:planos(reg).auditoria};})();}catch(e){return {err:e.message,stack:String(e.stack).slice(0,600)};}}""", pal)
    print('     app:', {k:v for k,v in r.items() if k in ('err','h','toast','n1','stack')})
    check('App: menú «Auditoría» para supervisor', r.get('tile'))
    check('App: lista a ciegas (sin diagnóstico ni censador original)', r['ciega'] and r['cuenta'])
    check('App: ficha de la palma avisa que es de auditoría', r['ficha'])
    check('App: el diagnóstico queda marcado con la muestra (también al sincronizar)', r['tag'] == EST['guardado']['id'] and r['plano'] == EST['guardado']['id'], r)
    op = pg.evaluate("async()=>{SES={u:'op',nombre:'Op',rol:'operario'};AUD.m=null;await cargarAuditoria();menu();return !!document.querySelector('#mAud')}")
    check('App: un operario no ve la auditoría', not op)
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
