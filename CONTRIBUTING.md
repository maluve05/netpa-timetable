# Contributing to Nova IMS Timetable Export

Thank you for your interest in contributing to **Nova IMS Timetable Export**! We welcome bug fixes, improvements, and documentation enhancements from the community.

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- A Chromium-based browser (Google Chrome, Microsoft Edge, Brave, etc.)
- A code editor (VS Code, Cursor, etc.)

### Local Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/netpa-timetable.git
   cd netpa-timetable
   ```

2. **Load the extension in Developer Mode:**
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable the **Developer mode** toggle in the top right.
   - Click **Load unpacked** in the top left.
   - Select the `extension/` directory inside this repository.

3. **Verify the development environment:**
   ```bash
   npm run validate
   ```

---

## 💻 Development Workflow

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Modify files in `extension/` (`popup.html`, `popup.css`, `popup.js`, `content.js`, `background.js`).
   - Keep code modular, well-commented, and aligned with Manifest V3 best practices.

3. **Reload Extension to Test:**
   - After editing files, go to `chrome://extensions` and click the **Reload icon** 🔄 on the extension card.
   - Navigate to `netpa.novaims.unl.pt` or `publish.novaims.unl.pt/Timetable/calendar` to test your changes.

4. **Run Validation Checks:**
   ```bash
   npm run validate
   ```

5. **Test Production Packaging:**
   ```bash
   npm run package
   ```
   Ensure the output `.zip` in `dist/` builds without errors.

---

## 📋 Code Guidelines

- **Manifest V3 Only**: Never introduce Manifest V2 APIs or patterns.
- **Pure JavaScript & CSS**: Keep the extension lightweight and free of heavyweight frameworks or external runtime bundling steps.
- **Asynchronous Code**: Always prefer `async/await` over `.then()` chains.
- **CSP Compliance**: No inline scripts in HTML files (`<script src="..."></script>` only) and never use `eval()` or `new Function()`.
- **Zero Telemetry / Privacy First**: The extension must never transmit student schedule data, credentials, or metrics to external servers.
- **Resilient Selectors**: When modifying DOM parsing selectors for Netpa or Publish, use fallback strategies and descriptive log messages so that student exports don't break silently if Nova IMS updates portal styling.

---

## 🚀 Submitting a Pull Request

1. Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Open a Pull Request against the `main` branch.
3. Provide a clear summary of your changes in the PR description, referencing any related issues.
4. Ensure all automated validation checks pass.

---

## 🐞 Reporting Bugs & Requesting Features

- **Bug Reports**: Please use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md). Include browser version, the specific Nova IMS portal (Netpa or Publish), and attach the exported debug log (`.txt`) if possible.
- **Feature Requests**: Open an issue using the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md).

Thank you for helping make university life easier for Nova IMS students!
