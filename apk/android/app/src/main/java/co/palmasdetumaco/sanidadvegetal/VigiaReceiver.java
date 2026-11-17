package co.palmasdetumaco.sanidadvegetal;

import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/**
 * Vigilancia del recorrido: una alarma exacta cada 60 s mientras hay jornada (también con el celular en reposo).
 * - Si el servicio está vivo, revisa que lleguen puntos del GPS (aviso a partir de 1 minuto sin GPS).
 * - Si Android cerró el servicio, lo vuelve a arrancar; si no puede, avisa al operario con vibración y notificación.
 * Así un corte se detecta en 1 a 2 minutos.
 */
public class VigiaReceiver extends BroadcastReceiver {
    static final long INTERVALO = 60_000L;

    static PendingIntent intento(Context c) {
        Intent i = new Intent(c, VigiaReceiver.class);
        i.setAction("co.palmasdetumaco.sanidadvegetal.VIGIA");
        return PendingIntent.getBroadcast(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean alarmasExactas(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    @SuppressLint({"ScheduleExactAlarm", "MissingPermission"})
    static void programar(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long cuando = System.currentTimeMillis() + INTERVALO;
        PendingIntent pi = intento(c);
        try {
            if (alarmasExactas(c)) {
                // setAlarmClock no se retrasa en reposo (Doze), a diferencia de las demás alarmas.
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(cuando, RecorridoService.abrirApp(c)), pi);
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, cuando, pi);
            }
        } catch (Exception e) {
            try { am.set(AlarmManager.RTC_WAKEUP, cuando, pi); } catch (Exception ignored) { }
        }
    }

    static void cancelar(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) try { am.cancel(intento(c)); } catch (Exception ignored) { }
    }

    static void arrancarServicio(Context c, String motivo) {
        Intent s = new Intent(c, RecorridoService.class);
        if (motivo != null) s.putExtra("motivo", motivo);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
        else c.startService(s);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        SharedPreferences p = RecorridoService.prefs(c);
        if (!p.getBoolean("activo", false)) return;
        programar(c);
        RecorridoService s = RecorridoService.vivo;
        if (s != null) { s.revisar(); return; }
        // El proceso o el servicio fueron cerrados por Android: se vuelve a arrancar el registro.
        if (RecorridoService.permisoFondo(c)) {
            try {
                arrancarServicio(c, "reinicio");
                return;
            } catch (Exception ignored) { }
        }
        RecorridoService.evento(c, p.getString("jornada", null), "detenido_sin_reinicio", null);
        RecorridoService.alertar(c, "Android detuvo el registro del recorrido. Toque aquí para volver a la aplicación y seguir grabando.");
    }
}
