# Deterministic editing contract

This contract governs canonical Inkframe state, native Elah edits, persistence,
WebMCP commands, preview, and export. It is a target contract; the phased roadmap
must verify each capability before advertising it as supported.

## Placement and duration

- Project time uses integer frames at `FPS = 30`. Every item occupies the half-open
  interval `[startFrame, endFrame)`, with `0 <= startFrame < endFrame`.
- A clip's placement is explicit, independent of its position in the `clips` array.
  Normalization preserves valid placement and is idempotent. It never globally
  packs clips or closes gaps.
- Different media lanes may overlap. Within one media lane, clips may touch or
  have gaps; their canonical intervals may not overlap in the first release.
- Timeline content duration is the maximum exclusive end of all clips, text,
  captions, and audio. An empty timeline has content duration zero;
  a renderer may require a one-frame empty canvas. The content limit is 1,800 frames.
- Moving a clip changes placement only. A non-ripple move does not change other
  clips. Explicit ripple/reorder commands identify their affected lane; they must
  not modify placements in other lanes.

## Transitions preserve the native cut

A transition joins consecutive clips in chronological order on the same media
lane, and only when `from.endFrame === to.startFrame`. Array adjacency across lanes
does not establish an edge. A gap does not establish an edge. Duplicate edges and
cross-lane transitions are invalid.

For duration `D` and cut `C = to.startFrame`, the native transition window is
`[C - floor(D / 2), C - floor(D / 2) + D)`. Odd durations keep that exact rounding.
Transitions do not move clips, subtract time, or create canonical clip overlap.
Existing duration constraints remain bounded by the participating clip durations.

This preserves the current Elah adapter convention: `toElahProject` projects
`clip.startFrame` directly and sets transition start to
`toClip.startFrame - floor(durationInFrames / 2)`. Elah's native editor similarly
creates a cut-centered transition, although its creation command rounds requested
durations to an even number. Reverse projection retains the resulting duration.

The previous `buildRenderTrack` and `getTimelineDurationInFrames` subtracted
transition durations and described different timing. The implementation now uses
the native convention; the old calculation is not migration authority.

## Legacy project migration

The project-content version is separate from IndexedDB database version 2 and
the existing persisted-record `schemaVersion: 2` storage layout.

For an unversioned project, retain stored valid starts/ends, trim ranges, IDs,
lane references, and transition durations. Supply default lanes for missing legacy
lane references. Do not subtract transition durations or repack clips: doing so
would change the composition currently projected to Elah. Once migrated, record
the content version so subsequent loads are idempotent. Metadata-only migration
must not rewrite unchanged media Blobs.

Malformed or ambiguous placements must surface a load/validation diagnostic.
Do not silently resolve same-lane overlaps by moving or dropping user clips.
Migration cannot recover gaps that an older save already erased through global
normalization. Existing legacy storage migration for asset Blobs remains intact.

Regression fixture: two image clips `[0,90)` and `[90,150)` with a 15-frame fade
keep a cut at 90, transition window `[83,98)`, and content end 150, not 135.
That fixture must round-trip through the Elah adapter unchanged.

## Source time is separate

Timeline duration is `endFrame - startFrame`. Source trims and time maps
describe sampling inside the asset; moving a clip does not alter sampling.
Normal playback uses linear source time. Keyframe positions are clip-local output
frames. Freeze holds one source timestamp; speed ramps integrate speed over output
time. One shared pure sampling specification must govern both preview resolution
and the export worker's independent decoder scheduling.

Splitting preserves the original samples on either side, rebases local animation
and time-map coordinates, and preserves source identity. Validate source bounds
using asset metadata rather than assuming a trim endpoint is the source duration.

## Atomic edits and verification

UI and WebMCP invoke the same validated canonical operation. Invalid placement,
lane identity, source range, duration, or unsupported mapping returns a structured
failure with no state, history, or persistence change. Multi-item edits validate
the complete prospective version and commit once. One completed gesture is one
undo step. Native Elah edits must pass the same validation before canonical commit;
failure restores the last accepted native projection.

Each capability must survive unrelated edits, undo/redo, aspect switching,
save/reload, direct seeks, playback, and an actual browser MP4 export. Export
acceptance compares decoded boundary frames and audio timing, not merely playable
metadata. Determinism concerns equivalent state and sampled content; cross-browser
MP4 byte identity is not required.

## Inspection evidence

- `src/lib/editor/domain/normalization.ts`: explicit placement preservation.
- `src/lib/editor/domain/render.ts`: maximum end and lane-local cut edges.
- `src/lib/editor/domain/version.ts`: normalization and lane assignment boundary.
- `src/lib/editor/elah-adapter.ts`: explicit native placement, cut-centered
  transitions, maximum-end canvas duration, and reverse projection.
- `node_modules/@elah/core/dist/editor/TimelineEngine.js`: native transition
  creation centered around `toClip.startFrame`.
- `src/lib/editor/project-storage.ts`: database/record layout versioning.

## Implementation status (2026-09-06)

The working implementation now includes explicit lane placement, transforms,
keyframes, caption cues, interval-driven ducking, freeze intervals, and positive
speed maps. Browser acceptance evidence for the tested scenarios is recorded below. Broader
release gates remain explicit; these results do not imply parity for every input.

- `domain/normalization.ts` preserves clip placement. `domain/render.ts` uses
  maximum end times and cut-centered transitions rather than legacy packing.
- `reducer.ts` supports append/place/reorder operations and validates prospective
  versions. Explicit placement is non-ripple. Edits that disconnect a transition
  remove that edge; explicit invalid transition creation is rejected.
- `project-migrations.ts` accepts unversioned content and content version 1,
  rejects unknown versions, and refuses migration that changes clip/source or
  transition timing. `project-storage.ts` upgrades unversioned project metadata
  once without changing IndexedDB layout version 2 or rewriting asset Blobs.
- Asset metadata includes optional positive integer microsecond duration and
  video dimensions. Browser metadata probes populate missing video/audio metadata
  with a ten-second timeout and release media resources on completion/cancellation.
  Failed probes leave metadata absent; metadata is retained across save/reload.
- The adapter and patched Elah runtime carry animation, caption projection, audio
  envelopes, and source-time mappings. `deterministic-runtime.mjs` supplies shared
  evaluation for browser preview and worker export. Installed dependency patch
  verification and actual rendered/exported content verification are separate gates.

### Supported data contracts

| Capability | Current contract |
| --- | --- |
| Transforms | Normalized canvas x/y and anchor, positive source-pixel scale, rotation in radians, opacity 0–1. Missing transform retains automatic fit. |
| Keyframes | Clip-local frame controls for x/y/scale/rotation/opacity; ordered unique frames; linear or hold interpolation. A control may sit at the exclusive duration boundary. Splits rebase controls and preserve evaluated boundary values. |
| Captions | Dedicated caption lane and plain text cues; same-lane overlaps rejected. SRT/WebVTT import is atomic with deterministic cue IDs. Starts round down, ends round up at 30 fps; quantization collisions are errors. |
| Ducking | Explicit audio/video trigger references and target reference, attenuation −60 to 0 dB, attack/release in frames. Overlapping rules use strongest attenuation. Muted/non-normal-retimed triggers do not drive the envelope. |
| Freeze | Replace an interval inside a video with a held source timestamp in microseconds; split surrounding segments and retain total timeline duration. Held embedded audio is muted. |
| Speed | Positive speed points with linear/hold interpolation; integrate speed over output time. Preserve timeline duration, reject out-of-bounds maps, mute embedded audio. |

Captions reject WebVTT positioning/settings, STYLE/REGION/NOTE blocks, markup, and
escaped entities explicitly rather than silently dropping their meaning. Imports
require a plain WEBVTT header or SRT timing blocks. Automatic transcription,
word-level highlighting, styled caption interchange, crop/masks/blend modes,
reverse playback, pitch-preserving audio retiming, and duration-extending freezes
are outside the current implementation.

### WebMCP commands

New commands require explicit `aspect`, `expectedRevision`, and `operationId`.
The transactional history command validates the complete batch; retry receipts
prevent replaying an already-applied operation. Obtain the revision from current
project inspection before preparing a new command. Reusing an operation ID with
different content is invalid.

| Tool | Additional principal fields |
| --- | --- |
| `editor_add_track` | `id`, `kind`, `name` |
| `editor_reorder_tracks` | `trackIds` containing every lane exactly once |
| `editor_place_clip` | `clipId`, `trackId`, `startFrame` |
| `editor_set_clip_transform` | `clipId`, `transform`, optional `opacity` |
| `editor_set_clip_keyframes` | `clipId`, `keyframes` |
| `editor_upsert_caption_cues` | `cues` on existing caption lanes |
| `editor_import_captions` | `trackId`, `format` (`srt`/`vtt`), `content`, `mode` (`append`/`replace`, default append) |
| `editor_set_audio_ducking` | `rule` |
| `editor_remove_audio_ducking` | `ruleId`, `confirmed: true` |
| `editor_freeze_clip_range` | `clipId`, `startFrame`, `endFrame`, `sourceTimeUs` |
| `editor_set_clip_speed_ramp` | `clipId`, positive speed `points`, `audioPolicy: "mute"` |

The registered tool input schema is authoritative. Existing inspection, validation,
frame capture, history, and export tools remain the verification entry points.
Failures must remain visible to callers; a rejected command must not create an
undo step or be reported as successfully applied.

### Remaining acceptance gates and risks

1. **First vertical slice:** export a 300-frame base with a higher-lane picture-in-picture
   on `[60,180)`. Verify decoded frames 59/60 and 179/180, layering, transform,
   soundtrack counted once, undo/reload, and both aspect ratios.
2. **Animation:** direct-seek and forward-playback samples agree at keys and between
   keys. Split/trim preserves sampling; compare exported boundary/midpoint frames.
3. **Captions:** burn-in visibility respects exclusive ends and plain text styling;
   check both aspect ratios, import errors, persistence, and actual MP4 frames.
4. **Audio:** compare preview and offline PCM envelope behavior, including seek,
   overlapping triggers, embedded audio, fades, cancellation, and decode failure.
5. **Retiming:** compare source samples before/during/after hold and ramp boundaries,
   including variable-frame-rate input. Require trustworthy source duration for
   full-source bounds. A trim-end fallback is only a conservative local bound and
   does not establish verified asset duration.
6. **Integration:** native Elah edit round trips retain every effect and asset
   reference; unsupported edits return a visible error. Verify a gesture is one
   history step and an atomic tool batch is one step.
7. **Resources:** exercise multiple simultaneous decoders, cancellation, and
   repeated exports; validate worker/runtime patch consistency after dependency
   installation and measure practical memory limits.

Automated domain, adapter, tool, and persistence checks provide evidence for their
specific contracts. A playable MP4 or successful encoder completion alone does not
prove image/audio parity. The recorded browser checks below establish selected
content/timing behavior; they do not establish color identity, a memory budget,
or general cross-browser equivalence.

## Recorded verification

The final integrated unit suite passes 248 tests across 48 files. TypeScript,
ESLint, and the production build pass. The pinned Elah patch also passes a pristine-install check: applying
it twice leaves all 167 dependency distribution files byte-identical.

All seven new browser scenarios passed when executed in stable subsets, alongside the
existing browser export smoke check. Recorded coverage includes portrait export,
cancellation, repeated export with prior artifact URL revocation, and caption UI
at a 390 × 844 mobile viewport. These checks provide evidence for the exercised
selection, composition, and frame-timing paths rather than universal codec parity.

Observed limits and outstanding checks:

- Preview and encoded export can differ in color conversion: one green sample
  was 255 in preview and 215 after export. Timing and source-selection assertions
  passed; exact preview/export RGB identity is not claimed.
- Cancellation has latency during initial audio decoding. Verify cancellation
  completion and resource release rather than assuming every decoding stage can
  be interrupted immediately.
- No measured extreme multilayer memory limit or cross-browser guarantee has
  been established. The tested compositions do not define a safe maximum number
  of simultaneous video decoders.
- Transitions on retimed clips are explicitly rejected. Animated clips combined
  with transitions remain unverified and must receive dedicated boundary-frame
  checks before being advertised as a supported combination.
- Required-audio failure propagation passed a real corrupt-audio browser test
  with no download. Synthetic video soundtracks are probed: confirmed absent
  streams are omitted, while unknown failures stop export. Zero-gain sources are
  skipped before fetching.
- Source interval lookup passed 5 fps variable-frame-rate and 60 fps collision
  fixtures. The terminal H.264 frame passed after a confirmed-end-of-file decoder
  flush; seeking resets that state. Preview capture waits for the actual requested
  source interval instead of accepting a nearby decoded frame.
