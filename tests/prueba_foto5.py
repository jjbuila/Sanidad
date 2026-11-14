"""Reproducción: pausa de 5 s en cada diagnóstico y la foto visible directamente en la ficha (visor y app)."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import sys, time, io, zipfile, json
sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
b = io.BytesIO(); Image.new('RGB', (320, 240), (40, 140, 80)).save(b, 'JPEG'); JPG = b.getvalue()
zb = io.BytesIO()
with zipfile.ZipFile(zb, 'w') as z: z.writestr('F1.jpg', JPG)
ZIP = zb.getvalue()
errores = []
def gh(route):
    u = route.request.url
    if u.endswith('/git/blobs/zipJ1'): return route.fulfill(status=200, body=ZIP, content_type='application/octet-stream')
    route.fulfill(status=404, body='{}')
JS_DATOS = """()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();window.chunkLote=async()=>[];
  SES={u:'admin',nombre:'Admin',rol:'admin',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
  const t0=Date.parse('2026-11-13T12:00:00Z');const c=[],t=[];for(let i=0;i<=40;i++){c.push([-78.70,1.50+i*0.0001]);t.push(t0+i*60000);}
  const d={tipo:'diagnostico',id:'D1',palma_id:'P1',lote:'IT01',linea:3,palma:7,nivel1:'PUDRICIÓN DE COGOLLO (PC)',n1_codigo:'PC',estado:'enferma',evaluador:'Op',creado:new Date(t0+10*60000).toISOString(),lat:1.501,lng:-78.70,n_fotos:1,fotos:'F1.jpg'};
  const j={id:'J1',fecha:'2026-11-13',evaluador:'Op Uno',usuario:'1000000001',inicio:new Date(t0).toISOString(),fin:new Date(t0+40*60000).toISOString(),hora_inicio:'07:00',hora_fin:'07:40',duracion_min:40,km:.4,ha:1,palmas:10,
    metodo:'calle',n_paradas:0,min_paradas:0,min_mov:40,por_lote:[],densidad:115,app:'',lotes:new Set(['IT01']),paradas:[],track:{c,t,acc:c.map(()=>4)},header:{},secuencias:null,tiempos:null,vel:2,diags:[d],zipSha:'zipJ1'};
  d._j=j;JOR=[j];aplicarFiltros(true);}"""
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1300, 'height': 900})
    ctx.route('https://api.github.com/**', gh)
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof abrirRep==='function'", timeout=30000); time.sleep(1)
    vz.evaluate(JS_DATOS)
    def medir(arrancar):
        vz.evaluate("mapa.closePopup()"); vz.wait_for_function("!document.querySelector('.leaflet-popup-content')", timeout=5000)
        vz.evaluate(arrancar)
        vz.wait_for_function("!!document.querySelector('.leaflet-popup-content')&&(PLAY.on?PLAY.espera:REP.espera)>Date.now()", timeout=20000)
        t_ini = time.time(); T1 = vz.evaluate("(PLAY.on?PLAY.t:REP.T)")
        vz.wait_for_function("!!document.querySelector('.ppFoto img')", timeout=8000)
        foto = vz.evaluate("(()=>{const i=document.querySelector('.ppFoto img');return i&&i.naturalWidth})()")
        time.sleep(4.0); T2 = vz.evaluate("(PLAY.on?PLAY.t:REP.T)")
        vz.wait_for_function("(PLAY.on?PLAY.t:REP.T)>" + str(T2 + 1), timeout=6000)
        return foto, T2 == T1, time.time() - t_ini
    foto, quieto, seg = medir("abrirDetalle(JOR[0]);document.querySelector('#pVel').value='600';PLAY.vel=600;iniciarPlay()")
    check('Visor (ficha de la jornada): la foto se ve directamente', foto == 320, foto)
    check('Visor: sigue quieto a los 4 s y arranca después (≈5 s)', quieto and 4.5 <= seg <= 7.5, round(seg, 1))
    vz.evaluate("pararPlay();cerrarDetalle();mapa.closePopup()")
    foto, quieto, seg = medir("abrirRep('uno');REP.vel=600;iniciarRep()")
    check('Visor (uno a uno): foto directa y pausa ≈5 s', foto == 320 and quieto and 4.5 <= seg <= 7.5, (foto, quieto, round(seg, 1), vz.evaluate('REP.espera-Date.now()')))
    vz.evaluate("detenerRep()")
    # App
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append('app: ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof abrirPlay==='function'", timeout=30000); time.sleep(2)
    pg.evaluate("""async(b64)=>{document.querySelector('#login').hidden=true;const buf=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer;
      const t0=Date.parse('2026-11-13T12:00:00Z');const pts=[];for(let i=0;i<=40;i++)pts.push({j:'JA',t:t0+i*60000,lat:1.50+i*0.0001,lng:-78.70,acc:4,s:1});
      await dbPutVarios('track',pts);await dbPut('fotos',{id:'FA',registro_id:'RA',buf,type:'image/jpeg'});
      await dbPut('jornadas',{id:'JA',estado:'finalizada',sync:'sincronizado',evaluador:'Op',inicio:new Date(t0).toISOString(),fin:new Date(t0+2400e3).toISOString(),km:.4,paradas:[],visita:{ha_recorridas:1,por_lote:[]},tiempos:{min_efectivo_labor:30},secuencias:[]});
      await dbPut('registros',{id:'RA',jornada_id:'JA',palma_id:'PA',lote:'IT01',linea:3,numero:7,evaluador:'Op',estado:'enferma',n1_codigo:'PC',n1:'PUDRICIÓN DE COGOLLO (PC)',sintomas:[],problemas:[],fotos:['FA'],sync:'sincronizado',creado:new Date(t0+10*60000).toISOString(),lat:1.501,lng:-78.70});
      S.registros=await dbAll('registros');await abrirPlay('JA');}""", __import__('base64').b64encode(JPG).decode())
    pg.select_option('#plVel', '300'); pg.click('#plBtn')
    pg.wait_for_function("!document.querySelector('#plCard').hidden", timeout=20000); t_ini = time.time(); T1 = pg.evaluate("PLAY.t")
    pg.wait_for_function("(()=>{const i=document.querySelector('#plCard img.foto');return i&&!i.hidden&&i.naturalWidth>0})()", timeout=5000)
    ancho = pg.evaluate("document.querySelector('#plCard img.foto').getBoundingClientRect().width")
    time.sleep(4.0); T2 = pg.evaluate("PLAY.t")
    pg.wait_for_function(f"PLAY.t>{T2 + 1}", timeout=6000); seg = time.time() - t_ini
    check('App: foto visible en la ficha (más grande)', ancho >= 100, ancho)
    check('App: pausa ≈5 s antes de seguir', T1 == T2 and 4.5 <= seg <= 7.5, round(seg, 1))
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
