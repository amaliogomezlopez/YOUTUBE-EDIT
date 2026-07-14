# Shortsmith: publicacion de video multi-plataforma

Este documento recoge el contrato operativo para subir clips generados por Shortsmith a YouTube Shorts, Instagram Reels, TikTok y X usando APIs oficiales.

## Estado actual

- YouTube: subida resumible por chunks desde disco mediante YouTube Data API.
- Instagram: preparado para publicar Reels mediante Instagram Graph API, pero requiere una URL HTTPS publica del MP4.
- TikTok: Content Posting API con upload por chunks y reconciliación del estado oficial hasta resultado terminal o timeout controlado.
- X: conector preparado para X API v2 media upload + `POST /2/tweets`, condicionado a plan/API con escritura y subida de media habilitadas.

Shortsmith no debe usar scraping para publicar. Si una API, cuenta, scope, plan o revision impide publicar automaticamente, el conector debe devolver `requires_manual_action` y exportar caption/assets.

## Flujo comun

1. El pipeline genera un clip vertical MP4 y `publishing-metadata.json`.
   - `publishing-metadata.json` conserva la metadata global del video largo.
   - Cada clip renderizado puede incluir `clip.publishing` con titulo, hashtags, caption, descripcion y cadencia recomendada propios.
   - Los conectores deben preferir `clip.publishing.{platform}` y usar `publishing-metadata.json` solo como fallback para jobs antiguos.
2. La UI o API local llama a `POST /api/jobs/{id}/publish`.
   - El dashboard guarda primero la metadata editada.
   - La petición exige `confirm=true` y una `idempotencyKey`; repetir la misma clave no crea otra publicación.
3. El servidor devuelve `202` al guardar la operación en `data/jobs/publishing-queue.json`. Puede incluir `scheduledFor`; la cola continúa aunque se cierre el navegador y recupera trabajos interrumpidos al reiniciar Shortsmith. El servidor debe permanecer encendido a la hora programada.
4. `src/lib/publishers.js` selecciona el clip renderizado, guarda progreso incremental en `publish-runs.json` y ejecuta conectores independientes.
5. Cada conector devuelve un estado de publicacion:
   - `pending`
   - `validating`
   - `uploading`
   - `processing`
   - `published`
   - `failed`
   - `requires_manual_action`
   - `skipped`
6. El resultado se guarda en `publish-runs.json` dentro del job local. `GET /api/jobs/{id}` expone el run y el estado de la cola para que el dashboard pueda reconciliarse tras recargar.

## Seguridad del dashboard local

- El servidor escucha en `127.0.0.1` por defecto. Exponerlo a LAN o internet requiere `SHORTSMITH_AUTH_TOKEN` de al menos 24 caracteres y un proxy HTTPS.
- Las mutaciones rechazan hosts no permitidos, peticiones `cross-site` y origins diferentes al host local. Los hosts/origins adicionales se declaran con `SHORTSMITH_ALLOWED_HOSTS` y `SHORTSMITH_ALLOWED_ORIGINS`.
- La publicación exige confirmación explícita e idempotencia para reducir duplicados por doble clic o reintentos.
- Los callbacks OAuth exigen `state` válido y de un solo uso. Los tokens se guardan en `.env` local sin mostrarlos completos.
- Shortsmith no debe imprimir tokens, claves, `.env` ni rutas privadas en capturas o logs compartidos.
- Las rutas locales quedan deshabilitadas en modo remoto salvo las incluidas en `SHORTSMITH_ALLOWED_MEDIA_ROOTS`.

La cola deduplica por `jobId + idempotencyKey`, limita concurrencia con `PUBLISH_CONCURRENCY` y permite cancelar o reintentar mediante `/api/publishing-queue/{queueId}/cancel` y `/retry`. Una caída ocurrida exactamente después de que una plataforma acepte un post pero antes de guardar su ID sigue siendo una ambigüedad remota inevitable; antes de reintentar debe revisarse la cuenta para evitar un duplicado.

Las sesiones resumibles, offsets, `publish_id`, contenedores y media IDs se guardan antes de continuar cada efecto remoto. YouTube reemplaza una sesión caducada; TikTok retoma el upload/poll; Instagram y X detienen una creación ambigua como `requires_manual_action` cuando no existe una consulta oficial suficientemente segura para deduplicarla.

`npm run publishing:doctor` inspecciona credenciales y capacidades declaradas sin imprimir secretos ni publicar contenido. La certificación real sigue requiriendo una subida privada/de prueba autorizada en las cuentas de cada plataforma.

## Instagram Reels

Instagram Graph API no acepta un archivo MP4 local en la llamada de creacion de media. El flujo correcto es:

1. Obtener o generar una URL HTTPS publica para el MP4.
2. Crear contenedor:

```text
POST /{ig-user-id}/media
media_type=REELS
video_url=https://dominio-publico/ruta/clip.mp4
caption=...
```

3. Hacer poll del contenedor hasta `FINISHED`.
4. Publicar:

```text
POST /{ig-user-id}/media_publish
creation_id={container-id}
```

Variables requeridas:

```text
META_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
```

Notas:
- La cuenta debe ser profesional (`BUSINESS` o `CREATOR`).
- El token debe coincidir con `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
- El OAuth manual puede fallar por configuracion de Meta/Instagram Login; para pruebas basta con un token valido generado desde Meta.
- No registrar ni exponer `META_ACCESS_TOKEN`.

### OAuth estable para Shortsmith

Para evitar URLs temporales tipo `trycloudflare`, Shortsmith puede usar una base publica fija para los callbacks OAuth:

```text
SHORTSMITH_PUBLIC_BASE_URL=https://sibelion.ddns.net:8443
```

Con esa variable, los callbacks por defecto pasan a ser:

```text
https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/callback
https://sibelion.ddns.net:8443/shortsmith/oauth/youtube/callback
https://sibelion.ddns.net:8443/shortsmith/oauth/x/callback
```

Tambien se siguen aceptando overrides especificos:

```text
META_REDIRECT_URI=
YOUTUBE_REDIRECT_URI=
X_REDIRECT_URI=
X_REDIRECT_URI_NEW_APP=
```

Registra en cada consola de proveedor la URL exacta que use Shortsmith. Para Instagram:

```text
App Settings > Instagram Login > Valid OAuth Redirect URIs
https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/callback
```

Comandos operativos:

```bash
npm run instagram:doctor
npm run instagram:refresh-token
npm run instagram:redeem-vps-code
```

`instagram:doctor` valida configuracion, token, cuenta profesional y asset host sin imprimir secretos. `instagram:refresh-token` refresca el token largo actual, valida la cuenta y actualiza `.env` local sin mostrar el token en stdout. Ejecutarlo semanalmente reduce la probabilidad de que una publicacion falle por token caducado.

Para reautorizacion futura, el VPS no debe guardar `META_APP_SECRET`. El receptor seguro en `/home/amalio/shortsmith-oauth` solo captura el `code` OAuth de un solo uso en `instagram-code.json` con permisos `600`. Despues, en Windows:

```bash
npm run instagram:redeem-vps-code
```

Ese comando trae el `code` por SSH, lo canjea localmente con el secreto ya existente en `.env`, actualiza `META_ACCESS_TOKEN` e `INSTAGRAM_BUSINESS_ACCOUNT_ID`, y borra el `code` remoto.

El servicio remoto es `shortsmith-oauth-code.service` y escucha en `127.0.0.1:3052`. Nginx debe enrutar `/shortsmith/oauth/` hacia ese puerto:

```nginx
location /shortsmith/oauth/ {
    proxy_pass http://127.0.0.1:3052;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
    proxy_connect_timeout 5s;
    limit_except GET { deny all; }
}
```

Aplicar el bloque en los server blocks HTTP y HTTPS antes de `location /`, ejecutar `nginx -t` y recargar nginx. Si Meta revoca permisos o bloquea la app, hay que volver a autorizar desde `/api/oauth/instagram/start` o desde una URL OAuth equivalente con el redirect fijo.

En el VPS queda preparado un script idempotente para aplicar esa ruta con privilegios:

```bash
sudo bash /home/amalio/shortsmith-oauth/apply-nginx-shortsmith-oauth.sh
```

El script crea backup de `/etc/nginx/sites-available/smartglasses`, inserta el bloque antes de ambos `location /`, ejecuta `nginx -t` y recarga nginx.

Runbook detallado: `docs/meta-instagram-reauthorization.md`.

## Asset host SSH/SCP

Para Instagram, Shortsmith incluye un asset host temporal por SSH/SCP en `src/lib/asset-host.js`.

Variables:

```text
ASSET_HOST_PROVIDER=ssh
ASSET_HOST_SSH_HOST=sibelion.ddns.net
ASSET_HOST_SSH_PORT=2223
ASSET_HOST_SSH_USER=amalio
ASSET_HOST_SSH_KEY_PATH=C:\ruta\local\a\clave_ssh.key
ASSET_HOST_REMOTE_DIR=/var/www/shortsmith/videos
ASSET_HOST_PUBLIC_BASE_URL=https://sibelion.ddns.net:8443/shortsmith/videos
```

Funcionamiento:
- Crea `ASSET_HOST_REMOTE_DIR` con `ssh mkdir -p`.
- Sube el MP4 con `scp`.
- Genera un nombre seguro y unico.
- Devuelve `ASSET_HOST_PUBLIC_BASE_URL/{filename}`.

Fallback:
- Si `ASSET_HOST_PROVIDER` no es `ssh` o faltan variables, Instagram devuelve `requires_manual_action`.
- Si la subida falla, Instagram devuelve `failed` con mensaje saneado.
- Si la URL generada no es HTTPS, no se usa para Instagram.

## VPS sibelion

Contexto verificado:

- Host: `sibelion.ddns.net`
- SSH: puerto `2223`
- Usuario: `amalio`
- Clave local configurada en `.env` mediante `ASSET_HOST_SSH_KEY_PATH`. No documentar rutas privadas reales ni subir claves al repositorio.
- Claves que no conectaron como `amalio`:
  - `sibelion_codex.key`
  - `sibelion_xauto.key`
- Servidor web: nginx.
- Site activo: `smartglasses`.
- HTTP `80` y HTTPS `8443` proxyean `/` a `127.0.0.1:5050`.
- `/var/www/html` existe pero no esta servido por el site activo.
- Se instalo una ruta estatica nginx para `/shortsmith/videos/` en los bloques HTTP y HTTPS.
- El directorio publico final es `/var/www/shortsmith/videos`, con owner `amalio:www-data` y permisos `755`.
- Backups nginx creados durante la configuracion:
  - `/etc/nginx/sites-available/smartglasses.before-shortsmith-20260629170154`
  - `/etc/nginx/sites-available/smartglasses.shortsmith-varwww-20260629170230`

Ruta recomendada:

```text
Remote dir: /var/www/shortsmith/videos
Public URL: https://sibelion.ddns.net:8443/shortsmith/videos/
```

Configuracion nginx recomendada dentro de los bloques `server_name sibelion.ddns.net`:

```nginx
location /shortsmith/videos/ {
    alias /var/www/shortsmith/videos/;
    types { video/mp4 mp4; text/plain txt; }
    default_type application/octet-stream;
    add_header Cache-Control "public, max-age=86400";
    add_header Access-Control-Allow-Origin "*";
    limit_except GET HEAD { deny all; }
}
```

Despues:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Prueba segura:

```bash
ssh -i "C:\ruta\local\a\clave_ssh.key" -p 2223 amalio@sibelion.ddns.net 'mkdir -p /var/www/shortsmith/videos'
scp -i "C:\ruta\local\a\clave_ssh.key" -P 2223 tiny-test.mp4 amalio@sibelion.ddns.net:/var/www/shortsmith/videos/tiny-test.mp4
curl -I https://sibelion.ddns.net:8443/shortsmith/videos/tiny-test.mp4
```

La prueba debe devolver `200`, `Content-Type: video/mp4` o compatible, y ser accesible desde una red externa.

## X / Twitter

Shortsmith usa APIs oficiales de X, nunca scraping. El flujo programatico para publicar un clip con texto es:

1. Subir el MP4 con X API v2 Media Upload:

```text
POST /2/media/upload/initialize
POST /2/media/upload/{id}/append
POST /2/media/upload/{id}/finalize
GET  /2/media/upload?command=STATUS&media_id=...
```

Shortsmith inicializa video como `media_category=tweet_video`, `media_type=video/mp4` y envia cada segmento a `append` como `multipart/form-data` con `segment_index` y `media`. El endpoint simple `POST /2/media/upload` se reserva para imagenes/subtitulos y no acepta `tweet_video`.

2. Crear el post con el media asociado:

```text
POST /2/tweets
{
  "text": "...",
  "media": {"media_ids": ["..."]}
}
```

Variables:

```text
X_USER_ACCESS_TOKEN=
```

Alias aceptado:

```text
X_OAUTH2_ACCESS_TOKEN=
```

Fallback OAuth 1.0a para media upload legacy oficial:

```text
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
```

Tambien se aceptan aliases con sufijo para evitar confundirlos con OAuth 2.0:

```text
X_API_KEY_OAUTH1=
X_API_SECRET_OAUTH1=
X_ACCESS_TOKEN_OAUTH1=
X_ACCESS_TOKEN_SECRET_OAUTH1=
```

Scopes recomendados para el token de usuario OAuth 2.0:

```text
tweet.write tweet.read users.read media.write offline.access
```

Shortsmith puede generar una URL OAuth 2.0 con `media.write` aunque el portal no muestre ese scope:

```text
GET /api/oauth/x/start
GET /api/oauth/x/doctor
GET /api/oauth/x/callback
```

El callback guarda el ultimo token completo en `data/secrets/x-oauth-latest.env` para evitar mostrar secretos completos en pantalla. Copiar esas lineas al `.env` local y no commitear `data/secrets`.

Variables para la app nueva:

```text
X_CLIENT_ID_NEW_APP=
X_CLIENT_SECRET_NEW_APP=
X_REDIRECT_URI_NEW_APP=
X_SCOPES_NEW_APP=tweet.read tweet.write users.read offline.access media.write
```

Notas:
- `X_BEARER_TOKEN` suele ser token app-only y no basta para publicar como usuario.
- Los tokens OAuth 1.0a (`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`) se usan como fallback oficial mediante `upload.twitter.com/1.1/media/upload.json` (`INIT`, `APPEND`, `FINALIZE`, `STATUS`) y `POST /1.1/statuses/update.json` si X API v2 bloquea `media.write`.
- X no ofrece programacion nativa del post en `POST /2/tweets`; si Shortsmith necesita publicar en una fecha futura, debe guardar un job local `pending` y ejecutarlo con scheduler propio.
- Si el plan, app, scope o acceso de la cuenta no permite `media.write` o escritura de posts, el conector debe devolver `requires_manual_action` cuando pueda detectarlo antes de publicar, o `failed` con mensaje saneado si X rechaza una llamada API.
- No registrar tokens ni respuestas completas que puedan incluir credenciales.

## Checklist antes de publicar en Instagram

- `npm test` pasa.
- `/api/oauth/instagram/doctor` devuelve `tokenOk=true`.
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` coincide con el token.
- `ASSET_HOST_*` esta configurado en `.env`.
- El MP4 subido responde por HTTPS publico con `200`.
- La URL no requiere cookies, headers privados ni autenticacion.
- El caption no supera 2200 caracteres.
- Si falla el poll del contenedor, guardar `containerId` y error para diagnostico.

## Seguridad y limpieza

- No subir videos privados reales sin indicacion explicita.
- No commitear `.env`, jobs, outputs ni MP4.
- No hardcodear tokens, claves ni rutas privadas en codigo.
- Las URLs temporales deberian limpiarse periodicamente en el VPS cuando ya no sean necesarias.
- No borrar nada del VPS salvo archivos creados expresamente para Shortsmith.
- La limpieza local del dashboard no elimina assets del VPS. `deleteHostedAsset()` limita cualquier borrado remoto al directorio configurado, pero debe invocarse de forma explícita cuando el propietario confirme que Meta ya no necesita el fichero.
