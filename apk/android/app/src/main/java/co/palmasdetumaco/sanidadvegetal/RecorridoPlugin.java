package co.palmasdetumaco.sanidadvegetal;

import android.content.Context;
import android.content.SharedPreferences;
import android.location.LocationManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;

/**
 * Puente entre la App web y el registro nativo del recorrido (RecorridoService).
 * iniciar / detener / configurar / estado; puntos(desde) devuelve los puntos guardados en el celular después de un
 * momento dado (para recuperar lo que la página no recibió); eventos() devuelve los cortes y reinicios de la jornada.
 * Mientras la página está activa, cada punto llega también en vivo con el evento «punto».
 */
@CapacitorPlugin(name = "Recorrido")
public class RecorridoPlugin extends Plugin {
    private static volatile RecorridoPlugin instancia;
    private static final int MAX_PUNTOS = 3000;
    // Posición de lectura para no releer todo el archivo en cada consulta
    private String cacheJ = null;
    private long cacheT = -1, cacheOff = 0;

    @Override
    public void load() { instancia = this; }

    static void emitir(JSONObject o) {
        RecorridoPlugin p = instancia;
        if (p == null) return;
        try { p.notifyListeners("punto", JSObject.fromJSONObject(o)); } catch (Exception ignored) { }
    }

    @PluginMethod
    public void iniciar(PluginCall call) {
        String j = call.getString("jornada");
        if (j == null) { call.reject("Falta la jornada"); return; }
        Context c = getContext();
        SharedPreferences p = RecorridoService.prefs(c);
        boolean misma = p.getBoolean("activo", false) && j.equals(p.getString("jornada", null));
        SharedPreferences.Editor e = p.edit().putBoolean("activo", true).putString("jornada", j)
            .putString("titulo", call.getString("titulo", "Sanidad Vegetal · Jornada en curso"))
            .putString("mensaje", call.getString("mensaje", "Registrando el recorrido. Toque para volver a la aplicación."))
            .putBoolean("pulso", call.getBoolean("pulso", false));
        if (!misma) { e.putLong("inicio", System.currentTimeMillis()).putLong("ultimoFix", 0); RecorridoService.ultimoFix = 0; limpiarViejos(c); }
        e.commit();
        if (!misma) RecorridoService.evento(c, j, "inicio", null);
        try {
            VigiaReceiver.arrancarServicio(c, null);
            VigiaReceiver.programar(c);
            call.resolve(estadoObj());
        } catch (Exception ex) {
            call.reject("No se pudo iniciar el registro del recorrido: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void detener(PluginCall call) {
        Context c = getContext();
        SharedPreferences p = RecorridoService.prefs(c);
        String j = p.getString("jornada", null);
        if (p.getBoolean("activo", false)) RecorridoService.evento(c, j, "fin", null);
        p.edit().putBoolean("activo", false).commit();
        VigiaReceiver.cancelar(c);
        try { c.stopService(new android.content.Intent(c, RecorridoService.class)); } catch (Exception ignored) { }
        RecorridoService.quitarAlerta(c);
        call.resolve();
    }

    @PluginMethod
    public void configurar(PluginCall call) {
        SharedPreferences.Editor e = RecorridoService.prefs(getContext()).edit();
        if (call.hasOption("pulso")) e.putBoolean("pulso", call.getBoolean("pulso", false));
        e.apply();
        call.resolve();
    }

    private JSObject estadoObj() {
        Context c = getContext();
        SharedPreferences p = RecorridoService.prefs(c);
        JSObject r = new JSObject();
        r.put("activo", p.getBoolean("activo", false));
        r.put("jornada", p.getString("jornada", null));
        r.put("servicio", RecorridoService.vivo != null);
        r.put("ultimoGps", Math.max(RecorridoService.ultimoFix, p.getLong("ultimoFix", 0)));
        r.put("alarmasExactas", VigiaReceiver.alarmasExactas(c));
        r.put("ubicacionFondo", RecorridoService.permisoFondo(c));
        r.put("ubicacion", RecorridoService.permisoUbicacion(c));
        r.put("pulso", p.getBoolean("pulso", false));
        boolean gps = true;
        try { gps = ((LocationManager) c.getSystemService(Context.LOCATION_SERVICE)).isProviderEnabled(LocationManager.GPS_PROVIDER); } catch (Exception ignored) { }
        r.put("gpsActivo", gps);
        r.put("android", Build.VERSION.SDK_INT);
        r.put("fabricante", Build.MANUFACTURER);
        r.put("modelo", Build.MODEL);
        return r;
    }

    @PluginMethod
    public void estado(PluginCall call) { call.resolve(estadoObj()); }

    @PluginMethod
    public void puntos(PluginCall call) {
        String j = call.getString("jornada");
        double desdeD = call.getDouble("desde", 0d);
        long desde = (long) desdeD;
        File f = RecorridoService.archivoPuntos(getContext(), j);
        JSArray arr = new JSArray();
        boolean mas = false;
        if (f.exists()) {
            long inicio = 0;
            synchronized (this) {
                if (j != null && j.equals(cacheJ) && desde >= cacheT && cacheOff <= f.length()) inicio = cacheOff;
            }
            try (RandomAccessFile raf = new RandomAccessFile(f, "r")) {
                long fin = raf.length();
                byte[] buf = new byte[(int) Math.max(0, fin - inicio)];
                raf.seek(inicio);
                raf.readFully(buf);
                long ultimoT = -1, ultimoOff = inicio;
                int n = 0, a = 0;
                for (int i = 0; i < buf.length; i++) {
                    if (buf[i] != '\n') continue;   // una línea sin '\n' final está a medio escribir: se lee después
                    String linea = new String(buf, a, i - a, StandardCharsets.UTF_8);
                    a = i + 1;
                    if (linea.isEmpty()) continue;
                    JSONObject o;
                    try { o = new JSONObject(linea); } catch (Exception ex) { continue; }
                    long t = o.optLong("t", 0);
                    if (n < MAX_PUNTOS) { ultimoT = Math.max(ultimoT, t); ultimoOff = inicio + a; }
                    if (t <= desde) continue;
                    if (n >= MAX_PUNTOS) { mas = true; break; }
                    arr.put(o);
                    n++;
                }
                synchronized (this) { if (ultimoT >= 0) { cacheJ = j; cacheT = ultimoT; cacheOff = ultimoOff; } }
            } catch (Exception ex) {
                call.reject("No se pudieron leer los puntos: " + ex.getMessage());
                return;
            }
        }
        JSObject r = new JSObject();
        r.put("puntos", arr);
        r.put("mas", mas);
        call.resolve(r);
    }

    @PluginMethod
    public void eventos(PluginCall call) {
        File f = RecorridoService.archivoEventos(getContext(), call.getString("jornada"));
        JSArray arr = new JSArray();
        if (f.exists()) {
            try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f), StandardCharsets.UTF_8))) {
                String l;
                while ((l = r.readLine()) != null) {
                    try { arr.put(new JSONObject(l)); } catch (Exception ignored) { }
                }
            } catch (Exception ignored) { }
        }
        JSObject o = new JSObject();
        o.put("eventos", arr);
        call.resolve(o);
    }

    /** Borra los archivos de recorridos de más de 20 días (la App ya los tiene en su base y en el repositorio). */
    private static void limpiarViejos(Context c) {
        File[] fs = RecorridoService.carpeta(c).listFiles();
        if (fs == null) return;
        long lim = System.currentTimeMillis() - 20L * 24 * 3600 * 1000;
        for (File f : fs) if (f.lastModified() < lim) f.delete();
    }
}
