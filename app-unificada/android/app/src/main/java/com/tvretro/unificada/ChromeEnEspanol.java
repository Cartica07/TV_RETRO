package com.tvretro.unificada;

import android.app.AlertDialog;
import android.webkit.JsResult;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * Los cuadros alert() y confirm() de la página (por ejemplo "¿Restablecer la TV?") con los botones en español.
 * Capacitor los trae fijos en inglés ("OK" y "Cancel"). Todo lo demás (permisos, selector de archivos, consola…)
 * lo sigue haciendo BridgeWebChromeClient.
 */
public class ChromeEnEspanol extends BridgeWebChromeClient {
    private final Bridge puente;

    public ChromeEnEspanol(Bridge bridge) {
        super(bridge);
        this.puente = bridge;
    }

    @Override
    public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
        if (puente.getActivity().isFinishing()) {
            return true;
        }

        new AlertDialog.Builder(view.getContext())
            .setMessage(message)
            .setPositiveButton("Aceptar", (dialog, boton) -> {
                dialog.dismiss();
                result.confirm();
            })
            .setOnCancelListener((dialog) -> {
                dialog.dismiss();
                result.cancel();
            })
            .create()
            .show();

        return true;
    }

    @Override
    public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
        if (puente.getActivity().isFinishing()) {
            return true;
        }

        new AlertDialog.Builder(view.getContext())
            .setMessage(message)
            .setPositiveButton("Aceptar", (dialog, boton) -> {
                dialog.dismiss();
                result.confirm();
            })
            .setNegativeButton("Cancelar", (dialog, boton) -> {
                dialog.dismiss();
                result.cancel();
            })
            .setOnCancelListener((dialog) -> {
                dialog.dismiss();
                result.cancel();
            })
            .create()
            .show();

        return true;
    }
}
