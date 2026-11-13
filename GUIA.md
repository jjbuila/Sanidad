# Sanidad Vegetal 3.4 — Guía de instalación y uso

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
   - *Name*: `Sanidad Vegetal celulares`.
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

Desde ese momento el operario trabaja **sin internet**: abre la aplicación, que ya tiene la sesión iniciada, planifica la jornada, censa y finaliza. En cuanto el celular tiene internet (WiFi o datos móviles), la información pendiente se sincroniza sola.

## 6. Trabajo en campo

### Planificar e iniciar la jornada
1. Pulse el botón naranja **INICIAR** de la barra inferior.
2. Elija los lotes. Puede tocarlos en el mapa (se marcan en naranja) o buscarlos por código o programa. Se permiten varios lotes en un mismo día.
3. Para cada lote, ajuste el **rango de líneas** que va a censar. Por defecto vienen todas.
4. Pulse **INICIAR JORNADA**. El evaluador queda registrado automáticamente con el nombre del usuario que ingresó.
   - Desde ese momento se **guarda el recorrido (track)**: aparece el indicador rojo **REC**, el tiempo, los kilómetros y el avance del censo.
   - Solo se cargan las palmas elegidas. En amarillo aparecen las pendientes por censar.

### Censar
- **CERCANA**: muestra un **círculo de 50 m** en el mapa y la **lista de palmas de la jornada dentro de ese radio**, ordenadas por distancia, con filtro por línea y opción «solo pendientes». Toque la palma que va a diagnosticar. El radio lo ajusta el administrador.
- **Elegir la palma a diagnosticar (tres formas):**
  1. **Tocar el punto de la palma** en el mapa.
  2. **Tocar la etiqueta** que aparece sobre cada palma al acercar el mapa (zoom 20: «L3 · P14»; zoom 21: «IT43 · L3 · P14»). Las etiquetas con borde naranja están a 50 m o menos de usted; las tenues, más lejos.
  3. Botón **CERCANA**: lista de palmas a 50 m o menos, con filtro por línea y «solo pendientes».
  - **Regla:** solo se puede **registrar un diagnóstico nuevo** en palmas a **50 m o menos** del operario (radio configurable por el administrador) y con GPS activo. Si la palma está más lejos, la ficha muestra la distancia y el botón «Ver palmas a 50 m o menos». Los diagnósticos ya registrados en la jornada pueden consultarse y corregirse (si no se han sincronizado) desde cualquier distancia.
- **Secuencias por lote y desplazamientos:** la **labor** empieza con la primera calle trabajada (o el primer diagnóstico) y termina con la última palma. Se distinguen tres desplazamientos:
  - **Desplazamiento inicial:** del inicio de la jornada al inicio de la labor. Se informa aparte; no es tiempo efectivo de un lote.
  - **Desplazamiento entre lotes:** de la última palma de un lote a la primera del siguiente. Se **suma a la secuencia del lote al que llega** (su hora de inicio es el final del lote anterior), se muestra en la columna *Despl. entre lotes* y **cuenta como tiempo efectivo**.
  - **Desplazamiento final:** de la última palma al fin de la jornada. Se informa aparte; no es tiempo efectivo de un lote.
  Cada bloque de trabajo en un lote abre una secuencia (1 RI01, 2 RI02, 3 RI01…), con hora de inicio y fin, tiempo total, desplazamiento entre lotes, paradas, **tiempo efectivo** (total − paradas), **velocidad de caminata**, palmas visitadas, hectáreas y diagnósticos. La barra de la jornada muestra la secuencia, el lote, el tiempo efectivo y la **velocidad de caminata** (km ÷ horas en movimiento, sin paradas). El resumen final, el GeoJSON (`secuencias`, `tiempos`, `velocidad_kmh`) y el visor traen el detalle.
- **Colores de las palmas diagnosticadas:** uno por enfermedad principal (PC rojo, PE morado, DBP naranja, Anillo rojo vino, Cercospora café, Deficiencias lima, Espontánea cian, Hoja pequeña índigo, Mal de juventud rosado, ML negro, MS azul, Palma amarilla oliva, Pestalotia verde azulado, Rayo blanco, Yarumo verde oscuro); si la palma está **de alta**, verde brillante.
- **Reproducción del recorrido:** las palmas visitadas aparecen a medida que avanza el operario, con su contador (app y visor).
- **Fotos:** el botón «📷 Tomar o adjuntar foto» abre la **cámara dentro de la app** (se pueden tomar varias seguidas y pulsar LISTO; 🖼 abre la galería). Las fotos se guardan a 1280 px. Así no se abre la cámara del sistema, que en celulares con poca memoria (por ejemplo Xiaomi Redmi con 4 GB) hacía que Android cerrara el navegador y se perdiera la foto.
- **Segundo plano:** al iniciar la jornada la app muestra el aviso persistente «Jornada en curso» en la barra de notificaciones (tocarlo vuelve a la app). Si la app estuvo más de 1,5 minutos en segundo plano, al volver avisa por voz que el recorrido pudo cortarse. Una aplicación web no puede registrar GPS con la app cerrada o la pantalla apagada: mantenga la app abierta y la pantalla encendida (la app la mantiene encendida sola).
- **Mensajes de voz:** al pulsar **Iniciar jornada** la app dice el mensaje motivacional de Palmas de Tumaco («Buenos días. Hoy inicia una nueva jornada…»), y al **finalizar**: «Muchas gracias por su labor. Feliz resto de día». Mientras suenan, los avisos de la guía no los interrumpen.
- **🔊 Guía por voz** (botón flotante): anuncia «Lote I T 43, línea 3, palma 14» al llegar a 2 m o menos de la palma. Si la palma ya fue censada, también lo dice.
- **REGISTRAR DIAGNÓSTICO** (formulario *Ramificación V6* de la plantación, 30 ramas, en `src/Formulario_Sanidad_RamificacionV6.xlsx`):
  1. **Nivel 1 · Enfermedad principal** (una sola): PC, PE, DBP, Anillo rojo, Cercospora, Deficiencias, Espontánea, Hoja pequeña, Mal de juventud, Marchitez letal, Marchitez sorpresiva, Palma amarilla, Pestalotia, Rayo y Yarumo.
  2. **Nivel 2 · Opción** (una sola), solo si la enfermedad la tiene (por ejemplo PC INICIAL, CRATER, PE PARTIDA, YARUMO EN CALLE).
  3. **Nivel 3 · Enfermedad**: **automático** según los niveles anteriores (caso nuevo o seguimiento). CRATER existe en ambos: si la palma ya tiene un diagnóstico de PC en el celular es *Seguimiento PC*; si no, *PC caso nuevo*.
  4. **Nivel 4 · Síntomas**: la **única selección múltiple**; se muestran solo los de la rama elegida (si hay uno solo, queda marcado).
  5. Campos de la rama, **respuesta única y obligatoria** cuando aplican: estado del hongo (solo PE), cirugía, producción, raíces buenas y transitabilidad. Observación (texto) y fotos. Se muestra la fuente técnica de la rama.
  - El **estado** (color en el mapa) se asigna solo: enferma (caso nuevo o activo), en recuperación, de alta, erradicada u otra novedad (espontánea, yarumo, rayo).
  - En cada jornada hay un diagnóstico por palma, que puede corregirse mientras no se haya sincronizado. Los diagnósticos hechos con el formulario anterior se conservan y se muestran como tales.
- La aplicación **no permite crear palmas ni lotes**: solo se trabaja sobre la cartografía oficial.
- Desde el botón **JORNADA** puede ver el avance por lote, **agregar lotes**, ver el recorrido hasta el momento o **FINALIZAR JORNADA**.

### Palmas visitadas y hectáreas recorridas (automático)
- **Qué cuenta (método por calle, predeterminado):** la aplicación identifica en qué **calle** está el operario, es decir, entre qué **par de líneas** camina, y cuenta como **visitadas** las palmas de **esas dos líneas** a la altura por donde pasa (media distancia entre palmas hacia adelante y hacia atrás). No hace falta que el operario las marque; el diagnóstico se registra solo para la sanidad.
- **Cómo identifica la calle:** cada ~2 m del recorrido busca la línea más cercana (distancia perpendicular a la línea, no a la palma) y luego la línea vecina del mismo lote que queda del lado del operario. Si el operario va casi encima de una línea (menos de 1,5 m), conserva la calle anterior para evitar saltos por ruido del GPS. En el borde del lote, donde no hay línea vecina, cuenta solo la línea del borde. Si el operario está a más de 6 m de cualquier línea (vías, canales, zonas sin palma), no cuenta nada.
- **Tolerancia:** soporta desviaciones laterales del GPS de hasta media calle (unos 3,9 m) sin contar líneas de calles vecinas ni perder la línea del frente. En pruebas con desvíos de 0, 2, 3 y 3,7 m hacia cualquier lado, contó siempre las dos líneas correctas; el buffer de 5 m perdía la línea opuesta desde 2 m de desvío.
- **Tipos de lote:** la aplicación clasifica cada lote automáticamente al cargarlo, según su cartografía:
  - **Lineal:** todas las palmas tienen línea → método por calle.
  - **Terraza** (siembra por curvas de nivel): las palmas no tienen línea (línea 0) o un mismo número de línea agrupa varias filas → se cuentan las palmas a **5 m o menos del recorrido** (buffer), porque no hay un par de líneas que definan la calle.
  - **Mixto:** las palmas con línea válida se cuentan por calle y las de terraza por buffer, en el mismo recorrido.
  - Una línea se considera de terraza cuando, en promedio, cada palma tiene más de 2,6 palmas de la misma línea a 10,5 m o menos (una fila real tiene unas 2). Con la cartografía actual: **268 lotes lineales, 22 de terraza** (RI02–RI07, RI12–RI14, RI19–RI23, RI26–RI33) **y 1 mixto** (IS03, con 79 palmas sin línea). Los lotes con líneas curvas pero numeradas fila por fila (por ejemplo IT33) se tratan como lineales, porque la dirección de la línea se toma localmente de las dos palmas más cercanas.
  - El resumen por lote indica «terraza» o «mixto», y los datos sincronizados lo guardan en `tipo_lote`.
- **Método alternativo (buffer):** cuenta las palmas a 5 m o menos del recorrido. El administrador puede elegirlo en *Configuración*. Para evaluar, **cada jornada guarda también el resultado con buffer** en `comparativo_buffer` (palmas, ha y detalle por lote), y el resumen lo muestra al final de la tabla.
- **Solo cuenta la labor, no los desplazamientos:** una calle se confirma como trabajada cuando el operario avanza **22 m o más a lo largo de ella** (y pasa al menos 3 palmas), **dentro del polígono del lote** (tolerancia de 2 m por el GPS). Las palmas que toma al caminar por senderos o bordes fuera del lote, al cruzar cabeceras de líneas o al desplazarse hacia o entre lotes quedan provisionales 90 s y se descartan; no cuentan como visitadas aunque el lote esté en la programación. Una vez confirmada, la calle sigue abierta 10 min (pausas, ida y vuelta).
- **Solo lotes programados:** se cuentan las palmas de los lotes de la jornada (selección inicial y lotes agregados). Para contar otro lote, agréguelo a la jornada.
- **Regla del 90 % (existencia 0):** los vacíos y palmas muertas (existencia 0) no exigen que el operario llegue a ellos. En cada línea se toma el **tramo entre la primera y la última palma viva visitada**; si en ese tramo visitó el **90 % o más de las palmas vivas**, los sitios de existencia 0 del tramo se completan automáticamente como visitados y suman a la hectárea (`sitios_vacios_regla90`). Si el tramo llega a la primera o a la última palma viva de la línea, también se completan los vacíos de esa punta. En terrazas la regla se aplica al conjunto de palmas sin línea del lote.
- **Formulario de diagnóstico:** las preguntas se agrupan con bandas de color numeradas: 1 Diagnóstico (niveles 1 a 3), 2 Síntomas, 3 Condiciones de la palma, 4 Observación y fotos. Los grupos 2 y 3 aparecen al elegir la enfermedad.
- **Hectáreas recorridas** = palmas visitadas ÷ **115 palmas/ha**, por lote.
- **Avance del lote** = palmas visitadas ÷ **palmas totales del lote** (todos los sitios de la cartografía, existencia 0 y 1). Se ve en la barra de la jornada («AVANCE»), en el panel de la jornada por lote, en el resumen final (columnas *Total lote* y *Avance*) y en la pestaña *Lotes* del visor, donde se cuentan las palmas distintas sin repetir entre jornadas.
- **Incidencia de PC del lote** = casos de PC ÷ palmas totales del lote (existencia 0 y 1). Cuenta el último diagnóstico de cada palma con Nivel 1 = PC y **excluye los casos en recuperación** (y los dados de alta). Está en *Datos › Resumen* de la App y en la pestaña *Lotes* del visor.
- **Desplazamiento entre lotes en la fila del lote:** la secuencia del lote al que llega muestra *Inicio* (fin del lote anterior), *Inicio labor* (primera palma), *Despl. entre lotes*, *T. labor* y *T. total* = desplazamiento + labor.
- **En el mapa:** las palmas se dibujan como puntos con los colores de siempre: amarillo pendiente, **cian** visitada y el color de la enfermedad con diagnóstico. El operario es una **flecha de navegación con haz** que gira hacia donde camina (el rumbo se actualiza cada 3 m; quieto conserva el último). Igual en la reproducción del visor. Las **paradas** se muestran como una etiqueta con el símbolo de pausa y los minutos (naranja sin actividad, azul con diagnóstico).
- **Pantalla en movimiento o fija:** el botón de la persona (encima de los controles del mapa) alterna **SIGUE** (el mapa mantiene centrado al operario mientras camina) y **FIJA** (el mapa no se mueve solo). Si se mueve el mapa con el dedo en modo SIGUE, el seguimiento se pausa 20 s y vuelve solo. La preferencia queda guardada; las jornadas nuevas empiezan en SIGUE. En el visor, la reproducción tiene la casilla **Seguir al operario**.
- **En el panel superior:** hora de **inicio**, palmas **visitadas** y **ha** en vivo.
- **En los resúmenes:** la jornada y su resumen final muestran **hora de inicio y fin**, duración, km, ha y la tabla **por lote** (palmas visitadas, ha y diagnósticos).
- **Ajustes:** el método, la densidad y el buffer los define el administrador en *Configuración* y se aplican a las jornadas nuevas.
- **Saltos del GPS:** los tramos con saltos de más de 50 m no se cuentan como área recorrida.

### Paradas (tiempos de espera)
- **Qué es una parada:** se registra **automáticamente** cuando el operario permanece **5 minutos o más dentro de un radio de 20 m**. El radio absorbe el error normal del GPS.
- **Datos de cada parada:** hora de inicio y fin, **duración**, lote, ubicación y **tipo**:
  - 🔵 **con diagnóstico:** se registraron diagnósticos durante la parada, es decir, trabajo en una palma.
  - 🟠 **sin actividad:** detenido sin registrar diagnósticos.
  - ⚪ **sin señal GPS:** no llegaron puntos durante varios minutos y el operario reapareció en el mismo sitio, por ejemplo con la pantalla apagada.
- **En vivo:** el panel superior muestra el número de paradas y el tiempo acumulado. Mientras el operario está detenido, el panel se resalta en **ámbar** con «⏸ minutos».
- **En el mapa:** las paradas aparecen como marcadores con su duración; al tocarlos se ve el detalle. También aparecen en la **reproducción del recorrido**.
- **En el resumen:** la jornada muestra la **tabla de paradas** y el tiempo **en paradas** frente al tiempo **en movimiento**. La tabla por lote incluye las paradas y sus minutos.
- **Ajustes:** el radio y el tiempo mínimo los define el administrador en *Configuración*.

### Base de datos y recorridos
- **DATOS → Diagnósticos**: tabla con filtros por jornada, lote, estado y sincronización, búsqueda y orden por columna. 🔒 indica sincronizado y ⏳ pendiente.
- **DATOS → Jornadas y recorridos**: cada jornada con su duración, kilómetros, puntos y diagnósticos. El botón **▶ Reproducir recorrido** muestra el track animado con hora, distancia y diagnósticos que aparecen en el momento en que se registraron. Tiene velocidades de ×10 a ×300 y una barra para adelantar o retroceder.
- **DATOS → Resumen por lote**: avance e incidencia, calculada como (enfermas + en tratamiento) / evaluadas.

## 7. Sincronización y bloqueo

**Regla: una jornada, una sincronización.**
- **Durante la jornada no se envía nada.** Los diagnósticos se pueden corregir mientras la jornada no se haya sincronizado.
- **Al finalizar la jornada**, en cuanto el celular tenga **internet (WiFi o datos móviles)**, se envía la **jornada completa** en un solo envío. Si no hay conexión, se reintenta sola al recuperarla, al abrir la app y cada 5 minutos. El administrador puede limitarlo a WiFi en *Configuración*.
- **Escalonamiento:** para que los 120 celulares no envíen al mismo tiempo, cada uno espera un **turno aleatorio de 0 a 10 minutos**. El botón *Sincronizar ahora* envía de inmediato.
- **Pausas de GitHub:** si GitHub pide esperar por exceso de solicitudes, la aplicación respeta la pausa y **reintenta sola**. El indicador de la cabecera muestra «Espera».
- **Bloqueo:** una vez enviada, la jornada queda **🔒 bloqueada**: sus diagnósticos no se pueden editar ni eliminar.

**Capacidad:** cada jornada usa **5 escrituras** en GitHub (4 si no tiene fotos). Con 120 operarios son unas 600 escrituras al día. El escalonamiento y los reintentos las distribuyen dentro del límite de GitHub de 500 por hora.

### Qué queda en GitHub

```
SanidadData/
└── jornadas/
    └── 2026-11-09/
        ├── 20261109-0816-5aec06.geojson      ← jornada completa (un solo archivo)
        └── 20261109-0816-5aec06_fotos.zip    ← todas las fotos de la jornada
```

**Contenido del `.geojson`:**
- Encabezado `"jornada"`: evaluador, usuario, dispositivo, **fecha, hora_inicio, hora_fin, duracion_min**, km, **ha_recorridas, palmas_visitadas, densidad_palmas_ha, metodo (calle_entre_lineas o buffer), comparativo_buffer, n_paradas, minutos_paradas, minutos_movimiento**, número de diagnósticos y de fotos, nombre del ZIP de fotos y versión de la aplicación. Incluye también **`por_lote`**, con lote, palmas_visitadas, palmas_existentes, sitios_vacios, ha, diagnosticos e ids_palmas_visitadas.
- **Puntos** con `tipo = diagnostico`. Cada uno lleva `palma_id`, `lote`, `linea`, `palma`, `estado`, `problemas`, `p_PC`… (1/0), `grado_pc`, `severidad`, `sintomas`, `accion`, `observaciones`, `fotos` (nombres dentro del ZIP), `gps_precision_m`, `dist_gps_palma_m`, `creado` y `sincronizado`.
- **Línea** con `tipo = recorrido`: el track, con la hora y la precisión de cada vértice.
- **Puntos** con `tipo = parada`: n, hora_inicio, hora_fin, duracion_min, lote, clase (con diagnóstico / sin actividad / sin señal GPS) y diagnosticos.

**Uso en QGIS:** al abrir el `.geojson`, QGIS ofrece dos subcapas, una de puntos (diagnósticos) y otra de líneas (recorrido). Para consolidar varias jornadas, use *Vectorial → Herramientas de gestión de datos → Combinar capas vectoriales*.

## 7.1 Visor web (administración)
- **Dirección:** `https://jjbuila.github.io/Sanidad/visor.html` (también desde el menú de la app: **Visor web**, visible para administradores y supervisores).
- **Acceso:** mismo usuario y contraseña de la app. Solo ingresan usuarios con rol **Administrador** o **Supervisor**; los operarios reciben un aviso. El rol *Supervisor* se asigna en `admin.html` y en la app de campo funciona como operario.
- **Qué muestra:** todas las jornadas sincronizadas en el rango de fechas elegido (Hoy, 7 días, 30 días, Este mes o fechas libres, máximo un año):
  - **Mapa:** lotes, recorridos (un color por operario), diagnósticos por estado, paradas y, desde zoom 17, las palmas de la cartografía coloreadas con su último diagnóstico.
  - **Resumen:** jornadas, operarios, lotes, ha recorridas, palmas visitadas, km, diagnósticos, enfermas, fotos, tiempo en paradas, ha por operario-día, diagnósticos por estado, problemas más frecuentes y comparativo *por calle frente a buffer*.
  - **Jornadas:** tabla ordenable; al tocar una se ve su detalle por lote y se **reproduce el recorrido** (×30 a ×600).
  - **Secuencias:** una fila por operario, jornada, secuencia y lote, con inicio, fin, tiempo total, paradas, tiempo efectivo, palmas, ha y diagnósticos; totales del periodo y CSV. Las jornadas sincronizadas antes de esta versión se reconstruyen con el recorrido (sin palmas por secuencia).
  - **Lotes** y **Operarios:** totales del periodo (operarios con tiempo total, paradas y tiempo efectivo); al tocar una fila se filtra por ese lote u operario.
  - **Filtro de Programa** (IT, IS, RI, CU…), además de operario, lote y estado.
  - **Diagnósticos:** tabla con estado y problemas; al tocar uno se ubica en el mapa y se pueden **ver sus fotos** (se descargan del ZIP de la jornada solo cuando se piden).
  - **Exportar:** GeoJSON filtrado, CSV de jornadas, lotes, operarios y diagnósticos (separador `;`, abre directo en Excel).
- **Consumo de GitHub:** cada archivo se descarga una sola vez y queda en caché del navegador (los archivos sincronizados no cambian). Una consulta de 7 días con 120 operarios usa unas 850 solicitudes la primera vez y casi ninguna después; el límite es 5.000 por hora.
- **Seguridad:** el token sigue cifrado en `datos/acceso.json`; solo se descifra en el navegador con la contraseña. Con «Recordar en este equipo» la sesión queda cifrada con una llave que no sale del navegador; use **Salir** en equipos compartidos.

## 7.2 Ortofoto del dron
- **Origen:** `ORTHO.tif` (9,2 cm por píxel, 108.480 × 154.151 píxeles, 4 bandas, sin comprimir, **66,9 GB**, MAGNA-SIRGAS Colombia Oeste Oeste EPSG:3114).
- **Versión liviana (alta definición):**
  - Zoom 19: **27,6 cm por píxel** (bloques de 3 × 3 píxeles del original), WebP calidad 70: 9.878 teselas, 86 MB. Se ven las hojas de cada palma.
  - Zoom 18: generado desde 27,6 cm (más nítido), WebP calidad 78: 2.571 teselas, 38 MB.
  - Zoom 12 a 17: desde 55 cm, 11 MB.
  - Total: 135 MB en `teselas/orto/` con su índice `indice.json`. Los zoom 18 y 19 van agrupados en **paquetes** (`p18/`, `p19/`, 699 archivos cada uno, de 4 y 16 teselas) para que el sitio tenga unos 2.400 archivos: con 13.440 archivos sueltos GitHub Pages superaba su límite de 10 minutos de publicación.
- **App de campo:** la **ortofoto del dron es el único mapa base** (se retiró el satélite de Esri).
  - **Menú → Mapa sin conexión:** descarga la ortofoto de toda la plantación hasta zoom 18 (unos 49 MB, con WiFi).
  - **Al iniciar una jornada con internet** se descarga en segundo plano el zoom 19 solo de los lotes elegidos (alrededor de 1 MB por lote), para tener el máximo detalle sin conexión sin cargar el celular.
- **Visor web:** fondo **Ortofoto dron** (o Sin fondo).
- **Para QGIS/ArcGIS:** `ORTHO_liviana_55cm.tif` (Cloud Optimized GeoTIFF, WebP calidad 80, 74 MB, con pirámides) en el Escritorio del equipo del administrador.
- **Actualizar con un vuelo nuevo:** repetir el proceso con el nuevo archivo y reemplazar la carpeta `teselas/orto/`; cambie el nombre de la carpeta (por ejemplo `orto2027/`) para que los celulares no conserven teselas antiguas en caché.

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
- **Detección de WiFi** (solo si el administrador limita la sincronización a WiFi): funciona en Chrome para Android. En iPhone y en computadores, la aplicación sincroniza con cualquier conexión.
