// Guard against multiple injections - only register the listener once
if (!window.__olxContentScriptLoaded) {
    window.__olxContentScriptLoaded = true;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "EXTRACT") {
            const urls = new Set();

            // Only grab images from the MAIN ad carousel (first swiper-wrapper)
            const carousel = document.querySelector('.swiper-wrapper');
            if (carousel) {
                const images = Array.from(carousel.querySelectorAll('img'));
                images.forEach(img => {
                    let url = img.src;
                    // OLX uses CDN for images, typically apollo.olxcdn.com
                    if (url && url.includes('apollo.olxcdn.com') && !url.includes('avatar')) {
                        // Remove size parameters like ;s=1000x700 to try to get the original/highest resolution
                        url = url.replace(/;s=\d+x\d+/, '');
                        urls.add(url);
                    }
                });
            }

            const imageUrls = Array.from(urls);

            if (imageUrls.length > 0) {
                chrome.runtime.sendMessage({
                    type: "OLX_IMAGES",
                    urls: imageUrls,
                    folderPath: message.folderPath
                });
            } else {
                alert("Could not detect any ad images on this page.");
            }
        }
    });
}
