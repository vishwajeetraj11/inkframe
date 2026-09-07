# Inkframe WebMCP tools

Inkframe exposes its product workflows as route-aware tools through the current WebMCP
draft API, `document.modelContext`. This is progressive enhancement: the editor
works normally when WebMCP is unavailable.

WebMCP is an evolving W3C Community Group draft and browser preview. For local
Chrome testing, enable `chrome://flags/#enable-webmcp-testing`, open Inkframe,
and use a WebMCP-capable browser agent to inspect the tools registered by the
active page.

## Site-wide tools

- `get_capabilities`
- `list_templates`
- `navigate_workspace`
- `open_template`

## Editor tools

Discovery and inspection:

- `editor_get_capabilities`
- `editor_get_state_summary`
- `editor_get_project`
- `editor_validate_project`
- `editor_get_render_diagnostics`
- `editor_capture_frame`
- `editor_capture_contact_sheet`
- `editor_get_export_status`
- `editor_get_export_artifact`
- `editor_list_assets`
- `editor_get_attribution_report`
- `editor_list_style_presets`

Workspace and timeline actions:

- `editor_request_media_picker`
- `editor_search_stock_videos`
- `editor_import_stock_video`
- `editor_search_stock_photos`
- `editor_import_stock_photo`
- `editor_search_licensed_music`
- `editor_import_licensed_music`
- `editor_search_licensed_sfx`
- `editor_import_licensed_sfx`
- `editor_import_audio_url`
- `editor_plan_storyboard`
- `editor_compose_storyboard`
- `editor_list_variants`
- `editor_create_variant`
- `editor_apply_variant`
- `editor_delete_variant`
- `editor_auto_fix_project`
- `editor_switch_canvas`
- `editor_select_timeline_item`
- `editor_add_text_overlay`
- `editor_update_text_overlay`
- `editor_remove_text_overlay`
- `editor_update_clip`
- `editor_remove_clip`
- `editor_move_clip`
- `editor_split_clip`
- `editor_duplicate_clip`
- `editor_set_transition`
- `editor_remove_transition`
- `editor_update_audio_track`
- `editor_remove_audio_track`
- `editor_apply_ai_editor_actions`
- `editor_request_export`
- `editor_cancel_export`
- `editor_remove_asset`
- `editor_undo`
- `editor_redo`

All tool inputs are checked with strict Zod schemas before execution, while the
browser receives standards-compatible JSON Schema. Tool callbacks read current
React state at invocation time, general outputs exclude embedded media data, and each
page unregisters its tools with an `AbortController` when it unmounts. Local
media never crosses the structured WebMCP boundary: picker tools open the
existing browser file controls and the user chooses files directly. Frame tools
only return reduced JPEGs when `includeImage` or `includeImages` is explicitly true.

Navigation, deletion, structured AI replacement, generation, and browser export tools require a
strict `confirmed: true` input. This explicit guard supplements the current
WebMCP draft while its native elicitation contract remains unsettled.

## Agent production loop

### Single-video grading: three-persona review

`editor_color_propose` returns a delegation protocol when it produces exactly one
clip candidate. The coordinator must delegate independent colorist, technical,
and visual-critic agents and give each the creative brief, exact settings and all
paired images from `editor_color_preview` (`includeImages: true`). Submit each
review through `editor_color_submit_review`, including its persona, actual agent
ID, verdict, findings and requested changes. Read collected feedback with
`editor_color_status`.

Single-candidate approval and application require all three distinct reviewer IDs
to judge that exact preview as improving. Revised proposals or new previews need
fresh reviews; stale project revisions and metadata-only evidence cannot qualify.
New feedback invalidates unused approvals. The coordinator should revise from
feedback for at most three rounds, stop on stalled progress, and leave the best
candidate for human judgment if no agreement is reached. This loop bound is an
orchestration instruction, not an authenticated execution constraint.

WebMCP requests delegation; it cannot spawn agents or authenticate their identity.
If delegation is unavailable, report that limitation and leave the proposal
unapproved rather than fabricate independent reviews. This gate applies to the
single-candidate WebMCP workflow, not manual grading controls or multi-shot proposals.

A browser agent can now complete and verify a full local workflow without a render server:

1. Inspect assets with `editor_list_assets`, then find footage with
   `editor_search_stock_videos` and import selected results with
   `editor_import_stock_video`.
2. Preview exact scene timings and replacement effects with
   `editor_plan_storyboard`. It does not mutate the editor and returns a token
   bound to that plan for ten minutes. Tokens are random, one-use, and bound to
   the complete timeline plus asset baseline. After the person approves, repeat the exact plan with
   its token and `confirmed: true` through `editor_compose_storyboard`.
   Add `variantName` to compose into an isolated draft, then compare and apply
   only the selected draft with `editor_apply_variant`. Atomic tools remain
   available for precise refinement. Freesound music and effects retain Creative Commons source/license metadata.
3. Run `editor_validate_project` and `editor_get_render_diagnostics` before
   export. Validation reports missing assets, unsafe typography, likely text
   overflow, timeline gaps, invalid transitions, and known Elah limitations.
4. Seek and inspect one active-canvas moment with `editor_capture_frame`, or
   create a multi-frame visual QA pass with `editor_capture_contact_sheet`
   and `includeImages: true`.
   Contact sheets appear inside the editor for the human as well as returning
   structured measurements to the agent. The tools
   reports every active clip, text layer, audio track, transition, and a
   pixel-sampled WCAG contrast result for each visible text overlay; passing
   `includeImage: true` also returns a reduced JPEG data URL for visual review.
5. Apply deterministic safe-area, minimum-type-size, timing, Elah-parity, and
   optional captured-frame contrast corrections with
   `editor_auto_fix_project`. Every field change is returned; ambiguous issues
   remain for manual review instead of silently changing media or copy.
6. Generate copyable stock credits and check required attribution metadata
   with `editor_get_attribution_report`.
7. Start a confirmed local MP4 render with `editor_request_export`, poll
   `editor_get_export_status`, and use `editor_cancel_export` if needed. A
   completed job reports filename, MIME type, byte size, duration, canvas size,
   frame rate, MP4 container, H.264 video/AAC audio codecs, bitrates, and
   completion time. `editor_get_export_artifact` returns the retained page-scoped
   Blob URL, MP4 signature, optional SHA-256 digest, and browser playback
   verification so the agent can reopen the exact rendered file.

`editor_get_capabilities` is the recommended entry point. It returns
task-oriented workflows and groups the larger atomic surface into discovery,
composition, inspection, correction, and delivery tools so an agent does not
need to infer a path from every registered operation.

### Music and narration balance

Use `editor_plan_audio_balance` to preview music ducking without changing the
project. Supply `aspect`, a `music` reference, a nonempty `narration` reference
array, `strength` (`gentle`, `balanced`, or `strong`), and a new `ruleId`.
Each reference is `{ kind: "audio" | "video", id: string }`.
The response includes the current `revision`, validated `rule`, gain `envelope`,
and `warnings`. This is timeline-interval ducking, not speech detection, loudness
measurement, or automatic mastering; audition the resulting mix.

After reviewing the plan, call `editor_apply_audio_balance` with the same inputs,
`confirmed: true`, `expectedRevision` from the plan, and a unique `operationId`.
The command revalidates inputs against that revision and adds one rule atomically.
Existing rule IDs are rejected. A stale revision requires planning again; retries
use the same operation ID. `editor_undo` reverses the single edit, or
`editor_remove_audio_ducking` removes the rule by ID with confirmation.
The plan is deterministic and has no hidden persistent approval token.

### Runtime environment discovery

The editor capability response also includes a fresh `runtime` inventory on each
call. OS identification is only a browser hint (including iPad desktop mode),
never evidence that `say`, Windows speech, Linux TTS, or FFmpeg is installed.
Operations report a status, reason, and next action. The status vocabulary is
`available`, `unsupported`, `not-installed`, `permission-required`, and `unknown`.
Only a future native integration that actually checks dependencies should report
native software as `available` or `not-installed`.

Currently no local companion is connected: narration-file generation is
unsupported and native media-processing availability is unknown. Import externally
generated audio through the existing media picker. Browser speech playback is not
advertised as a narration-file generator. File import requires user selection.
Export discovery checks browser primitives but leaves codec/configuration support
unknown until the actual export checks run; inspect export status for the result.
Discovery never requests permission, runs commands, or uploads media. Cloud/paid
fallbacks require explicit user choice and are never selected automatically.

Licensed stock audio is optional. Configure `FREESOUND_API_KEY` for music and sound effects. Results are restricted to downloadable
CC0, CC BY, or CC BY-SA items; imported assets retain creator, source, license,
and attribution requirements.

Inkframe never uploads an exported MP4. It retains the latest export as a
page-scoped Blob URL until the next export or page close, downloads it directly,
and exposes that same local artifact through WebMCP.
Local project persistence stores timeline metadata separately from deduplicated
asset blobs, and API-backed stock routes enforce per-client limits and
bounded request bodies.

Primary references:

- [W3C WebMCP draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)

## Official WebMCP evals

Inkframe pins Google Chrome Labs' `webmcp-evals` CLI. Deterministic live-browser
coverage lives in `evals/webmcp-smoke.json`; natural-language agent journeys live
in `evals/webmcp-evals.json`. The agent suite requires the model to discover the
hydrated overlay ID before editing the One Number metric.

With the app running on port 3000, run `npm run test:webmcp:smoke` for deterministic
live-browser tool discovery and execution without an AI key. Run
`npm run test:webmcp:agent` with `OPENAI_API_KEY` configured to test model tool
selection and the multi-step agent trajectory. Override the default model with
`WEBMCP_EVAL_MODEL` when needed.

The separate Playwright export test remains the full artifact-level check:
`npm run test:e2e -- e2e/webmcp-export.spec.ts`.
