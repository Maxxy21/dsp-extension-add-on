#!/bin/bash

echo "🚀 Starting DSP Extension Test Server..."
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.x"
    echo "💡 Install with: sudo apt install python3 (Ubuntu/Debian) or brew install python3 (macOS)"
    exit 1
fi

# Check if test-page.html exists
if [[ ! -f "test-page.html" ]]; then
    echo "❌ test-page.html not found"
    echo "💡 Make sure you're running this from the project root directory"
    exit 1
fi

echo "📡 Starting server on http://localhost:8000"
echo "🧪 Test page: http://localhost:8000/test-page.html"
echo ""
echo "🔧 Extension Setup:"
echo "1. Load your extension in the browser"
echo "2. Open the test URL above" 
echo "3. Extension should automatically activate"
echo ""
echo "⏹️  Press Ctrl+C to stop the server"
echo ""

# Make sure the script is executable and start Python server
python3 local-test-server.py