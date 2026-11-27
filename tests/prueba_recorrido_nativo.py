"""Registro nativo del recorrido (APK con el complemento «Recorrido», simulado):
la App recibe puntos en vivo, recupera los que no recibió mientras Android la tenía dormida (con su hora real y por páginas),
anota el equipo y los cortes del GPS con su causa al finalizar, los envía en la jornada y detiene el registro;
la hoja «Pantalla bloqueada» muestra la vigilancia y la vibración de confirmación; el visor dibuja los cortes punteados."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

STUB = """
window.__rec={pts:[],ev:[],llam:[],cb:null,lim:40,pulso:null};
const L=n=>(...a)=>Promise.resolve({abierto:true,display:'granted'});
const P=new Proxy({},{get:(o,k)=>k==='then'?undefined:L(String(k))});
window.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>false,Plugins:{
  Energia:{estado:async()=>({sinRestriccion:true,fabricante:'Xiaomi',modelo:'Redmi Note 12',android:34,activo:true}),solicitarSinRestriccion:L(),abrirInicioAutomatico:L(),abrirAhorroBateria:L(),abrirAjustesApp:L(),mantenerActivo:L()},
  Recorrido:{
    iniciar:async o=>{__rec.llam.push(['iniciar',o]);return {activo:true};},
    detener:async()=>{__rec.llam.push(['detener']);},
    configurar:async o=>{__rec.llam.push(['configurar',o]);__rec.pulso=o.pulso;},
    estado:async()=>({activo:true,servicio:true,ubicacion:true,ubicacionFondo:false,alarmasExactas:true,gpsActivo:true}),
    addListener:async(n,cb)=>{__rec.cb=cb;return {remove:async()=>{__rec.cb=null;}};},
    puntos:async o=>{__rec.llam.push(['puntos',o.desde]);const r=__rec.pts.filter(p=>p.t>o.desde);return {puntos:r.slice(0,__rec.lim),mas:r.length>__rec.lim};},
    eventos:async()=>({eventos:__rec.ev})},
  BackgroundGeolocation:new Proxy({},{get:(o,k)=>k==='then'?undefined:L()}),
  LocalNotifications:new Proxy({checkPermissions:async()=>({display:'granted'})},{get:(o,k)=>k in o?o[k]:k==='then'?undefined:L()}),
  TextToSpeech:P}};
"""
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900},
                          user_agent='Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile SanidadVegetalAPK/1 v1.0.20')
    ctx.add_init_script(STUB)
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof gpsFondo==='function'&&typeof S!=='undefined'", timeout=30000); time.sleep(2)
    pg.evaluate("document.querySelector('#login').hidden=true;SES={u:'op1',nombre:'Operario Uno',rol:'operario'}")
    r = pg.evaluate("""async()=>{await iniciarJornada([{lote:'IT01'}],'Operario Uno');await new Promise(r=>setTimeout(r,800));
      const i=__rec.llam.find(x=>x[0]==='iniciar');return {jid:S.jornada&&S.jornada.id,ini:i&&i[1],bg:bgWatcher,on:REC.on,cb:!!__rec.cb,eq:S.jornada.equipo};}""")
    check('Al iniciar la jornada arranca el registro nativo con la jornada', r['ini'] and r['ini']['jornada'] == r['jid'] and r['bg'] == 'rec' and r['on'], r['ini'])
    check('Se suscribe a los puntos en vivo', r['cb'])
    eq = r['eq'] or {}
    check('Anota el equipo (APK, registro protegido, marca y modelo)', eq.get('modo') == 'apk' and eq.get('registro') == 'nativo' and eq.get('modelo') == 'Redmi Note 12' and eq.get('ubicacion_siempre') is False, eq)

    # Puntos: 10 en vivo, 120 guardados por la APK mientras la página dormía (llegan después), un corte de 6 min con reinicio y 10 más
    r = pg.evaluate("""async()=>{
      const t0=Date.now()-40*60000,lat0=1.62,lng0=-78.8;let k=0;const pt=(t)=>({t,lat:lat0+(k++)*5/111320,lng:lng0,acc:4});
      const vivos=[];for(let i=0;i<10;i++)vivos.push(pt(t0+i*4000));
      for(const p of vivos){__rec.pts.push(p);__rec.cb(p);}
      await new Promise(r=>setTimeout(r,600));const n1=TRACK.n;
      let t=t0+40000;const dormidos=[];for(let i=0;i<120;i++){t+=4000;dormidos.push(pt(t));}
      __rec.pts.push(...dormidos);                        // la página no los recibió en vivo
      const tCorte=t;t+=6*60000;__rec.ev.push({t:tCorte+120000,e:'reinicio',ultimo_gps:tCorte});
      const desp=[];for(let i=0;i<10;i++){t+=4000;desp.push(pt(t));}__rec.pts.push(...desp);
      document.dispatchEvent(new Event('visibilitychange'));  // vuelve a primer plano
      await new Promise(r=>setTimeout(r,200));await recDrenar();await REC.cola;
      const ts=TRACK.pts.map(p=>p.t);
      return {n1,n2:TRACK.n,orden:ts.every((x,i)=>i===0||x>ts[i-1]),horaReal:TRACK.pts[15].t===dormidos[5].t,pags:__rec.llam.filter(x=>x[0]==='puntos').length,
        repetidos:new Set(ts).size===ts.length};}""")
    check('Los puntos en vivo se registran', r['n1'] == 10, r['n1'])
    check('Recupera los puntos que la página no recibió (120 + 10)', r['n2'] == 140, r['n2'])
    check('En orden, sin repetidos', r['orden'] and r['repetidos'])
    check('Con la hora real del GPS (aunque lleguen 30 min tarde)', r['horaReal'])
    check('Por páginas cuando son muchos', r['pags'] >= 4, r['pags'])

    # Finalizar: cortes con causa, en la jornada enviada, y se detiene el registro
    r = pg.evaluate("""async()=>{const id=S.jornada.id;await finalizarJornada('volumen');await new Promise(r=>setTimeout(r,500));
      const j=await dbGet('jornadas',id);const pts=await puntosTrack(id);const g=geoJornada(j,[],pts,new Date().toISOString(),null);
      return {c:j.cortes_gps,h:g.jornada.cortes_gps,eq:g.jornada.equipo,det:__rec.llam.some(x=>x[0]==='detener'),on:REC.on,bg:bgWatcher};}""")
    c = r['c'] or []
    check('Al finalizar anota el corte de 6 min', len(c) == 1 and 5.9 <= c[0]['minutos'] <= 6.2, c)
    check('Con su causa (Android cerró el registro y se reanudó solo)', c and 'se reanudó solo' in c[0]['causa'], c[0]['causa'] if c else '')
    check('La jornada enviada lleva los cortes y el equipo', r['h'] and len(r['h']) == 1 and r['eq'] and r['eq'].get('registro') == 'nativo')
    check('Detiene el registro nativo al finalizar', r['det'] and not r['on'] and r['bg'] != 'rec', r)

    # Hoja «Pantalla bloqueada»: vigilancia, ubicación todo el tiempo pendiente y vibración de confirmación
    pg.evaluate("menu();document.querySelector('#mBg').click()"); time.sleep(1)
    txt = pg.evaluate("document.querySelector('#hojaCuerpo').innerText")
    check('Muestra la vigilancia del recorrido', 'Vigilancia del recorrido' in txt and 'más de 1 minuto sin GPS' in txt)
    check('Marca pendiente «Ubicación todo el tiempo»', 'Ubicación todo el tiempo' in txt and 'PENDIENTE' in txt)
    pg.evaluate("const c=document.querySelector('#sbPulso');c.checked=true;c.dispatchEvent(new Event('change'))"); time.sleep(.5)
    check('La vibración de confirmación se guarda y se envía a la APK', pg.evaluate("S.cfg.pulsoGps===true&&__rec.pulso===true"))
    check('Sin errores de JavaScript (App)', not errores, errores[:3])

    # Visor: el corte se dibuja punteado y el detalle lo lista con su causa
    vs = ctx.new_page(); ev = []; vs.on('pageerror', lambda e: ev.append(str(e)[:200]))
    vs.goto('http://127.0.0.1:8765/visor.html'); vs.wait_for_function("typeof partesTrack==='function'&&typeof bloqueCortes==='function'", timeout=30000)
    r = vs.evaluate("""()=>{const t0=Date.parse('2026-11-17T14:40:00Z');const c=[],t=[];
      for(let i=0;i<20;i++){c.push([-78.8,1.62+i*5/111320]);t.push(t0+i*4000);}
      const tc=t[19];for(let i=0;i<10;i++){c.push([-78.8,1.63+i*5/111320]);t.push(tc+35*60000+i*4000);}
      const j={evaluador:'Operario',track:{c,t,acc:[]},header:{cortes_gps:[{inicio:new Date(tc).toISOString(),causa:'Sin señal de GPS'}],equipo:{modo:'apk',apk:'1.0.20',registro:'nativo',fabricante:'Xiaomi',modelo:'Redmi Note 12'}}};
      const pt=partesTrack(j);const b=bloqueCortes(j);return {partes:pt.partes.length,huecos:pt.huecos.map(h=>h.min),causa:pt.huecos[0]&&pt.huecos[0].causa,html:b};}""")
    check('Visor: el recorrido se parte en el corte (no dibuja la línea recta)', r['partes'] == 2 and r['huecos'] == [35], r)
    check('Visor: el detalle lista el corte con su causa y el equipo', 'corte(s) del GPS' in r['html'] and 'Sin señal de GPS' in r['html'] and 'Redmi Note 12' in r['html'], r['html'][:160])
    check('Sin errores de JavaScript (visor)', not ev, ev[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
