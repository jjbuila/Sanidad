# Sanidad Palma 2.1 — Guía de instalación y uso

**Palmas de Tumaco S.A.S.** · Censo fitosanitario georreferenciado sin conexión

## 1. Arquitectura

| Repositorio | Visibilidad | Contenido |
|---|---|---|
| `jjbuila/Sanidad` | Público (GitHub Pages) | La aplicación (`index.html`, `admin.html`, `sw.js`, `icons/`, `src/`) y la carpeta **`datos/`** con el paquete de acceso **cifrado** (`acceso.json`) y la cartografía **cifrada** (`carto.enc`). |
| `jjbuila/SanidadData` | **Privado** | `jornadas/`: diagnósticos, recorridos y fotos sincronizados. Opcionalmente, la copia maestra de la cartografía. |

**Cómo funciona el acceso**
- La cartografía y el token de GitHub viajan **cifrados** (AES-256-GCM) dentro de la aplicación, de modo que lotes y palmas vienen **cargados por defecto**.
- Cada operario ingresa con **usuario y contraseña**. La contraseña (PBKDF2-SHA256, 600 000 iteraciones) descifra en el celular la llave de datos, y con ella el token y la cartografía. **No se necesita internet para ingresar.**
- La sesión queda abierta en el dispositivo, protegida con una llave no extraíble, hasta que el operario pulse **Cerrar sesión**. Si la aplicación se cierra durante una jornada, al abrirla continúa sin pedir la contraseña.
- El token nunca se guarda ni se muestra en texto plano.

## 2. Preparar el repositorio privado de datos

`SanidadData` ya está creado como privado y con README. La aplicación escribe allí la carpeta `jornadas/`. La carpeta `cartografia/` puede quedar como copia maestra; la aplicación ya no la descarga de allí.

## 3. Crear el token de acceso

1. Pulse su foto (arriba a la derecha) y luego **Settings**.
2. Entre a **Developer settings**, luego **Personal access tokens**, **Fine-grained tokens** y pulse **Generate new token**.
3. Complete los campos:
   - *Name*: `Sanidad Palma celulares`.
   - *Expiration*: por ejemplo, 1 año.
   - *Repository access*: **Only select repositories** → **`jjbuila/SanidadData`**.
   - *Permissions*: **Contents** con **Read and write**.
4. Pulse **Generate token** y copie el `github_pat_…`. Solo lo necesitará en el paso siguiente.

## 4. Crear usuarios y el paquete cifrado (administrador)

1. Abra **`https://jjbuila.github.io/Sanidad/admin.html`** en el computador. También puede abrir el archivo `admin.html` del paquete directamente en Chrome.
2. En la pestaña **Crear paquete nuevo**:
   1. Verifique el usuario `jjbuila`, el repositorio `SanidadData` y la rama `main`. Pegue el token y pulse **Probar token**.
   2. En **Cartografía**, seleccione a la vez `lotes.geojson` y `palmas.zip`, que están en `sanidad-datos-cartografia.zip`.
   3. En **Usuarios**, registre a cada operario con su usuario (por ejemplo `jperez`), su nombre completo, el rol y su contraseña. El botón 🎲 genera una contraseña segura. Debe existir al menos un **Administrador**.
   4. Pulse **GENERAR ARCHIVOS CIFRADOS**. Se descargan `acceso.json` y `carto.enc`.
   5. Opcional: pulse **Descargar credenciales (CSV)** para entregar las contraseñas. Hágalo de forma personal y borre el archivo después.
3. Suba los dos archivos al repositorio **`Sanidad`**, dentro de una carpeta **`datos/`**:
   1. Pulse **Add file** y luego **Create new file**, y escriba `datos/LEAME.md` con cualquier texto. Pulse **Commit changes**.
   2. Entre a la carpeta `datos`, pulse **Add file** y luego **Upload files**, arrastre `acceso.json` y `carto.enc`, y pulse **Commit changes**.

**Contraseñas:** el paquete cifrado es público, así que su seguridad depende de la contraseña. Use **mínimo 8 caracteres combinando letras y números**; la página de administración no acepta contraseñas más débiles. Las generadas con 🎲 tienen 10 caracteres.

### Modificar usuarios después
1. En `admin.html` entre a la pestaña **Modificar paquete existente**.
2. Cargue el `acceso.json` vigente e ingrese con un usuario administrador.
3. Desde allí puede **agregar usuarios**, **cambiar contraseñas**, **eliminar usuarios**, **cambiar el token** cuando venza, o **reemplazar la cartografía**.
4. Pulse **GENERAR ARCHIVOS ACTUALIZADOS** y suba los archivos a `Sanidad/datos/`, reemplazando los anteriores.

Los celulares toman los cambios la próxima vez que abran la aplicación con internet. Un usuario eliminado pierde la sesión en ese momento.

> **Revocación completa:** si se pierde un celular o una contraseña queda expuesta, haga tres cosas. Primero, **revoque el token** en GitHub y cree uno nuevo. Segundo, en **Crear paquete nuevo**, genere un paquete completo con el token nuevo y contraseñas nuevas; así se crea una llave de datos nueva. Tercero, súbalo a `datos/`. Todas las sesiones anteriores quedarán invalidadas.

## 5. Publicar la aplicación y preparar cada celular

1. **Publicar:** suba al repositorio `Sanidad` el contenido de `sanidad-palma-v2-app.zip`: `index.html`, `admin.html`, `sw.js`, `manifest.webmanifest`, `GUIA.md`, `icons` y `src`. Además debe estar la carpeta `datos/` del paso 4.
2. **Abrir por primera vez (con WiFi):** abra `https://jjbuila.github.io/Sanidad/` en **Chrome**. Ingrese con usuario y contraseña. La cartografía se descifra en unos segundos y queda guardada en el celular.
3. **Instalar:** use **Menú → Instalar app**, o el menú ⋮ de Chrome → **Instalar app**.
4. **Voz sin internet:** *Ajustes → Sistema → Idiomas → Salida de texto a voz → Servicios de voz de Google → Instalar datos de voz → Español*.
5. **Mapa sin conexión:** con internet, recorra en el mapa los lotes de trabajo o use **Menú → Mapa sin conexión**.

Desde ese momento el operario trabaja **sin internet**: abre la aplicación, que ya tiene la sesión iniciada, planifica la jornada, censa y finaliza. Al llegar a una zona con WiFi, la información se sincroniza sola.

## 6. Trabajo en campo

### Planificar e iniciar la jornada
1. Pulse el botón naranja **INICIAR** de la barra inferior.
2. Elija los lotes. Puede tocarlos en el mapa (se marcan en naranja) o buscarlos por código o programa. Se permiten varios lotes en un mismo día.
3. Para cada lote, ajuste el **rango de líneas** que va a censar. Por defecto vienen todas.
4. Pulse **INICIAR JORNADA**. El evaluador queda registrado automáticamente con el nombre del usuario que ingresó.
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
SanidadData/
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
- **Uso en QGIS:** los GeoJSON se abren directamente. Para consolidar, clone el repositorio con `git clone https://github.com/jjbuila/SanidadData.git` y combine los `registros.geojson` con *Vectorial → Herramientas de gestión de datos → Combinar capas vectoriales*.

## 8. Actualizar la cartografía

1. Regenere `lotes.geojson` y `palmas.zip`. Mantenga el formato: `palmas.zip` contiene `indice.json` y `palmas/<LOTE>.json`.
2. En `admin.html`, pestaña **Modificar paquete existente**, cargue los dos archivos en **Cartografía** y pulse **GENERAR ARCHIVOS ACTUALIZADOS**.
3. Suba `acceso.json` y `carto.enc` a `Sanidad/datos/`.
4. Cada celular cargará la nueva cartografía la próxima vez que abra la aplicación con internet.

Mantenga el `ID Palma`, porque es el identificador que vincula los diagnósticos con cada palma.

## 9. Limitaciones conocidas

- **Pantalla encendida:** el navegador solo registra el recorrido con la aplicación abierta y la pantalla encendida. La aplicación mantiene la pantalla encendida durante la jornada; no la bloquee ni cambie de aplicación. Si la aplicación se cierra, al abrirla la jornada se recupera y el recorrido continúa.
- **Precisión:** solo se guardan puntos de recorrido con una precisión de 30 m o mejor, y se descartan los saltos del GPS.
- **Fotos:** se reducen a 1 280 px (unos 60 a 150 KB cada una). GitHub recomienda que un repositorio no supere unos 5 GB. Para un volumen alto de fotos, conviene archivar cada año en otro repositorio.
- **Detección de WiFi:** solo funciona en Chrome para Android. En iPhone y en computadores, la aplicación sincroniza con cualquier conexión.
