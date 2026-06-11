import base64
import json
import logging
import threading
import time
from datetime import datetime, timezone
from http.server import HTTPServer

logger = logging.getLogger("f1live.auth")

LOGIN_TIMEOUT = 300

_lock = threading.Lock()
_server = None
_login_url = None


def _f1auth():
    from fastf1.internals import f1auth
    return f1auth


def _read_token():
    try:
        return _f1auth().AUTH_DATA_FILE.read_text().strip()
    except (OSError, FileNotFoundError):
        return ""


def _decode_claims(token):
    parts = token.split(".")
    if len(parts) < 2:
        return None
    segment = parts[1]
    segment += "=" * (-len(segment) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(segment))
    except (ValueError, json.JSONDecodeError):
        return None


def _claims():
    token = _read_token()
    if not token:
        return None
    return _decode_claims(token)


def is_authenticated():
    claims = _claims()
    if claims is None:
        return False
    exp = claims.get("exp")
    if exp is not None and exp < time.time():
        return False
    return True


def status():
    claims = _claims()
    if claims is None:
        return {
            "authenticated": False,
            "pending": _server is not None,
            "product": None,
            "subscription": None,
            "expires_at": None,
        }
    exp = claims.get("exp")
    expired = exp is not None and exp < time.time()
    return {
        "authenticated": not expired,
        "pending": _server is not None,
        "product": claims.get("SubscribedProduct"),
        "subscription": claims.get("SubscriptionStatus"),
        "expires_at": datetime.fromtimestamp(exp, timezone.utc).isoformat() if exp else None,
    }


def start_login():
    global _server, _login_url
    with _lock:
        if _server is not None:
            return {"url": _login_url}

        f1auth = _f1auth()
        server = HTTPServer(("127.0.0.1", 0), f1auth.AuthHandler)
        port = server.server_port
        f1auth._auth_finished.clear()
        f1auth._subscription_token = None
        _server = server
        _login_url = f"https://f1login.fastf1.dev?port={port}"
        url = _login_url

    threading.Thread(target=_await_login, args=(server,), daemon=True).start()
    return {"url": url}


def _await_login(server):
    global _server, _login_url
    f1auth = _f1auth()
    serve = threading.Thread(target=server.serve_forever, daemon=True)
    serve.start()
    try:
        finished = f1auth._auth_finished.wait(timeout=LOGIN_TIMEOUT)
        token = f1auth._subscription_token if finished else None
        if token:
            try:
                f1auth.AUTH_DATA_FILE.write_text(token)
            except OSError:
                logger.exception("Failed to persist F1TV auth token")
    finally:
        server.shutdown()
        with _lock:
            _server = None
            _login_url = None


def logout():
    _f1auth().clear_auth_token()
    return {"authenticated": False, "pending": False}


def set_token(token):
    token = (token or "").strip()
    if not token:
        raise ValueError("No token provided.")
    claims = _decode_claims(token)
    if claims is None:
        raise ValueError("That does not look like a valid F1TV token.")
    exp = claims.get("exp")
    if exp is not None and exp < time.time():
        raise ValueError("That token has already expired.")
    f1auth = _f1auth()
    f1auth.AUTH_DATA_FILE.write_text(token)
    f1auth._subscription_token = token
    return status()
