# Pruebas automáticas

Pruebas de extremo a extremo con [Playwright](https://playwright.dev/python/) sobre la app compilada: app de campo, visor
(reproducción y Gerencia), administración (usuarios y formulario editable), diagnóstico por voz, auditoría, límite de la
plantación, historial, APK, pantalla bloqueada, alertas y reportes, carga masiva, panel del día, ciclo de censo aprobado, planificación del censo, erradicación (programación, aprobación de existencia 0 y labor en la App), monitoreo de plagas (muestra por lote y formulario)
y piloto de IA (servicio de IA simulado). GitHub se simula: las pruebas no leen ni escriben datos reales.

Se ejecutan solas en GitHub Actions (`.github/workflows/pruebas.yml`) con cada cambio en `src/` o `tests/`.

## Ejecutarlas en el computador

```bash
pip install playwright pillow openpyxl && python -m playwright install chromium
python src/build.py RUTA/node_modules src/marca
python -m http.server 8765 --bind 127.0.0.1
python tests/run_all.py            # todas
python tests/run_all.py gerencia   # solo las que contienen «gerencia»
```

En Windows se puede usar Edge en lugar de Chromium: `set PW_CANAL=msedge`.

Los datos de las pruebas son ficticios (nombres, cédulas y el polígono de `fixtures/` no son reales).
