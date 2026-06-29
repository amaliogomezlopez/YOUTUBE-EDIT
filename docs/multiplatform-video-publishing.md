# Shortsmith: publicacion de video multi-plataforma

Este documento recoge el contrato operativo para subir clips generados por Shortsmith a YouTube Shorts, Instagram Reels, TikTok y X usando APIs oficiales.

## Estado actual

- YouTube: preparado para subida directa del MP4 local con YouTube Data API.
- Instagram: preparado para publicar Reels mediante Instagram Graph API, pero requiere una URL HTTPS publica del MP4.
- TikTok: conector reservado; debe completarse con TikTok Content Posting API.
- X: conector reservado; debe completarse con X API.

Shortsmith no debe usar scraping para publicar. Si una API, cuenta, scope, plan o revision impide publicar automaticamente, el conector debe devolver `requires_manual_action` y exportar caption/assets.

## Flujo comun

1. El pipeline genera un clip vertical MP4 y `publishing-metadata.json`.
2. La UI o API local llama a `POST /api/jobs/{id}/publish`.
3. `src/lib/publishers.js` selecciona el clip renderizado y ejecuta conectores independientes.
4. Cada conector devuelve un estado de publicacion:
   - `pending`
   - `validating`
   - `uploading`
   - `processing`
   - `published`
   - `failed`
   - `requires_manual_action`
   - `skipped`
5. El resultado se guarda en `publish-runs.json` dentro del job local.

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
