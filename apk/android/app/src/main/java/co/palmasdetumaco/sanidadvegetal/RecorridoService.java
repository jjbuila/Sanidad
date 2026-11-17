package co.palmasdetumaco.sanidadvegetal;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Registro del recorrido de la jornada, independiente de la página web:
 * - servicio en primer plano de ubicación (notificación «Jornada en curso») con bloqueo parcial de CPU;
 * - cada punto del GPS se guarda en un archivo del celular (recorrido/<jornada>.jsonl) y la App lo recupera
 *   aunque Android haya dormido o cerrado la página;
 * - la vigilancia (VigiaReceiver, cada 60 s) avisa con vibración, voz y notificación si pasa más de 1 minuto sin GPS
 *   y vuelve a arrancar el servicio si Android lo cerró;
 * - eventos de la jornada (inicio, sin GPS, reinicios) en recorrido/<jornada>_eventos.jsonl.
 */
public class RecorridoService extends Service implements LocationListener {
    static final String PREFS = "recorrido";
    static final String CANAL = "recorrido";
    static final String CANAL_ALERTA = "recorrido_alerta";
    static final int ID_NOTIF = 4101, ID_ALERTA = 4102;
    static final long SIN_GPS_MS = 60_000L;

    static volatile RecorridoService vivo;
    static volatile long ultimoFix = 0, ultimoLatido = 0;

    private PowerManager.WakeLock bloqueo;
    private Writer escritor;
    private String jornada;
    private TextToSpeech voz;
    private boolean vozLista = false;
    private boolean enAlerta = false;
    private long ultimaGuardaPrefs = 0;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static File carpeta(Context c) { File d = new File(c.getFilesDir(), "recorrido"); if (!d.exists()) d.mkdirs(); return d; }

    static File archivoPuntos(Context c, String j) { return new File(carpeta(c), limpio(j) + ".jsonl"); }

    static File archivoEventos(Context c, String j) { return new File(carpeta(c), limpio(j) + "_eventos.jsonl"); }

    static String limpio(String j) { return j == null ? "sin" : j.replaceAll("[^A-Za-z0-9_-]", "_"); }

    /** Agrega un evento de la jornada (se usa también desde la vigilancia y el plugin). */
    static synchronized void evento(Context c, String j, String e, JSONObject extra) {
        if (j == null) return;
        try {
            JSONObject o = extra != null ? extra : new JSONObject();
            o.put("t", System.currentTimeMillis());
            o.put("e", e);
            try (Writer w = new OutputStreamWriter(new FileOutputStream(archivoEventos(c, j), true), StandardCharsets.UTF_8)) {
                w.write(o.toString());
                w.write('\n');
            }
        } catch (Exception ignored) { }
    }

    static void canales(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Jornada en curso", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Registro del recorrido durante la jornada");
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CANAL_ALERTA) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL_ALERTA, "Recorrido sin GPS", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Aviso cuando el recorrido deja de grabarse");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 700, 300, 700, 300, 700});
            nm.createNotificationChannel(ch);
        }
    }

    static PendingIntent abrirApp(Context c) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i == null) i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Aviso fuerte: vibración y notificación de alta prioridad (con la voz si el servicio está vivo). */
    static void alertar(Context c, String texto) {
        canales(c);
        try {
            Vibrator v = (Vibrator) c.getSystemService(VIBRATOR_SERVICE);
            long[] patron = {0, 700, 300, 700, 300, 700};
            if (v != null) {
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(patron, -1));
                else v.vibrate(patron, -1);
            }
        } catch (Exception ignored) { }
        try {
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL_ALERTA) : new Notification.Builder(c);
            b.setSmallIcon(icono(c)).setContentTitle("⚠ El recorrido no se está grabando").setContentText(texto)
                .setStyle(new Notification.BigTextStyle().bigText(texto)).setContentIntent(abrirApp(c)).setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM);
            if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_MAX).setVibrate(new long[]{0, 700, 300, 700});
            ((NotificationManager) c.getSystemService(NOTIFICATION_SERVICE)).notify(ID_ALERTA, b.build());
        } catch (Exception ignored) { }
        RecorridoService s = vivo;
        if (s != null) s.hablar(texto);
    }

    static void quitarAlerta(Context c) {
        try { ((NotificationManager) c.getSystemService(NOTIFICATION_SERVICE)).cancel(ID_ALERTA); } catch (Exception ignored) { }
    }

    static int icono(Context c) {
        int id = c.getResources().getIdentifier("ic_tracking", "drawable", c.getPackageName());
        return id != 0 ? id : android.R.drawable.ic_menu_mylocation;
    }

    static boolean permisoUbicacion(Context c) {
        return c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean permisoFondo(Context c) {
        if (Build.VERSION.SDK_INT < 29) return permisoUbicacion(c);
        return c.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        canales(this);
        try {
            voz = new TextToSpeech(this, st -> {
                if (st == TextToSpeech.SUCCESS) {
                    int r = voz.setLanguage(new Locale("es", "CO"));
                    if (r < 0) voz.setLanguage(new Locale("es"));
                    vozLista = true;
                }
            });
        } catch (Exception ignored) { }
    }

    private Notification notificacion() {
        SharedPreferences p = prefs(this);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        return b.setSmallIcon(icono(this))
            .setContentTitle(p.getString("titulo", "Sanidad Vegetal · Jornada en curso"))
            .setContentText(p.getString("mensaje", "Registrando el recorrido. Toque para volver a la aplicación."))
            .setContentIntent(abrirApp(this)).setOngoing(true).build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences p = prefs(this);
        // Siempre se llama startForeground de inmediato (Android lo exige al arrancar con startForegroundService).
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID_NOTIF, notificacion(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(ID_NOTIF, notificacion());
        } catch (Exception e) {
            String j = p.getString("jornada", null);
            evento(this, j, "sin_permiso", null);
            alertar(this, "Android no dejó reanudar el GPS. Toque aquí para volver a la aplicación y seguir grabando.");
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!p.getBoolean("activo", false)) { detenerTodo(); stopSelf(); return START_NOT_STICKY; }
        String j = p.getString("jornada", null);
        if (vivo == this && j != null && j.equals(jornada)) { VigiaReceiver.programar(this); return START_STICKY; }
        jornada = j;
        vivo = this;
        ultimoLatido = System.currentTimeMillis();
        if (ultimoFix == 0) ultimoFix = p.getLong("ultimoFix", 0);
        try {
            if (bloqueo == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                bloqueo = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SanidadVegetal:recorrido");
                bloqueo.setReferenceCounted(false);
            }
            if (!bloqueo.isHeld()) bloqueo.acquire(14L * 60L * 60L * 1000L);
        } catch (Exception ignored) { }
        abrirArchivo();
        pedirGps();
        String motivo = intent != null ? intent.getStringExtra("motivo") : null;
        if (motivo != null) {
            try {
                JSONObject o = new JSONObject();
                o.put("ultimo_gps", p.getLong("ultimoFix", 0));
                evento(this, jornada, motivo, o);
            } catch (Exception ignored) { }
        }
        VigiaReceiver.programar(this);
        return START_STICKY;
    }

    private void abrirArchivo() {
        try {
            if (escritor != null) escritor.close();
        } catch (Exception ignored) { }
        try {
            escritor = new OutputStreamWriter(new FileOutputStream(archivoPuntos(this, jornada), true), StandardCharsets.UTF_8);
        } catch (Exception e) { escritor = null; }
    }

    @SuppressLint("MissingPermission")
    private void pedirGps() {
        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        try { lm.removeUpdates(this); } catch (Exception ignored) { }
        if (!permisoUbicacion(this)) { evento(this, jornada, "sin_permiso", null); return; }
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper());
        } catch (Exception e) {
            evento(this, jornada, "gps_error", null);
        }
    }

    @Override
    public void onLocationChanged(Location l) {
        long ahora = System.currentTimeMillis();
        long t = l.getTime() > 0 && Math.abs(ahora - l.getTime()) < 120_000L ? l.getTime() : ahora;
        ultimoFix = ahora;
        ultimoLatido = ahora;
        if (enAlerta) {
            enAlerta = false;
            quitarAlerta(this);
            evento(this, jornada, "gps_ok", null);
        }
        try {
            JSONObject o = new JSONObject();
            o.put("t", t);
            o.put("lat", l.getLatitude());
            o.put("lng", l.getLongitude());
            o.put("acc", l.hasAccuracy() ? Math.round(l.getAccuracy() * 10) / 10.0 : 99);
            if (escritor != null) {
                escritor.write(o.toString());
                escritor.write('\n');
                escritor.flush();
            }
            RecorridoPlugin.emitir(o);
        } catch (Exception ignored) { }
        if (ahora - ultimaGuardaPrefs > 5000) {
            ultimaGuardaPrefs = ahora;
            prefs(this).edit().putLong("ultimoFix", ahora).apply();
        }
    }

    /** La vigilancia lo llama cada minuto mientras el servicio está vivo. */
    void revisar() {
        long ahora = System.currentTimeMillis();
        ultimoLatido = ahora;
        long sin = ahora - Math.max(ultimoFix, prefs(this).getLong("inicio", 0));
        if (sin > SIN_GPS_MS) {
            LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
            boolean gpsOn = true;
            try { gpsOn = lm.isProviderEnabled(LocationManager.GPS_PROVIDER); } catch (Exception ignored) { }
            if (!enAlerta) {
                enAlerta = true;
                try {
                    JSONObject o = new JSONObject();
                    o.put("ultimo_gps", ultimoFix);
                    evento(this, jornada, gpsOn ? "sin_gps" : "gps_apagado", o);
                } catch (Exception ignored) { }
            }
            alertar(this, gpsOn
                ? "Atención: el recorrido no se está grabando. Desbloquee el celular y revise el GPS."
                : "Atención: la ubicación del celular está apagada. Actívela para seguir grabando el recorrido.");
            pedirGps(); // vuelve a pedir el GPS por si el sistema lo soltó
        } else if (prefs(this).getBoolean("pulso", false)) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(90, VibrationEffect.DEFAULT_AMPLITUDE));
                    else v.vibrate(90);
                }
            } catch (Exception ignored) { }
        }
    }

    void hablar(String t) {
        try { if (voz != null && vozLista) voz.speak(t, TextToSpeech.QUEUE_FLUSH, null, "sv_alerta"); } catch (Exception ignored) { }
    }

    private void detenerTodo() {
        try { ((LocationManager) getSystemService(LOCATION_SERVICE)).removeUpdates(this); } catch (Exception ignored) { }
        try { if (escritor != null) escritor.close(); } catch (Exception ignored) { }
        escritor = null;
        try { if (bloqueo != null && bloqueo.isHeld()) bloqueo.release(); } catch (Exception ignored) { }
        quitarAlerta(this);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Si el operario desliza la App en recientes, el servicio sigue y la vigilancia queda programada.
        VigiaReceiver.programar(this);
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        detenerTodo();
        if (vivo == this) vivo = null;
        if (prefs(this).getBoolean("activo", false)) {
            evento(this, jornada, "servicio_detenido", null);
            VigiaReceiver.programar(this);
        }
        try { if (voz != null) voz.shutdown(); } catch (Exception ignored) { }
        super.onDestroy();
    }

    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }

    @Override public IBinder onBind(Intent intent) { return null; }
}
