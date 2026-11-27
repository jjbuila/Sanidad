package co.palmasdetumaco.sanidadvegetal;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.KeyEvent;
import android.view.WindowManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Modo jornada de la APK:
 * - la App se muestra encima de la pantalla de bloqueo y la pantalla no se apaga sola;
 * - si el operario presiona el botón de encendido, la pantalla se vuelve a encender de inmediato con la App
 *   (la App entra en modo ahorro: pantalla negra y brillo mínimo);
 * - la App queda fijada (fijación de pantalla de Android) hasta finalizar la jornada;
 * - modo ahorro: brillo mínimo; subir volumen durante 2 segundos lo desbloquea;
 * - bajar volumen sostenido 10 segundos finaliza la jornada (aunque la pantalla esté bloqueada): vibra al empezar,
 *   a los 5 s y al finalizar.
 */
@CapacitorPlugin(name = "Jornada")
public class JornadaPlugin extends Plugin {
    private static volatile JornadaPlugin instancia;
    static volatile boolean activa = false, ahorro = false;
    private static long ultimoPin = 0; // la fijación se pide como máximo una vez cada 10 minutos (nunca en ciclo)
    private BroadcastReceiver receptor;
    private final Handler h = new Handler(Looper.getMainLooper());
    private Runnable volumen2s, bajar5s, bajar10s;

    @Override
    public void load() { instancia = this; }

    private void enUi(Runnable r) { Activity a = getActivity(); if (a != null) a.runOnUiThread(r); }

    private void mostrarSobreBloqueo(boolean on) {
        Activity a = getActivity();
        if (a == null) return;
        if (Build.VERSION.SDK_INT >= 27) {
            a.setShowWhenLocked(on);
            a.setTurnScreenOn(on);
        } else {
            int f = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
            if (on) a.getWindow().addFlags(f); else a.getWindow().clearFlags(f);
        }
        if (on) a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private boolean fijada() {
        try {
            ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (Build.VERSION.SDK_INT >= 23) return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
            return am.isInLockTaskMode();
        } catch (Exception e) { return false; }
    }

    @PluginMethod
    public void iniciar(PluginCall call) {
        boolean fijar = call.getBoolean("fijar", true);
        activa = true;
        enUi(() -> {
            mostrarSobreBloqueo(true);
            long ahora = System.currentTimeMillis();
            if (fijar && !fijada() && ahora - ultimoPin > 10L * 60_000L) {
                ultimoPin = ahora;
                try { getActivity().startLockTask(); } catch (Exception ignored) { }
            }
        });
        if (receptor == null) {
            receptor = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent i) {
                    if (!activa || !Intent.ACTION_SCREEN_OFF.equals(i.getAction())) return;
                    despertar();
                    notifyListeners("pantallaApagada", new JSObject());
                }
            };
            ContextCompat.registerReceiver(getContext(), receptor, new IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED);
        }
        h.postDelayed(() -> call.resolve(estadoObj()), 600);
    }

    /** Vuelve a encender la pantalla con la App (encima de la pantalla de bloqueo). */
    @SuppressWarnings("deprecation")
    private void despertar() {
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, "SanidadVegetal:despertar");
            wl.acquire(3000);
        } catch (Exception ignored) { }
        enUi(() -> { mostrarSobreBloqueo(true); quitarBloqueo(); });
    }

    /** Si el celular no tiene PIN ni patrón, quita también la pantalla de bloqueo (con PIN la App queda encima de ella). */
    private void quitarBloqueo() {
        try {
            Activity a = getActivity();
            KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
            if (a == null || km == null || !km.isKeyguardLocked() || km.isKeyguardSecure()) return;
            if (Build.VERSION.SDK_INT >= 26) km.requestDismissKeyguard(a, null);
            else a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        } catch (Exception ignored) { }
    }

    @PluginMethod
    public void terminar(PluginCall call) {
        activa = false;
        cancelarBajar();
        ahorro = false;
        if (receptor != null) { try { getContext().unregisterReceiver(receptor); } catch (Exception ignored) { } receptor = null; }
        enUi(() -> {
            mostrarSobreBloqueo(false);
            ponerBrillo(-1f);
            if (fijada()) { try { getActivity().stopLockTask(); } catch (Exception ignored) { } }
        });
        call.resolve();
    }

    private void ponerBrillo(float b) {
        Activity a = getActivity();
        if (a == null) return;
        WindowManager.LayoutParams lp = a.getWindow().getAttributes();
        lp.screenBrightness = b < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : b;
        a.getWindow().setAttributes(lp);
    }

    @PluginMethod
    public void ahorro(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        ahorro = on;
        enUi(() -> ponerBrillo(on ? 0.06f : -1f)); // bajo pero visible (en algunos Xiaomi 0,01 deja la pantalla totalmente negra)
        call.resolve();
    }

    private JSObject estadoObj() {
        JSObject r = new JSObject();
        r.put("activa", activa);
        r.put("fijada", fijada());
        r.put("ahorro", ahorro);
        return r;
    }

    @PluginMethod
    public void estado(PluginCall call) { call.resolve(estadoObj()); }

    @SuppressWarnings("deprecation")
    private void vibrar(long ms) {
        try {
            Vibrator v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(ms);
        } catch (Exception ignored) { }
    }

    /** Bajar volumen sostenido 10 s con la jornada activa: finaliza la jornada (la App muestra el cierre paso a paso). */
    private boolean bajarVolumen(KeyEvent e) {
        if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) {
            cancelarBajar();
            despertar();
            vibrar(120);
            bajar5s = () -> { bajar5s = null; vibrar(250); };
            bajar10s = () -> { bajar10s = null; vibrar(700); despertar(); notifyListeners("finalizar", new JSObject()); };
            h.postDelayed(bajar5s, 5000);
            h.postDelayed(bajar10s, 10000);
        } else if (e.getAction() == KeyEvent.ACTION_UP) {
            cancelarBajar();
        }
        return true; // durante la jornada bajar volumen no cambia el volumen
    }

    private void cancelarBajar() {
        if (bajar5s != null) { h.removeCallbacks(bajar5s); bajar5s = null; }
        if (bajar10s != null) { h.removeCallbacks(bajar10s); bajar10s = null; }
    }

    /** Lo llama MainActivity con las teclas de volumen: en modo ahorro, subir volumen 2 s desbloquea;
     *  con la jornada activa, bajar volumen 10 s la finaliza. */
    static boolean tecla(KeyEvent e) {
        JornadaPlugin p = instancia;
        if (p != null && activa && e.getKeyCode() == KeyEvent.KEYCODE_VOLUME_DOWN) return p.bajarVolumen(e);
        if (p == null || !activa || !ahorro || e.getKeyCode() != KeyEvent.KEYCODE_VOLUME_UP) return false;
        if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) {
            if (p.volumen2s != null) p.h.removeCallbacks(p.volumen2s);
            p.volumen2s = () -> { p.volumen2s = null; p.notifyListeners("desbloquear", new JSObject()); };
            p.h.postDelayed(p.volumen2s, 2000);
        } else if (e.getAction() == KeyEvent.ACTION_UP && p.volumen2s != null) {
            p.h.removeCallbacks(p.volumen2s);
            p.volumen2s = null;
        }
        return true; // en modo ahorro el volumen no cambia
    }
}
