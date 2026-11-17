# Sanidad Vegetal · APK Android

Aplicación Android (Capacitor 8) que abre la app publicada en https://jjbuila.github.io/Sanidad/ y agrega:

- **Registro protegido del recorrido** (`RecorridoService.java`, `RecorridoPlugin.java` «Recorrido», `VigiaReceiver.java`): servicio de ubicación en primer plano que guarda cada punto en `files/recorrido/<jornada>.jsonl`; la App web los recupera con `puntos({jornada,desde})` aunque Android haya dormido la página. Una alarma exacta (`setAlarmClock`, cada 60 s) avisa con vibración, voz y notificación si pasa más de 1 minuto sin GPS y reanuda el servicio si Android lo cerró. Eventos (inicio, sin GPS, reinicios) en `<jornada>_eventos.jsonl`.
- GPS en segundo plano de respaldo para la App con APK antiguas (`@capacitor-community/background-geolocation`).
- Voz nativa de Android (`@capacitor-community/text-to-speech`).
- Permiso de notificaciones (`@capacitor/local-notifications`).
- Reconocimiento de voz sin conexión con **Vosk** (`VoskPlugin.java`, `com.alphacephei:vosk-android`) para el diagnóstico por voz. El modelo de español (`vosk-model-small-es-0.42`, ~40 MB) se descarga la primera vez que se activa.

Descarga (última versión): https://github.com/jjbuila/Sanidad/releases/latest/download/SanidadVegetal.apk

La versión (`1.0.N`) se agrega al agente de usuario (`SanidadVegetalAPK/1 v1.0.N`) al compilar; la app la muestra en Menú → App Android y avisa cuando hay una más nueva en Releases.

Compilación: `.github/workflows/apk.yml` (GitHub Actions) en cada cambio dentro de `apk/`, firmada con los secretos
`SANIDAD_KEYSTORE_B64` y `SANIDAD_KEYSTORE_PASS`. Los cambios de la app web llegan a la APK sin recompilar.
