# Infinite Canvas

> Transform ordinary web browsing into a visual spatial workspace. Collect websites, organize them spatially, connect related pages, and build infinite canvases directly inside Chrome.

Infinite Canvas is an open-source **Chrome Extension (Manifest V3)** built with React, TypeScript, Vite, React Flow (`@xyflow/react`), Zustand, and Tailwind CSS. All data is stored **100% locally**—no analytics, no cloud tracking, and no browsing history transmission.

---

## Core Features

- **Instant 1-Click 3D Spatial Overlay** — Visit any website and click the **Infinite Canvas** toolbar icon (or press `Alt+Shift+C`). Without opening a new tab, the active website immediately transforms into a floating 3D spatial universe right over the page—complete with its captured screenshot thumbnail, metadata, and real connected links/sections orbiting in 3D space. Click **Exit** (or press `Esc` / click the icon again) to return to the page untouched.
- **3D Spatial Engine (Three.js + React Three Fiber)** — Atmospheric dark space, depth fog, distant starfield, instanced ambient particles, soft studio lighting, glowing animated 3D connections, smooth damped camera transitions, and radar minimap.
- **Full Mouse & Keyboard Navigation** — Left-drag to orbit, scroll to zoom, `WASD` / Arrow keys to fly, `Shift + Drag` to reposition 3D panels, click to focus, double-click to open the original website, `F` to focus, `R` to reset camera, `+/-` to zoom.
- **2D Canvas Fallback Mode** — Automatic fallback if WebGL is unavailable, plus a 1-click **3D ↔ 2D** toggle in the bottom HUD to switch into the full React Flow 2D workspace anytime.
- **Spatial Clusters & Detail Drawer** — Organize panels into clusters (`Research`, `Design`, `Development`, `Inspiration`, `Products`, `Resources`, or custom clusters), edit notes/tags, and jump across connected links.
- **Chrome Side Panel & Context Menus** — Quick access to canvases, search, and right-click link capture.
- **Safe JSON Import / Export** — Export individual universes or full backups; imported JSON is strictly validated and sanitized before saving.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt + Shift + C` | Open Infinite Canvas quick-capture popup |
| `Space + Drag` | Pan canvas |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` (or `Ctrl/Cmd + Y`) | Redo |
| `Ctrl/Cmd + A` | Select all cards |
| `Delete` / `Backspace` | Delete selected cards or connections |
| `Ctrl/Cmd + S` | Save project immediately |

---

## Installation (Load Unpacked in Chrome)

1. Clone this repository and install dependencies:
   ```bash
   npm install
   ```
2. Build the production extension bundle:
   ```bash
   npm run build
   ```
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the generated `dist/` folder.
6. Pin **Infinite Canvas** in your Chrome toolbar for one-click access.

---

## Development & Build Commands

```bash
# Start Vite dev server (preview canvas UI in browser)
npm run dev

# Strict TypeScript type-checking
npm run typecheck

# Run unit tests (URL sanitization & JSON import validation)
npm test

# Typecheck + production Manifest V3 build into dist/
npm run build
```

---

## Architecture Overview

```text
src/
├── background/          # MV3 Service Worker (context menus, messaging, tab focus)
├── popup/               # Compact toolbar popup for one-click page capture
├── sidepanel/           # Chrome Side Panel (quick capture, canvas switcher, live search)
├── canvas/
│   ├── components/      # TopToolbar, CanvasSidebar, ZoomControls, Add/ImportExport Modals
│   ├── nodes/           # Resizable WebsiteNode card component
│   ├── edges/           # Custom labeled & animated CanvasEdge component
│   ├── hooks/           # Keyboard shortcuts & Space-pan hook
│   └── store/           # Zustand store (multi-canvas, undo/redo, debounced persistence)
├── onboarding/          # 6-step interactive first-time onboarding modal
└── shared/
    ├── components/      # Reusable Favicon with graceful fallback
    ├── storage/         # Modular IStorageAdapter (ChromeStorageAdapter + IndexedDBAdapter)
    ├── styles/          # Tailwind CSS + dark studio React Flow overrides
    ├── types/           # Explicit TypeScript interfaces for canvases, nodes, edges, messages
    └── utils/           # URL validation, JSON import schema validation, Chrome API isolation
```

### Storage Abstraction

Persistence is isolated behind the `IStorageAdapter` interface (`src/shared/storage/types.ts`):
- **`ChromeStorageAdapter`** (default): Persists workspaces in `chrome.storage.local` and synchronizes live across Popup, Side Panel, and Canvas tabs via `chrome.storage.onChanged`.
- **`IndexedDBAdapter`**: Included as a drop-in adapter (`src/shared/storage/indexedDbAdapter.ts`) for larger local datasets without changing UI components.

---

## Chrome Permissions Explained

Infinite Canvas requests only the minimum permissions required for its core features:

| Permission | Why It Is Needed |
| --- | --- |
| `storage` | Persists your spatial universes, panels, connections, camera positions, and preferences locally in `chrome.storage.local`. |
| `activeTab` | Reads the active tab and captures its visible thumbnail when you click the extension icon. |
| `scripting` | Extracts real page metadata/links (read-only) and mounts/unmounts the isolated full-screen 3D overlay directly on the active page when clicked. |
| `tabs` | Allows the Side Panel to read active tab info and lets the extension focus an existing full-tab Canvas if opened. |
| `contextMenus` | Adds right-click actions to launch the 3D spatial view or save links. |
| `sidePanel` | Enables the Chrome Side Panel workspace view alongside your browsing. |

### Privacy Guarantee

- **Zero analytics or telemetry.**
- **Zero external servers.** Your browsing activity and canvases never leave your browser unless you manually export a JSON file.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.

## License

MIT — see [LICENSE](./LICENSE) for details.
