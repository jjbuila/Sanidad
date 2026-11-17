package co.palmasdetumaco.sanidadvegetal;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EnergiaPlugin.class); // batería y bloqueo de pantalla (registro del recorrido en segundo plano)
        registerPlugin(VoskPlugin.class);
        registerPlugin(RecorridoPlugin.class); // GPS nativo del recorrido: puntos guardados en el celular y vigilancia cada minuto    // reconocimiento de voz sin conexión (diagnóstico por voz)
        super.onCreate(savedInstanceState);
    }
}
