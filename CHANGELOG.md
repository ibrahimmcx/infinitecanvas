# Changelog

All notable changes to **Infinite Canvas** will be documented in this file.

## [1.0.0] - 2026-11-20

### Added
- **Manifest V3 Extension Architecture**: Background service worker, compact Popup, Chrome Side Panel, and full-page Canvas Workspace.
- **Infinite Canvas Engine**: Powered by `@xyflow/react` with smooth pan/zoom, multi-selection, minimap, zoom controls, fit-to-view, grid styles (`dots`, `lines`, `cross`, `none`), and snap-to-grid.
- **Website Cards**: Metadata-driven cards with favicon fallbacks, optional compressed screenshot thumbnails, inline title/note editing, tags, 7 muted accent colors, 3 layout variants (`standard`, `compact`, `featured`), resizing, duplicating, and deleting.
- **Custom Visual Connections**: 4-sided card handles, customizable edge curve styles (`smoothstep`, `bezier`, `straight`), editable edge labels, and animated flow toggle.
- **Multiple Canvases & Persistence**: Create, rename, duplicate, and delete independent canvases persisted in `chrome.storage.local` with real-time cross-view sync and a modular `IndexedDBAdapter` ready for larger datasets.
- **Undo / Redo & Keyboard Shortcuts**: Full history stack (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+A`, `Delete`, `Space+Drag`, `Ctrl/Cmd+S`).
- **Validated JSON Import / Export**: Export single canvases or all canvases; strictly validate and sanitize imported JSON without overwriting existing projects.
- **Interactive Onboarding**: 6-step first-time walkthrough with starter canvas creation.
- **Open-Source Documentation**: `README.md`, `LICENSE` (MIT), `CONTRIBUTING.md`, `CHANGELOG.md`, and `.gitignore`.
