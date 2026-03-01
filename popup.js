document.addEventListener('DOMContentLoaded', () => {
    const folderInput = document.getElementById('folderName');
    const downloadBtn = document.getElementById('downloadBtn');

    // Inject script to get title and price from the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];

        if (tab.url && tab.url.includes("olx.ro/d/oferta")) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const titleEl = document.querySelector('[data-cy="offer_title"]');
                    const priceEl = document.querySelector('[data-testid="ad-price-container"]');

                    let title = titleEl ? titleEl.textContent.trim() : 'Unknown_Ad';
                    let price = priceEl ? priceEl.textContent.trim() : '';

                    // Remove newlines and excess spaces from price
                    price = price.replace(/\s+/g, ' ');

                    // Clean up string for folder name (remove invalid characters for filesystems)
                    title = title.replace(/[<>:"/\\|?*]+/g, '_');
                    price = price.replace(/[<>:"/\\|?*]+/g, '_');

                    return `${title} - ${price}`.trim();
                }
            }, (results) => {
                if (results && results[0] && results[0].result) {
                    folderInput.value = results[0].result;
                } else {
                    folderInput.value = "OLX_Ad_Download";
                }
            });
        } else {
            folderInput.value = "Not_an_OLX_Ad";
            downloadBtn.disabled = true;
        }
    });

    downloadBtn.addEventListener('click', () => {
        let folderName = folderInput.value.trim() || 'OLX_Ad';
        // Ensure no invalid characters sneak in from manual user input
        folderName = folderName.replace(/[<>:"/\\|?*]+/g, '_');

        // Get base directory from storage
        chrome.storage.sync.get({ baseDir: 'OLX_Downloads' }, (items) => {
            const baseDir = items.baseDir;
            const fullPath = `${baseDir}/${folderName}`.replace(/\/+/g, '/'); // ensure no double slashes if baseDir is empty

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.runtime.sendMessage({
                    type: "START_DOWNLOAD",
                    tabId: tabs[0].id,
                    folderName: fullPath
                });
                window.close(); // Close popup so it doesn't appear in the screenshot
            });
        });
    });
});
