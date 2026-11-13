package co.palmasdetumaco.sanidadvegetal;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EnergiaPlugin.class); // batería y bloqueo de pantalla (registro del recorrido en segundo plano)
        super.onCreate(savedInstanceState);
    }
}
