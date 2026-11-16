"""Visor · GERENCIA: barra de filtros (fecha, programa, lote, operario, estado, enfermedad y opciones), sección Enfermedades
con subdivisiones (datos y gráficos) y mapa de avance del censo por palmas visitadas. Datos ficticios."""
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
DATOS = """()=>{document.querySelector('#login').hidden=true;document.querySelector('#app').hidden=false;mapa.invalidateSize();
  SES={u:'admin1',nombre:'Admin',rol:'admin',token:'tok',repo:{owner:'jjbuila',repo:'SanidadData',rama:'main'}};
  const PAL={IT01:[...Array(20)].map((_,i)=>[i+1,1,i+1,i===19?0:1,-78.700+i*0.00005,1.500+i*0.0005]),IT05:[...Array(10)].map((_,i)=>[101+i,1,i+1,1,-78.690+i*0.00005,1.500+i*0.0005])};
  window.chunkLote=async l=>PAL[l]||[];
  const hoy=hoyISO(),ayer=hoyISO(new Date(Date.now()-86400000));
  const dg=(id,k,x)=>({tipo:'diagnostico',id:id+'d'+k,palma_id:String(x.p),lote:x.lote||'IT01',linea:1,palma:x.p,n1_codigo:x.n1,nivel2:x.n2||'',nivel3:x.n3||'',estado:x.est||'enferma',creado:new Date().toISOString(),lat:1.5,lng:-78.7});
  const mk=(id,u,nom,fecha,pl,diags)=>{const j={id,fecha,evaluador:nom,usuario:u,inicio:fecha+'T12:00:00Z',fin:fecha+'T13:00:00Z',hora_inicio:'07:00',hora_fin:'08:00',duracion_min:60,km:1,ha:1,palmas:10,metodo:'calle',
    n_paradas:0,min_paradas:0,min_mov:60,por_lote:pl,densidad:115,app:'',lotes:new Set(pl.map(x=>x.lote)),paradas:[],track:{c:[[-78.7,1.5],[-78.7,1.501]],t:[0,60000],acc:[4,4]},header:{},secuencias:null,tiempos:{min_efectivo_labor:50},vel:2,diags:[]};
    j.diags=diags.map((x,k)=>({...dg(id,k,x),_j:j}));return j;};
  const r=(a,b)=>[...Array(b-a+1)].map((_,i)=>a+i);
  JOR=[mk('J1','op1','OPERARIO UNO',hoy,[{lote:'IT01',palmas_visitadas:10,ha:.1,ids_palmas_visitadas:r(1,10)}],
          [{p:1,n1:'PC',n2:'PC INICIAL',n3:'SEGUIMIENTO 1'},{p:2,n1:'PC',n2:'PC INICIAL',n3:'SEGUIMIENTO 2'},{p:3,n1:'PC',n2:'PC AVANZADA'},{p:4,n1:'ML'}]),
       mk('J2','op2','OPERARIO DOS',ayer,[{lote:'IT01',palmas_visitadas:5,ha:.05,ids_palmas_visitadas:r(1,5)}],[{p:5,n1:'AR',n2:'AR INICIAL'}])];
  LOTES={type:'FeatureCollection',features:['IT01','IT05'].map((l,k)=>({type:'Feature',properties:{_lote:l,Programa:k?'IT-B':'IT-A',Area_ha:k?5:10},geometry:{type:'Polygon',coordinates:[[[-78.701+k*0.01,1.499],[-78.698+k*0.01,1.499],[-78.698+k*0.01,1.511],[-78.701+k*0.01,1.511],[-78.701+k*0.01,1.499]]]}}))};
  IND_LOTES={IT01:{n:20},IT05:{n:10}};for(const f of LOTES.features)PROG.set(f.properties._lote,f.properties.Programa);
  msOpciones('prog',[{v:'IT-A',t:'IT-A'},{v:'IT-B',t:'IT-B'}]);opcionesLote();msOpciones('op',[{v:'op1',t:'OPERARIO UNO'},{v:'op2',t:'OPERARIO DOS'}]);opcionesEnf();
  document.querySelector('#fDesde').value=ayer;document.querySelector('#fHasta').value=hoy;GER.plant=null;aplicarFiltros(false);}"""
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 1400, 'height': 950}, accept_downloads=True)
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, content_type='application/json', body='{"message":"Not Found"}'))
    vz = ctx.new_page(); vz.on('pageerror', lambda e: errores.append('visor: ' + str(e)[:200]))
    vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof pintarEnfGer==='function'", timeout=30000); time.sleep(1)
    vz.evaluate(DATOS)
    vz.click('#btGer'); vz.wait_for_selector('#gerFil', timeout=5000)
    F = vz.inner_text('#gerFil')
    check('Gerencia: barra de filtros con fechas, programa, lote, operario, estado, enfermedad y opciones',
          all(t in F for t in ['Desde', 'Hasta', 'Programa', 'Lote', 'Operario', 'Estado', 'Enfermedad', 'Opción de la enfermedad', 'Tipo de seguimiento']) and '2 jornadas' in F and '5 diagnósticos' in F, F)
    # Filtro de operario desde la barra de Gerencia
    vz.click('#gerFil .ms[data-k=op] .ms-bt'); vz.wait_for_selector('#msPop', timeout=3000)
    vz.click('#msPop .ms-it:has-text("OPERARIO DOS") .solo'); vz.wait_for_timeout(400)
    F = vz.inner_text('#gerFil')
    check('Filtro de operario aplica a todo (barra, visor y tablero)', '1 jornadas' in F and vz.evaluate("JORF.length") == 1 and 'OPERARIO DOS' in F and vz.inner_text('#filtros .ms[data-k=op] .ms-bt') == 'OPERARIO DOS', F[-120:])
    vz.click('#gLimpiar'); vz.wait_for_timeout(400)
    check('Quitar filtros', vz.evaluate("JORF.length") == 2 and '5 diagnósticos' in vz.inner_text('#gerFil'))
    # Enfermedades
    vz.click('[data-tsub=enf]'); vz.wait_for_timeout(400)
    E = vz.inner_text('#gerPanel')
    check('Enfermedades: palmas por enfermedad con gráfico', 'Pudrición de cogollo (PC)' in E and 'Anillo rojo (AR)' in E and 'Marchitez letal (ML)' in E and vz.evaluate("document.querySelectorAll('[data-enf]').length") == 3, E[:300])
    check('Enfermedades: subdivisiones (opción y tipo de seguimiento) con palmas y %', 'PC INICIAL' in E and 'PC AVANZADA' in E and 'SEGUIMIENTO 1' in E and '66,7 %' in E and 'no tiene subdivisiones' in E, E[:600])
    check('Enfermedades: gráfico por semana y tabla por lote', vz.evaluate("!!document.querySelector('#gerPanel svg rect')") and 'IT01' in E)
    vz.click('[data-enf2="PC|PC INICIAL"]'); vz.wait_for_timeout(500)
    check('Clic en una opción filtra todo por ella', vz.evaluate("[...FIL.n1].join()+'/'+[...FIL.n2].join()+'/'+DIAGF.length") == 'PC/PC INICIAL/2' and '2 diagnósticos' in vz.inner_text('#gerFil'), vz.evaluate("[...FIL.n1,...FIL.n2,DIAGF.length]"))
    vz.click('#gLimpiar'); vz.wait_for_timeout(300)
    # Mapa de avance
    vz.click('[data-tsub=avance]')
    vz.wait_for_function("GER.avRes&&document.querySelector('#avLeyenda').innerText.includes('Entrada')", timeout=15000); vz.wait_for_timeout(300)
    R = vz.evaluate("({c:GER.avRes.c,tot:GER.avRes.tot,li:GER.avRes.lotesI,l:GER.avRes.lotes,ha:GER.avRes.ha.map(x=>+x.toFixed(2))})")
    Ley = vz.inner_text('#avLeyenda')
    check('Avance: palmas por número de entradas (sin muertas)', R['c'] == [19, 5, 5, 0] and R['tot'] == 29, R)
    check('Avance: hectáreas proporcionales y lotes intervenidos', abs(R['ha'][1] - 5 / 29 * 15) < .01 and R['li'] == 1 and R['l'] == 2 and '1 Lotes | 50,0%' in Ley and 'Sin intervenir' in Ley and '1ra Entrada' in Ley and '2da Entrada' in Ley, (R, Ley))
    check('Avance: mapa con las palmas y los lotes', vz.evaluate("!!document.querySelector('#gerMapaAv .leaflet-image-layer')") and 'IT05' in vz.inner_text('#avTabla'))
    with vz.expect_download(timeout=10000) as dl: vz.click('#avPng')
    check('Avance: descarga la imagen PNG', dl.value.suggested_filename.startswith('avance_censo_') and dl.value.suggested_filename.endswith('.png'), dl.value.suggested_filename)
    vz.evaluate("msSolo('op','op2');aplicarFiltros(true)")
    vz.wait_for_function("GER.avRes&&GER.avRes.c[2]===0", timeout=10000)
    check('Avance: respeta el filtro de operario', vz.evaluate("GER.avRes.c") == [24, 5, 0, 0], vz.evaluate("GER.avRes.c"))
    vz.evaluate("msSolo('op','');msSolo('prog','IT-B');opcionesLote();aplicarFiltros(true)")
    vz.wait_for_function("GER.avRes&&GER.avRes.tot===10", timeout=10000)
    check('Avance: respeta el filtro de programa', vz.evaluate("GER.avRes.c") == [10, 0, 0, 0] and vz.evaluate("GER.avRes.lotesI") == 0)
    check('Sin errores de JavaScript', not errores, errores[:4])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
