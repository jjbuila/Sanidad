# Sanidad Vegetal · APK Android

Aplicación Android (Capacitor 8) que abre la app publicada en https://jjbuila.github.io/Sanidad/ y agrega:

- GPS en segundo plano con servicio nativo y notificación permanente durante la jornada (`@capacitor-community/background-geolocation`).
- Voz nativa de Android (`@capacitor-community/text-to-speech`).
- Permiso de notificaciones (`@capacitor/local-notifications`).
- Reconocimiento de voz sin conexión con **Vosk** (`VoskPlugin.java`, `com.alphacephei:vosk-android`) para el diagnóstico por voz. El modelo de español (`vosk-model-small-es-0.42`, ~40 MB) se descarga la primera vez que se activa.

Descarga (última versión): https://github.com/jjbuila/Sanidad/releases/latest/download/SanidadVegetal.apk

Compilación: `.github/workflows/apk.yml` (GitHub Actions) en cada cambio dentro de `apk/`, firmada con los secretos
`SANIDAD_KEYSTORE_B64` y `SANIDAD_KEYSTORE_PASS`. Los cambios de la app web llegan a la APK sin recompilar.
