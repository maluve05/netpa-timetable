# Privacy Policy for Nova IMS Timetable Export

*Last updated: August 20, 2026*

**Nova IMS Timetable Export** ("the Extension") is committed to protecting your privacy. This Privacy Policy explains our practices regarding data collection, usage, and disclosure when you use our browser extension.

---

## 1. Zero Data Collection

The Extension operates on a strict **Zero Data Collection** principle:

- **No Personal Information Collected**: We do not collect, store, transmit, or sell your name, student ID, login credentials, course registrations, IP address, browsing history, or any other personally identifiable information (PII).
- **No External Servers**: The Extension does not connect to any third-party servers, remote APIs, cloud storage, or external databases. All parsing, `.ics` file generation, and `.zip` compression occur entirely within your browser's local sandbox.
- **No Analytics or Telemetry**: There are no analytics libraries, trackers, cookies, or telemetry embedded in the Extension.

---

## 2. How Your Timetable Data is Handled

When you click **Export .ics** or **Batch Export**:

1. The content script temporarily reads schedule elements currently displayed in the DOM of `netpa.novaims.unl.pt` or `publish.novaims.unl.pt`.
2. The parsed data (course names, classroom locations, time intervals) is transferred in-memory to the extension popup.
3. The popup compiles this data into a standard iCalendar (`.ics`) file or `.zip` archive.
4. The file is saved locally to your device via the standard browser Downloads API.
5. All in-memory data is discarded as soon as the popup is closed or the page is refreshed.

---

## 3. Permissions Used

The Extension requests only the minimum permissions necessary to function:

| Permission | Purpose |
| :--- | :--- |
| `activeTab` | Grants temporary access to read the DOM of your active timetable page when you click the extension popup. |
| `scripting` | Allows execution of the timetable extractor script on the active Nova IMS schedule page. |
| `downloads` | Saves the generated `.ics` and `.zip` files directly to your local computer. |
| `matches` (`netpa.novaims.unl.pt`, `publish.novaims.unl.pt`) | Restricts the content script to run only on official Nova IMS timetable domains. |

---

## 4. Third-Party Services & Web Fonts

- The extension popup loads the open-source **Inter** font stylesheet from Google Fonts for styling purposes. No cookies or user identifiers are exchanged with Google Fonts.
- **JSZip** (`jszip.min.js`) is bundled locally inside the extension package for in-browser archive generation without external dependencies.

---

## 5. Changes to This Privacy Policy

If any changes are made to this policy, the updated version will be posted in this repository with an updated revision date.

---

## 6. Open Source Verification & Contact

The Extension is fully open source. You can inspect the entire codebase, scripts, and build artifacts at:
**[https://github.com/maluve05/netpa-timetable](https://github.com/maluve05/netpa-timetable)**

If you have any questions or privacy concerns, please open an issue on GitHub:
**[https://github.com/maluve05/netpa-timetable/issues](https://github.com/maluve05/netpa-timetable/issues)**
