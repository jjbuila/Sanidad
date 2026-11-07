# Sanidad Palma 2.0 — Guía de instalación y uso

**Palmas de Tumaco S.A.S.** · Censo fitosanitario georreferenciado sin conexión

## 1. Arquitectura

| Repositorio | Visibilidad | Contenido |
|---|---|---|
| `jjbuila/Sanidad` | Público (GitHub Pages) | La aplicación: `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`, `src/`. **No contiene datos.** |
| `jjbuila/Sanidad-datos` | **Privado** | `cartografia/` (lotes y palmas) y `jornadas/` (diagnósticos, recorridos y fotos sincronizados). |

Cada celular descarga la cartografía una sola vez desde el repositorio privado, usando un token de acceso, y trabaja sin conexión. Al conectarse a WiFi, envía los diagnósticos y recorridos en formato GeoJSON. Lo que ya se sincronizó queda bloqueado.

## 2. Crear el repositorio privado de datos

1. En GitHub pulse **+** y luego **New repository**.
2. En *Repository name* escriba `Sanidad-datos`.
3. Marque **Private**.
4. Marque **Add a README file**. Es obligatorio, porque la sincronización necesita que el repositorio tenga al menos un commit.
5. Pulse **Create repository**.
6. Pulse **Add file** y luego **Upload files**. Arrastre la carpeta **`cartografia`** del paquete `sanidad-datos-cartografia.zip`. La carpeta contiene:
   - `cartografia/lotes.geojson`: 291 lotes con `Lote`, `Programa` y `ZonaCosecha`.
   - `cartografia/palmas.zip`: 377 477 sitios de palma (4 MB).
7. Pulse **Commit changes**.

## 3. Crear el token de acceso

El token es la clave que usan los celulares para leer la cartografía y escribir los datos. Se crea en su cuenta de GitHub:

1. Pulse su foto (arriba a la derecha) y luego **Settings**.
2. Entre a **Developer settings**, luego **Personal access tokens**, **Fine-grained tokens** y pulse **Generate new token**.
3. Complete los campos:
   - *Token name*: `Sanidad Palma celulares`.
   - *Expiration*: la fecha que defina la empresa, por ejemplo 1 año.
   - *Repository access*: **Only select repositories** y elija **`jjbuila/Sanidad-datos`**.
   - *Permissions*, *Repository permissions*, **Contents**: **Read and write**.
4. Pulse **Generate token** y copie el valor que empieza por `github_pat_…`. GitHub no lo vuelve a mostrar.

> **Seguridad:** el token solo da acceso al repositorio `Sanidad-datos`. Si un celular se pierde, revoque el token en la misma pantalla y cree uno nuevo.

## 4. Actualizar la aplicación publicada (repositorio `Sanidad`)

1. Descomprima `sanidad-palma-v2-app.zip`.
2. En `jjbuila/Sanidad` pulse **Add file** y luego **Upload files**.
3. Arrastre **todo el contenido** de la carpeta: `index.html`, `sw.js`, `manifest.webmanifest`, `GUIA.md`, `icons` y `src`.
4. Pulse **Commit changes**. GitHub reemplaza los archivos que tienen el mismo nombre.
5. Opcional: borre la carpeta `datos-ejemplo` de la versión anterior. Para hacerlo, abra cada archivo de esa carpeta, pulse **⋯** y luego **Delete file**.
6. Espere entre 1 y 3 minutos a que *Actions* muestre el visto verde.

Desde la línea de comandos:

```bash
git clone https://github.com/jjbuila/Sanidad.git
cd Sanidad
git rm -r --quiet datos-ejemplo
cp -r /ruta/sanidad-palma-v2-app/* .
git add .
git commit -m "Sanidad Palma 2.0"
git push
```

## 5. Configurar cada celular

1. Abra `https://jjbuila.github.io/Sanidad/` en **Chrome**, con WiFi.
2. En **Configuración inicial**:
   - Escriba su nombre.
   - Usuario: `jjbuila`.
   - Repositorio: `Sanidad-datos`.
   - Rama: `main`.
   - Pegue el token.
3. Pulse **CONECTAR Y DESCARGAR CARTOGRAFÍA**. Tarda entre 20 y 60 segundos.
4. Instale la aplicación desde **Menú**, opción **Instalar app**, o desde el menú ⋮ de Chrome, opción **Instalar app**.
5. Descargue la voz en español para usarla sin internet: *Ajustes → Sistema → Idiomas → Salida de texto a voz → Servicios de voz de Google → Instalar datos de voz → Español*.
6. Con internet, recorra en el mapa los lotes donde va a trabajar, o use **Menú → Mapa sin conexión**, para guardar la imagen satelital.

**Para configurar varios celulares más rápido:** en un celular ya configurado entre a **Menú → Configuración → Enlace de configuración** y envíe ese enlace por un canal privado. Al abrirlo, el otro celular queda conectado sin escribir el token. El enlace contiene el token, por lo que no debe compartirse en grupos.

## 6. Trabajo en campo

### Planificar e iniciar la jornada
1. Pulse el botón naranja **INICIAR** de la barra inferior.
2. Elija los lotes. Puede tocarlos en el mapa (se marcan en naranja) o buscarlos por código o programa. Se permiten varios lotes en un mismo día.
3. Para cada lote, ajuste el **rango de líneas** que va a censar. Por defecto vienen todas.
4. Escriba el nombre del evaluador y pulse **INICIAR JORNADA**.
   - Desde ese momento se **guarda el recorrido (track)**: aparece el indicador rojo **REC**, el tiempo, los kilómetros y el avance del censo.
   - Solo se cargan las palmas elegidas. En amarillo aparecen las pendientes por censar.

### Censar
- **CERCANA**: abre la palma más próxima a su posición.
- **🔊 Guía por voz** (botón flotante): anuncia «Lote I T 43, línea 3, palma 14» al acercarse a menos de 4 m. Si la palma ya fue censada, también lo dice.
- **REGISTRAR DIAGNÓSTICO**: estado, problemas, grado de PC, severidad, síntomas, acción, observaciones y fotos. En cada jornada hay un diagnóstico por palma, que puede corregirse mientras no se haya sincronizado.
- La aplicación **no permite crear palmas ni lotes**: solo se trabaja sobre la cartografía oficial.
- Desde el botón **JORNADA** puede ver el avance por lote, **agregar lotes**, ver el recorrido hasta el momento o **FINALIZAR JORNADA**.

### Base de datos y recorridos
- **DATOS → Diagnósticos**: tabla con filtros por jornada, lote, estado y sincronización, búsqueda y orden por columna. 🔒 indica sincronizado y ⏳ pendiente.
- **DATOS → Jornadas y recorridos**: cada jornada con su duración, kilómetros, puntos y diagnósticos. El botón **▶ Reproducir recorrido** muestra el track animado con hora, distancia y diagnósticos que aparecen en el momento en que se registraron. Tiene velocidades de ×10 a ×300 y una barra para adelantar o retroceder.
- **DATOS → Resumen por lote**: avance e incidencia, calculada como (enfermas + en tratamiento) / evaluadas.

## 7. Sincronización y bloqueo

- **Automática con WiFi:** la aplicación sincroniza en cuanto detecta WiFi. Con datos móviles no lo hace, salvo que el usuario pulse **Sincronizar ahora** y lo confirme.
- **Tiempo de corrección:** cada diagnóstico espera **2 minutos** después de guardado antes de enviarse, para poder corregirlo. Este tiempo se ajusta en *Configuración*; con 0 se envía de inmediato.
- **Bloqueo:** una vez sincronizado, el diagnóstico queda **🔒 bloqueado**: no se puede editar ni eliminar. Tampoco se pueden borrar los datos del dispositivo mientras haya pendientes.
- **Estado en la cabecera:** el indicador superior muestra «Al día», el número de pendientes o un error. Al tocarlo se ve el detalle.

### Qué queda en GitHub

```
Sanidad-datos/
├── cartografia/
│   ├── lotes.geojson
│   └── palmas.zip
└── jornadas/
    └── 2026-11-07/
        └── 20261107-0816-5aec06/          ← una carpeta por jornada
            ├── registros.geojson          ← diagnósticos (puntos con todos los atributos)
            ├── recorrido.geojson          ← track (línea con tiempos y precisión de cada vértice)
            ├── jornada.json               ← evaluador, lotes, rangos, inicio, fin, km
            └── fotos/<id>.jpg
```

- **Campos de `registros.geojson`:** `palma_id`, `lote`, `linea`, `palma`, `estado`, `problemas`, `p_PC`… (1/0), `grado_pc`, `severidad`, `sintomas`, `accion`, `observaciones`, `fotos`, `gps_precision_m`, `dist_gps_palma_m`, `evaluador`, `creado`, `sincronizado`, entre otros.
- **Uso en QGIS:** los GeoJSON se abren directamente. Para consolidar, clone el repositorio con `git clone https://github.com/jjbuila/Sanidad-datos.git` y combine los `registros.geojson` con *Vectorial → Herramientas de gestión de datos → Combinar capas vectoriales*.

## 8. Actualizar la cartografía

1. Regenere `lotes.geojson` y `palmas.zip`. Mantenga el formato: `palmas.zip` contiene `indice.json` y `palmas/<LOTE>.json`.
2. Súbalos a `Sanidad-datos/cartografia/`, reemplazando los anteriores.
3. En cada celular, entre a **Menú → Configuración → Actualizar desde GitHub**.

Mantenga el `ID Palma`, porque es el identificador que vincula los diagnósticos con cada palma.

## 9. Limitaciones conocidas

- **Pantalla encendida:** el navegador solo registra el recorrido con la aplicación abierta y la pantalla encendida. La aplicación mantiene la pantalla encendida durante la jornada; no la bloquee ni cambie de aplicación. Si la aplicación se cierra, al abrirla la jornada se recupera y el recorrido continúa.
- **Precisión:** solo se guardan puntos de recorrido con una precisión de 30 m o mejor, y se descartan los saltos del GPS.
- **Fotos:** se reducen a 1 280 px (unos 60 a 150 KB cada una). GitHub recomienda que un repositorio no supere unos 5 GB. Para un volumen alto de fotos, conviene archivar cada año en otro repositorio.
- **Detección de WiFi:** solo funciona en Chrome para Android. En iPhone y en computadores, la aplicación sincroniza con cualquier conexión.
