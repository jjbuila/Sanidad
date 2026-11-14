"""Ejecuta todas las pruebas (cada una se reintenta una vez si falla, por la cámara y la voz simuladas).

Requisitos: la app compilada y servida en http://127.0.0.1:8765 (python -m http.server 8765 desde la raíz),
pip install playwright pillow && python -m playwright install chromium
Uso: python tests/run_all.py [nombre ...]
"""
import glob, os, subprocess, sys, time
sys.stdout.reconfigure(encoding='utf-8')
AQUI = os.path.dirname(os.path.abspath(__file__))
pruebas = sorted(glob.glob(os.path.join(AQUI, 'prueba_*.py')))
if len(sys.argv) > 1:
    pruebas = [p for p in pruebas if any(a in os.path.basename(p) for a in sys.argv[1:])]
fallas, t0 = [], time.time()
for p in pruebas:
    n = os.path.basename(p)[:-3]
    for intento in (1, 2):
        r = subprocess.run([sys.executable, p], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
        oks = r.stdout.count('\nOK') + r.stdout.startswith('OK')
        if r.returncode == 0:
            print(f'✅ {n}: {oks} verificaciones' + (' (al 2.º intento)' if intento == 2 else ''), flush=True); break
        if intento == 2:
            fallas.append(n); print(f'❌ {n}', flush=True)
            print('\n'.join(l for l in (r.stdout + r.stderr).splitlines() if l.startswith('FALLA') or 'Error' in l or 'Traceback' in l)[-3000:], flush=True)
print(f'\n{len(pruebas) - len(fallas)} de {len(pruebas)} pruebas sin fallas en {time.time() - t0:.0f} s.')
sys.exit(1 if fallas else 0)
