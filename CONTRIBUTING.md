# Contributing to Infinite Canvas

Thank you for your interest in contributing to **Infinite Canvas**!

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run checks before making changes:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
4. Load the `dist/` directory in Chrome via `chrome://extensions` → **Developer mode** → **Load unpacked**.

## Engineering Guidelines

- **Strict TypeScript**: Keep all types explicit and ensure `npm run typecheck` passes with zero errors.
- **Modular Architecture**: Keep Chrome Extension APIs inside `src/shared/utils/chromeService.ts` or `src/background/`, storage logic inside `src/shared/storage/`, and UI components small and focused.
- **Minimum Permissions**: Do not add new Manifest V3 permissions unless strictly required and documented in `README.md`.
- **Local-First & Privacy**: Do not add analytics, trackers, or external data transmission.
- **Security**: Always validate external URLs and imported JSON schemas; never inject raw HTML or bypass website `X-Frame-Options` / CSP headers.

## Submitting a Pull Request

1. Create a feature branch from `main`.
2. Add or update unit tests for any validation, storage, or utility changes.
3. Run `npm run build` and `npm test` to confirm everything passes.
4. Open a concise PR describing what changed and how it was tested.
