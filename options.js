// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.sync.get(
        { baseDir: 'OLX_Downloads' },
        (items) => {
            document.getElementById('baseDir').value = items.baseDir;
        }
    );
};

// Saves options to chrome.storage
const saveOptions = () => {
    let baseDir = document.getElementById('baseDir').value.trim();

    // Clean up directory name
    baseDir = baseDir.replace(/[<>:"/\\|?*]+/g, '_');

    if (baseDir.startsWith('/')) {
        baseDir = baseDir.substring(1);
    }

    chrome.storage.sync.set(
        { baseDir: baseDir || 'OLX_Downloads' },
        () => {
            // Update status to let user know options were saved.
            const status = document.getElementById('status');
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 2000);
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
