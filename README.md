# Ephemeral Video Editor

A Next.js + Remotion app for building short-form video timelines, AI-assisted caption scenes, and text-motion compositions without persisting user media after export.

## What the app includes

- `Editor`: upload image, video, and audio assets; build clip timelines; add structured text presets; export MP4.
- `Templates`: browse preset-driven caption and explainer layouts and deep-link into `/editor?template=<id>`.
- `Text Motion`: generate kinetic typography storyboards with OpenAI, preview them in Remotion, and export MP4.
- `API routes`: chat, editor export, text-motion generation, and text-motion export.

## Main entrypoints

- `/templates`: preset gallery for the editor workflow.
- `/editor`: timeline editor with asset library, preview, inspector, and AI chat drawer.
- `/text-motion`: AI text-motion editor and Remotion preview.

## Architecture

- `src/lib/editor`
  - Editor domain logic, reducers, schema validation, template catalog, and structured preset parsers.
  - `timeline.ts` is now a public facade over `domain/` modules.
  - `templates/` is the typed editor preset catalog.
  - `parsers/` contains structured overlay parsers such as chart-card, stat-ring, and createdaley-opener.
- `src/lib/text-motion`
  - Text-motion project types, defaults, template catalog, validation, and sanitization.
- `src/components/editor`
  - Editor UI panels plus `hooks/use-editor-session.ts` for reducer state, asset lifecycle, template hydration, export, and AI-apply actions.
- `src/components/text-motion`
  - Text-motion UI panels plus `hooks/use-text-motion-project.ts` for project state, image assets, template loading, generation, and export.
- `src/server/services`
  - Route-free orchestration for export, generation, temp-dir lifecycle, and chat context handling.
- `src/remotion`
  - Remotion compositions for the editor and text-motion experiences.
  - `editor-presets/types.ts` defines preset renderer contracts for ongoing renderer decomposition.

Additional notes are in [docs/architecture.md](/Users/vishwajeetraj/Documents/react/editor/docs/architecture.md).

## Commands

- `npm run dev`: start the Next.js app locally.
- `npm run build`: production build.
- `npm run lint`: ESLint checks.
- `npm run typecheck`: TypeScript checks.
- `npm run test:run`: run Vitest once.
- `npm run test`: watch mode for Vitest.

## Test coverage

The current safety net covers:

- editor template catalog lookup
- editor timeline sanitization and render-track behavior
- AI editor action parsing
- text-motion project sanitization
- chat-service context parsing
- route validation for export endpoints
- inspector routing for split sub-inspectors

## Runtime and data handling

- Editor assets live in browser memory until export.
- Server exports use per-request temp directories under the system temp root and clean them up after the response.
- No project persistence layer is configured.

## Environment

The AI routes require:

- `OPENAI_API_KEY`

Vercel-hosted exports additionally require:

- `new_READ_WRITE_TOKEN`

On Vercel, the build now creates a Remotion sandbox snapshot and stores the snapshot ID in Vercel Blob. Runtime exports restore that snapshot, render, and upload the result to Blob for download. Large editor exports that POST more than about 4.5 MB of source media to a function still need a direct-upload/blob-backed asset flow.

Optional local artifacts and generated media are kept under the workspace `artifacts/` directory when present.
