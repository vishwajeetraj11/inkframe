# Inkframe

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

## Presets

Available `stylePreset` values (registered in `src/lib/editor/types.ts`):

| Preset | Description |
|---|---|
| `vox-timeline` | Vox-style annotated timeline |
| `vox-timeline-ribbon` | Ribbon variant of vox-timeline |
| `vox-timeline-ledger` | Ledger variant of vox-timeline |
| `world-map-focus` | World map with animated focus point |
| `regional-map-focus` | Regional map with animated focus point |
| `film-frame-gallery` | Animated film-frame photo gallery |
| `editorial-bar-chart` | Editorial animated bar chart |
| `editorial-stat-ring` | Editorial animated stat ring |
| `editorial-seat-arc` | Editorial seat arc diagram |
| `createdaley-opener` | Craig Daley-style documentary opener |
| `chart-card` | Data chart card overlay |
| `news-clipping` | Newspaper clipping style overlay |
| `vox-pull-quote` | Vox-style pull quote with yellow highlighter sweep |
| `harris-marker` | Johnny Harris-style headline with hand-drawn marker underline/circle |
| `harris-location` | Johnny Harris-style typewriter location stamp lower third |

## Architecture

- `src/lib/editor`
  - Editor domain logic, reducers, schema validation, template catalog, and structured preset parsers.
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
  - `editor-presets/` holds one renderer file per preset; `EditorComposition.tsx` routes to them by `stylePreset`.

Additional notes are in [docs/architecture.md](./docs/architecture.md). If you want a guided onboarding path, see [docs/remotion-30-day-learning-plan.md](./docs/remotion-30-day-learning-plan.md).

## Commands

- `npm run dev`: start the Next.js app locally.
- `npm run build`: production build + create Remotion snapshot.
- `npm run lint`: ESLint checks.
- `npm run typecheck`: TypeScript checks.
- `npm run test:run`: run Vitest once.
- `npm run test`: watch mode for Vitest.

## Test coverage

The current safety net covers:

- editor template catalog lookup
- editor timeline sanitization and render-track behavior
- AI editor action parsing and session application
- text-motion project sanitization
- chat-service context parsing
- route validation for export endpoints
- export filename generation
- film-frame-gallery data helpers
- inspector routing for split sub-inspectors
- regional-map-focus helpers
- vox-timeline data helpers
- remotion SFX helpers
- default editor composition props

## Runtime and data handling

- Editor assets live in browser memory until export.
- Server exports use per-request temp directories under the system temp root and clean them up after the response.
- No project persistence layer is configured.

## Environment

The AI routes require:

- `OPENAI_API_KEY`

Vercel-hosted exports additionally require:

- `new_READ_WRITE_TOKEN`

On Vercel, the build creates a Remotion sandbox snapshot and stores the snapshot ID in Vercel Blob. Runtime exports restore that snapshot, render, and upload the result to Blob for download. Large editor exports that POST more than about 4.5 MB of source media to a function still need a direct-upload/blob-backed asset flow.

Optional local artifacts and generated media are kept under the workspace `artifacts/` directory when present.
