"""Formulario de diagnóstico editable: admin.html → config/ramas.json → App y visor. GitHub simulado."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import sys, time, json, os, base64
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
D = TMP
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
EST = {'cfg': None, 'sha': None, 'puts': 0, 'offline': False}
def gh(route):
    req = route.request; u = req.url
    if '/contents/config/ramas.json' in u:
        if req.method == 'PUT':
            b = json.loads(req.post_data); EST['cfg'] = json.loads(base64.b64decode(b['content']).decode('utf-8')); EST['puts'] += 1; EST['sha'] = 'sha%d' % EST['puts']
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': {'sha': EST['sha']}}))
        if EST['cfg'] is None or EST['offline']: return route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
        if 'raw' in (req.headers.get('accept') or ''): return route.fulfill(status=200, content_type='application/json', body=json.dumps(EST['cfg']))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': EST['sha'], 'content': base64.b64encode(json.dumps(EST['cfg']).encode()).decode()}))
    route.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}')
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1300, 'height': 950})
    ctx.route('https://api.github.com/**', gh)
    ad = ctx.new_page(); ad.on('pageerror', lambda e: errores.append('admin: ' + str(e)[:200])); dl = []
    ad.on('dialog', lambda d: (dl.append(d.message), d.accept()))
    ad.goto('http://127.0.0.1:8765/admin.html'); ad.wait_for_function("typeof entradaUsuario==='function'", timeout=20000)
    paq = ad.evaluate("""async()=>{const dkRaw=rnd(32),dk=await llaveDatos(dkRaw);
      return {formato:FORMATO,id:'p',creado:'',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'},kdf:{alg:'PBKDF2-SHA256',iter:ITER},token:await cifrar(dk,enc.encode('github_pat_prueba')),
        carto:{archivo:'carto.enc',version:'v1'},usuarios:[await entradaUsuario(dk,dkRaw,'admin1','Ana Admin','admin','Clave1234',{})]};}""")
    f = os.path.join(D, 'acceso_form.json'); open(f, 'w', encoding='utf-8').write(json.dumps(paq))
    ad.click('#tabs button[data-t=editar]'); ad.set_input_files('#eArchivo', f); ad.fill('#eUser', 'admin1'); ad.fill('#eClave', 'Clave1234'); ad.click('#eAbrir')
    ad.wait_for_selector('#ePanel:not([hidden])', timeout=60000); time.sleep(1)
    check('Sin formulario publicado: muestra «incorporado»', 'incorporado' in ad.inner_text('#rVer'), ad.inner_text('#rVer'))
    ad.click('#rAbrir'); ad.wait_for_selector('#rEditor:not([hidden])', timeout=10000)
    n = ad.evaluate("document.querySelectorAll('#rEditor .rEnf').length")
    check('Editor carga las 17 enfermedades del formulario actual', n == 17, n)
    # Cambios: renombrar DBP, color de PC, opción nueva en YAR, eliminar RAYO, nueva enfermedad NEM (tipo novedad), subir NEM
    gi = lambda c: ad.evaluate(f"[...document.querySelectorAll('#rEditor .rEnf')].findIndex(b=>b.querySelector('[data-e=c]').value==='{c}')")
    box = lambda c: f"#rEditor .rEnf[data-g='{gi(c)}']"
    ad.fill(box('DBP') + ' [data-e=n1]', 'DESPRENDIMIENTO DE BASES (DBP)')
    ad.evaluate(f"(()=>{{const i=document.querySelector(\"{box('PC')} [data-e=color]\");i.value='#123456';}})()")
    ad.click(box('YAR') + ' [data-addo]'); time.sleep(.2)
    ops = ad.locator(box('YAR') + ' .rOp'); last = ops.nth(ops.count() - 1)
    last.locator('[data-k=n2]').fill('YARUMO EN VÍA'); last.locator('[data-k=s]').fill('Yarumo junto a la vía\nRaíces sobre la vía')
    ad.click(box('RAYO') + ' [data-delg]'); time.sleep(.2)
    ad.click('#rAddE'); time.sleep(.2)
    nb = box('NUEVA')
    ad.fill(nb + ' [data-e=c]', 'NEM'); ad.fill(nb + ' [data-e=n1]', 'Nematodos'); ad.select_option(nb + ' [data-e=tipo]', 'novedad')
    ad.locator(nb + ' [data-k=s]').fill('Raíces con agallas'); ad.locator(nb + ' [data-k=cir]').uncheck(); ad.locator(nb + ' [data-k=rai]').check()
    for _ in range(3): ad.click(box('NEM') + ' [data-mov="-1"]'); time.sleep(.15)
    # Validación: opción repetida
    ad.click(box('YAR') + ' [data-addo]'); time.sleep(.2)
    ops = ad.locator(box('YAR') + ' .rOp'); ops.nth(ops.count() - 1).locator('[data-k=n2]').fill('YARUMO EN CALLE')
    ad.click('#rGuardar'); time.sleep(.5)
    check('Valida opciones repetidas', 'repetida' in ad.inner_text('#rMsg') and EST['puts'] == 0, ad.inner_text('#rMsg'))
    ops.nth(ops.count() - 1).locator('[data-delo]').click(); time.sleep(.2)
    ad.click('#rGuardar'); ad.wait_for_function("document.querySelector('#rMsg').textContent.includes('guardado')", timeout=10000)
    c = EST['cfg']; cods = list(dict.fromkeys(x['c'] for x in c['ramas']))
    check('Guarda config/ramas.json en el repositorio de datos', EST['puts'] == 1 and c['formato'] == 'sanidad-ramas-1' and c['version'], c.get('version'))
    check('Cambios guardados: nombre, color, opción nueva, eliminado y nueva enfermedad',
          any(x['c'] == 'DBP' and x['n1'] == 'DESPRENDIMIENTO DE BASES (DBP)' for x in c['ramas']) and c['enfermedades']['PC']['color'] == '#123456'
          and any(x.get('n2') == 'YARUMO EN VÍA' and x['s'] == ['Yarumo junto a la vía', 'Raíces sobre la vía'] for x in c['ramas']) and 'RAYO' not in cods
          and any(x['c'] == 'NEM' and x['n1'] == 'NEMATODOS' and x['rai'] and not x['cir'] for x in c['ramas']) and c['enfermedades']['NEM']['tipo'] == 'novedad' and 'RAYO' not in c['enfermedades'], cods)
    check('Reordenar: Nematodos subió 3 puestos', cods.index('NEM') == len(cods) - 4, cods[-5:])
    check('Versión publicada visible', c['version'] in ad.inner_text('#rVer'))
    # ---- App ----
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: (errores.append('ALERTA app: ' + d.message), d.dismiss()))
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof cargarRamas==='function'", timeout=30000); time.sleep(2)
    r = pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'op',nombre:'Op',rol:'operario'};S.cfg.gh={...S.cfg.gh,token:'tok',owner:'jjbuila',repo:'SanidadData',rama:'main'};
      const aplicado=await cargarRamas();
      const j={id:'JF',estado:'activa',evaluador:'Op',usuario:'op',inicio:new Date().toISOString(),seleccion:[{lote:'IT01'}],densidad:115,buffer:5,km:0,sync:'pendiente'};await dbPut('jornadas',j);S.jornada=j;
      S.idx.set('PF',{type:'Feature',geometry:{type:'Point',coordinates:[-78.7,1.7]},properties:{_id:'PF',_lote:'IT01',_linea:1,_num:1}});S.gps={lat:1.70002,lng:-78.7,acc:4,t:Date.now()};
      await abrirFormulario({palma_id:'PF'});const frm=document.querySelector('#frm');const n1=[...frm.querySelectorAll('input[name=n1]')].map(i=>i.value+'='+i.nextElementSibling.textContent);
      const mk=(n,v)=>{const i=[...frm.querySelectorAll(`input[name=${n}]`)].find(x=>x.value===v);i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));};
      mk('n1','YAR');const yar=[...frm.querySelectorAll('input[name=n2]')].map(i=>i.value);
      mk('n1','NEM');const campos=[...frm.querySelectorAll('label.campo')].map(l=>l.textContent.replace('*','').trim());
      mk('sintomas','Raíces con agallas');for(const n of ['produccion','raices','transitabilidad']){const x=frm.querySelector(`input[name=${n}]`);if(x){x.checked=true;x.dispatchEvent(new Event('change',{bubbles:true}));}}
      F.fotosNuevas.push({id:'FF',buf:new ArrayBuffer(4),type:'image/jpeg'});await guardarRegistro(frm);const reg=S.registros.find(x=>x.palma_id==='PF');
      return {aplicado,n1,yar,campos,estado:reg&&reg.estado,color:reg&&colorReg(reg),colorPC:COLOR_N1.PC,prob:PROBLEMAS.find(x=>x.id==='NEM'),version:S.ramasVersion};}""")
    check('App: aplica el formulario publicado', r['aplicado'] and r['version'] == c['version'], r['version'])
    check('App: enfermedades nuevas/renombradas/eliminadas', 'NEM=NEMATODOS' in r['n1'] and 'DBP=DESPRENDIMIENTO DE BASES (DBP)' in r['n1'] and not any(x.startswith('RAYO=') for x in r['n1']), r['n1'][-5:])
    check('App: Yarumo con la opción nueva', 'YARUMO EN VÍA' in r['yar'], r['yar'])
    check('App: Nematodos pide raíces y no cirugía', any('Raíces' in x for x in r['campos']) and not any('Cirugía' in x for x in r['campos']), r['campos'])
    check('App: tipo «novedad» y color del formulario', r['estado'] == 'novedad' and r['colorPC'] == '#123456', (r['estado'], r['colorPC']))
    check('App: nombre en PROBLEMAS (exportes y filtros)', r['prob'] and r['prob']['n'] == 'Nematodos', r['prob'])
    EST['offline'] = True
    r2 = pg.evaluate("async()=>{RAMAS.splice(0,RAMAS.length,...RAMAS.filter(x=>x.c!=='NEM'));const a=await cargarRamas();return {a,nem:RAMAS.some(x=>x.c==='NEM')};}")
    check('App: sin conexión usa el formulario guardado', r2['a'] and r2['nem'], r2)
    EST['offline'] = False
    # ---- Visor ----
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof cargarRamasVisor==='function'", timeout=30000)
    v = vz.evaluate("async()=>{SES={token:'t',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};await cargarRamasVisor();return {n:PROBLEMAS.NEM,c:COLOR_N1.PC,dbp:PROBLEMAS.DBP};}")
    check('Visor: nombres y colores del formulario', v['n'] == 'Nematodos' and v['c'] == '#123456' and v['dbp'] == 'Desprendimiento de bases (DBP)', v)
    check('Sin errores de JavaScript ni alertas', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
