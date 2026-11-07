# Sanidad Palma — Guía de instalación y uso

Aplicación web instalable (PWA) que funciona **sin conexión** para registrar el diagnóstico fitosanitario de cada palma de aceite sobre la cartografía de la plantación: **lotes** (polígonos) y **palmas** (puntos).

## 1. Contenido del paquete

| Archivo / carpeta | Función |
|---|---|
| `index.html` | La aplicación completa. Incluye todas las librerías (Leaflet, JSZip, shpjs, togeojson): no necesita internet para funcionar. |
| `sw.js` | *Service worker*: guarda la aplicación y los mapas base en el dispositivo para usarlos sin señal. |
| `manifest.webmanifest`, `icons/` | Permiten instalar la aplicación en el celular como si fuera una app nativa. |
| `datos-ejemplo/` | Lotes y palmas de prueba (3 lotes, 2 025 palmas, siembra en triángulo de 9 m). |
| `src/app.html`, `src/build.py` | Código fuente y script para reconstruir `index.html` después de personalizarlo. |

## 2. Publicación e instalación en los celulares

### Opción A — Recomendada: publicar en una dirección https

La instalación como app y el guardado de mapas sin conexión exigen que la aplicación se abra desde una dirección `https://`. Basta con hacerlo **una sola vez con internet**; después funciona en campo sin señal.

**Netlify Drop (la más rápida, sin programar):**
1. Ingrese a `https://app.netlify.com/drop` desde un computador.
2. Arrastre la carpeta completa `app-sanidad-palma` a la página.
3. Netlify entrega una dirección del tipo `https://nombre-aleatorio.netlify.app`. Cree una cuenta gratuita para que la dirección no expire.

**GitHub Pages (alternativa):**
```bash
cd app-sanidad-palma
git init
git add .
git commit -m "Sanidad Palma v1.3.0"
git branch -M main
git remote add origin https://github.com/SU_USUARIO/sanidad-palma.git
git push -u origin main
```
Luego, en GitHub: *Settings → Pages → Source: Deploy from a branch → main / (root) → Save*. La dirección será `https://SU_USUARIO.github.io/sanidad-palma/`.

> También puede alojarla en un servidor web interno de la empresa, siempre que tenga certificado https.

**Instalación en Android (Chrome):**
1. Abra la dirección https en Chrome, con internet.
2. Menú ☰ de la aplicación → **Instalar la aplicación en este dispositivo** (o menú ⋮ de Chrome → *Agregar a la pantalla principal / Instalar app*).
3. Acepte el permiso de **ubicación** cuando se solicite.
4. Antes de ir a campo, abra la app una vez con internet en la zona de trabajo para guardar el mapa base (ver numeral 4).

**iPhone (Safari):** botón Compartir → *Agregar a pantalla de inicio*.

### Opción B — Abrir el archivo directamente

Copie `index.html` al dispositivo y ábralo en el navegador. Captura, almacenamiento, GPS, importación y exportación funcionan sin internet, pero **no** se instala como app ni guarda mapas base (se ven solo los lotes y las palmas sobre fondo gris). Útil para pruebas en computador.

## 3. Preparación de la cartografía (QGIS)

### Lotes (polígonos)
- Un polígono por lote, con un campo que lo identifique (p. ej. `LOTE`).
- Exporte: clic derecho en la capa → *Exportar → Guardar objetos como…* → Formato **GeoJSON** → SRC **EPSG:4326 – WGS 84**.

### Palmas (puntos)
- Un punto por palma (sitio de siembra). Campos recomendados: `ID_PALMA`, `LOTE`, `LINEA`, `PALMA`.
- Si no tiene el campo de lote, la aplicación lo calcula según el polígono que contiene cada palma.
- Si no tiene `ID_PALMA`, la aplicación lo genera como `LOTE-L<línea>-P<número>`.
- Exporte igualmente a **GeoJSON en EPSG:4326**.

**Formatos aceptados:** **GeoPackage (.gpkg)**, GeoJSON, KML, KMZ y Shapefile comprimido en `.zip` (con `.shp`, `.shx`, `.dbf` y `.prj`). Si la capa está en MAGNA-SIRGAS / Origen Nacional (EPSG:9377) u otro sistema proyectado, la app intenta reproyectarla a partir de su definición; aun así, se recomienda WGS 84.

**Importar en la app:** Menú ☰ → *Importar lotes* y luego *Importar palmas*. La app propone automáticamente qué campo corresponde a identificador, lote, línea, número y existencia de la palma; verifique y, en **Lotes a cargar**, escriba un filtro (p. ej. `IT` o `GU1`), pulse *Marcar los visibles* y luego **Importar**.

### Capas de Palmas de Tumaco

| Capa | Contenido | Uso recomendado |
|---|---|---|
| `Lotes_Claude.gpkg` o `lotes.geojson` | 291 lotes con `Lote`, `Programa`, `ZonaCosecha` | Cargar completa en todos los dispositivos (≈1 MB). |
| `Palmas.gpkg` | 377 477 sitios de palma (105 MB) | Desde computador. En celular, preferir los archivos por programa. |
| `palmas_por_programa/palmas_XX.geojson` | Las mismas palmas divididas en 12 programas (1–11 MB cada uno) | Cargar en cada celular solo el programa o los lotes que se evaluarán. |

- Campos usados: `ID Palma` / `ID_Palma` (identificador único que vincula los diagnósticos), `LOTE`, `Linea`, `Palma` y `Existente` (0 = sitio sin palma: se dibuja en gris claro y no cuenta como palma en el resumen).
- **Recomendación de carga:** importe al celular el programa completo (o varios); las palmas quedan guardadas por lote y en el mapa solo se cargan los **lotes de trabajo** (ver numeral 5). Para no saturar el equipo, active como máximo unas 60 000 palmas a la vez; lo normal es trabajar con 1 a 5 lotes (1 000–8 000 palmas).
- Para agregar otro programa sin borrar lo guardado, elija *Agregar o actualizar lotes en la capa actual*.
- Observación de calidad: en el lote **IT24** hay 2 116 palmas sin número de palma (`Palma` vacío). Funcionan normalmente gracias a `ID Palma`, pero conviene completarlas en la cartografía.

> **Importante:** los diagnósticos se vinculan a cada palma por su identificador. Si luego actualiza la capa de palmas, conserve los mismos identificadores.

**Rendimiento:** la app está probada con miles de puntos. Si la finca tiene decenas de miles de palmas, cargue en cada celular solo los lotes que esa persona evaluará.

## 4. Mapa base sin conexión

En Menú ☰ → *Configuración* elija el mapa base:

- **Satélite (Esri World Imagery)** o **Calles (OpenStreetMap)**: las zonas que se visualizan con internet quedan guardadas automáticamente. Además, *Menú ☰ → Guardar el mapa de la zona visible* descarga la zona en pantalla en 4 niveles de zoom (hasta 2 500 teselas por descarga). Úselo con moderación y conforme a los términos de uso de cada proveedor.
- **Ortofoto propia (recomendada)**: utilice sus propias imágenes de dron, con mayor detalle y sin depender de terceros.
  1. En QGIS: *Caja de herramientas → Generar teselas XYZ (Directorio)*.
  2. Extensión: la de su ortofoto; zoom mínimo 14; zoom máximo 20 o 21 (según la resolución); formato PNG o JPG; desmarque *Usar TMS*.
  3. Directorio de salida: una carpeta llamada `teselas` **dentro** de `app-sanidad-palma`.
  4. Publique de nuevo la carpeta (numeral 2).
  5. En la app: *Configuración → Mapa base: Ortofoto propia*, dirección `teselas/{z}/{x}/{y}.png` (o `.jpg`) y el zoom máximo que usó.
  6. Con internet, ubique la finca y use *Guardar el mapa de la zona visible* (el límite para ortofoto propia es 20 000 teselas por descarga).

## 5. Lotes de trabajo y guía por voz

### Elegir los lotes del día
1. Menú ☰ → **🎯 Elegir lotes de trabajo**.
2. Escriba un filtro (p. ej. `IT4`, o la zona `Z2`), marque los lotes y pulse **Trabajar con estos lotes**.
3. Solo esas palmas se cargan en memoria y en el mapa; los demás lotes quedan guardados en el dispositivo y se ven con borde blanco punteado.
4. Atajo en el mapa: con el mapa alejado, toque cualquier lote → *Agregar a los lotes de trabajo*, *Trabajar solo en este lote* o *Quitar*.
5. El resumen por lote incluye todos los lotes guardados, estén o no activos. La selección se conserva al cerrar la aplicación.

### Guía por voz (🔈 en la barra inferior)
- Al activarla, el mapa sigue su posición y la pantalla se mantiene encendida.
- Cuando usted queda a menos de **4 m** de una palma, suena un pitido, vibra el equipo y la voz anuncia, por ejemplo: «Lote I T 43, línea 3, palma 14». Si la palma ya fue evaluada, agrega su estado; si es un sitio sin palma, lo indica.
- Al pasar de un lote a otro anuncia «Entrando al lote…» y advierte si ese lote no está cargado.
- Si la precisión del GPS es peor que 15 m, avisa «precisión baja» y no anuncia palmas, para evitar errores.
- El recuadro superior muestra siempre la palma más cercana y la distancia; tóquelo para abrir la ficha y registrar el diagnóstico, o pulse 🔁 para repetir el anuncio.
- Distancia de anuncio, precisión mínima y velocidad de la voz se ajustan en *Configuración* (incluye un botón *Probar la voz*).

**Voz sin internet (Android):** *Ajustes → Sistema → Idiomas → Salida de texto a voz → Servicios de voz de Google → Instalar datos de voz → Español*, y descargue la voz en español. Sin esa descarga, en campo sin señal solo sonarán el pitido y la vibración.

**Importante:** el navegador entrega la posición GPS solo con la aplicación abierta y la pantalla encendida. No bloquee el teléfono ni cambie a otra aplicación mientras use la guía por voz.

## 6. Trabajo en campo

1. **Primer ingreso:** escriba su nombre y la finca. Para practicar, pulse *Generar datos de ejemplo*.
2. **📍 Mi ubicación:** activa el seguimiento del GPS (el mapa le sigue). La barra superior indica la precisión (±m).
3. **🌴 Palma cercana:** selecciona la palma más próxima a su posición y muestra la distancia. También puede tocar cualquier palma en el mapa.
4. **＋ Nuevo diagnóstico:** diligencie el formulario:
   - Fecha y hora, evaluador (obligatorios).
   - Estado: sana, enferma, en tratamiento, muerta, erradicada, sitio vacío o resiembra (obligatorio).
   - Problemas sanitarios (PC, marchitez letal, anillo rojo, marchitez sorpresiva, pudriciones, *Rhynchophorus*, *Strategus*, *Leptopharsa*/Pestalotiopsis, *Opsiphanes*, *Sagalassa*, etc.). Si marca PC se habilita el grado (1 a 5).
   - Severidad general (0 a 5), síntomas, acción recomendada, observaciones y fotografías (se comprimen a 1 600 px para ahorrar espacio).
   - Si usted está a más de 25 m de la palma, la app lo advierte para evitar errores de identificación.
5. **＋ Palma nueva:** registra una palma que no existe en la capa (en su posición GPS). También puede mantener presionado el mapa sobre el sitio exacto.
6. **Colores del mapa:** cada palma toma el color de su último diagnóstico (botón 🎨 *Leyenda*). Amarillo = sin evaluar.
7. **📋 Registros:** lista con filtros por lote, estado y problema; toque un registro para editarlo.
8. **📊 Resumen:** palmas evaluadas, sanas, enfermas e **incidencia por lote** = (enfermas + en tratamiento) / evaluadas, más el conteo por problema.

## 7. Exportación y consolidación

**Menú ☰ → Exportar:**
- **Paquete completo (.zip):** `registros.csv`, `registros.geojson`, `ultimo_estado_por_palma.geojson`, `registros.kml`, las capas y la carpeta `fotos/`.
- **Compartir paquete:** lo envía por WhatsApp, correo o Drive cuando haya señal.
- El CSV usa `;` como separador (abre directo en Excel en español) e incluye columnas `p_PC`, `p_ML`, `p_AR`… con 1/0 para análisis rápido.
- En QGIS, abra `registros.geojson` y únalo con su capa de palmas por `palma_id`.

**Varios evaluadores:** cada uno crea un **respaldo** (Menú ☰ → *Crear respaldo*). En un dispositivo central, use *Restaurar o combinar respaldo* con cada archivo: los registros se suman sin duplicarse (cada diagnóstico tiene un identificador único).

> **Buena práctica:** los datos viven en el dispositivo. Exporte o respalde al terminar cada jornada. No borre los datos del navegador ni desinstale la app sin haber respaldado.

## 8. Personalización del formulario

Los catálogos están al inicio del código en `src/app.html`:

```javascript
const ESTADOS   = [ {id:'sana', n:'Sana', c:'#2e7d32'}, ... ];   // id, nombre, color en el mapa
const PROBLEMAS = [ {id:'PC', n:'Pudrición del cogollo (PC)'}, ... ];
const SINTOMAS  = [ 'Pudrición en flecha', ... ];
const ACCIONES  = [ 'Ninguna', 'Seguimiento', ... ];
```

Después de modificarlos, reconstruya `index.html`:

```bash
mkdir -p ~/libs-sanidad && cd ~/libs-sanidad
npm init -y
npm i leaflet@1.9.4 jszip@3.10.1 shpjs@4 @tmcw/togeojson@5
cd /ruta/a/app-sanidad-palma
python3 src/build.py ~/libs-sanidad/node_modules
```

(El script requiere Python 3 con Pillow: `pip install pillow`.) Luego cambie `APP='sanidad-palma-app-v1'` por `v2` en `sw.js` para que los celulares descarguen la nueva versión, y publique de nuevo. No cambie los `id` de opciones ya usadas, pues con ellos se guardan los registros.

## 9. Limitaciones conocidas

- La precisión depende del GPS del celular (normalmente 3–10 m bajo cielo abierto; peor bajo dosel cerrado). Por eso la selección se basa en la palma cartografiada y la app registra, además, la posición GPS y la distancia al momento del diagnóstico como control de calidad.
- En iPhone, Safari puede liberar el almacenamiento de apps poco usadas; respalde con frecuencia.
- Los mapas de Esri y OpenStreetMap tienen condiciones de uso propias; para uso intensivo en la empresa, se recomienda la ortofoto propia.
