# Infinite Canvas

> Transform any live webpage into an interactive, connected spatial canvas—directly inside the current tab without opening a new window.

Infinite Canvas is an open-source **Chrome Extension (Manifest V3)** built with React 19, TypeScript, Vite, React Flow (`@xyflow/react`), Three.js + React Three Fiber (lazy-loaded 3D Space mode), Zustand, and Tailwind CSS. All data stays **100% local** in your browser—zero analytics, zero tracking, zero external servers.

---

## Core Features

- **1-Click In-Page Spatial Transformation** — Visit any website and click the **Infinite Canvas** toolbar icon (or press `Alt + Shift + C`). Without opening a new tab, the active page's original view is cleanly hidden while preserving its live DOM, and Infinite Canvas takes over the page's viewport. Press `Esc`, click **Exit**, or click the icon again to return to the original page instantly.
- **Automatic Per-Section Visual Screenshots** — Scans the live page's semantic sections (`Header`, `Navigation`, `Hero`, `Sections`, `Forms`, `Sidebar`, `Footer`), captures unique viewport bands (temporarily hiding sticky headers on lower bands), and crops each section's real visual UI into its own browser-framed preview card.
- **Live Interactive Page Buttons** — Extracts visible buttons, links, and inputs inside every section and displays them as clickable controls right on each card. Clicking any button closes the canvas, scrolls smoothly to the real element on the page, highlights it, and triggers it live.
- **Connected Spatial Flow Layout** — Arranges the Page Hub, navigation/control cards, and visual section previews in a clean left-to-right spatial architecture connected by smooth curved Bezier arrows, with a warm sand/peach canvas aesthetic, bottom `/` command search bar, zoom controls, and minimap.
- **Lazy-Loaded 3D Orbital Space Mode** — Click **3D Space** anytime to explore the same captured universe in a Three.js / React Three Fiber 3D environment with starfield, instanced particles, damped OrbitControls, `WASD` flight navigation, spatial clusters, radar minimap, and detail drawer.
- **Multiple Canvases, Undo/Redo & Safe JSON Import/Export** — Manage independent canvases, undo/redo changes, and export or import validated, sanitized JSON backups.
- **Chrome Side Panel & Context Menus** — Quick access to saved canvases, live search, and right-click link capture.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt + Shift + C` | Toggle Infinite Canvas on the current webpage |
| `/` | Focus bottom command / section search bar |
| `Esc` | Clear search / exit focused panel / return to live webpage |
| `Space + Drag` | Pan canvas |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` (or `Ctrl/Cmd + Y`) | Redo |
| `Ctrl/Cmd + A` | Select all cards |
| `Delete` / `Backspace` | Delete selected cards or connections |
| `Ctrl/Cmd + S` | Save workspace immediately |
| `WASD` / `F` / `R` / `+` / `-` | 3D Space navigation, focus, reset camera, zoom |

---

## Installation (Load Unpacked in Chrome)

1. Clone this repository and install dependencies:
   ```bash
   git clone https://github.com/ibrahimmcx/infinitecanvas.git
   cd infinitecanvas
   npm install
   ```
2. Build the production extension bundle:
   ```bash
   npm run build
   ```
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the generated `dist/` folder.
6. Pin **Infinite Canvas** in your Chrome toolbar, open any website, and click the icon.

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
├── background/          # MV3 Service Worker (DOM structure scan, section cropper, in-page host mount, context menus)
├── canvas/
│   ├── components/      # TopToolbar, CanvasSidebar, CosmicBokehBackground, ZoomControls, Modals
│   ├── nodes/           # Resizable WebsiteNode with real section screenshot & live page button triggers
│   ├── edges/           # Curved Bezier CanvasEdge with editable labels & animation
│   ├── hooks/           # Keyboard shortcuts & Space-pan hook
│   └── store/           # Zustand store (multi-canvas, undo/redo, debounced persistence)
├── spatial/
│   ├── SpatialApp.tsx   # Mode coordinator (Spatial Flow default + lazy-loaded 3D Space)
│   ├── Spatial3DView.tsx# Lazy-loaded Three.js / React Three Fiber 3D scene
│   ├── camera/          # Smooth damped CameraRig (OrbitControls + WASD + focus transitions)
│   ├── components/      # SpatialOverlayHUD (radar minimap, clusters) & SpatialDetailDrawer
│   ├── effects/         # AmbientSpace (stars, fog, instanced particles, orbital rings)
│   ├── objects/         # WebsitePanel3D & animated 3D ConnectionLines3D
│   └── utils/           # 3D orbital layout & WebGL capability detection
├── sidepanel/           # Chrome Side Panel (canvas switcher, quick capture, live search)
├── popup/               # Standalone popup capture view
├── onboarding/          # 6-step interactive first-time onboarding modal
└── shared/
    ├── components/      # Reusable Favicon with graceful fallback
    ├── storage/         # Modular IStorageAdapter (ChromeStorageAdapter + IndexedDBAdapter)
    ├── styles/          # Tailwind CSS v4 + React Flow studio overrides
    ├── types/           # Strict TypeScript interfaces for canvases, nodes, sections, edges
    └── utils/           # URL sanitization, JSON import validation, Chrome API isolation
```

### Storage Abstraction

Persistence is isolated behind `IStorageAdapter` (`src/shared/storage/types.ts`):
- **`ChromeStorageAdapter`** (default): Persists workspaces in `chrome.storage.local` and synchronizes live across views via `chrome.storage.onChanged`.
- **`IndexedDBAdapter`**: Included as a drop-in adapter (`src/shared/storage/indexedDbAdapter.ts`) for larger local datasets without changing UI components.

---

## Chrome Permissions Explained

Infinite Canvas requests only the minimum permissions required for its core features:

| Permission | Why It Is Needed |
| --- | --- |
| `storage` | Persists your canvases, section cards, connections, and preferences locally in `chrome.storage.local`. |
| `activeTab` | Reads the active tab and captures visible-tab screenshots when you click the extension icon. |
| `scripting` | Scans the active page's real sections and buttons (read-only), temporarily hides sticky headers during band capture, and swaps the page's viewport in-place with Infinite Canvas. |
| `tabs` | Allows the Side Panel to display active tab info and lets the extension focus an open full-tab Canvas. |
| `contextMenus` | Adds right-click actions to launch Infinite Canvas on the current page or save links. |
| `sidePanel` | Enables the Chrome Side Panel workspace view alongside your browsing. |

### Privacy Guarantee

- **Zero analytics or telemetry.**
- **Zero external servers.** Your browsing activity, screenshots, and canvases remain 100% local in your browser unless you manually export a JSON file.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.

## License

MIT — see [LICENSE](./LICENSE) for details.
