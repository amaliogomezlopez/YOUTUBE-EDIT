# Changelog

## 0.4.0 - 2026-07-14

- Persiste sesiones de subida e identificadores remotos de YouTube, Instagram, TikTok y X para reanudar o reconciliar tras reinicios sin duplicar publicaciones ambiguas.
- Unifica timeout, cancelación y reintentos en LLM, STT, OAuth y conectores externos.
- Endurece el servidor con autenticación opcional, protección CSRF, rate limit, CSP, DTO públicos sin rutas/sesiones y bloqueo seguro de exposición remota.
- Añade bloqueo de instancia, reserva de espacio, limpieza con simulación, retención configurable y rutas locales permitidas explícitamente en modo remoto.
- Incorpora programación local de publicaciones y registro manual de métricas editoriales por clip y plataforma.
- Añade diagnóstico seguro de preparación de plataformas con `npm run publishing:doctor`.
- Amplía la cobertura a reinicio, sesiones expiradas/completadas, seguridad HTTP, almacenamiento, métricas y detección YuNet sobre vídeo real.

## 0.3.0 - 2026-07-12

- Sustituye el multipart en memoria por streaming a disco con límites y limpieza segura.
- Añade colas persistentes para procesamiento, rerender y publicación, con cancelación, reintentos y recuperación tras reinicio.
- Divide STT largo en fragmentos solapados y deduplica segmentos al recomponer la transcripción.
- Implementa subida resumible de YouTube con recuperación del offset y polling oficial del estado de TikTok.
- Añade detección local YuNet/ONNX para webcam y evita inventar un recorte cuando no se detecta una cara estable.
- Incorpora editor de clips, rango, layout, calidad, posición manual de webcam y rerender versionado.
- Modulariza el dashboard, añade progreso de upload/publicación y mejora estados de error y recuperación.
- Amplía la suite a 89 pruebas y valida el pipeline real mediante smoke FFmpeg.

## 0.2.0 - 2026-07-12

- Rediseña el dashboard como control room con Producción, Biblioteca y Storysmith.
- Añade historial de jobs, estado de proveedores y recuperación desde la UI.
- Hace persistente la edición de metadata global y por clip.
- Añade revisión, confirmación e idempotencia antes de publicar.
- Restringe el servidor a localhost, bloquea mutaciones cross-site y endurece OAuth state.
- Guarda credenciales OAuth locales sin mostrarlas completas.
- Añade HTTP Range para previews de vídeo.
- Corrige aliases LLM/STT y evita extraer audio si ya hay transcripción.
- Implementa upload TikTok por chunks con memoria acotada y reintentos transitorios.
- Amplía la suite con pruebas de configuración, dashboard, idempotencia y persistencia segura.
