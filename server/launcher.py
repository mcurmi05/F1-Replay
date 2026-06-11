import os
import threading
import webbrowser


def _ensure_ssl_certs():
    if os.environ.get("SSL_CERT_FILE"):
        return
    try:
        import certifi
    except ImportError:
        return
    bundle = certifi.where()
    os.environ["SSL_CERT_FILE"] = bundle
    os.environ.setdefault("SSL_CERT_DIR", os.path.dirname(bundle))


def main():
    _ensure_ssl_certs()
    import uvicorn
    from main import app

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    url = f"http://{host}:{port}"

    if not os.environ.get("F1_NO_BROWSER"):
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()

    print(f"F1-Replay running at {url}")
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
