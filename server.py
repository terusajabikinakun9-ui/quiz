import http.server
import socketserver
import webbrowser
import threading
import time
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def open_browser():
    # Wait 1 second for the server to start, then launch default browser
    time.sleep(1.0)
    url = f"http://localhost:{PORT}"
    print(f"\n[INFO] Membuka {url} di browser default Anda...")
    webbrowser.open(url)

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("=" * 60)
        print("  OPTIWATCH - SIMULASI OPTIMASI CCTV & PENCARIAN LOKAL")
        print("=" * 60)
        print(f"[OK]   Server aktif pada port: {PORT}")
        print(f"[INFO] Direktori kerja: {DIRECTORY}")
        print("[TIPS] Tekan Ctrl+C di terminal ini untuk mematikan server.")
        print("=" * 60)
        
        # Start browser in a background thread
        threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[INFO] Menutup server. Sampai jumpa!")
            sys.exit(0)

if __name__ == "__main__":
    start_server()
