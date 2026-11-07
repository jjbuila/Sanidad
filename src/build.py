"""Construye index.html incrustando las librerías para que la app funcione 100 % sin internet,
genera los íconos y los datos de ejemplo."""
import base64, json, math, os, sys
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NM = sys.argv[1] if len(sys.argv) > 1 else '/root/build/node_modules'

def leer(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def seguro(js):
    return js.replace('</script', '<\\/script')

html = leer(os.path.join(RAIZ, 'src', 'app.html'))
reemplazos = {
    '/*LEAFLET_CSS*/': leer(f'{NM}/leaflet/dist/leaflet.css'),
    '/*LIB_LEAFLET*/': seguro(leer(f'{NM}/leaflet/dist/leaflet.js')),
    '/*LIB_JSZIP*/': seguro(leer(f'{NM}/jszip/dist/jszip.min.js')),
    '/*LIB_SHP*/': seguro(leer(f'{NM}/shpjs/dist/shp.min.js')),
    '/*LIB_TOGEOJSON*/': seguro(leer(f'{NM}/@tmcw/togeojson/dist/togeojson.umd.js')),
    '/*LIB_SQL*/': seguro(leer(f'{NM}/sql.js/dist/sql-wasm.js')),
    '/*LIB_PROJ4*/': seguro(leer(f'{NM}/proj4/dist/proj4.js')),
    '/*SQL_WASM_B64*/': base64.b64encode(open(f'{NM}/sql.js/dist/sql-wasm.wasm', 'rb').read()).decode('ascii'),
}
for k, v in reemplazos.items():
    assert k in html, k
    html = html.replace(k, v, 1)
with open(os.path.join(RAIZ, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)

# ---------- Íconos ----------
os.makedirs(os.path.join(RAIZ, 'icons'), exist_ok=True)
def icono(n):
    k = 4; N = n * k
    im = Image.new('RGBA', (N, N), (27, 77, 46, 255))
    d = ImageDraw.Draw(im)
    cx, cy = N / 2, N * 0.42
    d.ellipse([N*.18, N*.80, N*.82, N*.90], fill=(20, 58, 34, 255))
    d.polygon([(cx-N*.035, N*.84), (cx+N*.035, N*.84), (cx+N*.02, cy), (cx-N*.02, cy)], fill=(160, 120, 70, 255))
    for ang in range(-160, 1, 32):
        a = math.radians(ang)
        ex, ey = cx + math.cos(a)*N*.33, cy + math.sin(a)*N*.22 + N*.08
        mx, my = cx + math.cos(a)*N*.17, cy + math.sin(a)*N*.17 - N*.05
        d.line([(cx, cy), (mx, my), (ex, ey)], fill=(126, 200, 80, 255), width=int(N*.045), joint='curve')
    d.ellipse([cx-N*.05, cy-N*.05, cx+N*.05, cy+N*.05], fill=(240, 160, 40, 255))
    d.ellipse([N*.66, N*.58, N*.86, N*.78], fill=(198, 40, 40, 255), outline=(255, 255, 255, 255), width=int(N*.015))
    im.resize((n, n), Image.LANCZOS).save(os.path.join(RAIZ, 'icons', f'icon-{n}.png'))
icono(192); icono(512)

# ---------- Datos de ejemplo (para probar la importación) ----------
os.makedirs(os.path.join(RAIZ, 'datos-ejemplo'), exist_ok=True)
lat0, lng0 = 1.6420, -78.6050
kLat = 1/111320; kLng = 1/(111320*math.cos(math.radians(lat0)))
ancho, alto, calle, dE, dL, borde = 200, 250, 20, 9, 9*math.sqrt(3)/2, 4.5
lotes, palmas = [], []
for i, nom in enumerate(['L01', 'L02', 'L03']):
    x0 = i*(ancho+calle)
    P = lambda x, y: [round(lng0+x*kLng, 8), round(lat0+y*kLat, 8)]
    lotes.append({'type': 'Feature', 'properties': {'LOTE': nom, 'AREA_HA': round(ancho*alto/10000, 2), 'MATERIAL': 'Híbrido OxG'},
                  'geometry': {'type': 'Polygon', 'coordinates': [[P(x0, 0), P(x0+ancho, 0), P(x0+ancho, alto), P(x0, alto), P(x0, 0)]]}})
    linea, x = 0, x0+borde
    while x <= x0+ancho-borde:
        linea += 1; num = 0; y = borde + (0 if linea % 2 else dE/2)
        while y <= alto-borde:
            num += 1
            palmas.append({'type': 'Feature', 'properties': {'ID_PALMA': f'{nom}-L{linea}-P{num}', 'LOTE': nom, 'LINEA': linea, 'PALMA': num},
                           'geometry': {'type': 'Point', 'coordinates': P(x, y)}})
            y += dE
        x += dL
for nom, fc in (('lotes_ejemplo', lotes), ('palmas_ejemplo', palmas)):
    with open(os.path.join(RAIZ, 'datos-ejemplo', nom+'.geojson'), 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': fc}, f, ensure_ascii=False)
print('index.html', os.path.getsize(os.path.join(RAIZ, 'index.html')), 'bytes;', len(palmas), 'palmas de ejemplo')
