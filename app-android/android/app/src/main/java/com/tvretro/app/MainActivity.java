package com.tvretro.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios se registran ANTES de super.onCreate.
        registerPlugin(PortapapelesImagenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
