package co.palmasdetumaco.sanidadvegetal;

import android.os.Bundle;
import android.view.KeyEvent;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EnergiaPlugin.class); // batería y bloqueo de pantalla (registro del recorrido en segundo plano)
        registerPlugin(VoskPlugin.class);    // reconocimiento de voz sin conexión (diagnóstico por voz)
        registerPlugin(RecorridoPlugin.class); // GPS nativo del recorrido: puntos guardados en el celular y vigilancia cada minuto
        registerPlugin(JornadaPlugin.class);   // modo jornada: encima del bloqueo, App fijada, modo ahorro y volumen 2 s
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (JornadaPlugin.tecla(event)) return true;
        return super.dispatchKeyEvent(event);
    }
}
