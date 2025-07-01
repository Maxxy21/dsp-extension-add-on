#!/bin/bash

echo "🔏 Signing DSP Extension with Mozilla..."

# Check if API credentials are set
if [ -z "$WEB_EXT_API_KEY" ] || [ -z "$WEB_EXT_API_SECRET" ]; then
    echo "❌ Error: Mozilla API credentials not set"
    echo ""
    echo "Please set your Mozilla API credentials:"
    echo "export WEB_EXT_API_KEY=your_api_key"
    echo "export WEB_EXT_API_SECRET=your_api_secret"
    exit 1
fi

# Get version from manifest
VERSION=$(node -p "require('./extension/manifest.json').version")
echo "📦 Extension version: $VERSION"

# Create dist directory
mkdir -p dist

# Change to extension directory
cd extension

echo "🚀 Starting signing process..."

# Sign the extension
web-ext sign \
    --api-key="$WEB_EXT_API_KEY" \
    --api-secret="$WEB_EXT_API_SECRET" \
    --channel=unlisted \
    --artifacts-dir=../dist \
    --timeout=600000

if [ $? -eq 0 ]; then
    cd ..
    
    # Find and rename the signed XPI
    SIGNED_XPI=$(find dist -name "*.xpi" -type f | head -1)
    NEW_NAME="dist/dsp-extension-v$VERSION.xpi"
    
    if [ "$SIGNED_XPI" != "$NEW_NAME" ]; then
        mv "$SIGNED_XPI" "$NEW_NAME"
    fi
    
    echo "✅ Extension signed successfully!"
    echo "📦 Signed file: $NEW_NAME"
    
    # Generate SHA256 hash
    SHA256=$(sha256sum "$NEW_NAME" | cut -d' ' -f1)
    echo "🔐 SHA256: $SHA256"
    echo "$SHA256" > "dist/dsp-extension-v$VERSION.sha256"
else
    cd ..
    echo "❌ Signing failed!"
    exit 1
fi
