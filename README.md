# 🚀 DSP Management Extension

A Firefox Add-On for automated DSP (Delivery Service Partner) roster management with webhook notifications and scheduling automation.

## 📋 Features

- ✅ **Dual Daily Checks**: Automatic mismatch detection at 2:00 PM and 3:30 PM
- ✅ **Webhook Notifications**: Send alerts to Amazon Chime via configured webhooks
- ✅ **Manual Checks**: On-demand roster mismatch checking
- ✅ **Custom Messaging**: Broadcast messages to individual or multiple DSPs
- ✅ **Auto-Updates**: Seamless updates via Firefox's built-in update system
- ✅ **Cross-Platform**: Works on Windows, macOS, and Linux
- ✅ **Modern UI**: Clean, responsive interface with dark mode support

## 🎯 Quick Links

- **📥 Download**: [Latest Release](https://github.com/Maxxy21/dsp-extension-hosting/releases/latest)
- **🌐 Install Page**: [maxxy21.github.io/dsp-extension-hosting](https://maxxy21.github.io/dsp-extension-hosting)
- **🔄 Updates**: Automatic via Firefox (no manual downloads needed)
- **🐛 Issues**: [Report bugs](https://github.com/Maxxy21/dsp-extension-hosting/issues)

## 📥 Installation

### For End Users
1. Download the latest `.xpi` file from [Releases](https://github.com/Maxxy21/dsp-extension-hosting/releases/latest)
2. Open Firefox
3. Go to `about:addons`
4. Click the gear icon ⚙️ → "Install Add-on From File..."
5. Select the downloaded `.xpi` file
6. Click "Add" when prompted

### For Developers
```bash
git clone https://github.com/Maxxy21/dsp-extension-hosting.git
cd dsp-extension-hosting
npm install
npm run dev  # Opens Firefox with extension loaded
```

## 🔧 Configuration

After installation:

1. **Click the extension icon** in Firefox toolbar
2. **Open Settings** (gear icon in popup)
3. **Configure Webhooks**:
    - Add DSP codes (e.g., "DHH1", "LTN2")
    - Add corresponding Amazon Chime webhook URLs
4. **Enable Notifications** for automatic daily checks

## 🚀 Development

### Prerequisites
- **Node.js** 16+
- **Firefox** (for testing)
- **Git Bash** (Windows) or Terminal (macOS/Linux)

### Setup
```bash
# Clone repository
git clone https://github.com/Maxxy21/dsp-extension-hosting.git
cd dsp-extension-hosting

# Install dependencies
npm install

# Install web-ext globally for development
npm install -g web-ext
```

### Development Commands
```bash
npm run dev          # Start Firefox with extension loaded
npm run build        # Build unsigned XPI file
npm run lint         # Lint extension code
npm run clean        # Clean build artifacts
```

### Version Management
```bash
npm run version:patch   # 1.4.0 → 1.4.1
npm run version:minor   # 1.4.0 → 1.5.0  
npm run version:major   # 1.4.0 → 2.0.0
```

### Extension Signing
```bash
# Set Mozilla API credentials
export WEB_EXT_API_KEY="your_api_key"
export WEB_EXT_API_SECRET="your_api_secret"

# Sign extension for distribution
npm run sign
```

Get API credentials from: [addons.mozilla.org/developers/addon/api/key/](https://addons.mozilla.org/developers/addon/api/key/)

## 🏗️ Project Structure

```
dsp-extension-hosting/
├── 📁 .github/workflows/     # CI/CD automation
├── 📁 extension/             # Extension source code
│   ├── 📄 manifest.json     # Extension manifest
│   ├── 📁 background/        # Background scripts
│   ├── 📁 content/           # Content scripts  
│   ├── 📁 popup/             # Extension popup
│   ├── 📁 options/           # Settings page
│   ├── 📁 icons/             # Extension icons
│   └── 📄 browser-polyfill.js
├── 📁 scripts/               # Build and development scripts
├── 📁 docs/                  # GitHub Pages (auto-generated)
├── 📁 dist/                  # Build output
├── 📄 package.json          # Dependencies and scripts
└── 📄 README.md             # This file
```

## 🔄 CI/CD Pipeline

### Automated Releases
- **Push to main** → Automatic patch release
- **Manual trigger** → Choose patch/minor/major release
- **GitHub Pages** → Auto-updated download page
- **Firefox Updates** → Users get automatic updates

### Workflow
1. Make changes to extension code
2. Commit and push to main branch
3. GitHub Actions automatically:
    - Bumps version number
    - Builds and signs extension
    - Creates GitHub release
    - Updates Firefox update manifest
    - Deploys to GitHub Pages

## 📚 API Reference

### Extension Messaging
```javascript
// Send manual check request
browser.runtime.sendMessage({ action: "manualCheck" });

// Send message to DSP
browser.runtime.sendMessage({
  action: "sendMessage",
  dsp: "DHH1", 
  message: "Your message here"
});

// Update notification settings
browser.runtime.sendMessage({
  action: "updateNotificationSettings",
  enabled: true
});
```

### Webhook Configuration
Store webhooks in local storage:
```javascript
await browser.storage.local.set({
  webhooks: {
    "DHH1": "https://hooks.chime.aws/your-webhook-url",
    "LTN2": "https://hooks.chime.aws/another-webhook-url"
  }
});
```

## 🐛 Troubleshooting

### Common Issues

#### Extension not loading
```bash
# Check for syntax errors
npm run lint

# Test in clean Firefox profile
npm run dev
```

#### Build fails
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

#### Signing fails
- Verify Mozilla API credentials are correct
- Ensure extension ID is unique
- Check manifest.json is valid JSON
- Try with a new version number

#### Automatic updates not working
- Verify `update_url` in manifest points to correct location
- Check `docs/updates.json` is accessible
- Ensure extension ID matches in manifest and updates.json

### Development Tips
- Use `about:debugging` for temporary installs during development
- Check browser console for error messages
- Use Firefox Developer Edition for unsigned extensions
- Test webhook URLs with tools like Postman

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Style
- Use modern JavaScript (ES6+)
- Follow existing code formatting
- Add comments for complex logic
- Update README if adding new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **📧 Issues**: [GitHub Issues](https://github.com/Maxxy21/dsp-extension-hosting/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/Maxxy21/dsp-extension-hosting/discussions)
- **📖 Documentation**: [Wiki](https://github.com/Maxxy21/dsp-extension-hosting/wiki)

## 🎉 Acknowledgments

- **Mozilla** for the excellent WebExtensions API
- **Firefox** for the robust extension platform
- **Amazon** for the logistics platform integration
- **Contributors** who help improve this project

## 📊 Version History

- **v1.4.0** - Dual daily checks (2:00 PM & 3:30 PM)
- **v1.3.0** - Enhanced webhook management
- **v1.2.0** - Improved UI and error handling
- **v1.1.0** - Added custom messaging features
- **v1.0.0** - Initial release with basic functionality

---

**Made with ❤️ for DSP management automation**