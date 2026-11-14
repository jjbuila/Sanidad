package co.palmasdetumaco.sanidadvegetal;

import android.Manifest;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;
import org.vosk.LibVosk;
import org.vosk.LogLevel;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Reconocimiento de voz en español dentro de la APK con Vosk (sin depender del servicio de Google).
 * - prepararModelo({url}): descarga y descomprime el modelo (una sola vez, unos 40 MB) en la memoria de la app.
 * - iniciar({gramatica}): escucha el micrófono; con gramática (lista de frases) reconoce solo esas frases, mucho más preciso.
 * - pausar({on}), detener(), estado().
 * Eventos: "resultado" {texto}, "parcial" {texto}, "progresoModelo" {fase, pct}, "error" {mensaje}.
 */
@CapacitorPlugin(name = "Vosk", permissions = {
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "microfono")
})
public class VoskPlugin extends Plugin implements RecognitionListener {
    private static final float HZ = 16000f;
    private Model modelo;
    private SpeechService servicio;
    private final ExecutorService hilo = Executors.newSingleThreadExecutor();
    private volatile boolean descargando = false;

    @Override
    public void load() {
        try { LibVosk.setLogLevel(LogLevel.WARNINGS); } catch (Throwable ignored) { }
    }

    private File dirModelo() { return new File(getContext().getFilesDir(), "vosk-es"); }

    private boolean modeloListo() {
        File d = dirModelo();
        return new File(d, "am/final.mdl").exists() && new File(d, "conf/model.conf").exists();
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("modelo", modeloListo());
        r.put("descargando", descargando);
        r.put("escuchando", servicio != null);
        r.put("permiso", getPermissionState("microfono") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void prepararModelo(PluginCall call) {
        if (modeloListo()) { JSObject r = new JSObject(); r.put("modelo", true); call.resolve(r); return; }
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("Falta la dirección del modelo de voz."); return; }
        if (descargando) { call.reject("El modelo de voz ya se está descargando."); return; }
        descargando = true;
        hilo.execute(() -> {
            File zip = new File(getContext().getCacheDir(), "vosk-es.zip");
            File tmp = new File(getContext().getFilesDir(), "vosk-es-tmp");
            try {
                // 1) Descarga
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(20000); c.setReadTimeout(60000); c.setInstanceFollowRedirects(true);
                long total = c.getContentLengthLong(), leidos = 0; int ult = -1;
                try (InputStream in = new BufferedInputStream(c.getInputStream()); OutputStream out = new FileOutputStream(zip)) {
                    byte[] b = new byte[65536]; int n;
                    while ((n = in.read(b)) > 0) {
                        out.write(b, 0, n); leidos += n;
                        int pct = total > 0 ? (int) (leidos * 100 / total) : -1;
                        if (pct != ult) { ult = pct; progreso("descarga", pct); }
                    }
                } finally { c.disconnect(); }
                // 2) Descompresión (se quita la carpeta raíz del zip)
                borrar(tmp); tmp.mkdirs(); progreso("descomprimir", 0);
                try (ZipInputStream zin = new ZipInputStream(new BufferedInputStream(new java.io.FileInputStream(zip)))) {
                    ZipEntry e; byte[] b = new byte[65536];
                    while ((e = zin.getNextEntry()) != null) {
                        String nombre = e.getName(); int i = nombre.indexOf('/');
                        String rel = i >= 0 ? nombre.substring(i + 1) : nombre;
                        if (rel.isEmpty()) continue;
                        File f = new File(tmp, rel);
                        if (!f.getCanonicalPath().startsWith(tmp.getCanonicalPath() + File.separator)) continue; // zip seguro
                        if (e.isDirectory()) { f.mkdirs(); continue; }
                        f.getParentFile().mkdirs();
                        try (OutputStream out = new FileOutputStream(f)) { int n; while ((n = zin.read(b)) > 0) out.write(b, 0, n); }
                    }
                }
                borrar(dirModelo());
                if (!tmp.renameTo(dirModelo())) throw new Exception("No se pudo instalar el modelo de voz.");
                zip.delete();
                if (!modeloListo()) throw new Exception("El modelo de voz descargado está incompleto.");
                progreso("listo", 100);
                JSObject r = new JSObject(); r.put("modelo", true); call.resolve(r);
            } catch (Exception ex) {
                zip.delete(); borrar(tmp);
                call.reject("No se pudo descargar el modelo de voz: " + ex.getMessage());
            } finally { descargando = false; }
        });
    }

    @PluginMethod
    public void iniciar(PluginCall call) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) { requestPermissionForAlias("microfono", call, "permisoMic"); return; }
        arrancar(call);
    }

    @PermissionCallback
    private void permisoMic(PluginCall call) {
        if (getPermissionState("microfono") == PermissionState.GRANTED) arrancar(call);
        else call.reject("Sin permiso para usar el micrófono.");
    }

    private void arrancar(PluginCall call) {
        if (!modeloListo()) { call.reject("Falta descargar el modelo de voz."); return; }
        final JSArray gram = call.getArray("gramatica", null);
        hilo.execute(() -> {
            try {
                if (modelo == null) modelo = new Model(dirModelo().getAbsolutePath());
                pararServicio();
                Recognizer rec = new Recognizer(modelo, HZ);
                if (gram != null && gram.length() > 0) {
                    JSONArray g = new JSONArray();
                    for (int i = 0; i < gram.length(); i++) g.put(gram.getString(i));
                    g.put("[unk]");
                    rec.setGrammar(g.toString());
                }
                servicio = new SpeechService(rec, HZ);
                servicio.startListening(this);
                call.resolve();
            } catch (Exception ex) {
                call.reject("No se pudo iniciar el reconocimiento de voz: " + ex.getMessage());
            }
        });
    }

    @PluginMethod
    public void pausar(PluginCall call) {
        boolean on = call.getBoolean("on", true);
        try { if (servicio != null) servicio.setPause(on); } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void detener(PluginCall call) {
        hilo.execute(() -> { pararServicio(); call.resolve(); });
    }

    private void pararServicio() {
        if (servicio != null) {
            try { servicio.stop(); } catch (Exception ignored) { }
            try { servicio.shutdown(); } catch (Exception ignored) { }
            servicio = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        pararServicio();
        if (modelo != null) { try { modelo.close(); } catch (Exception ignored) { } modelo = null; }
        super.handleOnDestroy();
    }

    private void progreso(String fase, int pct) {
        JSObject r = new JSObject(); r.put("fase", fase); r.put("pct", pct); notifyListeners("progresoModelo", r);
    }

    private static String texto(String json, String clave) {
        try { return new JSONObject(json).optString(clave, ""); } catch (Exception e) { return ""; }
    }

    private void emitir(String evento, String t) {
        if (t == null) return; t = t.replace("[unk]", "").trim(); if (t.isEmpty()) return;
        JSObject r = new JSObject(); r.put("texto", t); notifyListeners(evento, r);
    }

    @Override public void onPartialResult(String hyp) { emitir("parcial", texto(hyp, "partial")); }
    @Override public void onResult(String hyp) { emitir("resultado", texto(hyp, "text")); }
    @Override public void onFinalResult(String hyp) { emitir("resultado", texto(hyp, "text")); }
    @Override public void onError(Exception e) { JSObject r = new JSObject(); r.put("mensaje", e.getMessage()); notifyListeners("error", r); }
    @Override public void onTimeout() { }

    private static void borrar(File f) {
        if (f == null || !f.exists()) return;
        File[] hijos = f.listFiles(); if (hijos != null) for (File h : hijos) borrar(h);
        f.delete();
    }
}
