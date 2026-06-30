# Meta / Instagram reauthorization runbook

This document explains how to reauthorize Instagram publishing for Shortsmith without copying Meta app secrets to the VPS.

## Current architecture

- Public OAuth callback:
  `https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/callback`
- Public health check:
  `https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/health`
- VPS user service:
  `shortsmith-oauth-code.service`
- VPS local listener:
  `127.0.0.1:3052`
- Remote one-time code file:
  `/home/amalio/shortsmith-oauth/instagram-code.json`
- Local token exchange command:
  `npm run instagram:redeem-vps-code`

The VPS only stores a short-lived OAuth `code`. The code is redeemed on the local Windows machine, where `.env` already contains `META_APP_SECRET`. Do not copy `META_APP_SECRET` to the VPS.

## Routine health checks

From Windows:

```bash
npm run instagram:doctor
```

Expected:

- `missingEnv` is empty.
- `token.ok` is `true`.
- `token.isProfessional` is `true`.
- `token.matchesEnv` is `true`.
- `assetHost.configured` is `true`.
- `config.redirectUri` is:
  `https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/callback`

Check the public callback route:

```bash
curl -fsS https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/health
```

Expected:

```text
ok
```

## Weekly token refresh

Run:

```bash
npm run instagram:refresh-token
npm run instagram:doctor
```

`instagram:refresh-token` updates `.env` locally without printing the token. If refresh succeeds, no browser authorization is needed.

## Full reauthorization

Use this only when `instagram:refresh-token` fails, Meta revokes access, or `instagram:doctor` reports the token as invalid.

1. Confirm the callback URL is registered in Meta App Dashboard:

```text
https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/callback
```

For Instagram Login, this belongs in the valid OAuth redirect URI list.

2. Start the local Shortsmith server if you want to use the built-in start route:

```bash
npm run server
```

3. Open:

```text
http://localhost:3000/api/oauth/instagram/start
```

Authorize the correct Instagram professional account.

4. Meta redirects to the VPS callback. The browser should show:

```text
Instagram OAuth code received securely.
Return to Shortsmith and run npm run instagram:redeem-vps-code.
```

5. Back on Windows, redeem the remote one-time code:

```bash
npm run instagram:redeem-vps-code
npm run instagram:doctor
```

Expected result:

- `.env` is updated with `META_ACCESS_TOKEN`.
- `.env` is updated with `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
- The remote `instagram-code.json` is deleted.
- `instagram:doctor` reports `token.ok=true`.

## VPS service operations

Check the user service:

```bash
systemctl --user status shortsmith-oauth-code.service
```

Restart it:

```bash
systemctl --user restart shortsmith-oauth-code.service
```

Check the local listener from the VPS:

```bash
curl -fsS http://127.0.0.1:3052/shortsmith/oauth/instagram/health
```

## Nginx route

The nginx route is applied by:

```bash
sudo bash /home/amalio/shortsmith-oauth/apply-nginx-shortsmith-oauth.sh
```

The script backs up `/etc/nginx/sites-available/smartglasses`, inserts the `/shortsmith/oauth/` proxy route in both HTTP and HTTPS server blocks, runs `nginx -t`, and reloads nginx.

The route should proxy to:

```text
http://127.0.0.1:3052
```

## Troubleshooting

- `health` returns `404`: nginx is not routing `/shortsmith/oauth/`; rerun the nginx apply script with sudo.
- Browser callback says `Invalid OAuth state`: use a fresh authorization URL.
- `instagram:redeem-vps-code` says no valid code: authorize again; the previous code may have been deleted or expired.
- `instagram:doctor` reports `API access blocked`: check Meta app status, Instagram Login settings, app roles, and whether the account revoked permissions.
- `matchesEnv=false`: the token belongs to a different Instagram account than `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
