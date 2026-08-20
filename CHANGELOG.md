# Changelog

All notable changes to the **Nova IMS Timetable Export** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-08-20

### Added
- **Modern Publish Portal Integration**: Full support for `https://publish.novaims.unl.pt/Timetable/calendar` Angular calendar view (`app-calendar-week-view`, `.event-grid-container`).
- **Automated Batch Student Groups Scanner**: Automatic sidebar tree expansion (`app-tree-filter`) and discovery of all degree programs, academic years, and study groups.
- **Batch ZIP Archive Packaging**: Client-side ZIP bundling using embedded `JSZip`, allowing full-degree exports into a single download.
- **Folder Nesting Option**: Configurable folder organization inside `.zip` (`[Program] / [Year] / [Group].ics`).
- **Interactive Stepper**: Semester duration selector allowing customizable recurrence from 1 to 52 weeks (default: 15 weeks).
- **Live Progress & Diagnostics UI**: Real-time batch progress bar, active group name badges, and error-tolerant iteration.
- **Diagnostic Log Download**: 1-click download of verbose `.txt` extraction logs for both single and batch operations.
- **Comprehensive Repository Tooling**: Added `scripts/validate.js` and `scripts/package.js` for zero-dependency validation and store packaging.

### Improved
- Modernized extension popup interface with smooth transitions, dark-mode styling, tab navigation, and live previews.
- Enhanced event deduplication and sorting by date, start hour, and minute.

---

## [1.1.0] - 2026-08-15

### Added
- **Timezone Compliance**: Integrated explicit `Europe/Lisbon` `VTIMEZONE` definitions (`WET`/`WEST` daylight savings) to avoid calendar time drift.
- **Background Service Worker**: Added `background.js` using `chrome.downloads.onDeterminingFilename` to prevent Chrome from defaulting data URIs to random UUID filenames.

### Fixed
- Fixed Netpa table multi-rowspan tracking when classes span multiple 30-minute time intervals.
- Corrected academic year detection from `gotoDate` script handlers.

---

## [1.0.0] - 2026-08-01

### Added
- Initial release with Google Chrome **Manifest V3** support.
- Legacy **Netpa** timetable parser (`netpa.novaims.unl.pt` `#tabhorarionew`).
- Export to standard iCalendar (`.ics`) file format with weekly recurrence rules (`RRULE`).
- Extraction of subject, classroom, section group, and duration into event details.
