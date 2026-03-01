# OLX Ad Downloader - Chrome Extension

A Chrome extension that downloads all images and takes a full-page screenshot from OLX.ro ad pages.

## Features

- 📸 **Full-page screenshot** via scroll-and-stitch (no debugger banner)
- 🖼️ **Image download** — grabs all ad images from the OLX CDN at highest resolution
- 🔗 **Link file** — saves a clickable `.html` shortcut to the ad
- 📁 **Organized folders** — downloads into `<base_dir>/<ad_title - price>/`
- ⚙️ **Settings page** — configure your base download directory
- 🟢 **Dynamic icon** — turns green on OLX ad pages, gray elsewhere

## Installation

1. Clone or download this repository
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select this folder
5. Navigate to an OLX ad page and click the extension icon!

## Usage

1. Go to any OLX.ro ad page (e.g. `https://www.olx.ro/d/oferta/...`)
2. The extension icon turns green
3. Click it → a popup shows the ad title and price as the folder name
4. Edit the folder name if needed, then click **Download Images & Screenshot**
5. All files are saved to `Downloads/<base_dir>/<folder_name>/`

## Settings

Right-click the extension icon → **Options** to set the base download directory (default: `OLX_Downloads`).
