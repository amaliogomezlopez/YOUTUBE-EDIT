# TikTok: revisión y prueba real — 6 de septiembre de 2026

## Resultado actual

- Aplicación: Amaliometria Shortsmith, ID 7656831292679407623. Producción permanece en Draft; NO se ha reenviado la revisión.
- Sandbox: Shortsmith Review Demo, ID 7682225903581825032. Usuario autorizado: amaliometria.
- OAuth real completado. TikTok devolvió el perfil Amaliometria y creator info con límite de vídeo de 3600 segundos.
- Direct Post, con SELF_ONLY e interacciones desactivadas: rechazado por TikTok con mensaje que remite a content-sharing-guidelines. El conector anterior no conservaba el código de error; no atribuirle un código específico sin otra respuesta verificable.
- Upload/inbox: MP4 técnico original de ocho segundos aceptado. Consulta posterior confirmó estado terminal SEND_TO_USER_INBOX, sin failReason. No equivale a publicación pública; requiere terminar dentro de TikTok. El identificador de prueba y las capturas están en los artefactos locales, no en el repositorio.
- No se cambió la privacidad de la cuenta ni se publicaron vídeos públicamente.

## Correcciones realizadas

Las páginas públicas /terminos y /privacidad identifican por su nombre exacto Amaliometria Shortsmith y reflejan los permisos utilizados. Se eliminó user.info.profile de producción y Sandbox, y se alinearon los scopes del código y la configuración local.

El retorno anterior en sibelion.ddns.net:8443 no respondió durante OAuth. Se publicó un retorno fijo en:

https://shortsmith-amaliometria.amalio11111.chatgpt.site/oauth/tiktok/callback/

Ese retorno transfiere únicamente code, state y errores a http://127.0.0.1:3100/api/oauth/tiktok/callback; no acepta destinos arbitrarios, usa no-store y no-referrer. La sesión local valida un state de un solo uso con caducidad. El nuevo retorno se configuró SOLO en Sandbox y TIKTOK_SANDBOX_REDIRECT_URI. Producción conserva su retorno anterior: resolverlo antes de una futura solicitud de producción.

El sitio público desplegado es la versión 7, commit d37555eb4311f30a221d41df12b264ab83c64913; Sites confirmó éxito.

Se corrigió validateTiktokToken para aceptar el código de éxito oficial ok, que antes se trataba como error. El mismo tratamiento se alineó en refreshTiktokAccessToken.

## Panel local de pruebas

http://127.0.0.1:3100/tiktok-sandbox.html

- Credenciales y tokens Sandbox solo en memoria; reiniciar el servidor exige volver a conectarlos. No se sustituyen credenciales de producción ni se imprimen secretos.
- Reutiliza Login Kit, creator info, el conector TikTok, el cargador multipart y FFprobe existentes.
- Selección de MP4 y caption editable, cuenta destinataria, privacidad sin preselección, interacciones inicialmente desactivadas, consentimiento expreso.
- Direct Post limitado a SELF_ONLY y contenido de prueba no comercial. No implementa todos los casos comerciales de una aplicación pública.
- Máximo 100 MB para el MP4 de pruebas. La duración se obtiene del archivo real.
- Consulta del estado por publishId para evitar reenvíos duplicados.
- Endpoints sujetos a autenticación, origen y CSRF existentes; el panel API solo admite conexiones loopback.
- La UI principal de publicación multiplataforma sigue siendo independiente de este panel Sandbox; no se afirma que el producto entero cumpla la auditoría de Direct Post.

## Grabación y evidencia

OBS 32.1.2 se abrió y se crearon un perfil y una colección llamados Shortsmith TikTok Sandbox. La captura nativa falló con SetIsBorderRequired: Interfaz no compatible (0x80004002); la entrada por coordenadas tampoco estuvo disponible. No se inició grabación o streaming con OBS.

La captura FFmpeg de la ventana integrada produjo un vídeo negro, descartado como evidencia. La alternativa útil fue capturar la pestaña mediante la API del navegador durante tramos reales de interacción y codificar esos fotogramas. Solo se acortaron esperas y fotogramas idénticos; no se simularon pantallas ni respuestas.

Artefactos locales bajo data/tiktok-* (ignorados por Git):

- tiktok-sandbox-inbox-walkthrough.mp4: recorrido de diagnóstico, 36,6 segundos, aproximadamente 0,52 MB, 1280×720.
- tiktok-sandbox-success.png: confirmación SEND_TO_USER_INBOX.
- tiktok-demo-frames/: originales, marcas temporales y manifiesto de montaje.
- tiktok-sandbox-test-v2.mp4: MP4 técnico enviado, ocho segundos, sin audio.

El vídeo NO es una demostración completa lista para aprobación: no demuestra Direct Post exitoso, y el consentimiento OAuth inicial no quedó completo en la captura. Sigue adjunto en producción el vídeo antiguo 2026-06-29 23-29-01.mp4; no se sustituyó ni se presentó como evidencia nueva.

## Validación

npm test: 433 pruebas, todas correctas. Incluye estado OAuth aislado, caducidad, rechazo de state inválido/reutilizado, respuesta oficial ok, autenticación/CSRF y no exposición de credenciales. Build del sitio correcto y retorno HTTP comprobado contra redirecciones arbitrarias. Verificación visual del MP4 de prueba, del resultado de la subida y del montaje de capturas.

## Bloqueos de aprobación y alternativas

TikTok excluye aplicaciones privadas/personales y utilidades destinadas a subir contenido a cuentas propias o del equipo. Corregir los textos y grabar un vídeo no resuelve ese criterio. Fuentes oficiales: [App Review Guidelines](https://developers.tiktok.com/docs/en/app-review-guidelines) y [Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

Además, el editor es local y la URL declarada es un sitio informativo; TikTok exige coherencia entre la aplicación demostrada y la URL web presentada. Falta una prueba Direct Post permitida y la demostración completa de los permisos seleccionados. No presentar esta herramienta privada como un producto público ficticio.

Buffer continúa siendo la alternativa para publicación automática mediante una integración oficial: [API](https://buffer.com/api), [ejemplo de vídeo](https://developers.buffer.com/examples/create-video-post.html), [TikTok y API oficial](https://buffer.com/made-for/developers). Requiere cuenta TikTok conectada a Buffer, acceso API y MP4 accesible por URL pública. El conector Buffer aún no está implementado. El hosting de vídeos en sibelion debe comprobarse o sustituirse, pues el host falló durante esta prueba. Usar APIs oficiales no elimina las reglas de contenido ni garantiza inmunidad frente a moderación.
