"""Palmas del inicio y del final de las calles (lotes lineales, método por calle).
Lote sintético (sin datos reales): líneas a 9 m, palmas a 9 m en tresbolillo. El operario recorre en serpentina las calles
2|3, 4|5 y 6|7 y en cada cabecera cruza por las puntas de las líneas. Antes, la primera palma de la calle quedaba en espera en
una «calle» equivocada y se descartaba; ahora debe marcarse. Un sendero que cruza las cabeceras de líneas NO trabajadas no marca nada."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL
import sys, time, math
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)

LAT0, LNG0 = 1.5, -78.9
KY = 111320; KX = KY * math.cos(LAT0 * math.pi / 180)
NL, NP, SEP = 10, 16, 9.0
def ll(x, y): return [LNG0 + x / KX, LAT0 + y / KY]
pal = []; pid = 1
for ln in range(1, NL + 1):
    for p in range(1, NP + 1):
        x = (ln - 1) * SEP; y = (p - 1) * SEP + (SEP / 2 if ln % 2 == 0 else 0)
        lng, lat = ll(x, y); pal.append([pid, ln, p, 1, round(lng, 8), round(lat, 8)]); pid += 1
ymax = (NP - 1) * SEP + SEP / 2
caja = [ll(-6, -6), ll((NL - 1) * SEP + 6, -6), ll((NL - 1) * SEP + 6, ymax + 8), ll(-6, ymax + 8), ll(-6, -6)]
LOTE = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'Lote': 'ZZ01'}, 'geometry': {'type': 'Polygon', 'coordinates': [caja]}}]}

def recorrido(calles, ruido=True):
    """Serpentina por las calles (pares de líneas). En las cabeceras el operario sale 5 m y cruza a la siguiente calle."""
    pts = []; t = 1_700_000_000_000; k = 0
    def ir(x0, y0, x1, y1):
        nonlocal t, k
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / 3))
        for i in range(1, n + 1):
            x = x0 + (x1 - x0) * i / n; y = y0 + (y1 - y0) * i / n
            dx = (math.sin(k * 1.7) * 1.2) if ruido else 0; dy = (math.cos(k * 2.3) * 1.2) if ruido else 0; k += 1
            lng, lat = ll(x + dx, y + dy); t += 4000; pts.append({'lat': lat, 'lng': lng, 't': t})
    sube = True; x = (calles[0] - 1) * SEP + SEP / 2; y = -5
    lng, lat = ll(x, y); pts.append({'lat': lat, 'lng': lng, 't': t})
    for i, c in enumerate(calles):
        xc = (c - 1) * SEP + SEP / 2
        if i: ir(x, y, xc, y); x = xc
        y1 = ymax + 5 if sube else -5
        ir(x, y, x, y1); y = y1; sube = not sube
    return pts

errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    pg = nav.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200]))
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof calcularVisita==='function'", timeout=30000); time.sleep(1.5)
    pg.evaluate("""([P,G])=>{window.__P={ZZ01:P};leerChunk=async l=>__P[l]||[];CARTO.lotes={ZZ01:{n:P.length}};
      G.features.forEach(f=>f.properties._lote=f.properties.Lote);S.lotes=G;cajasLotes();IDXV.clear();LFEAT.clear();LMET.clear();KX=0;}""", [pal, LOTE])
    calc = """async pts=>{const E=await calcularVisita(pts,115,5,'calle',true,true,[{lote:'ZZ01'}],8);
      const g=await indiceVisita('ZZ01');const r={};for(const [ln,x] of g.lineas){r[ln]=x.pal.filter(q=>E.set.has(q.id)).map(q=>q.p).sort((a,b)=>a-b);}return r;}"""
    r = pg.evaluate(calc, recorrido([2, 4, 6, 8]))
    trab = [2, 3, 4, 5, 6, 7, 8, 9]
    falt = {ln: [q for q in range(1, NP + 1) if q not in r.get(str(ln), [])] for ln in trab}
    check('Calle por calle: lote lineal', pg.evaluate("indiceVisita('ZZ01').then(g=>g.tipo)") == 'lineal')
    check('Las palmas del inicio y del final de cada calle trabajada se marcan', all(not v for v in falt.values()), {k: v for k, v in falt.items() if v})
    check('Las líneas no trabajadas (1 y 10) no se marcan', not r.get('1') and not r.get('10'), {'1': r.get('1'), '10': r.get('10')})
    # Sendero por la cabecera norte (5 m afuera de las puntas) de un lado al otro del lote, sin trabajar calles.
    pts = []; t = 1_700_000_000_000
    for i in range(0, 40):
        x = -4 + i * 2.2; lng, lat = ll(x, ymax + 5); t += 4000; pts.append({'lat': lat, 'lng': lng, 't': t})
    r2 = pg.evaluate(calc, pts)
    check('Un sendero por la cabecera (sin trabajar calles) no marca palmas', sum(len(v) for v in r2.values()) == 0, r2)
    # Trabaja solo la calle 4|5 y luego sale por el sendero de la cabecera: solo se marcan las líneas 4 y 5.
    pts = recorrido([4], ruido=True); t = pts[-1]['t']; y = ymax + 5
    for i in range(0, 40):
        x = 4 * SEP - SEP / 2 + i * 2.2; lng, lat = ll(x, y); t += 4000; pts.append({'lat': lat, 'lng': lng, 't': t})
    r3 = pg.evaluate(calc, pts)
    otras = {k: v for k, v in r3.items() if k not in ('4', '5') and v}
    check('Trabajar una calle y salir por la cabecera: solo cuentan sus dos líneas', not otras and len(r3.get('4', [])) == NP and len(r3.get('5', [])) == NP, {'4': len(r3.get('4', [])), '5': len(r3.get('5', [])), 'otras': otras})
    check('Sin errores de JavaScript', not errores, errores[:3])
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)
