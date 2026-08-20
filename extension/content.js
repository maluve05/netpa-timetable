/**
 * Nova IMS Timetable Export — Content Script
 * 
 * Supports both:
 * 1. Legacy CSH Net timetable table (netpa.novaims.unl.pt)
 * 2. Modern Angular Publish calendar view (publish.novaims.unl.pt)
 *    - Single timetable export
 *    - Automated batch discovery & export of all student groups
 */

(() => {
  'use strict';

  // Day abbreviations → JS day-of-week index (0=Mon … 6=Sun)
  const DAY_MAP = {
    'Seg': 0, 'Mon': 0, // Monday
    'Ter': 1, 'Tue': 1, // Tuesday
    'Qua': 2, 'Wed': 2, // Wednesday
    'Qui': 3, 'Thu': 3, // Thursday
    'Sex': 4, 'Fri': 4, // Friday
    'S\u00e1b': 5, 'Sab': 5, 'Sat': 5, // Saturday
    'Dom': 6, 'Sun': 6  // Sunday
  };

  const DAY_ABBREVS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let isBatchCancelled = false;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function pad(n) {
    return n.toString().padStart(2, '0');
  }

  /**
   * Parse "HHhMM" → { hours, minutes }
   */
  function parseTime(timeStr) {
    const match = timeStr.match(/(\d+)h(\d+)/);
    if (!match) return null;
    return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
  }

  /**
   * Add minutes to a time object → { hours, minutes }
   */
  function addMinutes(time, mins) {
    const totalMinutes = time.hours * 60 + time.minutes + mins;
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  }

  /**
   * Extract year from gotoDate('DD-MM-YYYY') navigation links (Netpa format).
   */
  function extractYear(doc) {
    const scripts = doc.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      const match = text.match(/gotoDate\(\s*'(\d{2})-(\d{2})-(\d{4})'\s*\)/);
      if (match) {
        return parseInt(match[3], 10);
      }
    }
    const links = doc.querySelectorAll('a[onclick*="gotoDate"]');
    for (const link of links) {
      const onclick = link.getAttribute('onclick') || '';
      const match = onclick.match(/gotoDate\(\s*'(\d{2})-(\d{2})-(\d{4})'\s*\)/);
      if (match) {
        return parseInt(match[3], 10);
      }
    }
    return new Date().getFullYear();
  }

  // =========================================================================
  // NETPA (CSH Net) EXTRACTOR
  // =========================================================================
  function extractNetpaTimetable(table, log, addLog) {
    addLog('Starting extraction via Netpa (CSH Net) layout parser...');
    addLog('Found timetable table #tabhorarionew');

    const thead = table.querySelector('thead');
    if (!thead) {
      addLog('ERROR: Table <thead> not found.');
      return { 
        error: 'Table header not found.',
        logText: log.join('\n')
      };
    }

    const year = extractYear(document);
    addLog(`Extracted Year from scripts/links: ${year}`);

    // Parse Netpa day headers
    const headerCells = thead.querySelectorAll('th[scope="col"]');
    const dayHeaders = [];
    for (const th of headerCells) {
      const text = th.textContent.trim();
      const match = text.match(/^(\S+)\s+(\d+)-(\d+)$/);
      if (match) {
        const dayAbbrev = match[1];
        const dayOfMonth = parseInt(match[2], 10);
        const month = parseInt(match[3], 10);
        const dayIndex = DAY_MAP[dayAbbrev];
        if (dayIndex !== undefined) {
          const dateStr = `${year}-${pad(month)}-${pad(dayOfMonth)}`;
          dayHeaders.push({ dayIndex, dayAbbrev, dateStr, year, month, dayOfMonth });
        }
      }
    }

    addLog(`Parsed ${dayHeaders.length} day headers from Netpa <thead>`);
    dayHeaders.forEach((dh, i) => {
      addLog(`  Header [${i}]: ${dh.dayAbbrev} -> Index ${dh.dayIndex}, Date: ${dh.dateStr}`);
    });

    if (dayHeaders.length === 0) {
      addLog('ERROR: Could not parse any day headers from Netpa table.');
      return { 
        error: 'Could not parse day headers from the timetable.',
        logText: log.join('\n')
      };
    }

    const tbody = [...table.querySelectorAll('tbody')].find(b => b.querySelector('th.time')) || table.querySelector('tbody');
    if (!tbody) {
      addLog('ERROR: No tbody found inside table.');
      return { 
        error: 'Table tbody not found.',
        logText: log.join('\n')
      };
    }

    const rows = tbody.querySelectorAll('tr');
    addLog(`Target tbody selected. Found ${rows.length} <tr> elements in schedule body.`);

    const events = [];
    const numCols = dayHeaders.length;
    const rowspanTracker = new Array(numCols).fill(0);

    for (const row of rows) {
      const timeTh = row.querySelector('th.time');
      if (!timeTh) continue;

      const timeText = timeTh.textContent.trim();
      const startTime = parseTime(timeText);
      if (!startTime) continue;

      const tds = row.querySelectorAll('td');
      let tdIdx = 0;

      for (let col = 0; col < numCols; col++) {
        if (rowspanTracker[col] > 0) {
          rowspanTracker[col]--;
          continue;
        }

        if (tdIdx >= tds.length) break;
        const td = tds[tdIdx];
        tdIdx++;

        const rowspan = parseInt(td.getAttribute('rowspan') || '1', 10);
        if (rowspan > 1) {
          rowspanTracker[col] = rowspan - 1;
        }

        const descDiv = td.querySelector('div[name="descriptionDiv"]');
        if (!descDiv || !descDiv.textContent.trim()) continue;

        const html = descDiv.innerHTML;
        const parts = html.split(/<br\s*\/?>/i);
        const subject = (parts[0] || '').replace(/<[^>]*>/g, '').trim();
        const roomGroupStr = (parts[1] || '').replace(/<[^>]*>/g, '').trim();

        let room = roomGroupStr;
        let group = '';
        const dashIdx = roomGroupStr.lastIndexOf(' - ');
        if (dashIdx !== -1) {
          room = roomGroupStr.substring(0, dashIdx).trim();
          group = roomGroupStr.substring(dashIdx + 3).trim();
        }

        const durationMinutes = rowspan * 30;
        const endTime = addMinutes(startTime, durationMinutes);
        const dayHeader = dayHeaders[col];
        if (!dayHeader) continue;

        events.push({
          subject,
          room,
          group,
          date: dayHeader.dateStr,
          startHour: startTime.hours,
          startMinute: startTime.minutes,
          endHour: endTime.hours,
          endMinute: endTime.minutes,
          durationMinutes,
          dayAbbrev: dayHeader.dayAbbrev,
          dayIndex: dayHeader.dayIndex
        });
      }
    }

    events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startHour !== b.startHour) return a.startHour - b.startHour;
      return a.startMinute - b.startMinute;
    });

    events.forEach(e => {
      addLog(`  MATCH FOUND @ [${e.date} / ${e.dayAbbrev}] ${pad(e.startHour)}h${pad(e.startMinute)} (${e.durationMinutes}m): "${e.subject}" in "${e.room}" (${e.group})`);
    });

    addLog(`Processed ${rows.length} Netpa time rows.`);
    addLog(`SUCCESS: Extracted ${events.length} total events from Netpa.`);

    const cdLectivo = document.getElementById('cdLectivo');
    const academicYear = cdLectivo ? cdLectivo.options[cdLectivo.selectedIndex]?.text : '';

    const turmaSelect = document.getElementById('cdTurma') || document.querySelector('select[name*="Turma"]');
    const studyGroup = turmaSelect && turmaSelect.selectedIndex >= 0 ? turmaSelect.options[turmaSelect.selectedIndex].text.trim() : '';

    const debug = {
      siteType: 'Netpa',
      timeRowCount: table.querySelectorAll('th.time').length,
      tbodyRowsFound: rows.length,
      totalTdCount: tbody.querySelectorAll('td').length,
      descDivCount: table.querySelectorAll('div[name="descriptionDiv"]').length,
      nonEmptyDescCount: [...table.querySelectorAll('div[name="descriptionDiv"]')].filter(d => d.textContent.trim()).length,
      dayHeaderCount: dayHeaders.length,
      eventsExtracted: events.length,
      studyGroup,
      year
    };

    return {
      events,
      dayHeaders: dayHeaders.map(d => ({
        dayAbbrev: d.dayAbbrev,
        dayIndex: d.dayIndex,
        date: d.dateStr
      })),
      academicYear,
      studyGroup,
      year,
      weekStartDate: dayHeaders.length > 0 ? dayHeaders[0].dateStr : null,
      debug,
      logText: log.join('\n')
    };
  }

  // =========================================================================
  // PUBLISH (Angular Calendar View) EXTRACTOR
  // =========================================================================
  function extractPublishTimetable(log, addLog) {
    addLog('Starting extraction via Publish (Angular Calendar View) layout parser...');

    // Extract Entity Info (Course / Year / Group Name)
    const entityName = document.querySelector('.entity-name')?.textContent.trim() || '';
    const entityDetails = [...document.querySelectorAll('.entity-details')].map(e => e.textContent.trim());
    addLog(`Extracted Entity Name: "${entityName}"`);
    if (entityDetails.length > 0) {
      addLog(`Extracted Entity Details: ${entityDetails.join(' | ')}`);
    }

    // Extract Month & Year Header
    let headerYear = new Date().getFullYear();
    let headerMonth = new Date().getMonth() + 1;

    const monthHeaderEl = document.querySelector('h6.mb-0[title]') || document.querySelector('h6.mb-0');
    if (monthHeaderEl) {
      const headerText = monthHeaderEl.getAttribute('title') || monthHeaderEl.textContent.trim();
      addLog(`Found Month/Year Header text: "${headerText}"`);

      const match = headerText.match(/([A-Za-zçáéíóúâêôãõ]+)\s+(\d{4})/i);
      if (match) {
        const monthName = match[1].toLowerCase();
        headerYear = parseInt(match[2], 10);
        const monthMap = {
          january: 1, janeiro: 1,
          february: 2, fevereiro: 2,
          march: 3, marco: 3, março: 3,
          april: 4, abril: 4,
          may: 5, maio: 5,
          june: 6, junho: 6,
          july: 7, julho: 7,
          august: 8, agosto: 8,
          september: 9, setembro: 9,
          october: 10, outubro: 10,
          november: 11, novembro: 11,
          december: 12, dezembro: 12
        };
        if (monthMap[monthName]) {
          headerMonth = monthMap[monthName];
        }
      }
    }
    addLog(`Base Header Month/Year resolved to: ${pad(headerMonth)}/${headerYear}`);

    // Parse Day Headers
    const dayHeaderEls = document.querySelectorAll('.day-header');
    addLog(`Found ${dayHeaderEls.length} .day-header elements in DOM.`);

    const dayHeaders = [];
    dayHeaderEls.forEach((dh, idx) => {
      const dayName = dh.querySelector('.day-name')?.textContent.trim() || '';
      const dayNumberText = dh.querySelector('.day-number')?.textContent.trim() || '1';
      const dayNumber = parseInt(dayNumberText, 10);
      const style = dh.getAttribute('style') || dh.style.cssText || '';

      const colMatch = style.match(/grid-area:\s*\d+\s*\/\s*(\d+)/i);
      const colNum = colMatch ? parseInt(colMatch[1], 10) : (idx + 2);
      const dayIndex = DAY_MAP[dayName] !== undefined ? DAY_MAP[dayName] : (colNum - 2);

      dayHeaders.push({
        colNum,
        dayIndex,
        dayAbbrev: dayName || DAY_ABBREVS[dayIndex] || 'Mon',
        dayNumber
      });

      addLog(`  Day Header [${idx}]: "${dayName}" ${dayNumber} (grid col ${colNum} -> dayIndex ${dayIndex})`);
    });

    if (dayHeaders.length === 0) {
      addLog('ERROR: Could not parse any day headers from .day-header elements.');
      return {
        error: 'Could not parse day headers from Publish calendar.',
        logText: log.join('\n')
      };
    }

    // Parse Day Columns & Events
    const dayColumns = document.querySelectorAll('.day-column');
    addLog(`Found ${dayColumns.length} .day-column elements in DOM.`);

    const events = [];

    dayColumns.forEach((col, colIdx) => {
      const style = col.getAttribute('style') || col.style.cssText || '';
      const colGridMatch = style.match(/grid-area:\s*\d+\s*\/\s*(\d+)/i);
      const colNum = colGridMatch ? parseInt(colGridMatch[1], 10) : (colIdx + 2);
      const dayIndex = colNum - 2;

      const dayHeader = dayHeaders.find(dh => dh.colNum === colNum || dh.dayIndex === dayIndex) || {
        dayIndex,
        dayAbbrev: DAY_ABBREVS[dayIndex] || 'Mon',
        dayNumber: 1
      };

      const eventEls = col.querySelectorAll('.event');
      addLog(` Column [${colIdx + 1}] (Col ${colNum}, Day: ${dayHeader.dayAbbrev} ${dayHeader.dayNumber}): Found ${eventEls.length} events.`);

      eventEls.forEach((evEl, evIdx) => {
        const lineEls = evEl.querySelectorAll('.event-detail-line');
        const lines = [...lineEls].map(l => l.textContent.trim()).filter(Boolean);

        addLog(`   -> Event [${evIdx + 1}] detail lines (${lines.length}): [${lines.map(l => `"${l}"`).join(', ')}]`);

        if (lines.length === 0) return;

        const subject = lines[0];
        let group = '';
        let room = '';
        let teacher = '';
        const dateTimeLine = lines[lines.length - 1];

        // Parse intermediate lines (group, room, teacher)
        for (let i = 1; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith('(') && line.endsWith(')')) {
            teacher = teacher ? `${teacher}, ${line}` : line;
          } else if (/^(TP|P|T|L)\d+$/i.test(line)) {
            group = line;
          } else if (/^(Auditorium|Room|Lab|Sala|Anfiteatro)/i.test(line) || (!room && i === 2)) {
            room = line;
          } else if (!group && i === 1) {
            group = line;
          } else if (!room && i === 2) {
            room = line;
          }
        }

        // Parse Date and Time from dateTimeLine
        // Example: "07-09-2026, 14-09-2026, 21-09-2026, 28-09-2026, 05-10-2026, (+9) | 10:00 (01:30h)"
        const parts = dateTimeLine.split('|');
        const datesStr = parts[0] || '';
        const timeStr = parts[1] || '';

        // Extract time and duration
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*\(\s*(\d{1,2}):(\d{2})h?\s*\)/);
        let startHour = 0, startMinute = 0, durationMinutes = 90;
        if (timeMatch) {
          startHour = parseInt(timeMatch[1], 10);
          startMinute = parseInt(timeMatch[2], 10);
          const durHours = parseInt(timeMatch[3], 10);
          const durMins = parseInt(timeMatch[4], 10);
          durationMinutes = durHours * 60 + durMins;
        }

        const totalEndMins = startHour * 60 + startMinute + durationMinutes;
        const endHour = Math.floor(totalEndMins / 60);
        const endMinute = totalEndMins % 60;

        // Match exact date string YYYY-MM-DD
        const allDates = (datesStr.match(/\b\d{2}-\d{2}-\d{4}\b/g) || []);
        let matchedDate = '';

        for (const dStr of allDates) {
          const [d, m, y] = dStr.split('-').map(n => parseInt(n, 10));
          if (d === dayHeader.dayNumber) {
            matchedDate = `${y}-${pad(m)}-${pad(d)}`;
            break;
          }
        }

        if (!matchedDate && allDates.length > 0) {
          const [d, m, y] = allDates[0].split('-').map(n => parseInt(n, 10));
          matchedDate = `${y}-${pad(m)}-${pad(d)}`;
        }

        if (!matchedDate) {
          matchedDate = `${headerYear}-${pad(headerMonth)}-${pad(dayHeader.dayNumber)}`;
        }

        events.push({
          subject,
          group,
          room,
          teacher,
          date: matchedDate,
          startHour,
          startMinute,
          endHour,
          endMinute,
          durationMinutes,
          dayAbbrev: dayHeader.dayAbbrev,
          dayIndex: dayHeader.dayIndex
        });

        addLog(`      MATCH FOUND @ [${matchedDate} / ${dayHeader.dayAbbrev}] ${pad(startHour)}:${pad(startMinute)}-${pad(endHour)}:${pad(endMinute)} (${durationMinutes}m): "${subject}" in "${room}" (${group})`);
      });
    });

    events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startHour !== b.startHour) return a.startHour - b.startHour;
      return a.startMinute - b.startMinute;
    });

    addLog(`SUCCESS: Extracted ${events.length} total events from Publish calendar view.`);

    const weekStartDate = dayHeaders.length > 0 ? (
      events.length > 0 ? events[0].date : `${headerYear}-${pad(headerMonth)}-${pad(dayHeaders[0].dayNumber)}`
    ) : null;

    const debug = {
      siteType: 'Publish',
      entityName,
      studyGroup: entityName,
      entityDetails,
      headerYear,
      headerMonth,
      dayHeaderCount: dayHeaders.length,
      dayColumnCount: dayColumns.length,
      eventsExtracted: events.length
    };

    return {
      events,
      dayHeaders: dayHeaders.map(d => ({
        dayAbbrev: d.dayAbbrev,
        dayIndex: d.dayIndex,
        date: `${headerYear}-${pad(headerMonth)}-${pad(d.dayNumber)}`
      })),
      academicYear: entityName ? `${entityName} (${headerYear})` : `${headerYear}`,
      studyGroup: entityName,
      year: headerYear,
      weekStartDate,
      debug,
      logText: log.join('\n')
    };
  }

  // =========================================================================
  // PUBLISH STUDENT GROUPS DISCOVERY & TREE EXPANSION
  // =========================================================================

  function getStudentGroupsContainer() {
    const filterGroups = [...document.querySelectorAll('app-filters-panel .filter-group')];
    return filterGroups.find(fg => {
      const text = fg.textContent || '';
      return text.includes('Student Groups') || text.includes('Grupos de Alunos');
    }) || filterGroups.find(fg => fg.querySelector('app-tree-filter'));
  }

  async function expandPublishStudentGroupsTree(addLog) {
    addLog('Expanding Student Groups sidebar tree...');

    const studentGroupSection = getStudentGroupsContainer();
    if (!studentGroupSection) {
      addLog('WARNING: Student Groups section container not found.');
      return false;
    }

    // 1. Ensure the filter group itself is expanded (if collapsed)
    const sectionToggle = studentGroupSection.querySelector('button[aria-expanded="false"]');
    if (sectionToggle) {
      addLog('Opening collapsed Student Groups filter header...');
      sectionToggle.click();
      await sleep(250);
    }

    // 2. Click the "Expand all" button if available in the filter header or navbar
    const expandAllBtn = studentGroupSection.querySelector('button[title*="Expand" i]') ||
                         studentGroupSection.querySelector('button:has(.bi-arrows-expand)') ||
                         document.querySelector('.sidebar-wrapper button[title*="Expand" i]');
    if (expandAllBtn) {
      addLog('Clicking "Expand all" button in sidebar...');
      expandAllBtn.click();
      await sleep(400);
    }

    // 3. Iterative expansion fallback: expand any remaining unexpanded chevrons
    let maxPasses = 6;
    while (maxPasses > 0) {
      const collapsedChevrons = studentGroupSection.querySelectorAll('.chevron:not(.expanded):not(.invisible)');
      if (collapsedChevrons.length === 0) break;
      addLog(`Pass ${7 - maxPasses}: Found ${collapsedChevrons.length} collapsed branches. Expanding...`);
      collapsedChevrons.forEach(ch => {
        const btn = ch.closest('button');
        if (btn) btn.click();
      });
      await sleep(250);
      maxPasses--;
    }

    addLog('Student Groups tree expansion finished.');
    return true;
  }

  function getLeafGroupElements() {
    const studentGroupSection = getStudentGroupsContainer();
    if (!studentGroupSection) return [];

    const treeFilter = studentGroupSection.querySelector('app-tree-filter');
    if (!treeFilter) return [];

    // A leaf group button has chevron.invisible or has no nested ul.tree-list inside its li
    const allItems = [...treeFilter.querySelectorAll('li.tree-item')];
    const leafItems = allItems.filter(li => {
      const childList = li.querySelector(':scope > ul.tree-list');
      const hasInvisibleChevron = li.querySelector(':scope > button .chevron.invisible');
      return !childList || hasInvisibleChevron;
    });

    return leafItems.map((li, index) => {
      const btn = li.querySelector(':scope > button.node-toggle') || li.querySelector('button');
      const groupName = btn?.querySelector('.node-label')?.textContent.trim() || btn?.textContent.trim() || '';

      // Walk up parent li items for Year and Degree context
      const parentYearLi = li.parentElement?.closest('li.tree-item');
      const parentDegreeLi = parentYearLi?.parentElement?.closest('li.tree-item');

      const yearName = parentYearLi?.querySelector(':scope > button.node-toggle .node-label')?.textContent.trim() ||
                       parentYearLi?.querySelector(':scope > button .node-label')?.textContent.trim() || '';

      const degreeName = parentDegreeLi?.querySelector(':scope > button.node-toggle .node-label')?.textContent.trim() ||
                         parentDegreeLi?.querySelector(':scope > button .node-label')?.textContent.trim() ||
                         (parentYearLi ? '' : 'General');

      const fullDegree = degreeName || yearName || 'Other';
      const fullYear = (degreeName && yearName) ? yearName : '';

      return {
        id: index,
        element: btn,
        groupName,
        degree: fullDegree,
        year: fullYear,
        path: [fullDegree, fullYear, groupName].filter(Boolean).join(' > ')
      };
    }).filter(g => g.groupName);
  }

  async function scanPublishStudentGroups(log, addLog) {
    addLog('Starting Student Groups discovery scan on Publish...');
    await expandPublishStudentGroupsTree(addLog);

    const leaves = getLeafGroupElements();
    addLog(`Discovered ${leaves.length} student groups in total.`);

    // Aggregate unique degrees/programs
    const programMap = new Map();
    leaves.forEach(leaf => {
      const prog = leaf.degree || 'Other';
      if (!programMap.has(prog)) {
        programMap.set(prog, { degree: prog, count: 0 });
      }
      programMap.get(prog).count++;
    });

    const programs = Array.from(programMap.values());
    programs.sort((a, b) => a.degree.localeCompare(b.degree));

    leaves.forEach((g, i) => {
      addLog(`  [${i + 1}/${leaves.length}] ${g.path}`);
    });

    return {
      success: true,
      groups: leaves.map(l => ({
        id: l.id,
        groupName: l.groupName,
        degree: l.degree,
        year: l.year,
        path: l.path
      })),
      programs,
      totalCount: leaves.length,
      logText: log.join('\n')
    };
  }

  async function waitForPublishTimetable(targetGroupName, maxWaitMs, addLog) {
    const startTime = Date.now();
    await sleep(250);

    while (Date.now() - startTime < maxWaitMs) {
      if (isBatchCancelled) return false;

      const loadingOverlay = document.querySelector('.loading-overlay');
      const isLoading = loadingOverlay && (
        getComputedStyle(loadingOverlay).display !== 'none' &&
        loadingOverlay.offsetParent !== null
      );

      const entityName = (document.querySelector('.entity-name')?.textContent || '').trim();
      const activeNode = (document.querySelector('app-filters-panel .node-toggle.active .node-label')?.textContent || '').trim();

      const nameMatched = (
        (entityName && targetGroupName && entityName.toLowerCase().includes(targetGroupName.toLowerCase())) ||
        (activeNode && targetGroupName && activeNode.toLowerCase().includes(targetGroupName.toLowerCase()))
      );

      if (!isLoading && nameMatched) {
        // DOM settle delay
        await sleep(200);
        return true;
      }

      await sleep(150);
    }

    addLog(`Notice: Timetable wait timeout (${maxWaitMs}ms) for "${targetGroupName}". Proceeding with current DOM state.`);
    return true;
  }

  // =========================================================================
  // BATCH EXTRACTION CONTROLLER
  // =========================================================================
  async function runBatchExtraction(options, log, addLog) {
    const { groupIds, weeksCount = 15 } = options;
    isBatchCancelled = false;

    addLog('=== Starting Batch Timetable Extraction ===');
    addLog(`Target group count: ${groupIds ? groupIds.length : 'ALL'}`);
    addLog(`Semester weeks: ${weeksCount}`);

    // Ensure tree is fully expanded
    await expandPublishStudentGroupsTree(addLog);
    const leafElements = getLeafGroupElements();

    if (leafElements.length === 0) {
      addLog('ERROR: No student group elements found in sidebar tree.');
      return {
        error: 'No student group elements found in the sidebar tree. Please make sure the Student Groups section is visible.',
        results: [],
        logText: log.join('\n')
      };
    }

    // Filter target groups
    const targets = (groupIds && groupIds.length > 0)
      ? leafElements.filter(l => groupIds.includes(l.id))
      : leafElements;

    addLog(`Total target student groups to process: ${targets.length}`);

    const results = [];
    let totalClassesExtracted = 0;

    for (let i = 0; i < targets.length; i++) {
      if (isBatchCancelled) {
        addLog('CANCELLED: Batch extraction cancelled by user.');
        break;
      }

      const target = targets[i];
      addLog(`--------------------------------------------------`);
      addLog(`[${i + 1}/${targets.length}] Selecting group: "${target.groupName}" (${target.path})`);

      // Notify popup of progress
      try {
        chrome.runtime.sendMessage({
          action: 'batchProgress',
          current: i + 1,
          total: targets.length,
          groupName: target.groupName,
          path: target.path,
          status: 'extracting',
          totalClasses: totalClassesExtracted
        });
      } catch (e) {
        // Popup might have closed or not listening, continue gracefully
      }

      try {
        // Click the node button
        if (target.element) {
          target.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          target.element.click();
        } else {
          // Re-query by path/name if reference became stale
          const currentLeaves = getLeafGroupElements();
          const match = currentLeaves.find(cl => cl.groupName === target.groupName && cl.path === target.path);
          if (match && match.element) {
            match.element.scrollIntoView({ block: 'nearest' });
            match.element.click();
          }
        }

        // Wait for calendar to update
        await waitForPublishTimetable(target.groupName, 5000, addLog);

        // Extract timetable
        const extractResult = extractPublishTimetable(log, addLog);

        if (extractResult && extractResult.events) {
          const eventCount = extractResult.events.length;
          totalClassesExtracted += eventCount;
          results.push({
            groupName: target.groupName,
            degree: target.degree,
            year: target.year,
            path: target.path,
            events: extractResult.events,
            weekStartDate: extractResult.weekStartDate,
            academicYear: extractResult.academicYear,
            eventCount: eventCount,
            error: null
          });
          addLog(`Result for "${target.groupName}": ${eventCount} classes found.`);
        } else {
          const errMsg = extractResult?.error || 'No events could be parsed';
          addLog(`WARNING for group "${target.groupName}": ${errMsg}. Continuing to next group...`);
          results.push({
            groupName: target.groupName,
            degree: target.degree,
            year: target.year,
            path: target.path,
            events: [],
            weekStartDate: null,
            eventCount: 0,
            error: errMsg
          });
        }
      } catch (err) {
        // As requested: "if errors are encountered indicate in the log and continue"
        addLog(`ERROR while processing "${target.groupName}": ${err.message}. Continuing to next group...`);
        results.push({
          groupName: target.groupName,
          degree: target.degree,
          year: target.year,
          path: target.path,
          events: [],
          weekStartDate: null,
          eventCount: 0,
          error: err.message
        });
      }

      // Small pause between clicks to be gentle on browser
      await sleep(200);
    }

    addLog('==================================================');
    addLog(`Batch extraction completed. Processed ${results.length}/${targets.length} groups.`);
    addLog(`Total classes extracted across all groups: ${totalClassesExtracted}`);

    return {
      success: true,
      cancelled: isBatchCancelled,
      results,
      totalClasses: totalClassesExtracted,
      totalGroups: results.length,
      logText: log.join('\n')
    };
  }

  // =========================================================================
  // MAIN ROUTER & MESSAGE DISPATCHER
  // =========================================================================

  function extractTimetable() {
    const log = [];
    const addLog = (msg) => log.push(`[${new Date().toISOString()}] ${msg}`);

    addLog('=== Nova IMS Timetable Extraction Log ===');
    addLog(`URL: ${window.location.href}`);
    addLog(`Document Title: ${document.title}`);

    // Check for Netpa timetable table (#tabhorarionew)
    const netpaTable = document.getElementById('tabhorarionew');
    if (netpaTable) {
      addLog('Site Detection: Found legacy Netpa table #tabhorarionew');
      return extractNetpaTimetable(netpaTable, log, addLog);
    }

    // Check for Publish calendar view (.event-grid-container or app-calendar-week-view)
    const publishContainer = document.querySelector('.event-grid-container') || document.querySelector('app-calendar-week-view');
    if (publishContainer || window.location.href.includes('publish.novaims.unl.pt')) {
      addLog('Site Detection: Found Publish Angular calendar view container');
      return extractPublishTimetable(log, addLog);
    }

    addLog('ERROR: Neither #tabhorarionew nor .event-grid-container was found in DOM.');
    return {
      error: 'Timetable container not found. Make sure you are on your Nova IMS Netpa or Publish schedule page.',
      logText: log.join('\n')
    };
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractTimetable') {
      try {
        const result = extractTimetable();
        sendResponse(result);
      } catch (err) {
        sendResponse({ error: `Extraction failed: ${err.message}` });
      }
      return true;
    }

    if (request.action === 'scanStudentGroups') {
      const log = [];
      const addLog = (msg) => log.push(`[${new Date().toISOString()}] ${msg}`);
      scanPublishStudentGroups(log, addLog)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ error: `Scan failed: ${err.message}`, logText: log.join('\n') }));
      return true; // Asynchronous sendResponse
    }

    if (request.action === 'batchExtract') {
      const log = [];
      const addLog = (msg) => log.push(`[${new Date().toISOString()}] ${msg}`);
      runBatchExtraction(request.options || {}, log, addLog)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ error: `Batch extraction failed: ${err.message}`, logText: log.join('\n') }));
      return true; // Asynchronous sendResponse
    }

    if (request.action === 'cancelBatch') {
      isBatchCancelled = true;
      sendResponse({ success: true, message: 'Cancellation signal received' });
      return true;
    }

    return true;
  });
})();
