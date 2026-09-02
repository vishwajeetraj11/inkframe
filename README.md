# Inkframe

**An agent-native motion studio: prompt an editable video timeline, inspect every change, and explicitly approve the final MP4 render.**

[Live app](https://inkframe-eta.vercel.app/) · [Open the editor](https://inkframe-eta.vercel.app/editor) · [WebMCP tool reference](./docs/webmcp.md)

Inkframe combines Next.js, Elah, and WebMCP to make short-form video creation a shared human-agent workflow. A browser agent can inspect the current project, compose structured scenes, adjust timeline items, switch aspect ratios, add sound effects, and request a local browser export through typed tools. The same edits stay visible and editable in the human interface.

## The WebMCP moment

Most browser agents must reverse-engineer a video editor by inspecting the DOM and clicking controls. Inkframe gives the agent the editor's real actions instead:

1. **Compose:** the agent creates or edits scenes through strict, state-aware WebMCP tools.
2. **Review:** every result appears in the same Elah timeline and WebGL preview the person uses.
3. **Confirm:** destructive actions, generation, navigation, and MP4 export require explicit confirmation.
4. **Deliver:** Elah renders and encodes the active 9:16 or 16:9 composition entirely in the browser, then starts the download.

### Try the judge flow

Open the [live editor](https://inkframe-eta.vercel.app/editor) in ChatGPT's in-app browser and ask:

> Create a 9-second Reel with three editorial text scenes about why browser agents should use structured tools instead of clicking through interfaces. Use three different visual presets, inspect the resulting timeline, then ask me before exporting the MP4.

This demonstrates a complete agent-native task rather than a tool-discovery-only proof: project inspection → structured composition → visible human review → confirmed render.

## WebMCP implementation

- Route-aware catalogs expose site, editor, and Text Motion workflows only while their pages are active.
- Strict Zod inputs are converted to standards-compatible JSON Schema.
- Tool handlers read current React state at invocation time instead of capturing stale snapshots.
- File contents and object URLs never cross the structured tool boundary; native pickers preserve browser security.
- Tool outputs are bounded and sanitized, and registrations are cleaned up on unmount.
- WebMCP hosts that omit an execution context remain supported while supplied abort signals still cancel work.

All WebMCP integration work was added on September 1, 2026, during the challenge submission period. The underlying video editor predates the challenge; the agent tool surface, route-aware registration, live state bridge, tests, and judge workflow are the challenge extension.

## What the app includes

- `Editor`: upload image, video, and audio assets; build clip timelines; add structured text presets; export MP4.
- `Templates`: browse preset-driven caption and explainer layouts and deep-link into `/editor?template=<id>`.
- `Text Motion`: generate kinetic typography storyboards with OpenAI, preview them in Elah, and export MP4 locally.
- `API routes`: AI chat and text-motion generation only; media preview and export stay in the browser.

## Main entrypoints

- `/templates`: preset gallery for the editor workflow.
- `/editor`: timeline editor with asset library, preview, inspector, and AI chat drawer.
- `/text-motion`: AI text-motion editor with Elah preview and browser-native export.

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
- `src/lib/export`
  - Elah browser-export bridge and local Blob download handling.
- `src/server/services`
  - AI generation and chat context handling only.

Additional notes are in [docs/architecture.md](./docs/architecture.md).

## Commands

- `npm run dev`: start the Next.js app locally.
- `npm run build`: production Next.js build.
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
- Elah project conversion for editor and Text Motion timelines
- film-frame-gallery data helpers
- inspector routing for split sub-inspectors
- regional-map-focus helpers
- vox-timeline data helpers
- browser-native sound effect generation
- route-aware WebMCP registration and cleanup
- editor, Text Motion, and site-wide WebMCP contracts
- browser-host compatibility for tool calls with or without cancellation context

## Runtime and data handling

- Editor assets stay in browser memory through preview and export.
- Elah renders in a Web Worker and MediaBunny encodes the MP4 locally.
- Export downloads a browser-created Blob; source media is never sent to Inkframe's server.
- No project persistence layer is configured.

## Environment

The AI routes require:

- `OPENAI_API_KEY`

No storage or render-service credentials are required for export.

Optional local artifacts and generated media are kept under the workspace `artifacts/` directory when present.
