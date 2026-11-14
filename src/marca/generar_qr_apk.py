"""Genera el afiche con el QR de descarga de la APK de Sanidad Vegetal (Palmas de Tumaco).

Uso:  python src/marca/generar_qr_apk.py
Salida: src/marca/qr_apk.png (QR solo) y src/marca/qr_apk_afiche.png (afiche para imprimir o compartir).
Requiere: pip install pillow qrcode
"""
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageFilter

URL = 'https://jjbuila.github.io/Sanidad/apk.html'  # redirige a la última APK (enlace corto = QR más fácil de leer)
D = os.path.dirname(os.path.abspath(__file__))
VERDE, VERDE2, ACENTO, NARANJA, OSCURO = (3, 101, 69), (15, 157, 107), (34, 211, 154), (238, 118, 51), (14, 61, 47)
CREMA, TEXTO, TENUE = (247, 250, 246), (16, 44, 34), (88, 120, 106)
FUENTES = r'C:\Windows\Fonts'

def fuente(nombre, tam):
    for n in nombre:
        try:
            return ImageFont.truetype(os.path.join(FUENTES, n), tam)
        except OSError:
            pass
    return ImageFont.load_default(tam)

def mezcla(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def qr_bonito(lado):
    """QR de puntos redondos con degradado verde, esquinas redondeadas y el ícono de la app al centro (los patrones de ubicación se mantienen oscuros y sólidos para que cualquier lector los reconozca)."""
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=0)
    q.add_data(URL); q.make(fit=True)
    m = q.get_matrix(); n = len(m)
    SS = 4  # supermuestreo para bordes suaves
    Z = 3  # margen blanco (zona de silencio) en módulos
    cel = lado * SS // (n + 2 * Z); L = cel * (n + 2 * Z); off = Z * cel
    im = Image.new('RGBA', (L, L), (255, 255, 255, 0)); dr = ImageDraw.Draw(im)
    ojo = lambda r, c: (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)
    c0 = n // 2; hueco = max(4, int(n * 0.24) // 2)  # zona libre para el ícono (≈ 24 % del ancho)
    # Patrones de alineación: nunca se tapan (sin ellos el código se lee mal)
    pos = qrcode.util.pattern_position(q.version)
    alin = [(a, b) for a in pos for b in pos if not ((a < 9 and b < 9) or (a < 9 and b > n - 10) or (a > n - 10 and b < 9))]
    en_alin = lambda r, c: any(abs(r - a) <= 2 and abs(c - b) <= 2 for a, b in alin)
    for r in range(n):
        for c in range(n):
            if not m[r][c] or ojo(r, c) or en_alin(r, c) or (abs(r - c0) <= hueco and abs(c - c0) <= hueco):
                continue
            t = (r + c) / (2 * n)
            x, y = off + c * cel, off + r * cel; p = cel * 0.04
            dr.ellipse([x + p, y + p, x + cel - p, y + cel - p], fill=mezcla(VERDE2, VERDE, t) + (255,))
    for (r, c) in ((0, 0), (0, n - 7), (n - 7, 0)):
        x, y = off + c * cel, off + r * cel
        dr.rounded_rectangle([x, y, x + 7 * cel, y + 7 * cel], radius=int(cel * 2.2), fill=OSCURO + (255,))  # marco oscuro
        dr.rounded_rectangle([x + cel, y + cel, x + 6 * cel, y + 6 * cel], radius=int(cel * 1.5), fill=(255, 255, 255, 255))
        dr.rounded_rectangle([x + 2 * cel, y + 2 * cel, x + 5 * cel, y + 5 * cel], radius=int(cel * 0.9), fill=OSCURO + (255,))
    for a, b in alin:  # alineación: cuadro redondeado oscuro, blanco y punto central
        if abs(a - c0) <= hueco + 2 and abs(b - c0) <= hueco + 2: continue
        x, y = off + (b - 2) * cel, off + (a - 2) * cel
        dr.rounded_rectangle([x, y, x + 5 * cel, y + 5 * cel], radius=int(cel * 1.4), fill=OSCURO + (255,))
        dr.rounded_rectangle([x + cel, y + cel, x + 4 * cel, y + 4 * cel], radius=int(cel * .9), fill=(255, 255, 255, 255))
        dr.ellipse([x + 2 * cel, y + 2 * cel, x + 3 * cel, y + 3 * cel], fill=OSCURO + (255,))
    # Ícono de la app al centro, con margen blanco
    ic_lado = int((2 * hueco - 1) * cel)
    ic = Image.open(os.path.join(D, 'icon-512.png')).convert('RGBA').resize((ic_lado, ic_lado), Image.LANCZOS)
    cx = off + (c0 - hueco) * cel + cel // 2 + (2 * hueco + 1) * cel // 2 - ic_lado // 2
    bl = int(cel * 0.6)
    dr.rounded_rectangle([cx - bl, cx - bl, cx + ic_lado + bl, cx + ic_lado + bl], radius=int(ic_lado * 0.28), fill=(255, 255, 255, 255))
    im.alpha_composite(ic, (cx, cx))
    return im.resize((lado, lado), Image.LANCZOS)

def centrado(dr, y, txt, f, fill, W):
    w = dr.textlength(txt, font=f); dr.text(((W - w) / 2, y), txt, font=f, fill=fill)

def afiche():
    W, H = 1240, 1754  # A5 vertical a 150 ppp (sirve también para WhatsApp)
    im = Image.new('RGB', (W, H), CREMA); dr = ImageDraw.Draw(im)
    # Franja superior con degradado verde
    for y in range(470):
        dr.line([(0, y), (W, y)], fill=mezcla(OSCURO, VERDE, y / 470))
    dr.ellipse([-260, 400, W + 260, 640], fill=CREMA)
    # Ícono de la app y título
    ic = Image.open(os.path.join(D, 'icon-512.png')).convert('RGBA').resize((150, 150), Image.LANCZOS)
    im.paste(ic, ((W - 150) // 2, 60), ic)
    fT = fuente(['bahnschrift.ttf', 'segoeuib.ttf', 'arialbd.ttf'], 86)
    fS = fuente(['segoeui.ttf', 'arial.ttf'], 36)
    centrado(dr, 222, 'SANIDAD VEGETAL', fT, (255, 255, 255), W)
    centrado(dr, 322, 'App de censo sanitario de palma', fS, (205, 240, 225), W)
    # Tarjeta blanca con sombra y el QR
    q = qr_bonito(760); x0, y0 = (W - 840) // 2, 455
    sombra = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sombra).rounded_rectangle([x0, y0 + 14, x0 + 840, y0 + 854], 56, fill=(3, 60, 40, 70))
    im.paste(sombra.filter(ImageFilter.GaussianBlur(22)), (0, 0), sombra.filter(ImageFilter.GaussianBlur(22)))
    dr.rounded_rectangle([x0, y0, x0 + 840, y0 + 840], 56, fill=(255, 255, 255), outline=(214, 232, 223), width=3)
    im.paste(q, (x0 + 40, y0 + 40), q)
    # Llamado y pasos
    fC = fuente(['bahnschrift.ttf', 'segoeuib.ttf'], 60); fP = fuente(['segoeui.ttf', 'arial.ttf'], 34); fPb = fuente(['segoeuib.ttf', 'arialbd.ttf'], 34)
    centrado(dr, 1330, 'ESCANEE Y DESCARGUE LA APP', fC, VERDE, W)
    pasos = [('1', 'Abra la cámara del celular y apunte al código.'),
             ('2', 'Toque el enlace y descargue SanidadVegetal.apk.'),
             ('3', 'Instálela. Si ya la tiene, instale encima (no la desinstale).')]
    y = 1420
    for num, txt in pasos:
        dr.ellipse([150, y, 204, y + 54], fill=NARANJA); centrado_n = dr.textlength(num, font=fPb)
        dr.text((177 - centrado_n / 2, y + 4), num, font=fPb, fill=(255, 255, 255))
        dr.text((228, y + 6), txt, font=fP, fill=TEXTO); y += 74
    # Pie con el logo de Palmas de Tumaco
    dr.line([(120, 1640), (W - 120, 1640)], fill=(214, 232, 223), width=2)
    lg = Image.open(os.path.join(D, 'logo_900.png')).convert('RGBA'); lh = 88; lg = lg.resize((int(lg.width * lh / lg.height), lh), Image.LANCZOS)
    fF = fuente(['segoeui.ttf', 'arial.ttf'], 26)
    t = 'Android  ·  Uso interno'; tw = dr.textlength(t, font=fF); total = lg.width + 40 + tw
    xl = (W - total) / 2; im.paste(lg, (int(xl), 1652), lg); dr.text((xl + lg.width + 40, 1682), t, font=fF, fill=TENUE)
    return im, q

if __name__ == '__main__':
    a, q = afiche()
    fondo = Image.new('RGB', q.size, (255, 255, 255)); fondo.paste(q, (0, 0), q)
    fondo.save(os.path.join(D, 'qr_apk.png'), optimize=True)
    a.save(os.path.join(D, 'qr_apk_afiche.png'), optimize=True)
    print('Listo:', os.path.join(D, 'qr_apk_afiche.png'))
