# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Production Next.js build
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript compiler (no emit)
npm run test         # Run Vitest in watch mode
npm run test:run     # Run Vitest once (CI)
```

Run a single test file:
```bash
npx vitest run test/inspector.test.tsx
```

Tests live flat in `test/` (jsdom environment, setup in `test/setup.ts`). The `@/` import alias maps to `src/` in both `tsconfig.json` and `vitest.config.ts`.

> `CLAUDE.md` is a mirror of this file for Claude Code — keep both in sync when editing either.

## Architecture

**Inkframe** is a browser-based video composition tool: users assemble clips, images, audio, and text overlays into a timeline, then export as MP4. The project has three routes:

1. **`/editor`** — Timeline-based editor (primary)
2. **`/templates`** — Preset gallery; deep-links into `/editor?template=<id>`
3. **`/text-motion`** — AI-generated kinetic typography composer

### State Management

All editor state lives in `useEditorSession` (`src/components/editor/hooks/use-editor-session.ts`), a React reducer hook. The root state type is `ProjectSession`:

```
ProjectSession
├── activeVersion: "reel_9_16" | "widescreen_16_9"
└── versions: { reel_9_16: VersionTimeline, widescreen_16_9: VersionTimeline }
```

Each `VersionTimeline` holds `clips[]`, `textOverlays[]`, `audioTracks[]`, and `transitions[]`. The reducer (`editorReducer`) handles all mutations; actions are aspect-scoped. All types live in `src/lib/editor/types.ts`.

### Preset System

Text overlays use a `stylePreset` field (e.g., `"vox-timeline"`, `"editorial-stat-ring"`). Each preset is composed of:

| Layer | Location |
|---|---|
| Elah projection | `src/lib/editor/elah-adapter.ts` |
| Structured data parser (optional) | `src/lib/editor/parsers/{preset}.ts` |
| Inspector panel (optional) | `src/components/editor/inspector/preset-inspectors/{preset}Inspector.tsx` |

To add a new preset: add the string literal to `TextOverlayStylePreset` in `types.ts`, define its Elah-compatible typography defaults, and add it to the template catalog if needed.

### Export Pipeline

Export is a browser-side operation powered by Elah. The flow:

1. `elah-adapter.ts` projects the active Inkframe timeline and browser asset URLs into an Elah `Project`.
2. `elah-browser.ts` invokes Elah's lazy Web Worker exporter.
3. Elah renders frames with its browser renderer and MediaBunny encodes MP4 locally.
4. The resulting Blob is downloaded directly, retained as a page-scoped URL for playback verification, and revoked on the next export or page teardown; source media never passes through an Inkframe render route.

Local persistence uses IndexedDB v2: project metadata lives in `projects`, while media Blobs live in `assets` and are only rewritten when their fingerprint changes. Stock and AI API routes use shared request-size and per-client rate guards from `src/server/request-guard.ts`.

### AI Chat Protocol

The AI chat drawer (`POST /api/chat`) uses the Vercel AI SDK. The LLM can embed structured editor mutations in its response using sentinel tags:

```
[[EDITOR_ACTIONS]]{ ...AIEditorActions JSON... }[[/EDITOR_ACTIONS]]
```

These are parsed by `src/lib/editor/ai-actions.ts` and applied via `applyAIEditorActions` in `src/components/editor/hooks/editor-session-ai.ts`. The JSON schema for valid actions is defined in `ai-actions.ts` using Zod.

### Domain Logic vs. UI

`src/lib/editor/` is pure TypeScript — no React or DOM. It contains:
- `types.ts` / `schema.ts` / `reducer.ts` / `constants.ts` — core editor domain
- `domain/` — generic helpers (assets, version, render, helpers)
- `parsers/` — per-preset structured-text parsers (parse raw text content into typed preset data)
- Per-preset domain files (e.g. `vox-timeline.ts`, `chart-card.ts`, `editorial-stat-ring.ts`) — preset-specific business logic, co-located with but separate from the generic domain

`src/components/editor/` contains the React UI and Elah preview workspace. `src/lib/export/` contains the browser download/export bridge. `src/server/` contains AI services, stock-provider HTTP helpers, and shared request guards.

### Text Motion (separate workflow)

`/text-motion` is a parallel, self-contained pipeline that does not share state with the editor:

- `src/lib/text-motion/` — project types, defaults, Zod schema, template catalog, sanitization (pure TS, mirrors the `src/lib/editor/` split)
- `src/components/text-motion/hooks/use-text-motion-project.ts` — the state hook (analogous to `useEditorSession`)
- `src/lib/text-motion/elah-adapter.ts` — converts storyboards into Elah projects for preview and MP4 export
- `POST /api/text-motion/generate` — OpenAI storyboard generation backed by `text-motion-generate-service.ts`

### Constants

Key values in `src/lib/editor/constants.ts`:
- `FPS = 30`
- `MAX_DURATION_FRAMES = 1800` (60 seconds)
- `PRESET_MIN_DURATIONS_FRAMES` — per-preset minimum frame counts

### Environment Variables

- `OPENAI_API_KEY` — required for AI chat and text-motion generation
