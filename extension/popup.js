/**
 * Nova IMS Timetable Export — Popup Script
 * 
 * Manages:
 * 1. Single Timetable Export (CSH Net & Publish calendar view)
 * 2. Batch Timetable Export (Publish Student Groups) with ZIP packaging
 */

(() => {
  'use strict';

  // ── Tab Management ──
  const tabSingleBtn = document.getElementById('tab-single-btn');
  const tabBatchBtn = document.getElementById('tab-batch-btn');
  const viewSingle = document.getElementById('view-single');
  const viewBatch = document.getElementById('view-batch');
  const footerText = document.getElementById('footer-text');

  function switchTab(tabName) {
    if (tabName === 'batch') {
      tabSingleBtn.classList.remove('active');
      tabBatchBtn.classList.add('active');
      viewSingle.classList.remove('active');
      viewBatch.classList.add('active');
      if (footerText) footerText.textContent = 'Publish portal: batch student groups exporter';
      
      // Auto-scan if not scanned yet
      if (discoveredGroups.length === 0 && !isScanning) {
        scanStudentGroups();
      }
    } else {
      tabBatchBtn.classList.remove('active');
      tabSingleBtn.classList.add('active');
      viewBatch.classList.remove('active');
      viewSingle.classList.add('active');
      if (footerText) footerText.textContent = 'Works on Nova IMS Publish & Netpa';
    }
  }

  if (tabSingleBtn) tabSingleBtn.addEventListener('click', () => switchTab('single'));
  if (tabBatchBtn) tabBatchBtn.addEventListener('click', () => switchTab('batch'));

  // ── Single Export DOM References ──
  const exportBtn = document.getElementById('export-btn');
  const logBtn = document.getElementById('log-btn');
  const weeksInput = document.getElementById('weeks-input');
  const weeksDec = document.getElementById('weeks-dec');
  const weeksInc = document.getElementById('weeks-inc');
  const statusArea = document.getElementById('status-area');
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const previewArea = document.getElementById('preview-area');
  const previewCount = document.getElementById('preview-count');
  const previewList = document.getElementById('preview-list');
  const errorArea = document.getElementById('error-area');
  const errorText = document.getElementById('error-text');

  let currentSingleLogText = '';

  // ── Batch Export DOM References ──
  const batchScanText = document.getElementById('batch-scan-text');
  const batchRescanBtn = document.getElementById('batch-rescan-btn');
  const batchProgramSelect = document.getElementById('batch-program-select');
  const batchWeeksInput = document.getElementById('batch-weeks-input');
  const batchWeeksDec = document.getElementById('batch-weeks-dec');
  const batchWeeksInc = document.getElementById('batch-weeks-inc');
  const batchFoldersCheck = document.getElementById('batch-folders-check');
  const batchStartBtn = document.getElementById('batch-start-btn');
  const batchCancelBtn = document.getElementById('batch-cancel-btn');
  const batchLogBtn = document.getElementById('batch-log-btn');
  const batchProgressArea = document.getElementById('batch-progress-area');
  const batchProgressTitle = document.getElementById('batch-progress-title');
  const batchProgressPercent = document.getElementById('batch-progress-percent');
  const batchProgressBar = document.getElementById('batch-progress-bar');
  const batchCurrentGroup = document.getElementById('batch-current-group');
  const batchProgressCounter = document.getElementById('batch-progress-counter');
  const batchResultsArea = document.getElementById('batch-results-area');
  const batchResultsSummary = document.getElementById('batch-results-summary');
  const batchResultsList = document.getElementById('batch-results-list');

  // Batch State
  let discoveredGroups = [];
  let discoveredPrograms = [];
  let isScanning = false;
  let isBatchRunning = false;
  let currentBatchLogText = '';

  // ── Stepper Helper ──
  function setupStepper(inputEl, decBtn, incBtn) {
    if (!inputEl) return;
    if (decBtn) {
      decBtn.addEventListener('click', () => {
        const val = parseInt(inputEl.value, 10) || 15;
        if (val > 1) inputEl.value = val - 1;
      });
    }
    if (incBtn) {
      incBtn.addEventListener('click', () => {
        const val = parseInt(inputEl.value, 10) || 15;
        if (val < 52) inputEl.value = val + 1;
      });
    }
  }

  setupStepper(weeksInput, weeksDec, weeksInc);
  setupStepper(batchWeeksInput, batchWeeksDec, batchWeeksInc);

  // ── Logging Handlers ──
  if (logBtn) {
    logBtn.addEventListener('click', () => {
      if (!currentSingleLogText) {
        alert('No log text available yet. Run Export first.');
        return;
      }
      const filename = `nova-ims-single-debug-log-${new Date().toISOString().slice(0, 10)}.txt`;
      downloadFile(currentSingleLogText, filename, 'text/plain;charset=utf-8');
    });
  }

  if (batchLogBtn) {
    batchLogBtn.addEventListener('click', () => {
      if (!currentBatchLogText) {
        alert('No batch log text available yet. Run Batch Export first.');
        return;
      }
      const filename = `nova-ims-batch-debug-log-${new Date().toISOString().slice(0, 10)}.txt`;
      downloadFile(currentBatchLogText, filename, 'text/plain;charset=utf-8');
    });
  }

  // ── Day name mapping for display ──
  const DAY_ABBREVS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const PT_DAY_MAP = {
    'Seg': 0, 'Ter': 1, 'Qua': 2, 'Qui': 3,
    'Sex': 4, 'S\u00e1b': 5, 'Sab': 5, 'Dom': 6
  };

  // ── UI Helpers ──
  function showError(message) {
    errorArea.classList.remove('hidden');
    errorText.textContent = message;
  }

  function clearError() {
    errorArea.classList.add('hidden');
    errorText.textContent = '';
  }

  function showSingleSuccess(eventCount) {
    clearError();
    statusArea.classList.add('success');
    statusIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>`;
    statusText.textContent = `Exported ${eventCount} classes successfully!`;
  }

  function setSingleLoading(loading) {
    if (loading) {
      exportBtn.classList.add('loading');
      exportBtn.disabled = true;
      exportBtn.querySelector('span').textContent = 'Extracting…';
      exportBtn.querySelector('.btn-icon').innerHTML = `
        <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="25" stroke-linecap="round"/>`;
    } else {
      exportBtn.classList.remove('loading');
      exportBtn.disabled = false;
      exportBtn.querySelector('span').textContent = 'Export .ics';
      exportBtn.querySelector('.btn-icon').innerHTML = `
        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>`;
    }
  }

  function showPreview(events) {
    previewArea.classList.remove('hidden');
    previewCount.textContent = `${events.length} class${events.length !== 1 ? 'es' : ''} found`;
    previewList.innerHTML = '';

    const uniqueEvents = deduplicateEvents(events);
    uniqueEvents.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startHour !== b.startHour) return a.startHour - b.startHour;
      return a.startMinute - b.startMinute;
    });

    uniqueEvents.forEach((event, index) => {
      const dayIdx = event.dayIndex ?? (PT_DAY_MAP[event.dayAbbrev] ?? 0);
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.style.animationDelay = `${index * 50}ms`;
      item.innerHTML = `
        <div class="preview-dot"></div>
        <div class="preview-info">
          <span class="preview-subject">${escapeHtml(event.subject)}</span>
          <span class="preview-detail">${escapeHtml(event.room)}${event.group ? ' · ' + escapeHtml(event.group) : ''}</span>
        </div>
        <span class="preview-time">${DAY_ABBREVS[dayIdx]} ${pad(event.startHour)}:${pad(event.startMinute)}</span>`;
      previewList.appendChild(item);
    });
  }

  function pad(n) {
    return n.toString().padStart(2, '0');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function sanitizeFilename(name) {
    return (name || '').replace(/[/\\?%*:|"<>]/g, '_').trim();
  }

  function deduplicateEvents(events) {
    const seen = new Set();
    return events.filter(e => {
      const key = `${e.subject}|${e.date}|${e.startHour}:${e.startMinute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── ICS Generator ──
  function formatIcsDateTime(dateStr, hour, minute) {
    const [y, m, d] = dateStr.split('-');
    return `${y}${m}${d}T${pad(hour)}${pad(minute)}00`;
  }

  function generateUid(event) {
    const base = `${event.subject}-${event.date}-${event.startHour}${event.startMinute}`;
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      const char = base.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${Math.abs(hash).toString(36)}-${Date.now().toString(36)}@nova-ims-timetable`;
  }

  function foldLine(line) {
    if (line.length <= 75) return line;
    let result = line.substring(0, 75);
    let pos = 75;
    while (pos < line.length) {
      result += '\r\n ' + line.substring(pos, pos + 74);
      pos += 74;
    }
    return result;
  }

  function generateIcs(events, weeksCount, calendarTitle) {
    const calName = calendarTitle || 'Nova IMS Timetable';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nova IMS Timetable Export//Chrome Extension//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calName}`,
      'X-WR-TIMEZONE:Europe/Lisbon',
      '',
      // VTIMEZONE for Europe/Lisbon
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Lisbon',
      'BEGIN:STANDARD',
      'DTSTART:19701025T020000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0000',
      'TZNAME:WET',
      'END:STANDARD',
      'BEGIN:DAYLIGHT',
      'DTSTART:19700329T010000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
      'TZOFFSETFROM:+0000',
      'TZOFFSETTO:+0100',
      'TZNAME:WEST',
      'END:DAYLIGHT',
      'END:VTIMEZONE'
    ];

    const sortedEvents = [...events].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startHour !== b.startHour) return a.startHour - b.startHour;
      return a.startMinute - b.startMinute;
    });

    for (const event of sortedEvents) {
      const dtStart = formatIcsDateTime(event.date, event.startHour, event.startMinute);
      const dtEnd = formatIcsDateTime(event.date, event.endHour, event.endMinute);
      const uid = generateUid(event);

      const description = [
        event.group ? `Group: ${event.group}` : '',
        event.teacher ? `Teacher: ${event.teacher}` : '',
        event.room ? `Room: ${event.room}` : '',
        `Duration: ${event.durationMinutes} min`
      ].filter(Boolean).join('\\n');

      lines.push('BEGIN:VEVENT');
      lines.push(foldLine(`DTSTART;TZID=Europe/Lisbon:${dtStart}`));
      lines.push(foldLine(`DTEND;TZID=Europe/Lisbon:${dtEnd}`));

      if (weeksCount > 1) {
        lines.push(`RRULE:FREQ=WEEKLY;COUNT=${weeksCount}`);
      }

      lines.push(foldLine(`SUMMARY:${event.subject}`));

      if (event.room) {
        lines.push(foldLine(`LOCATION:${event.room}`));
      }

      if (description) {
        lines.push(foldLine(`DESCRIPTION:${description}`));
      }

      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // ── Download Helpers ──
  function downloadFile(content, filename, mimeType, isBase64 = false) {
    chrome.runtime.sendMessage(
      { action: 'downloadFile', content, filename, mimeType, isBase64, saveAs: true },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          // Fallback blob download
          try {
            let blob;
            if (isBase64) {
              const byteCharacters = atob(content);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              blob = new Blob([byteArray], { type: mimeType });
            } else {
              blob = new Blob([content], { type: mimeType });
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              if (a.parentNode) a.parentNode.removeChild(a);
              URL.revokeObjectURL(url);
            }, 60000);
          } catch (e) {
            console.error('Fallback download failed:', e);
          }
        }
      }
    );
  }

  // ── Tab Query Helper ──
  async function getActivePortalTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return null;

    const isNovaIms = tab.url && (
      tab.url.includes('netpa.novaims.unl.pt') ||
      tab.url.includes('publish.novaims.unl.pt')
    );

    if (!isNovaIms) return null;

    // Inject content script if needed
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // Already injected or permission handled
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    return tab;
  }

  // ============================================================
  // SINGLE EXPORT FLOW
  // ============================================================
  exportBtn.addEventListener('click', async () => {
    setSingleLoading(true);
    clearError();
    previewArea.classList.add('hidden');

    try {
      const tab = await getActivePortalTab();
      if (!tab) {
        showError('Please navigate to your Nova IMS schedule page (publish.novaims.unl.pt or netpa.novaims.unl.pt) first.');
        setSingleLoading(false);
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'extractTimetable' }, (response) => {
        setSingleLoading(false);

        if (chrome.runtime.lastError) {
          showError('Could not communicate with the schedule page. Try refreshing the timetable tab and clicking Export again.');
          return;
        }

        if (!response) {
          showError('No response from the schedule page.');
          return;
        }

        if (response.logText) {
          currentSingleLogText = response.logText;
          if (logBtn) logBtn.classList.remove('hidden');
        }

        if (response.error) {
          showError(response.error);
          return;
        }

        if (!response.events || response.events.length === 0) {
          showError('No classes found on the current view. Make sure a timetable is selected.');
          return;
        }

        // Show preview
        showPreview(response.events);

        // Generate and download .ics
        const weeksCount = parseInt(weeksInput.value, 10) || 15;
        const groupName = (response.studyGroup || '').trim();
        const icsContent = generateIcs(response.events, weeksCount, groupName || 'Nova IMS Timetable');

        const exportDate = new Date().toISOString().slice(0, 10);
        let filename;
        if (groupName) {
          filename = `${sanitizeFilename(groupName)} ${exportDate}.ics`;
        } else {
          const weekStart = response.weekStartDate || 'timetable';
          filename = `nova-ims-timetable-${weekStart}.ics`;
        }

        downloadFile(icsContent, filename, 'text/calendar;charset=utf-8');
        showSingleSuccess(response.events.length);
      });
    } catch (err) {
      setSingleLoading(false);
      showError(`Unexpected error: ${err.message}`);
    }
  });

  // ============================================================
  // BATCH EXPORT FLOW (PUBLISH STUDENT GROUPS)
  // ============================================================

  // Listen for batch progress events from content.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'batchProgress' && isBatchRunning) {
      const { current, total, groupName, status, totalClasses } = message;
      const percent = Math.min(100, Math.round((current / Math.max(1, total)) * 100));

      if (batchProgressPercent) batchProgressPercent.textContent = `${percent}%`;
      if (batchProgressBar) batchProgressBar.style.width = `${percent}%`;
      if (batchCurrentGroup) batchCurrentGroup.textContent = `Extracting: ${groupName || 'group'}`;
      if (batchProgressCounter) batchProgressCounter.textContent = `${current} / ${total}`;
      if (batchProgressTitle) batchProgressTitle.textContent = `Extracting [${current}/${total}] (${totalClasses || 0} classes)...`;
    }
  });

  async function scanStudentGroups() {
    if (isScanning) return;
    isScanning = true;
    clearError();

    batchScanText.textContent = 'Expanding sidebar tree & scanning student groups…';
    batchProgramSelect.innerHTML = '<option value="all">Scanning student groups…</option>';
    batchStartBtn.disabled = true;

    try {
      const tab = await getActivePortalTab();
      if (!tab) {
        batchScanText.textContent = 'Please open https://publish.novaims.unl.pt/Timetable/calendar first.';
        isScanning = false;
        batchStartBtn.disabled = false;
        return;
      }

      if (!tab.url.includes('publish.novaims.unl.pt')) {
        batchScanText.textContent = 'Batch export is designed for the Publish portal (publish.novaims.unl.pt).';
        isScanning = false;
        batchStartBtn.disabled = false;
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'scanStudentGroups' }, (response) => {
        isScanning = false;
        batchStartBtn.disabled = false;

        if (chrome.runtime.lastError) {
          batchScanText.textContent = 'Could not scan sidebar. Please refresh the Publish tab and click Rescan.';
          return;
        }

        if (!response || response.error) {
          batchScanText.textContent = response?.error || 'Failed to discover student groups in sidebar.';
          return;
        }

        discoveredGroups = response.groups || [];
        discoveredPrograms = response.programs || [];
        currentBatchLogText = response.logText || '';
        if (currentBatchLogText && batchLogBtn) batchLogBtn.classList.remove('hidden');

        if (discoveredGroups.length === 0) {
          batchScanText.textContent = 'No student groups found. Make sure the Student Groups section is present in the sidebar.';
          batchProgramSelect.innerHTML = '<option value="all">No groups discovered</option>';
          batchStartBtn.disabled = true;
          return;
        }

        // Update Scan Summary
        batchScanText.textContent = `✓ Discovered ${discoveredGroups.length} student groups across ${discoveredPrograms.length} programs.`;

        // Populate Program Dropdown
        batchProgramSelect.innerHTML = '';

        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = `All Programs (${discoveredGroups.length} student groups)`;
        batchProgramSelect.appendChild(allOpt);

        discoveredPrograms.forEach(prog => {
          const opt = document.createElement('option');
          opt.value = prog.degree;
          opt.textContent = `${prog.degree} (${prog.count} group${prog.count !== 1 ? 's' : ''})`;
          batchProgramSelect.appendChild(opt);
        });
      });
    } catch (err) {
      isScanning = false;
      batchStartBtn.disabled = false;
      batchScanText.textContent = `Scan error: ${err.message}`;
    }
  }

  if (batchRescanBtn) {
    batchRescanBtn.addEventListener('click', () => scanStudentGroups());
  }

  // Start Batch Export
  batchStartBtn.addEventListener('click', async () => {
    if (discoveredGroups.length === 0) {
      await scanStudentGroups();
      if (discoveredGroups.length === 0) return;
    }

    clearError();
    const tab = await getActivePortalTab();
    if (!tab) {
      showError('Please navigate to https://publish.novaims.unl.pt/Timetable/calendar first.');
      return;
    }

    // Determine target groups from dropdown
    const selectedScope = batchProgramSelect.value;
    let targetGroups = discoveredGroups;
    if (selectedScope !== 'all') {
      targetGroups = discoveredGroups.filter(g => g.degree === selectedScope);
    }

    if (targetGroups.length === 0) {
      showError('No student groups selected.');
      return;
    }

    const weeksCount = parseInt(batchWeeksInput.value, 10) || 15;
    const organizeFolders = batchFoldersCheck ? batchFoldersCheck.checked : true;
    const targetGroupIds = targetGroups.map(g => g.id);

    // UI state: Start batch
    isBatchRunning = true;
    batchStartBtn.classList.add('hidden');
    batchCancelBtn.classList.remove('hidden');
    batchCancelBtn.disabled = false;
    batchProgressArea.classList.remove('hidden');
    batchResultsArea.classList.add('hidden');

    batchProgressBar.style.width = '0%';
    batchProgressPercent.textContent = '0%';
    batchProgressCounter.textContent = `0 / ${targetGroups.length}`;
    batchCurrentGroup.textContent = 'Initializing extraction…';

    chrome.tabs.sendMessage(
      tab.id,
      {
        action: 'batchExtract',
        options: {
          groupIds: targetGroupIds,
          weeksCount
        }
      },
      async (response) => {
        isBatchRunning = false;
        batchStartBtn.classList.remove('hidden');
        batchCancelBtn.classList.add('hidden');
        batchProgressArea.classList.add('hidden');

        if (chrome.runtime.lastError) {
          showError('Batch extraction connection was lost. If the tab was refreshed or closed, please try again.');
          return;
        }

        if (!response || response.error) {
          showError(response?.error || 'Batch extraction encountered an error.');
          return;
        }

        if (response.logText) {
          currentBatchLogText = response.logText;
          if (batchLogBtn) batchLogBtn.classList.remove('hidden');
        }

        const results = response.results || [];
        if (results.length === 0) {
          showError('No results were returned from batch extraction.');
          return;
        }

        // Package into ZIP using JSZip
        batchCurrentGroup.textContent = 'Packaging .ZIP file…';
        
        try {
          const zip = new JSZip();
          let exportedCount = 0;
          let totalClasses = 0;

          // Overview summary text inside zip
          const overviewLines = [
            '========================================',
            ' NOVA IMS TIMETABLE BATCH EXPORT',
            '========================================',
            `Export Date: ${new Date().toISOString()}`,
            `Semester Weeks: ${weeksCount}`,
            `Scope: ${selectedScope === 'all' ? 'All Programs' : selectedScope}`,
            `Total Groups Processed: ${results.length}`,
            '',
            'STUDENT GROUPS SUMMARY:'
          ];

          results.forEach(res => {
            const classCount = (res.events && res.events.length) || 0;
            totalClasses += classCount;
            if (classCount > 0) exportedCount++;

            overviewLines.push(`- ${res.path}: ${classCount} classes${res.error ? ` (Note: ${res.error})` : ''}`);

            if (classCount > 0) {
              const icsData = generateIcs(res.events, weeksCount, res.groupName);
              const safeGroup = sanitizeFilename(res.groupName);
              const safeDegree = sanitizeFilename(res.degree || 'General');
              const safeYear = sanitizeFilename(res.year || '');

              let zipFilePath;
              if (organizeFolders) {
                if (safeYear) {
                  zipFilePath = `${safeDegree}/${safeYear}/${safeGroup}.ics`;
                } else {
                  zipFilePath = `${safeDegree}/${safeGroup}.ics`;
                }
              } else {
                zipFilePath = `${safeDegree} - ${safeGroup}.ics`;
              }

              zip.file(zipFilePath, icsData);
            }
          });

          overviewLines.push('');
          overviewLines.push(`Total Classes Extracted: ${totalClasses}`);
          overviewLines.push('========================================');

          zip.file('Export_Summary.txt', overviewLines.join('\r\n'));

          // Generate Base64 ZIP
          const zipBase64 = await zip.generateAsync({ type: 'base64' });
          const exportDate = new Date().toISOString().slice(0, 10);
          const zipFilename = selectedScope === 'all'
            ? `Nova_IMS_All_Student_Groups_${exportDate}.zip`
            : `Nova_IMS_${sanitizeFilename(selectedScope)}_${exportDate}.zip`;

          // Download ZIP
          downloadFile(zipBase64, zipFilename, 'application/zip', true);

          // Render Results Card in UI
          batchResultsArea.classList.remove('hidden');
          batchResultsSummary.textContent = `${results.length} groups · ${totalClasses} total classes`;

          batchResultsList.innerHTML = '';
          results.forEach(res => {
            const count = (res.events && res.events.length) || 0;
            const row = document.createElement('div');
            row.className = 'result-row';
            row.innerHTML = `
              <span class="result-group-name" title="${escapeHtml(res.path)}">${escapeHtml(res.groupName)} <small style="color:var(--text-muted);">(${escapeHtml(res.degree)})</small></span>
              <span class="${count > 0 ? 'badge-count' : 'badge-empty'}">${count} ${count === 1 ? 'class' : 'classes'}</span>
            `;
            batchResultsList.appendChild(row);
          });

        } catch (zipErr) {
          showError(`Failed to create ZIP package: ${zipErr.message}`);
        }
      }
    );
  });

  // Cancel Batch Export
  if (batchCancelBtn) {
    batchCancelBtn.addEventListener('click', async () => {
      batchCancelBtn.disabled = true;
      batchProgressTitle.textContent = 'Cancelling batch export…';

      try {
        const tab = await getActivePortalTab();
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { action: 'cancelBatch' });
        }
      } catch (e) {
        console.error('Cancel message error:', e);
      }
    });
  }

  // Initial check on popup load
  (async () => {
    try {
      const tab = await getActivePortalTab();
      if (tab && tab.url && tab.url.includes('publish.novaims.unl.pt')) {
        // Auto-switch to batch tab or prepare scan
        // If user is on publish, we can default or allow easy one-click batch
      }
    } catch (e) {
      // Ignored on popup open
    }
  })();
})();
