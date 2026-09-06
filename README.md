# Inkframe — An Agent-Native Motion Studio

Create an editable short-form video with a browser agent, then inspect, approve, and export it locally.

[Live app](https://inkframe-eta.vercel.app/) · [Open the editor](https://inkframe-eta.vercel.app/editor) · [WebMCP tool reference](./docs/webmcp.md) · [MIT License](./LICENSE)

Inkframe is a browser-native video editor for people and agents to use together. A person sets the creative direction; an agent uses structured WebMCP tools to inspect the project, plan changes, find media, compose a timeline, validate it, and request a local MP4 export. The result remains visible and editable in the same timeline.

## Why WebMCP

A conventional video editor exposes pixels, menus, drag targets, and transient selection state. That is workable for a person, but brittle for an agent trying to infer whether a click or drag worked.

Inkframe exposes the editor's domain actions instead. For example, an agent can call `editor_plan_storyboard`, `editor_import_stock_video`, `editor_set_transition`, and `editor_validate_project` with typed input and structured output. It can inspect exact clip, text, audio, and transition state instead of guessing from the interface.

The workflow stays human-controlled:

1. **Plan without mutation.** `editor_plan_storyboard` previews timing, captions, assets, and transitions without changing the project.
2. **Approve the exact plan.** A one-use, content-bound approval token is required before composition.
3. **Inspect the edit.** Validation, frame capture, contact sheets, diagnostics, and attribution reporting check the same active timeline the person sees.
4. **Export locally.** A confirmed request renders an MP4 in the browser with Elah and MediaBunny; source media is not sent to an Inkframe render server.

## What you can do

- Compose 9:16 Reels or 16:9 videos with visual clips, text overlays, audio, and fade, slide, or wipe transitions.
- Import local media or search Pexels photos and videos from the editor.
- Search licensed music and sound effects from Freesound. Imported assets retain provider, creator, source, license, and required-credit metadata.
- Create a storyboard, save it as an isolated variant, compare it, and apply the chosen version.
- Trim, split, duplicate, move, and remove clips; edit captions; mix and trim audio; undo and redo changes.
- Validate export readiness, inspect frames, generate a contact sheet, and obtain a copyable attribution report.
- Export an MP4 locally and verify its browser-retained artifact metadata.

## Try the WebMCP flow

Open the [live editor](https://inkframe-eta.vercel.app/editor) in a ChatGPT/Codex browser session with WebMCP enabled, or in Google Chrome with WebMCP enabled. Then ask:

> Plan a 16-second vertical 9:16 launch Reel for a boutique travel company promoting a Vietnam escape. Use four scenes: Ha Long Bay, Sapa rice terraces, Vietnamese street food, and lanterns at night. Show scene timing, captions, media-search terms, transitions, and a licensed music direction. Do not change the editor yet.

Review the plan, then say:

> I approve the storyboard. Import the selected assets, compose the timeline, validate the project, and show the attribution report. Do not export yet.

This makes the handoff explicit: the agent proposes a plan, the person approves it, and the editor records a structured, inspectable result.

## WebMCP surface

Inkframe registers route-aware tools through `document.modelContext` when WebMCP is available. The editor continues to work normally when it is not.

- Site tools: capability discovery, template listing, and safe navigation.
- Editor tools: project inspection, stock-media search and import, storyboard planning and composition, precise timeline editing, variants, validation, visual QA, attribution, and local export.
- Safeguards: strict Zod validation, JSON Schema inputs, bounded and sanitized outputs, abort handling, no raw local file data or object URLs in tool responses, and explicit confirmation for destructive actions and export.

See the complete names, inputs, and agent production loop in [docs/webmcp.md](./docs/webmcp.md).

## Architecture

```text
src/lib/editor/          Editor domain, reducers, validation, WebMCP tools, templates
src/components/editor/   Timeline editor, media library, preview, inspector, session hooks
src/lib/export/          Browser export bridge and MP4 artifact handling
src/lib/webmcp/          Route-aware registration and WebMCP types
src/server/              Stock-media helpers and request guards
```

All editor state lives in `useEditorSession`. The active project contains separate 9:16 and 16:9 timelines, each with clips, text overlays, audio tracks, and transitions.

## Local-first media and data handling

- Pexels and licensed-audio searches return metadata through guarded server routes; selected media downloads into the browser.
- Projects and local media blobs persist in browser IndexedDB.
- Elah renders in a Web Worker and MediaBunny encodes the MP4 in the browser.
- The latest export is kept as a page-scoped Blob URL for playback verification and download. Inkframe does not upload source media or exported MP4s to a render service.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create `.env.local` when using stock search:

```bash
PEXELS_API_KEY=...
FREESOUND_API_KEY=...      # optional: licensed music and sound-effect search
```

These credentials stay server-side. No storage or render-service credential is required for local export.

## Commands

```bash
npm run dev        # Start Next.js with Turbopack
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # TypeScript without emitting files
npm run test       # Vitest watch mode
npm run test:run   # Run Vitest once
npm run test:e2e   # Playwright WebMCP compose and export verification
```

## Attribution

Assets imported from Pexels and Freesound retain their provenance in the media library. Inkframe visibly identifies credits that are required for publishing and `editor_get_attribution_report` returns copyable credit lines for the active timeline.

## License

Inkframe is released under the [MIT License](./LICENSE).
