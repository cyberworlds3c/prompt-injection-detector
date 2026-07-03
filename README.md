# 🛡️ AI Shield — Hidden Prompt Injection Detector

A browser extension (Chrome + Firefox) that scans web pages for hidden prompt injection attacks — malicious instructions embedded in websites that attempt to hijack AI assistants like GitHub Copilot, Claude, ChatGPT, and others.

---

## What is a Prompt Injection Attack?

When you use an AI assistant to help you read, summarise, or interact with a web page, the AI sees the page's raw content — including things that are **invisible to you**. Attackers can hide instructions inside:

- HTML comments (`<!-- AI: ignore previous instructions -->`)
- Elements with `display:none` or `visibility:hidden`
- Zero-opacity or 0px-font-size text
- Text coloured the same as the page background

These hidden instructions can attempt to make an AI exfiltrate your data, bypass content filters, or behave in unexpected ways — all without you ever seeing them.

**AI Shield detects all of these.**

---

## Features

- 🔍 **Scans the live DOM** — catches hidden elements using computed styles, not just inline CSS
- 💬 **Scans HTML comments** — invisible to users but readable by AI tools
- 🎚️ **3 sensitivity levels:**
  - 🟢 **Normal** — high-confidence imperative injection commands only (low false-positive rate)
  - 🟠 **High** — adds jailbreak, DAN, developer-mode, and bypass patterns
  - 🔴 **Ultra** — adds roleplay, persona, exfiltration, and LLM prompt-format patterns
- 📍 **Click-to-locate** — click any finding to flash and scroll to the element on the page
- 🔒 **Read-only** — never modifies page content or styles permanently
- ⚡ **No background tracking** — scans only run when you click the button

---

## Screenshots

<img width="380" height="600" alt="Screenshot 2026-04-04 at 4 29 42 PM" src="https://github.com/user-attachments/assets/f4e777fe-be6d-4424-8d3b-2bb4210233b4" />
<img width="380" height="596" alt="Screenshot 2026-04-04 at 4 29 33 PM" src="https://github.com/user-attachments/assets/9e7067f3-8ff8-4ee9-b85e-15bd7b25fa14" />

---

## Installation

As a add-on: https://addons.mozilla.org/en-US/firefox/addon/prompt-injection-detector/

### Manual Install — Chrome

1. Clone or download this repository
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the extension folder
5. Click the AI Shield icon to open the side panel

### Manual Install — Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file inside the extension folder
4. Click the AI Shield icon in the toolbar to open the popup

---

## Usage

1. Navigate to any web page
2. Click the **AI Shield** icon in the Chrome toolbar
3. Select a sensitivity level (Normal is recommended for everyday use)
4. Click **Scan Page**
5. Review any findings — click a finding card to highlight the element on the page

---

## Demo

A realistic demo page (`demo-malicious-site.html`) is included. It mimics a legitimate recipe website with **6 hidden prompt injection attacks** embedded using different techniques:

| # | Technique                              | Detected at  |
| - | -------------------------------------- | ------------ |
| 1 | HTML comment (`<!-- AI: ... -->`)    | All levels   |
| 2 | `display:none` div                   | All levels   |
| 3 | Zero-opacity span                      | All levels   |
| 4 | Same-colour-as-background text         | All levels   |
| 5 | `assistant:` comment (prompt format) | High + Ultra |
| 6 | `visibility:hidden` element          | High + Ultra |
| 7 | `system:` comment (prompt format)    | Ultra only   |
| 8 | `[INST]` comment (Llama format)      | Ultra only   |
| 9 | Hidden roleplay/persona element        | Ultra only   |

Open the file in Chrome, then run the extension on it to see all detections in action.

### Running the demo locally

Because Chrome restricts extensions from scanning `file://` URLs, serve the demo over HTTP:

```bash
cd ai-shield-extension
python3 -m http.server 8080
```

Then open **http://localhost:8080/demo-malicious-site.html** in Chrome and scan with AI Shield.

---

## Detection Patterns

The scanner uses three layers of regex patterns:

**Always flagged (Normal+)**
- `ignore * previous * instructions`
- `your new instructions are`
- `from now on you will/must/should`
- `you have been reprogrammed`
- `override your training`
- `new system prompt:`

**Flagged at High+**
- `do not tell the user`
- `developer mode enabled`
- `DAN mode`
- `bypass safety/filters`
- `jailbreak`

**Flagged at Ultra**
- `you are now acting as`
- `roleplay as` / `simulate being`
- `exfiltrate`
- LLM prompt formats (`[INST]`, `<|im_start|>`, `system:`, `human:`)

Hidden elements always produce **HIGH** severity regardless of sensitivity level. Visible text with the same patterns produces **MEDIUM**.

---

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Grants temporary access to the current tab when you click the extension icon |
| `scripting` | Inject the scanner script into the active tab on demand |
| `sidePanel` | Display results in the Chrome side panel |
| `host_permissions: http/https` | Required for `scripting.executeScript` — scoped to http/https only, excludes browser-internal pages |

The extension **never** sends any data off-device. All scanning happens locally in your browser.

---

## Privacy

This extension collects no personal data, sends no telemetry, and makes no network requests. The scanner runs entirely in-browser. See [PRIVACY.md](PRIVACY.md) for the full policy.

---

## Contributing

Issues and pull requests are welcome. If you discover a new injection technique that isn't detected, please open an issue with an example.

---

## License

MIT
