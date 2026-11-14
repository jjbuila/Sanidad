"""Prueba de «Recuperar mi historial» con GitHub simulado."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import io, json, sys, time, zipfile, re
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

def geo(jid, usuario, evaluador, fecha, labor=None, fotos=None):
    h = {'id': jid, 'evaluador': evaluador, 'usuario': usuario, 'fecha': fecha, 'inicio': fecha + 'T13:00:00.000Z', 'fin': fecha + 'T20:00:00.000Z',
         'km': 4.2, 'palmas_visitadas': 300, 'ha_recorridas': 2.5, 'por_lote': [{'lote': 'IT01'}], 'lotes_seleccionados': [{'lote': 'IT01'}],
         'secuencias': [], 'tiempos': {}, 'archivo_fotos': (jid + '_fotos.zip') if fotos else None, 'sincronizado': fecha + 'T21:00:00.000Z'}
    if labor:
        h['labor'] = labor
        for k in ('palmas_visitadas','ha_recorridas','por_lote','km'): h.pop(k, None)
    diag = {'tipo': 'diagnostico', 'id': 'R-' + jid, 'jornada_id': jid, 'palma_id': 'P1', 'lote': 'IT01', 'linea': 3, 'palma': 14, 'creado': h['inicio'],
            'evaluador': evaluador, 'estado': 'sana', 'n1_codigo': 'SN', 'nivel1': 'Sana', 'sintomas': 'a|b', 'problemas': '', 'observaciones': 'ok',
            'fotos': '|'.join(f + '.jpg' for f in (fotos or [])), 'sincronizado': h['sincronizado']}
    feats = [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [-78.7, 1.7]}, 'properties': diag},
             {'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': [[-78.7, 1.7], [-78.701, 1.701]]},
              'properties': {'tipo': 'recorrido', 'tiempos': [h['inicio'], fecha + 'T13:01:00.000Z'], 'precision_m': [4, 5]}},
             {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [-78.7, 1.7]},
              'properties': {'tipo': 'parada', 'n': 1, 'inicio': h['inicio'], 'fin': fecha + 'T13:10:00.000Z', 'duracion_min': 10, 'lote': 'IT01', 'clase': 'pausa'}}]
    if labor == 'cirugia':
        feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [-78.7, 1.7]},
                      'properties': {'id': 'C-' + jid, 'tipo': 'cirugia', 'palma_id': 'P1', 'palma': 14, 'linea': 3, 'jornada_id': jid, 'fotos': ''}})
    return json.dumps({'type': 'FeatureCollection', 'jornada': h, 'features': feats})

zb = io.BytesIO()
with zipfile.ZipFile(zb, 'w') as z: z.writestr('F1.jpg', b'\xff\xd8\xff\xe0FOTO1'); z.writestr('F2.jpg', b'\xff\xd8\xff\xe0FOTO2')
BLOBS = {'b1': geo('J1', 'op1', 'Operario Uno', '2026-11-10', fotos=['F1', 'F2']).encode(), 'z1': zb.getvalue(),
         'b2': geo('J2', '', 'Operario Uno', '2026-11-11', labor='cirugia').encode(),
         'b3': geo('J3', 'op1', 'Operario Uno', '2026-11-12').encode(),
         'b4': geo('J4', 'op9', 'Otro Señor', '2026-11-12').encode()}
COMMITS = [
    {'sha': 'c1', 'commit': {'message': 'Sanidad Vegetal · Operario Uno · jornada 2026-11-10 · 1 diagnóstico(s) · u:op1'}},
    {'sha': 'c2', 'commit': {'message': 'Sanidad Vegetal · Cirugía · Operario Uno · 2026-11-11 · 1 cirugía(s)'}},
    {'sha': 'c3', 'commit': {'message': 'Sanidad Vegetal · Operario Uno · jornada 2026-11-12 · 1 diagnóstico(s) · u:op1'}},
    {'sha': 'c4', 'commit': {'message': 'Sanidad Vegetal · Otro Señor · jornada 2026-11-12 · 1 diagnóstico(s) · u:op9'}},
    {'sha': 'c5', 'commit': {'message': 'Actualiza programación de cirugía'}}]
FILES = {'c1': [{'filename': 'jornadas/2026-11-10/J1.geojson', 'sha': 'b1', 'status': 'added'}, {'filename': 'jornadas/2026-11-10/J1_fotos.zip', 'sha': 'z1', 'status': 'added'}],
         'c2': [{'filename': 'cirugia/jornadas/2026-11-11/J2.geojson', 'sha': 'b2', 'status': 'added'}],
         'c3': [{'filename': 'jornadas/2026-11-12/J3.geojson', 'sha': 'b3', 'status': 'added'}],
         'c4': [{'filename': 'jornadas/2026-11-12/J4.geojson', 'sha': 'b4', 'status': 'added'}]}
pedidos = []
def gh(route):
    u = route.request.url; pedidos.append(u.split('/repos/')[-1])
    m = re.search(r'/commits\?', u)
    if m:
        page = int(re.search(r'[?&]page=(\d+)', u).group(1))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(COMMITS if page == 1 else []))
    m = re.search(r'/commits/(\w+)$', u)
    if m: return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': m.group(1), 'files': FILES.get(m.group(1), [])}))
    m = re.search(r'/git/blobs/(\w+)$', u)
    if m: return route.fulfill(status=200, content_type='application/octet-stream', body=BLOBS[m.group(1)])
    route.fulfill(status=404, body='{}')

errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errores.append(str(e)+' '+(e.stack or '')[:400]))
    pg.on('console', lambda m: m.type == 'error' and errores.append('console: ' + m.text))
    pg.on('dialog', lambda d: d.dismiss())
    ctx.route('https://api.github.com/**', gh)
    pg.goto('http://127.0.0.1:8765/index.html')
    pg.wait_for_function("typeof S!=='undefined'&&typeof dbPut==='function'", timeout=30000); time.sleep(2)
    pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;
      SES={u:'op1',nombre:'Operario Uno',rol:'operario'};S.cfg.gh={...S.cfg.gh,token:'tok'};S.cfg.evaluador='Operario Uno';
      await dbPut('jornadas',{id:'J3',estado:'finalizada',sync:'sincronizado',evaluador:'Operario Uno',usuario:'op1',inicio:'2026-11-12T13:00:00.000Z',fin:'2026-11-12T20:00:00.000Z',km:9.9,local:true});
      panelHistorial();document.querySelector('#hDesde').value='2026-11-01';document.querySelector('#hHasta').value='2026-11-13';}""")
    pg.click('#hIr')
    pg.wait_for_function("(document.querySelector('#hMsg')||{}).textContent && !document.querySelector('#hIr').disabled", timeout=30000)
    msg = pg.evaluate("document.querySelector('#hMsg').textContent")
    check('Mensaje final', 'recuperada' in msg, msg)
    r = pg.evaluate("""async()=>{const js=Object.fromEntries((await dbAll('jornadas')).map(j=>[j.id,{sync:j.sync,imp:!!j.importada,km:j.km,labor:j.labor||null,par:(j.paradas||[]).length}]));
      const rs=(await dbAll('registros')).map(r=>({id:r.id,j:r.jornada_id,sync:r.sync,fotos:r.fotos,sint:r.sintomas,tipo:r.tipo||null}));
      const fs=(await dbAll('fotos')).map(f=>f.id);const t1=(await puntosTrack('J1')).length;
      const pend=(await jornadasPorSincronizar()).map(j=>j.id);return {js,rs,fs,t1,pend};}""")
    js = r['js']
    check('J1 (u:op1) importada con fotos y recorrido', js.get('J1', {}).get('imp') and sorted(r['fs']) == ['F1', 'F2'] and r['t1'] == 2 and js['J1']['par'] == 1, (js.get('J1'), r['fs'], r['t1']))
    check('J2 (cirugía, solo por nombre) importada', js.get('J2', {}).get('imp') and js['J2']['labor'] == 'cirugia', js.get('J2'))
    check('J3 local no se sobrescribe', js['J3']['km'] == 9.9 and not js['J3']['imp'], js['J3'])
    check('J4 de otro usuario no se importa', 'J4' not in js)
    check('Commit de otro usuario no se consulta', not any('/commits/c4' in x for x in pedidos) and not any('/commits/c5' in x for x in pedidos))
    check('Registros importados quedan sincronizados', all(x['sync'] == 'sincronizado' for x in r['rs']) and len(r['rs']) == 3, r['rs'])
    check('Síntomas y fotos se reconstruyen', any(x['sint'] == ['a', 'b'] and x['fotos'] == ['F1', 'F2'] for x in r['rs']))
    check('Importadas no se vuelven a enviar', r['pend'] == [], r['pend'])
    ro = pg.evaluate("""async()=>{const r=S.registros.find(x=>x.id==='R-J1');await abrirFormulario(r);return {sl:!!document.querySelector('#frm fieldset[disabled]'),tit:document.querySelector('#hojaTitulo').textContent,mini:document.querySelectorAll('#fotos img').length};}""")
    check('Diagnóstico importado se abre en solo lectura con sus fotos', ro['sl'] and ro['mini'] == 2, ro)
    # Segunda vez: no duplica
    pg.evaluate("panelHistorial();document.querySelector('#hDesde').value='2026-11-01';")
    pg.click('#hIr'); pg.wait_for_function("(document.querySelector('#hMsg')||{}).textContent && !document.querySelector('#hIr').disabled", timeout=30000)
    msg2 = pg.evaluate("document.querySelector('#hMsg').textContent")
    check('Segunda descarga: ya estaban', 'ya estaban' in msg2, msg2)
    pg.evaluate("cerrarHoja()")
    for v in ('diag','res','jor'):
        try:
            pg.evaluate(f"abrirBD('{v}')"); time.sleep(1.2)
        except Exception as e: errores.append(f'abrirBD {v}: {e}')
    txt = pg.evaluate("document.querySelector('#bd')?document.querySelector('#bd').innerText:''")
    check('Pantallas de datos abren con jornadas importadas', 'J1' in txt or '2026-11-10' in txt or 'IT01' in txt, txt[:120])
    pg.evaluate("abrirBD('jor')"); time.sleep(1.5)
    nc = pg.evaluate("document.querySelectorAll('#bdCuerpo .jor-card').length")
    check('Recorridos: aparecen las 3 jornadas (incluida cirugía importada)', nc == 3, nc)
    pg.evaluate("document.querySelector('#bdCuerpo [data-play=\"J1\"]').click()"); time.sleep(1.5)
    pl = pg.evaluate("({on:PLAY.on,vis:!document.querySelector('#play').hidden,sub:document.querySelector('#plSub').textContent})")
    check('Reproducir recorrido de jornada importada', pl['on'] and pl['vis'], pl['sub'])
    pg.evaluate("detenerPlay&&detenerPlay()")
    check('Barra plegada tiene HA', pg.evaluate("!!document.querySelector('#pjMini #pjMiniHa')"))
    check('Sin errores de JavaScript', not errores, errores[:5])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
