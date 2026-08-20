/**
 * Background script for Nova IMS Timetable Export
 * 
 * Handles file downloads using chrome.downloads API and explicitly enforces
 * proper filenames and extensions via onDeterminingFilename to prevent Chrome
 * from saving data URIs as random UUID files without extensions.
 */

// Store mapping of download request filenames
let pendingFilename = null;

// Enforce custom filename when Chrome determines the target filename
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  let targetFilename = pendingFilename;
  
  // If no pending filename is queued, fallback to item.filename if available
  if (!targetFilename && item.filename && !item.filename.match(/^[0-9a-f-]{36}$/i)) {
    targetFilename = item.filename;
  }
  
  // Default fallback if all else fails
  if (!targetFilename) {
    targetFilename = 'nova-ims-timetable.ics';
  }

  // Clear pending filename state
  pendingFilename = null;

  // Explicitly tell Chrome to use our filename
  suggest({
    filename: targetFilename,
    conflictAction: 'uniquify'
  });

  return true; // Asynchronous suggestion response
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadFile') {
    const { content, filename, mimeType, isBase64 } = message;

    try {
      // Store filename for onDeterminingFilename listener
      pendingFilename = filename;

      let dataUrl;
      if (isBase64) {
        dataUrl = `data:${mimeType};base64,${content}`;
      } else {
        // Encode UTF-8 text to base64 Data URI safely
        const bytes = new TextEncoder().encode(content);
        let binary = '';
        const len = bytes.byteLength;
        // Chunk encoding to avoid call stack limits on large files
        const CHUNK_SIZE = 8192;
        for (let i = 0; i < len; i += CHUNK_SIZE) {
          const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
          binary += String.fromCharCode.apply(null, chunk);
        }
        const base64 = btoa(binary);
        dataUrl = `data:${mimeType};base64,${base64}`;
      }

      chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: message.saveAs !== undefined ? message.saveAs : true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("Download failed:", chrome.runtime.lastError.message);
          pendingFilename = null;
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log("Download started successfully. Download ID:", downloadId);
          sendResponse({ success: true, downloadId });
        }
      });
    } catch (err) {
      console.error("Error preparing download:", err);
      pendingFilename = null;
      sendResponse({ success: false, error: err.message });
    }

    return true; // Keep message channel open
  }
});
