# Inkframe WebMCP tools

Inkframe exposes its product workflows as route-aware tools through the current WebMCP
draft API, `document.modelContext`. This is progressive enhancement: the editor
and Text Motion interfaces work normally when WebMCP is unavailable.

WebMCP is an evolving W3C Community Group draft and browser preview. For local
Chrome testing, enable `chrome://flags/#enable-webmcp-testing`, open Inkframe,
and use a WebMCP-capable browser agent to inspect the tools registered by the
active page.

## Site-wide tools

- `inkframe_get_capabilities`
- `inkframe_list_templates`
- `inkframe_navigate_workspace`
- `inkframe_open_editor_template`

## Editor tools

Discovery and inspection:

- `editor_get_capabilities`
- `editor_get_state_summary`
- `editor_get_project`
- `editor_validate_project`
- `editor_get_render_diagnostics`
- `editor_capture_frame`
- `editor_get_export_status`
- `editor_list_assets`
- `editor_get_attribution_report`
- `editor_list_style_presets`
- `editor_list_sound_effects`

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
- `editor_add_sound_effect`
- `editor_apply_ai_editor_actions`
- `editor_request_export`
- `editor_cancel_export`
- `editor_remove_asset`
- `editor_undo`
- `editor_redo`

## Text Motion tools

- `text_motion_get_capabilities`
- `text_motion_list_templates`
- `text_motion_list_animations`
- `text_motion_get_project_summary`
- `text_motion_set_aspect_template`
- `text_motion_load_template`
- `text_motion_set_prompt`
- `text_motion_set_title`
- `text_motion_add_scene`
- `text_motion_update_scene`
- `text_motion_update_theme`
- `text_motion_list_image_assets`
- `text_motion_assign_image_to_all_scenes`
- `text_motion_remove_image_asset`
- `text_motion_remove_scene`
- `text_motion_generate`
- `text_motion_export`
- `text_motion_request_image_picker`

All tool inputs are checked with strict Zod schemas before execution, while the
browser receives standards-compatible JSON Schema. Tool callbacks read current
React state at invocation time, outputs exclude embedded image data, and each
page unregisters its tools with an `AbortController` when it unmounts. Local
media never crosses the structured WebMCP boundary: picker tools open the
existing browser file controls and the user chooses files directly.

Navigation, deletion, structured AI replacement, generation, and browser export tools require a
strict `confirmed: true` input. This explicit guard supplements the current
WebMCP draft while its native elicitation contract remains unsettled.

## Agent production loop

A browser agent can now complete and verify a full local workflow without a render server:

1. Inspect assets with `editor_list_assets`, then find footage with
   `editor_search_stock_videos` and import selected results with
   `editor_import_stock_video`.
2. Preview exact scene timings and replacement effects with
   `editor_plan_storyboard`. It does not mutate the editor and returns a token
   bound to that plan. After the person approves, repeat the exact plan with
   its token and `confirmed: true` through `editor_compose_storyboard`.
   Atomic tools remain available for precise refinement. Jamendo music and
   Freesound effects retain Creative Commons source/license metadata.
3. Run `editor_validate_project` and `editor_get_render_diagnostics` before
   export. Validation reports missing assets, unsafe typography, likely text
   overflow, timeline gaps, invalid transitions, and known Elah limitations.
4. Seek and inspect important moments with `editor_capture_frame`. The tool
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
   completion time.

`editor_get_capabilities` is the recommended entry point. It returns
task-oriented workflows and groups the larger atomic surface into discovery,
composition, inspection, correction, and delivery tools so an agent does not
need to infer a path from every registered operation.

Licensed stock audio is optional. Configure `JAMENDO_CLIENT_ID` for music and
`FREESOUND_API_KEY` for sound effects. Results are restricted to downloadable
CC0, CC BY, or CC BY-SA items; imported assets retain creator, source, license,
and attribution requirements.

The returned artifact metadata describes the browser-created download. Inkframe
does not upload or retain the MP4, so WebMCP intentionally does not expose a
server URL for the local file.

Primary references:

- [W3C WebMCP draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)
