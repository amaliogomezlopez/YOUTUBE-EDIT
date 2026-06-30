#!/usr/bin/env python3
import json
import os
import secrets
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("SHORTSMITH_OAUTH_PORT", "3052"))
STATE_TOKEN = os.environ.get("SHORTSMITH_OAUTH_STATE_TOKEN", "")
CODE_FILE = Path(os.environ.get(
    "SHORTSMITH_OAUTH_CODE_FILE",
    "/home/amalio/shortsmith-oauth/instagram-code.json"
))


def write_private_json(path, payload):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    tmp.replace(path)
    os.chmod(path, 0o600)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        safe_path = self.path.split("?", 1)[0]
        print(f"{self.client_address[0]} {self.command} {safe_path}", flush=True)

    def send_text(self, status, body):
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "text/plain; charset=utf-8")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/shortsmith/oauth/instagram/health":
            self.send_text(200, "ok\n")
            return
        if parsed.path != "/shortsmith/oauth/instagram/callback":
            self.send_text(404, "not found\n")
            return

        params = parse_qs(parsed.query)
        oauth_error = params.get("error", [""])[0]
        if oauth_error:
            description = params.get("error_description", [oauth_error])[0]
            self.send_text(400, f"Instagram OAuth error: {description}\n")
            return

        code = params.get("code", [""])[0]
        state = params.get("state", [""])[0]
        if not code:
            self.send_text(400, "Missing OAuth code.\n")
            return
        if STATE_TOKEN and not secrets.compare_digest(state, STATE_TOKEN):
            self.send_text(400, "Invalid OAuth state.\n")
            return

        write_private_json(CODE_FILE, {
            "provider": "instagram",
            "code": code,
            "state": state,
            "receivedAt": datetime.now(timezone.utc).isoformat()
        })
        self.send_text(
            200,
            "Instagram OAuth code received securely.\n"
            "Return to Shortsmith and run npm run instagram:redeem-vps-code.\n"
        )


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Shortsmith OAuth code callback listening on 127.0.0.1:{PORT}", flush=True)
    server.serve_forever()
