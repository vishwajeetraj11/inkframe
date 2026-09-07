# Object tracking and selective grading

These are independent clip-inspector features. Neither requires the other.

## Object tracking

Select a video clip, open Object tracking, choose a box around a textured object, and analyze. Frames are decoded locally; bounded RGB patch matching returns sampled positions and confidence. Review the path and correct individual samples before attaching an image graphic. Attachment writes ordinary position keyframes and can be undone.

This is patch tracking, not semantic object recognition. Occlusion, rapid motion, or ambiguous texture can lose the track. A lost track cannot be attached: shorten the clip or choose a clearer box and retrack. Retimed clips, source transitions, and animated source transforms are unsupported. Project edits invalidate tracking results. Initial attachment supports image graphics, not text or blur masks.

WebMCP exposes `editor_track_object`, `editor_correct_object_track`, and confirmed `editor_attach_object_track`.

## Selective color grading

Select a video or image clip and add up to eight ellipse or rectangle regions. Set position, size, feather, inversion, exposure, temperature, tint, and saturation. Regions are static source-space masks, independent of tracking, and apply after the global grade. Preview and browser export share pixel grading, including image sources and preview orientation correction.

WebMCP exposes confirmed `editor_set_selective_grade`. It replaces the clip's regions while preserving its global grade. An empty region list removes selective adjustments. Region edits are persisted with the project and participate in normal undo/redo.
