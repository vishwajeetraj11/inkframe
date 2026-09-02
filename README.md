# Inkframe

**An agent-native motion studio: compose an editable video timeline, inspect every change, and explicitly approve the final MP4 render.**

[Live app](https://inkframe-eta.vercel.app/) · [Open the editor](https://inkframe-eta.vercel.app/editor) · [WebMCP tool reference](./docs/webmcp.md)

Inkframe combines Next.js, Elah, and WebMCP to make short-form video creation a shared human-agent workflow. A browser agent can inspect the current project, compose structured scenes, adjust timeline items, switch aspect ratios, import licensed audio, and request a local browser export through typed tools. The same edits stay visible and editable in the human interface.

## The WebMCP moment

Most browser agents must reverse-engineer a video editor by inspecting the DOM and clicking controls. Inkframe gives the agent the editor's real actions instead:

1. **Plan:** the agent previews scene timings and replacement effects without changing the project.
2. **Confirm:** a human-approved, content-bound token authorizes exactly that storyboard—not a later mutation.
3. **Review:** validation, render diagnostics, frame capture, and conservative auto-fixes inspect and improve the same Elah timeline the person uses.
4. **Credit:** Inkframe produces a copyable stock-media provenance and attribution report.
5. **Deliver:** Elah renders and encodes the active 9:16 or 16:9 composition entirely in the browser, then reports and downloads the MP4.

### Try the judge flow

Open the [live editor](https://inkframe-eta.vercel.app/editor) in ChatGPT's in-app browser and ask:

> Plan a 9-second Reel with three editorial scenes about why browser agents should use structured tools instead of clicking interfaces. Show me the scene timing before changing the editor. After I approve, compose it with punch, rise, and word-reveal motion, validate it, inspect two key frames, safely fix readability problems, report stock-media credits, then ask before exporting and verify the MP4 metadata.

This demonstrates a complete agent-native task rather than a tool-discovery-only proof: project inspection → structured composition → visible human review → confirmed render.

## WebMCP implementation

- Route-aware catalogs expose site and editor workflows only while their pages are active.
- Strict Zod inputs are converted to standards-compatible JSON Schema.
- Tool handlers read current React state at invocation time instead of capturing stale snapshots.
- File contents and object URLs never cross the structured tool boundary; native pickers preserve browser security.
- Tool outputs are bounded and sanitized, and registrations are cleaned up on unmount.
- `editor_get_capabilities` returns task-oriented workflows and tool groups so agents do not need to scan the entire atomic surface.
- Storyboard approval tokens are bound to the exact normalized plan; changing a scene invalidates the token and requires approval again.
- WebMCP hosts that omit an execution context remain supported while supplied abort signals still cancel work.
- Export jobs expose progress, cancellation, and local artifact metadata without uploading the video.

All WebMCP integration work was added on September 1, 2026, during the challenge submission period. The underlying video editor predates the challenge; the agent tool surface, route-aware registration, live state bridge, tests, and judge workflow are the challenge extension.

## What the app includes

- `Editor`: import local or Pexels image/video/audio assets; trim, split, duplicate, transition, mix, and export MP4.
- `Templates`: browse complete Elah-native multi-scene timelines and deep-link into `/editor?template=<id>`.
- `API routes`: licensed stock-search proxies; media preview, project storage, and export stay in the browser.

## Main entrypoints

- `/templates`: preset gallery for the editor workflow.
- `/editor`: timeline editor with asset library, preview, inspector, WebMCP controls, and local export.

## Presets

The template gallery exposes the verified `agent-demo-reel`, a 19-second WebMCP-created
vertical edit that opens directly in the Elah timeline. Older structured style identifiers
remain readable for project compatibility, but are not presented as templates because they
belong to the retired server-rendered pipeline.

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
- `src/components/editor`
  - Editor UI panels plus `hooks/use-editor-session.ts` for reducer state, asset lifecycle, template hydration, and export.
- `src/lib/export`
  - Elah browser-export bridge and local Blob download handling.
- `src/server`
  - Bounded stock-provider HTTP helpers and shared request guards.

Additional notes are in [docs/architecture.md](./docs/architecture.md).

## Commands

- `npm run dev`: start the Next.js app locally.
- `npm run build`: production Next.js build.
- `npm run lint`: ESLint checks.
- `npm run typecheck`: TypeScript checks.
- `npm run test:run`: run Vitest once.
- `npm run test:e2e`: run the real Chrome WebMCP compose → inspect → browser-export verification.
- `npm run test`: watch mode for Vitest.

## Test coverage

The current safety net covers:

- editor template catalog lookup
- editor timeline sanitization and render-track behavior
- AI editor action parsing and session application
- Elah project conversion for editor timelines
- film-frame-gallery data helpers
- inspector routing for split sub-inspectors
- regional-map-focus helpers
- vox-timeline data helpers
- route-aware WebMCP registration and cleanup
- editor and site-wide WebMCP contracts
- browser-host compatibility for tool calls with or without cancellation context
- non-mutating storyboard planning and content-bound approval tokens
- safe typography/contrast auto-fixes and stock-media credit reporting
- fresh-profile Chrome composition, inspection, browser export, and codec verification

## Runtime and data handling

- Editor assets stay in browser memory through preview and export.
- Elah renders in a Web Worker and MediaBunny encodes the MP4 locally.
- Export downloads a browser-created Blob; source media is never sent to Inkframe's server.
- Projects and local source blobs autosave to browser IndexedDB; they are never uploaded by the editor.

## Environment

Pexels stock search requires:

- `PEXELS_API_KEY` (used only by the metadata search proxy; selected media downloads directly into the browser)

Optional licensed audio search requires:

- `JAMENDO_CLIENT_ID` for downloadable CC0/CC BY/CC BY-SA music
- `FREESOUND_API_KEY` for CC0/CC BY/CC BY-SA sound effects

Both credentials stay server-side. Imported audio downloads into the browser and retains creator, source, license, and attribution metadata.

No storage or render-service credentials are required for export.

Optional local artifacts and generated media are kept under the workspace `artifacts/` directory when present.
