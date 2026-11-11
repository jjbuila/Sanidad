"""Construye index.html de Sanidad Palma 2.0 incrustando librerías, fuente y logo,
para que la aplicación funcione 100 % sin internet.

Uso:
    python3 src/build.py RUTA/node_modules RUTA/marca
"""
import base64, datetime, os, re, shutil, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NM = sys.argv[1] if len(sys.argv) > 1 else '/root/build/node_modules'
MARCA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(RAIZ, 'src', 'marca')

def leer(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def b64(p):
    with open(p, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')

def seguro(js):
    return js.replace('</script', '<\\/script')

fuentes = ''
for peso in (500, 600, 700):
    ruta = f'{NM}/@fontsource/rajdhani/files/rajdhani-latin-{peso}-normal.woff2'
    fuentes += ("@font-face{font-family:'Rajdhani';font-style:normal;font-display:swap;"
                f"font-weight:{peso};src:url(data:font/woff2;base64,{b64(ruta)}) format('woff2')}}\n")

# Versión = fecha y hora de Colombia (UTC-5) del momento de la construcción: AAAAMMDD:HHMM
VERSION = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5)).strftime('%Y%m%d:%H%M')
html = leer(os.path.join(RAIZ, 'src', 'app.html')).replace('__VERSION__', VERSION)
reemplazos = {
    '/*LEAFLET_CSS*/': leer(f'{NM}/leaflet/dist/leaflet.css'),
    '/*FUENTES*/': fuentes,
    '/*LIB_LEAFLET*/': seguro(leer(f'{NM}/leaflet/dist/leaflet.js')),
    '/*LIB_JSZIP*/': seguro(leer(f'{NM}/jszip/dist/jszip.min.js')),
}
for k, v in reemplazos.items():
    assert k in html, k
    html = html.replace(k, v, 1)
html = html.replace('__LOGO__', 'data:image/png;base64,' + b64(os.path.join(MARCA, 'logo_900.png')))
html = html.replace('__ISO__', 'data:image/png;base64,' + b64(os.path.join(MARCA, 'isotipo_256.png')))
with open(os.path.join(RAIZ, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)

vis = leer(os.path.join(RAIZ, 'src', 'visor.html')).replace('__VERSION__', VERSION)
for k, v in reemplazos.items():
    assert k in vis, k
    vis = vis.replace(k, v, 1)
vis = vis.replace('__LOGO__', 'data:image/png;base64,' + b64(os.path.join(MARCA, 'logo_900.png')))
vis = vis.replace('__ISO__', 'data:image/png;base64,' + b64(os.path.join(MARCA, 'isotipo_256.png')))
with open(os.path.join(RAIZ, 'visor.html'), 'w', encoding='utf-8') as f:
    f.write(vis)

adm = leer(os.path.join(RAIZ, 'src', 'admin.html'))
adm = adm.replace('/*FUENTES*/', fuentes, 1).replace('/*LIB_JSZIP*/', seguro(leer(f'{NM}/jszip/dist/jszip.min.js')), 1)
adm = adm.replace('__LOGO__', 'data:image/png;base64,' + b64(os.path.join(MARCA, 'logo_900.png')))
with open(os.path.join(RAIZ, 'admin.html'), 'w', encoding='utf-8') as f:
    f.write(adm)

os.makedirs(os.path.join(RAIZ, 'icons'), exist_ok=True)
for n in (192, 512):
    shutil.copy(os.path.join(MARCA, f'icon-{n}.png'), os.path.join(RAIZ, 'icons', f'icon-{n}.png'))
sw_ruta = os.path.join(RAIZ, 'sw.js')
sw = leer(sw_ruta)
sw = re.sub(r"const APP='[^']*';", "const APP='sanidad-vegetal-" + VERSION.replace(':', '-') + "';", sw, count=1)
with open(sw_ruta, 'w', encoding='utf-8') as f:
    f.write(sw)
with open(os.path.join(RAIZ, 'version.json'), 'w', encoding='utf-8') as f:
    f.write('{"version": "%s"}\n' % VERSION)
print('Versión', VERSION, '| index.html', os.path.getsize(os.path.join(RAIZ, 'index.html')), 'bytes')
