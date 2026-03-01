chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_DOWNLOAD") {
    const tabId = message.tabId;
    const folderPath = message.folderName;

    // Wait for popup to close before taking screenshots
    setTimeout(() => {
      chrome.tabs.get(tabId, (tab) => {

        // 1. Create a .url Internet Shortcut file for the ad
        // This format is natively double-clickable on Windows
        const urlContent = "[InternetShortcut]\r\nURL=" + tab.url + "\r\n";
        const urlDataUri = "data:application/octet-stream;base64," + btoa(urlContent);
        chrome.downloads.download({
          url: urlDataUri,
          filename: `${folderPath}/ad_link.url`,
          saveAs: false
        });

        // 2. Take full page screenshot using scroll-and-stitch approach
        takeFullPageScreenshot(tabId, folderPath);

        // 3. Inject content script to get images
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, () => {
          chrome.tabs.sendMessage(tabId, { type: "EXTRACT", folderPath: folderPath });
        });
      });
    }, 500);
  }

  if (message.type === "OLX_IMAGES") {
    const urls = message.urls;
    const folderPath = message.folderPath;

    urls.forEach((url, index) => {
      chrome.downloads.download({
        url: url,
        filename: `${folderPath}/image_${index + 1}.jpg`,
        saveAs: false
      });
    });
  }
});

// ---- Full page screenshot via scroll-and-stitch ----

async function takeFullPageScreenshot(tabId, folderPath) {
  try {
    // Get page dimensions from the content script
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1
        };
      }
    });
    const dims = result.result;

    const vw = dims.viewportWidth;
    const vh = dims.viewportHeight;
    const totalH = dims.scrollHeight;
    const dpr = dims.devicePixelRatio;

    const slices = [];
    let y = 0;
    let isFirstSlice = true;

    while (y < totalH) {
      // Scroll to position
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (scrollY) => { window.scrollTo(0, scrollY); },
        args: [y]
      });

      // Delay to respect Chrome's MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota (~2/sec)
      await new Promise(r => setTimeout(r, 600));

      // Capture visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });

      // How much of this slice is actual content (last slice may be partial)
      const remaining = totalH - y;
      const sliceHeight = Math.min(vh, remaining);

      slices.push({
        dataUrl,
        y,
        sliceHeight,
        fullHeight: vh
      });

      // After capturing the first slice, hide all fixed/sticky elements
      // so they don't appear in subsequent slices
      if (isFirstSlice) {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const all = document.querySelectorAll('*');
            window.__fixedEls = [];
            all.forEach(el => {
              const style = getComputedStyle(el);
              if (style.position === 'fixed' || style.position === 'sticky') {
                window.__fixedEls.push({ el, display: el.style.display });
                el.style.display = 'none';
              }
            });
          }
        });
        isFirstSlice = false;
      }

      y += vh;
    }

    // Restore fixed/sticky elements
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.__fixedEls) {
          window.__fixedEls.forEach(({ el, display }) => {
            el.style.display = display;
          });
          delete window.__fixedEls;
        }
      }
    });

    // Scroll back to top
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { window.scrollTo(0, 0); },
    });

    // Use an OffscreenDocument to stitch the images together on a canvas
    // Or we can send the slices to a content script to stitch them.
    // Simplest: inject a script to do the stitching in the page itself.
    await chrome.scripting.executeScript({
      target: { tabId },
      func: stitchScreenshots,
      args: [slices, totalH, vw, dpr, folderPath]
    });

  } catch (err) {
    console.error("Full page screenshot error:", err);
    // Fallback: just capture the visible tab
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      chrome.downloads.download({
        url: dataUrl,
        filename: `${folderPath}/screenshot_${timestamp}.png`,
        saveAs: false
      });
    } catch (e2) {
      console.error("Fallback screenshot also failed:", e2);
    }
  }
}

// This function runs in the page context to stitch screenshots
function stitchScreenshots(slices, totalHeight, viewportWidth, dpr, folderPath) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = viewportWidth * dpr;
    canvas.height = totalHeight * dpr;
    const ctx = canvas.getContext('2d');

    let loaded = 0;
    slices.forEach((slice, idx) => {
      const img = new Image();
      img.onload = () => {
        // The captured image is at device pixel ratio scale
        const srcHeight = slice.sliceHeight * dpr;
        const dy = slice.y * dpr;

        // For the last slice, we may need to crop from the bottom of the captured image
        if (slice.sliceHeight < slice.fullHeight) {
          // Last partial slice - take only the bottom portion
          const srcY = (slice.fullHeight - slice.sliceHeight) * dpr;
          ctx.drawImage(img, 0, srcY, img.width, srcHeight, 0, dy, img.width, srcHeight);
        } else {
          ctx.drawImage(img, 0, 0, img.width, srcHeight, 0, dy, img.width, srcHeight);
        }

        loaded++;
        if (loaded === slices.length) {
          canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            // Send back to background for downloading
            chrome.runtime.sendMessage({
              type: "STITCHED_SCREENSHOT",
              folderPath: folderPath
            });
            // We can't download from content script, so use a link element
            const a = document.createElement('a');
            a.href = url;
            a.download = 'screenshot_fullpage.png';
            // Actually, let's send the data URL to background instead
            const reader = new FileReader();
            reader.onloadend = () => {
              chrome.runtime.sendMessage({
                type: "SAVE_SCREENSHOT",
                dataUrl: reader.result,
                folderPath: folderPath
              });
              resolve();
            };
            reader.readAsDataURL(blob);
          }, 'image/png');
        }
      };
      img.src = slice.dataUrl;
    });
  });
}

// Handle the stitched screenshot save
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_SCREENSHOT") {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    chrome.downloads.download({
      url: message.dataUrl,
      filename: `${message.folderPath}/screenshot_fullpage_${timestamp}.png`,
      saveAs: false
    });
  }
});

// ---- Dynamic icon state ----

function updateIconState(tabId, url) {
  if (url && url.includes("olx.ro/d/oferta")) {
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        "16": "icon_active_16.png",
        "48": "icon_active_48.png"
      }
    });
  } else {
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        "16": "icon_inactive_16.png",
        "48": "icon_inactive_48.png"
      }
    });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateIconState(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    updateIconState(activeInfo.tabId, tab.url);
  });
});
