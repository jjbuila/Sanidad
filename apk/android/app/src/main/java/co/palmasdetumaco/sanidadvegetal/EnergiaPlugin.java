package co.palmasdetumaco.sanidadvegetal;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Mantiene activo el registro del recorrido con la pantalla bloqueada:
 * - bloqueo parcial de CPU (PARTIAL_WAKE_LOCK) mientras hay jornada en curso;
 * - consulta y solicitud de "sin restricciones" de batería (exención de optimización);
 * - accesos directos a Inicio automático / Ahorro de batería de MIUI (Xiaomi) y a los ajustes de la aplicación.
 */
@CapacitorPlugin(name = "Energia")
public class EnergiaPlugin extends Plugin {
    private PowerManager.WakeLock bloqueo;

    private PowerManager pm() { return (PowerManager) getContext().getSystemService(Context.POWER_SERVICE); }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        boolean sin = Build.VERSION.SDK_INT < 23 || pm().isIgnoringBatteryOptimizations(getContext().getPackageName());
        r.put("sinRestriccion", sin);
        r.put("fabricante", Build.MANUFACTURER);
        r.put("modelo", Build.MODEL);
        r.put("android", Build.VERSION.SDK_INT);
        r.put("activo", bloqueo != null && bloqueo.isHeld());
        call.resolve(r);
    }

    @PluginMethod
    public void mantenerActivo(PluginCall call) {
        boolean on = call.getBoolean("on", true);
        try {
            if (on) {
                if (bloqueo == null) {
                    bloqueo = pm().newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SanidadVegetal:jornada");
                    bloqueo.setReferenceCounted(false);
                }
                if (!bloqueo.isHeld()) bloqueo.acquire(14L * 60L * 60L * 1000L); // máximo 14 h por jornada
            } else if (bloqueo != null && bloqueo.isHeld()) {
                bloqueo.release();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private boolean abrir(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void solicitarSinRestriccion(PluginCall call) {
        String pkg = getContext().getPackageName();
        boolean ok = false;
        if (Build.VERSION.SDK_INT >= 23) {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + pkg));
            ok = abrir(i);
            if (!ok) ok = abrir(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
        JSObject r = new JSObject(); r.put("abierto", ok); call.resolve(r);
    }

    @PluginMethod
    public void abrirInicioAutomatico(PluginCall call) {
        String pkg = getContext().getPackageName();
        boolean ok = false;
        String[][] destinos = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"}
        };
        for (String[] d : destinos) {
            Intent i = new Intent();
            i.setComponent(new ComponentName(d[0], d[1]));
            if (abrir(i)) { ok = true; break; }
        }
        if (!ok) ok = abrir(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
        JSObject r = new JSObject(); r.put("abierto", ok); call.resolve(r);
    }

    @PluginMethod
    public void abrirAhorroBateria(PluginCall call) {
        String pkg = getContext().getPackageName();
        Intent i = new Intent();
        i.setComponent(new ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity"));
        i.putExtra("package_name", pkg);
        i.putExtra("package_label", "Sanidad Vegetal");
        boolean ok = abrir(i);
        if (!ok) ok = abrir(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
        JSObject r = new JSObject(); r.put("abierto", ok); call.resolve(r);
    }

    @PluginMethod
    public void abrirAjustesApp(PluginCall call) {
        boolean ok = abrir(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        JSObject r = new JSObject(); r.put("abierto", ok); call.resolve(r);
    }

    @Override
    protected void handleOnDestroy() {
        try { if (bloqueo != null && bloqueo.isHeld()) bloqueo.release(); } catch (Exception ignored) {}
    }
}
