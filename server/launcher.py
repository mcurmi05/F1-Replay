import os
import threading
import webbrowser


def main():
    import uvicorn
    from main import app

    host = "127.0.0.1"
    port = int(os.environ.get("PORT", "8000"))
    url = f"http://{host}:{port}"

    if not os.environ.get("F1_NO_BROWSER"):
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()

    print(f"F1-Replay running at {url}")
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
