# DSP Management Extension Release Notes

## Version 1.4.16

### 🚀 New Features
- Enhanced dual daily checks at 2:00 PM and 3:30 PM
- Improved webhook configuration UI

### 🐛 Bug Fixes
- InnerHTML fix for popup text rendering issues

### 🔧 Improvements
- Better error handling for Mozilla signing
- Enhanced CI/CD workflow with npm integration


### 📋 Technical Notes
- Updated build system to use npm scripts
-  Added dual manifest support for Mozilla signing

---

## Installation Instructions

### Standard Installation
1. Download the .xpi file from the release
2. Open Firefox and go to `about:addons`
3. Click the gear icon ⚙️ and select "Install Add-on From File..."
4. Choose the downloaded .xpi file
5. Click "Add" when prompted

### Development Installation (if unsigned)
1. Download the .xpi file from the release
2. Go to `about:debugging` in Firefox
3. Click "This Firefox"
4. Click "Load Temporary Add-on..."
5. Select the downloaded .xpi file

### Automatic Updates
Existing users will receive this update automatically within 24 hours.

---

## Configuration

After installation, configure your DSP webhook URLs in the extension settings:
1. Click the extension icon in Firefox toolbar
2. Click the gear icon to open settings
3. Add your DSP codes and corresponding Amazon Chime webhook URLs
4. Enable automatic notifications for scheduled checks

---
