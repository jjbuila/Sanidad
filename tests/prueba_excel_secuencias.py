"""Visor: «⬇ Excel secuencias» descarga un .xlsx con las secuencias de todas las jornadas filtradas (desplazamiento inicial,
lotes con su secuencia y desplazamiento entre lotes, desplazamiento final), un resumen por jornada y uno por lote. Datos sintéticos."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, TMP
import sys, time, os, zipfile, re
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

JS = """()=>{
  const s=(tipo,lote,sec,hi,hf,tot,extra)=>({tipo,lote,secuencia:sec,hora_inicio:hi,hora_fin:hf,inicio:'2026-11-25T'+hi+':00Z',min_total:tot,min_paradas:0,min_efectivo:tot,km:.5,diagnosticos:1,...extra});
  const J=(id,u,n,secs)=>({id,fecha:'2026-11-25',usuario:u,evaluador:n,lotes:new Set(secs.filter(x=>x.tipo==='lote').map(x=>x.lote)),secuencias:secs,diags:[],paradas:[],por_lote:[],header:{},track:null});
  JOR=[J('J1','op1','PEDRO PEREZ',[s('desplazamiento_inicial','',null,'06:00','06:20',20),
        s('lote','IT01',1,'06:20','08:00',100,{hora_inicio_labor:'06:20',min_desplazamiento:0,min_labor:100,palmas_visitadas:500,ha:4.35}),
        s('lote','IT02',2,'08:00','10:00',120,{hora_inicio_labor:'08:10',min_desplazamiento:10,min_labor:110,palmas_visitadas:600,ha:5.22,min_paradas:15,min_efectivo:105}),
        s('desplazamiento_final','',null,'10:00','10:30',30)]),
       J('J2','op2','ANA RUIZ',[s('lote','IT02',1,'07:00','09:00',120,{hora_inicio_labor:'07:00',min_desplazamiento:0,min_labor:120,palmas_visitadas:700,ha:6.09})])];
  FIL.op.clear();FIL.lote.clear();FIL.prog.clear();
  JORF=JOR;return filasSecuencias().length;}"""
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', accept_downloads=True)
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('http://127.0.0.1:8765/visor.html'); pg.wait_for_function("typeof xlsxSecuencias==='function'&&typeof JSZip!=='undefined'", timeout=30000); time.sleep(1)
    n = pg.evaluate(JS)
    check('Filas de secuencias de las jornadas filtradas', n == 5, n)
    pg.evaluate("TAB='resumen';pintarPanel()")
    check('Botón «Excel secuencias» en el resumen', pg.locator('#xSecX').count() == 1)
    with pg.expect_download() as d:
        pg.evaluate("document.querySelector('#xSecX').click()")
    ruta = os.path.join(TMP, 'sec.xlsx'); d.value.save_as(ruta)
    check('Nombre del archivo', d.value.suggested_filename.startswith('secuencias_') and d.value.suggested_filename.endswith('.xlsx'), d.value.suggested_filename)
    z = zipfile.ZipFile(ruta); nombres = z.namelist()
    wb = z.read('xl/workbook.xml').decode()
    check('Tres hojas: Secuencias, Por jornada y Por lote', re.findall(r'<sheet name="([^"]+)"', wb) == ['Secuencias', 'Por jornada', 'Por lote'])
    try:
        import openpyxl
        w = openpyxl.load_workbook(ruta)
        h = w['Secuencias']; filas = [[c.value for c in r] for r in h.iter_rows(values_only=False)]
        cab = filas[0]; tipos = [r[cab.index('Tipo')] for r in filas[1:]]
        check('Ordenadas por fecha y operario; en cada jornada: desplazamiento inicial, lotes, desplazamiento final', tipos == ['Lote', 'Desplazamiento inicial', 'Lote', 'Lote', 'Desplazamiento final'], tipos)
        import datetime as _dt
        M = lambda v: v.total_seconds() / 60 if isinstance(v, _dt.timedelta) else (v * 1440 if isinstance(v, (int, float)) else None)
        r2 = filas[4]; it = cab.index('T. total')
        check('Tiempos en horas:minutos de Excel (sumables)', abs(M(r2[it]) - 120) < 1e-6 and h.cell(row=5, column=it + 1).number_format == '[h]:mm', (r2[it], h.cell(row=5, column=it + 1).number_format))
        check('Lote IT02 con secuencia 2 y desplazamiento entre lotes de 10 min', r2[cab.index('Lote')] == 'IT02' and r2[cab.index('Sec.')] == 2 and abs(M(r2[cab.index('Despl. entre lotes')]) - 10) < 1e-6)
        j = w['Por jornada']; fj = [[c.value for c in r] for r in j.iter_rows()]; cj = fj[0]; j1 = [r for r in fj[1:] if r[cj.index('Jornada')] == 'J1'][0]
        check('Por jornada: desplazamiento inicial, entre lotes y final', round(M(j1[cj.index('Despl. inicial')])) == 20 and round(M(j1[cj.index('Despl. entre lotes')])) == 10 and round(M(j1[cj.index('Despl. final')])) == 30 and j1[cj.index('Orden de lotes')] == 'IT01 → IT02', j1)
        l = w['Por lote']; fl = [[c.value for c in r] for r in l.iter_rows()]; cl = fl[0]
        it2 = [r for r in fl[1:] if r[0] == 'IT02'][0]
        check('Por lote: IT02 suma 2 secuencias de 2 jornadas y 1.300 palmas', it2[cl.index('Secuencias')] == 2 and it2[cl.index('Jornadas')] == 2 and it2[cl.index('Palmas')] == 1300, it2)
    except ImportError:
        check('openpyxl disponible para leer el Excel', False, 'pip install openpyxl')
    # Filtro por lote: solo las secuencias de ese lote (sin desplazamientos)
    pg.evaluate("FIL.lote=new Set(['IT01']);JORF=JOR.filter(j=>[...j.lotes].some(l=>FIL.lote.has(l)))")
    check('Con filtro de lote solo salen sus secuencias', pg.evaluate("filasSecuencias().map(x=>x.lote).join(',')") == 'IT01')
    pg.evaluate("TAB='secuencias';pintarPanel()")
    check('Botón «Excel secuencias» también en la pestaña Secuencias', pg.locator('#xSecX').count() == 1)
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
