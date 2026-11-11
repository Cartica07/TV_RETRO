package com.tvretro.app;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Lee del portapapeles de Android una IMAGEN copiada (el plugin oficial
 * @capacitor/clipboard solo lee texto). Devuelve { hayImagen, tipo, datos }
 * con "datos" en Base64 (sin saltos de línea). Solo se llama cuando el
 * usuario toca "Pegar" y la app está en primer plano.
 */
@CapacitorPlugin(name = "PortapapelesImagen")
public class PortapapelesImagenPlugin extends Plugin {

    // Tope de seguridad: una imagen copiada de más de esto se ignora.
    private static final int TOPE_BYTES = 25 * 1024 * 1024;

    @PluginMethod
    public void leer(PluginCall call) {
        try {
            Context contexto = getContext();
            ClipboardManager cm = (ClipboardManager) contexto.getSystemService(Context.CLIPBOARD_SERVICE);
            JSObject respuesta = new JSObject();
            respuesta.put("hayImagen", false);

            if (cm != null && cm.hasPrimaryClip()) {
                ClipData clip = cm.getPrimaryClip();
                ContentResolver resolver = contexto.getContentResolver();
                for (int i = 0; clip != null && i < clip.getItemCount(); i++) {
                    Uri uri = clip.getItemAt(i).getUri();
                    if (uri == null) continue;
                    String tipo = resolver.getType(uri);
                    if (tipo == null || !tipo.startsWith("image/")) continue;

                    try (InputStream entrada = resolver.openInputStream(uri)) {
                        if (entrada == null) continue;
                        ByteArrayOutputStream salida = new ByteArrayOutputStream();
                        byte[] bloque = new byte[64 * 1024];
                        int n;
                        while ((n = entrada.read(bloque)) != -1) {
                            salida.write(bloque, 0, n);
                            if (salida.size() > TOPE_BYTES) {
                                call.reject("La imagen copiada es demasiado grande");
                                return;
                            }
                        }
                        respuesta.put("hayImagen", true);
                        respuesta.put("tipo", tipo);
                        respuesta.put("datos", Base64.encodeToString(salida.toByteArray(), Base64.NO_WRAP));
                        break;
                    }
                }
            }
            call.resolve(respuesta);
        } catch (Exception e) {
            call.reject("No se pudo leer el portapapeles", e);
        }
    }
}
