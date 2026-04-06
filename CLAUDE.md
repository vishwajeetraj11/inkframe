# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Production build + create Remotion snapshot
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript compiler (no emit)
npm run test         # Run Vitest in watch mode
npm run test:run     # Run Vitest once (CI)
```

Run a single test file:
```bash
npx vitest run test/inspector.test.tsx
```

## Architecture

**Inkframe** is a browser-based video composition tool: users assemble clips, images, audio, and text overlays into a timeline, then export as MP4. The project has three routes:

1. **`/editor`** — Timeline-based editor (primary)
2. **`/text-motion`** — AI-generated kinetic typography composer
3. **`/remote-renderer`** — Second entry point into `EditorShell`, used for the Vercel Sandbox render environment

### State Management

All editor state lives in `useEditorSession` (`src/components/editor/hooks/use-editor-session.ts`), a React reducer hook. The root state type is `ProjectSession`:

```
ProjectSession
├── activeVersion: "reel_9_16" | "widescreen_16_9"
└── versions: { reel_9_16: VersionTimeline, widescreen_16_9: VersionTimeline }
```

Each `VersionTimeline` holds `clips[]`, `textOverlays[]`, `audioTracks[]`, and `transitions[]`. The reducer (`editorReducer`) handles all mutations; actions are aspect-scoped. All types live in `src/lib/editor/types.ts`.

### Preset System

Text overlays use a `stylePreset` field (e.g., `"vox-timeline"`, `"editorial-stat-ring"`). Each preset is a plugin composed of:

| Layer | Location |
|---|---|
| Remotion renderer | `src/remotion/editor-presets/{preset}.tsx` |
| Structured data parser (optional) | `src/lib/editor/parsers/{preset}.ts` |
| Inspector panel (optional) | `src/components/editor/inspector/preset-inspectors/{preset}Inspector.tsx` |

To add a new preset: add the string literal to `TextOverlayStylePreset` in `types.ts`, create the renderer, register it in `EditorComposition.tsx`, add it to the template catalog if needed.

### Export Pipeline

Export is a server-side operation triggered via `POST /api/export` (FormData with project JSON + uploaded files). The flow:

1. `editor-export-service.ts` — validates assets, stages files to temp dir, inlines images as base64
2. `render-service.ts` — dispatches to local or Vercel render path based on `shouldUseVercelSandboxRender()` (true when `VERCEL=1` + `NODE_ENV=production`)
3. **Local**: Remotion bundler runs in-process; output written to temp file
4. **Vercel**: A pre-built Remotion snapshot (uploaded to Blob during `npm run build`) is restored into a `@vercel/sandbox` Firecracker VM via `renderMediaOnVercel`; output is uploaded to Vercel Blob and a download URL is returned

If export fails on Vercel with "No Remotion sandbox snapshot found", a redeploy is required to regenerate the snapshot.

`EditorComposition.tsx` is the Remotion top-level composition that receives asset sources and routes each overlay to its preset renderer.

### AI Chat Protocol

The AI chat drawer (`POST /api/chat`) uses the Vercel AI SDK. The LLM can embed structured editor mutations in its response using sentinel tags:

```
[[EDITOR_ACTIONS]]{ ...AIEditorActions JSON... }[[/EDITOR_ACTIONS]]
```

These are parsed by `src/lib/editor/ai-actions.ts` and applied via `applyAIEditorActions` in `src/components/editor/hooks/editor-session-ai.ts`. The JSON schema for valid actions is defined in `ai-actions.ts` using Zod.

### Domain Logic vs. UI

`src/lib/editor/` is pure TypeScript — no React, no Remotion. It contains:
- `types.ts` / `schema.ts` / `reducer.ts` / `constants.ts` — core editor domain
- `domain/` — generic helpers (assets, version, render, helpers)
- `parsers/` — per-preset structured-text parsers (parse raw text content into typed preset data)
- Per-preset domain files (e.g. `vox-timeline.ts`, `chart-card.ts`, `editorial-stat-ring.ts`) — preset-specific business logic, co-located with but separate from the generic domain

`src/components/editor/` contains all React UI. `src/remotion/` contains all Remotion rendering logic. `src/server/` contains all server-side services.

### Constants

Key values in `src/lib/editor/constants.ts`:
- `FPS = 30`
- `MAX_DURATION_FRAMES = 1800` (60 seconds)
- `PRESET_MIN_DURATIONS_FRAMES` — per-preset minimum frame counts

### Environment Variables

- `OPENAI_API_KEY` — required for AI chat and text-motion generation
- `new_READ_WRITE_TOKEN` — Vercel Blob token (the literal env var name; also accepted as `BLOB_READ_WRITE_TOKEN`). Required for Vercel export and snapshot storage.
