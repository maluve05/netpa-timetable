# Chrome Web Store Listing Package

> **Single Source of Truth** for Chrome Developer Dashboard submission metadata, permission justifications, privacy disclosures, and store copy for **Nova IMS Timetable Export**.

---

## 1. Store Listing Metadata

| Field | Value |
| :--- | :--- |
| **Extension Name** | Nova IMS Timetable Export |
| **Version** | `1.2.0` |
| **Default Language** | English (en) |
| **Primary Category** | Productivity |
| **Secondary Category** | Academic |
| **Short Description** *(max 132 chars)* | Export single or batch Nova IMS timetables from Netpa & Publish directly to .ics or .zip for Google Calendar & Apple Calendar. |
| **Website URL** | `https://github.com/maluve05/netpa-timetable` |
| **Support URL** | `https://github.com/maluve05/netpa-timetable/issues` |

---

## 2. Detailed Store Description

```markdown
Export your Nova IMS class schedules directly into Google Calendar, Apple Calendar, or Outlook with one click!

Nova IMS Timetable Export is a fast, lightweight, and privacy-first browser extension designed for Nova Information Management School (Universidade NOVA de Lisboa) students, faculty, and academic coordinators.

✨ KEY FEATURES

📅 Dual Portal Compatibility
• Supports the modern Nova IMS Publish Calendar portal (publish.novaims.unl.pt)
• Supports the classic Netpa portal (netpa.novaims.unl.pt)

🚀 1-Click Single Timetable Export
• Extract your active weekly timetable into a standard .ics (iCalendar) file.
• Automatic detection of course titles, classrooms, section groups (e.g., TP01, T02), and professors.
• Custom semester recurrence duration (default: 15 weeks).

📦 Batch Export for Entire Degrees & Student Groups
• Automated scanning and tree expansion of all student groups in the Publish sidebar.
• Filter by degree/program or export all groups simultaneously.
• Download all schedules packaged cleanly in a single .zip file organized by folders: Degree / Year / Group.ics.

🌍 Timezone & Daylight Saving Time Compliant
• Built-in Europe/Lisbon timezone support (WET/WEST transitions) ensures that class start and end times never shift unexpectedly.

🔒 100% Private & Client-Side
• Runs entirely within your browser.
• Zero telemetry, zero analytics, zero external network requests, and zero data collection.

🐞 Built-in Diagnostic Logger
• Download detailed diagnostic logs (.txt) with one click if needed.

------------------------------------------------------------
HOW TO USE:
1. Log into your Nova IMS schedule on Netpa or the Publish calendar portal.
2. Click the Nova IMS Timetable Export extension icon in your browser toolbar.
3. Select your desired semester duration and click "Export .ics" (or use "Batch Export" on Publish).
4. Import the downloaded .ics file into Google Calendar, Apple Calendar, or Outlook!
------------------------------------------------------------
```

---

## 3. Permissions Justifications

The Chrome Web Store review team requires specific, functional reasons for each requested permission:

### `activeTab`
> **Justification**: Needed to access and parse the currently active Nova IMS timetable webpage (either Netpa or Publish) when the user explicitly clicks on the extension action popup.

### `scripting`
> **Justification**: Used to execute DOM parsing scripts inside the active Nova IMS schedule tab to extract timetable metadata (events, course names, room assignments, times, and student group trees).

### `downloads`
> **Justification**: Used to initiate and save the generated `.ics` calendar files and `.zip` archives directly to the user's local Downloads folder with appropriate, clean filenames.

### `content_scripts` / Host Patterns (`*://netpa.novaims.unl.pt/*`, `*://publish.novaims.unl.pt/*`)
> **Justification**: Scoped strictly to official Nova Information Management School timetable portals to inspect timetable grid elements and perform batch section scraping when requested by the student.

---

## 4. Privacy & Data Use Disclosures

In the Chrome Developer Dashboard **Privacy** tab:

1. **Single Purpose Description**:
   > *This extension has a single purpose: to parse Nova IMS academic timetables on university portals and export them into standard iCalendar (.ics) files or .zip archives for personal calendar synchronization.*

2. **Data Usage Declarations**:
   - **Does this extension collect or transmit user data?** `No`.
   - **Authentication / Credentials collected?** `No`.
   - **Personal Communications collected?** `No`.
   - **Location data collected?** `No`.
   - **Web history collected?** `No`.
   - **Financial or payment info collected?** `No`.

3. **Privacy Policy URL**:
   > `https://github.com/maluve05/netpa-timetable/blob/main/PRIVACY.md`

---

## 5. Visual Assets Checklist

- [x] **Small Icon (16×16px)**: `extension/icons/icon16.png`
- [x] **Medium Icon (48×48px)**: `extension/icons/icon48.png`
- [x] **Large Icon (128×128px)**: `extension/icons/icon128.png`
- [ ] **Store Screenshot 1 (1280×800 or 640×400)**: Single Export popup active on Publish portal.
- [ ] **Store Screenshot 2 (1280×800 or 640×400)**: Batch Export popup showing student group scanner & progress bar.
- [ ] **Small Promo Tile (440×280px)** *(optional)*: Nova IMS Timetable Export banner.
- [ ] **Marquee Promo Tile (1400×560px)** *(optional)*: Full banner graphic.

---

## 6. Pre-Submission Verification

- [x] `manifest_version: 3` verified.
- [x] All icon paths in `manifest.json` resolve to valid PNG files.
- [x] No `eval()`, `new Function()`, or inline `<script>` tags used.
- [x] Background service worker uses `chrome.storage` / ephemeral architecture without global persistent memory state.
- [x] Package ZIP is clean and contains only extension files (`npm run package`).
