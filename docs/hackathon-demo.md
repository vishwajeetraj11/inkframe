# WebMCP Challenge demo guide

This is the shortest reliable path for evaluating Inkframe as an agent-native product.

## Judge setup

1. Open <https://inkframe-eta.vercel.app/editor> in ChatGPT's in-app browser. Chrome 149+ with WebMCP testing enabled is also supported.
2. Confirm that the page exposes the `editor_*` WebMCP catalog.
3. Give the browser agent the prompt below.

## Canonical prompt

> Create a 9-second Reel with three editorial text scenes about why browser agents should use structured tools instead of clicking through interfaces. Use three different visual presets, inspect the resulting timeline, then ask me before exporting the MP4.

Expected tool path:

1. `editor_get_capabilities` or `editor_get_state_summary`
2. `editor_apply_ai_editor_actions` with `confirmed: true`, or a sequence of typed overlay tools
3. `editor_get_project` to verify the result
4. `editor_request_export` only after the person confirms

Expected visible result:

- The same scenes appear in the Elah timeline and Remotion preview.
- The person can edit the generated result through normal editor controls.
- Export produces a downloadable MP4 rather than a simulated success message.

## Three-minute video structure

### 0:00–0:20 — Problem

Browser agents normally inspect and click through complex editors. This is slow, brittle, and disconnected from the application's real state.

### 0:20–0:45 — Product

Show Inkframe's editor, Elah timeline, Remotion preview, aspect switcher, and export. State the target user: a creator who needs a polished short-form video without manually operating every control.

### 0:45–1:55 — Agent-native workflow

Run the canonical prompt. Show WebMCP tools being discovered and called. Keep the timeline visible while scenes appear. Inspect the canonical project state and make one follow-up edit.

### 1:55–2:25 — Human control

Show that export is gated by explicit confirmation. Approve it, invoke `editor_request_export`, and show the successful MP4 download.

### 2:25–2:50 — Why WebMCP

Explain that WebMCP removes DOM guesswork, preserves the signed-in browser session, uses strict schemas, and keeps agent work visible in the product UI.

### 2:50–3:00 — Close

“Inkframe turns video editing from browser automation into genuine human-agent collaboration: prompt the cut, inspect every edit, approve the render.”

## Release checklist

- [ ] Live URL loads without authentication or setup instructions.
- [ ] Direct WebMCP tool invocation works in the deployed build.
- [ ] Canonical prompt completes from a clean editor state.
- [ ] Confirmed export downloads a playable MP4.
- [ ] Reel and Widescreen preserve their timelines when switching.
- [ ] Public repository reflects the deployed commit.
- [ ] Public repository includes the owner's chosen open-source license.
- [ ] README identifies pre-challenge work and the WebMCP challenge extension.
- [ ] Public YouTube demo is under three minutes and includes audio.
- [ ] Devpost description links the live app, repository, and video.
