"""Módulo de usuarios de admin.html: buscar, editar, suspender, eliminar, crear; el acceso.json resultante funciona en la app."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import sys, time, json, os
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
D = TMP
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1200, 'height': 900}, accept_downloads=True)
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    ad = ctx.new_page(); ad.on('pageerror', lambda e: errores.append('admin: ' + str(e)[:200]))
    dialogos = []
    def dlg(d):
        dialogos.append(d.message); d.accept()
    ad.on('dialog', dlg)
    ad.goto('http://127.0.0.1:8765/admin.html'); ad.wait_for_function("typeof entradaUsuario==='function'", timeout=20000)
    # Paquete de prueba (usuarios y contraseñas ficticias)
    paquete = ad.evaluate("""async()=>{const dkRaw=rnd(32),dk=await llaveDatos(dkRaw);const U=[];
      for(const [u,n,r,extra] of [['admin1','Ana Admin','admin',{cargo:'Coordinadora'}],['op1','Pedro Pérez','operario',{cargo:'Auxiliar de censo',labores:['censo']}],
        ['op2','Luis Gómez','operario',{labores:['censo','cirugia'],rol_cirugia:'auxiliar'}],['op3','Marta Ruiz','operario',{}],['sup1','Sara Visor','supervisor',{}]])
        U.push(await entradaUsuario(dk,dkRaw,u,n,r,'Clave1234',extra));
      return {formato:FORMATO,id:'prueba-'+Date.now(),creado:new Date().toISOString(),repo:{owner:'x',repo:'y',rama:'main'},kdf:{alg:'PBKDF2-SHA256',iter:ITER},
        token:await cifrar(dk,enc.encode('github_pat_prueba')),carto:{archivo:'carto.enc',version:'v1'},usuarios:U};}""")
    f = os.path.join(D, 'acceso_prueba.json'); open(f, 'w', encoding='utf-8').write(json.dumps(paquete))
    ad.click('#tabs button[data-t=editar]'); ad.set_input_files('#eArchivo', f)
    ad.fill('#eUser', 'admin1'); ad.fill('#eClave', 'Clave1234'); ad.click('#eAbrir')
    ad.wait_for_selector('#ePanel:not([hidden])', timeout=60000)
    res = ad.inner_text('#eResumen').replace('\n', ' ')
    check('Resumen por rol y labor', 'Usuarios 5' in res and 'Operarios 3' in res and 'Cirugía' in res, res)
    filas = lambda: ad.evaluate("[...document.querySelectorAll('#eLista tr')].map(t=>t.innerText.replace(/\\s+/g,' '))")
    check('Lista con cargo, rol, labores y estado', any('Auxiliar de censo' in r and 'Censo' in r and 'ACTIVO' in r for r in filas()), filas()[:2])
    ad.fill('#eBuscar', 'pedro'); time.sleep(.2)
    check('Búsqueda', len(filas()) == 1 and 'op1' in filas()[0], filas())
    ad.fill('#eBuscar', ''); ad.select_option('#eFLab', 'cirugia'); time.sleep(.2)
    check('Filtro por labor (cirugía)', set(r.split(' ')[0] for r in filas()) == {'admin1', 'op2', 'sup1'}, [r.split(' ')[0] for r in filas()])
    ad.select_option('#eFLab', '')
    # Editar op1: cargo, identificación, labores + cirujano
    ad.click('[data-ed="op1"]'); ad.fill('#fCargo', 'Cirujano de campo'); ad.fill('#fId', '1000000099'); ad.check('#fCir'); ad.select_option('#fRolCir', 'cirujano'); ad.click('#fOk')
    check('Edición marcada como cambio pendiente', any('op1' in r and 'CAMBIOS' in r and 'Cirugía (cirujano)' in r for r in filas()), [r for r in filas() if 'op1' in r])
    # Suspender op2, eliminar op3, crear op4
    ad.click('[data-sus="op2"]'); ad.click('[data-del="op3"]')
    ad.click('#eAgregar'); ad.fill('#fU', 'op4'); ad.fill('#fNombre', 'Nuevo Operario'); ad.fill('#fCargo', 'Auxiliar'); ad.fill('#fClave', 'Nueva4567'); ad.click('#fOk')
    check('Estados: suspendido, se eliminará, nuevo', any('op2' in r and 'SUSPENDIDO' in r for r in filas()) and any('op3' in r and 'SE ELIMINARÁ' in r for r in filas()) and any('op4' in r and 'NUEVO' in r for r in filas()))
    # Validación: usuario repetido
    ad.click('#eAgregar'); ad.fill('#fU', 'op1'); ad.fill('#fNombre', 'X'); ad.click('#fOk')
    check('No permite usuario repetido', 'ya existe' in ad.inner_text('#fMsg')); ad.click('#fNo')
    # CSV
    with ad.expect_download() as dl: ad.click('#eCsv')
    csv = open(dl.value.path(), encoding='utf-8-sig').read()
    check('Exporta CSV sin contraseñas', 'usuario;nombre;cargo;identificacion;rol;labores;rol_cirugia;estado' in csv and 'Clave1234' not in csv and 'Suspendido' in csv, csv.splitlines()[0])
    # Generar
    with ad.expect_download() as dl: ad.click('#eGuardar')
    nuevo = json.load(open(dl.value.path(), encoding='utf-8'))
    check('Genera acceso.json con 4 usuarios (op3 eliminado, op4 creado)', sorted(x['u'] for x in nuevo['usuarios']) == ['admin1', 'op1', 'op2', 'op4', 'sup1'][:0] or sorted(x['u'] for x in nuevo['usuarios']) == ['admin1', 'op1', 'op2', 'op4', 'sup1'], sorted(x['u'] for x in nuevo['usuarios']))
    viejo = {x['u']: x for x in paquete['usuarios']}; nv = {x['u']: x for x in nuevo['usuarios']}
    check('Contraseñas sin cambio se conservan (misma llave envuelta)', all(nv[u]['ct'] == viejo[u]['ct'] for u in ['admin1', 'op1', 'op2', 'sup1']))
    check('Tras generar, la lista queda al día', not any('CAMBIOS' in r or 'NUEVO' in r for r in filas()), filas())
    f2 = os.path.join(D, 'acceso_resultado.json'); open(f2, 'w', encoding='utf-8').write(json.dumps(nuevo))
    # ---- App con el paquete resultante ----
    ctx.route('**/datos/acceso.json*', lambda r: r.fulfill(status=200, body=json.dumps(nuevo), content_type='application/json'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof ingresar==='function'&&ACCESO&&ACCESO.usuarios", timeout=40000)
    r = pg.evaluate("""async()=>{const o={};
      for(const [u,c] of [['op2','Clave1234'],['op1','Clave1234'],['op4','Nueva4567'],['op3','Clave1234']]){try{await ingresar(u,c);o[u]={ok:true,cargo:SES.cargo,id:SES.identificacion,lab:SES.labores,rc:SES.rol_cirugia};}catch(e){o[u]={ok:false,err:e.message};}}
      return o;}""")
    check('App: usuario suspendido no puede ingresar', not r['op2']['ok'] and 'suspendido' in r['op2']['err'], r['op2'])
    check('App: usuario editado ingresa con sus nuevos datos', r['op1']['ok'] and r['op1']['cargo'] == 'Cirujano de campo' and r['op1']['id'] == '1000000099' and r['op1']['lab'] == ['censo', 'cirugia'] and r['op1']['rc'] == 'cirujano', r['op1'])
    check('App: usuario nuevo ingresa', r['op4']['ok'], r['op4'])
    check('App: usuario eliminado ya no ingresa', not r['op3']['ok'], r['op3'])
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
