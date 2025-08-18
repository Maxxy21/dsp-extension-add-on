#!/usr/bin/env python3
"""
Simple local web server for testing DSP Extension
Serves your HTML files on localhost so the extension can access them
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

class DSPTestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.getcwd(), **kwargs)
    
    def end_headers(self):
        # Add CORS headers for testing
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def log_message(self, format, *args):
        print(f"🌐 {format % args}")

def start_test_server(port=8000):
    """Start a local web server for testing the DSP extension"""
    
    # Check if test-page.html exists
    test_file = Path("test-page.html")
    if not test_file.exists():
        print("❌ test-page.html not found in current directory")
        print("💡 Make sure you're running this from the project root directory")
        return
    
    try:
        with socketserver.TCPServer(("", port), DSPTestHandler) as httpd:
            print("🚀 DSP Extension Test Server Starting...")
            print(f"📡 Server running at: http://localhost:{port}")
            print(f"🧪 Test page: http://localhost:{port}/test-page.html")
            print("📝 Your HTML file: Place your DSP HTML file in this directory")
            print("")
            print("🔧 Extension Setup:")
            print("1. Load your extension in the browser")
            print("2. Open the test URL above")
            print("3. Extension should automatically activate and highlight mismatches")
            print("")
            print("⏹️  Press Ctrl+C to stop the server")
            print("")
            
            # Try to open the test page automatically
            try:
                webbrowser.open(f"http://localhost:{port}/test-page.html")
                print("🌐 Opening test page in browser...")
            except:
                print("ℹ️  Manually open http://localhost:{port}/test-page.html in your browser")
            
            httpd.serve_forever()
            
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {port} is already in use")
            print(f"💡 Try a different port: python local-test-server.py {port + 1}")
        else:
            print(f"❌ Error starting server: {e}")
    except KeyboardInterrupt:
        print("\n⏹️  Server stopped by user")

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("❌ Invalid port number")
            sys.exit(1)
    
    start_test_server(port)