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
- `editor_list_assets`
- `editor_list_style_presets`
- `editor_list_sound_effects`

Workspace and timeline actions:

- `editor_request_media_picker`
- `editor_switch_canvas`
- `editor_select_timeline_item`
- `editor_add_text_overlay`
- `editor_update_text_overlay`
- `editor_remove_text_overlay`
- `editor_update_clip`
- `editor_remove_clip`
- `editor_move_clip`
- `editor_set_crossfade`
- `editor_remove_crossfade`
- `editor_update_audio_track`
- `editor_remove_audio_track`
- `editor_add_sound_effect`
- `editor_apply_ai_editor_actions`
- `editor_request_export`
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

Primary references:

- [W3C WebMCP draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)
