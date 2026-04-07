# Remotion 30-Day Learning Plan

## How To Use This Plan

This plan is for a senior software engineer who has zero prior Remotion knowledge and wants to learn it efficiently through this repo.

The structure is intentionally hybrid:

- Week 1 teaches the Remotion mental model first.
- Week 2 maps that mental model into this codebase.
- Week 3 focuses on preset architecture, layout systems, and reusable render logic.
- Week 4 covers media, fonts, export, and a small capstone.

Use this plan with three rules:

1. Keep each day narrow. One concept, one reading pass, one visible takeaway.
2. End each day with a tiny artifact: a note, a traced data flow, or a safe visual change in a local branch.
3. Do not start with the hardest presets. Learn the system before chasing the fanciest output.

You should not need external docs to understand the sequence below. The repo links are the primary study surface.

## What Success Looks Like

By day 30, you should be able to:

- explain what a Remotion composition is and how frames drive animation
- read and modify the main Remotion files in this repo without guessing
- understand how editor state becomes composition props
- clone and adapt an existing preset safely
- explain the difference between previewing, bundling, and rendering/exporting

---

## Week 1: Core Remotion Mental Model

### Day 1: What Remotion actually is

- Focus: understand Remotion as deterministic React video rendering, not DOM animation.
- Read:
  - [`src/remotion/index.ts`](../src/remotion/index.ts)
  - [`src/remotion/RemotionRoot.tsx`](../src/remotion/RemotionRoot.tsx)
- Learn:
  - `registerRoot()`
  - `Composition`
  - `fps`, `durationInFrames`, `width`, `height`
  - `defaultProps`
- Checkpoint:
  - explain in your own words how one `Composition` becomes a renderable video surface.

### Day 2: Frames, not timelines

- Focus: internalize frame-based thinking.
- Read:
  - [`src/remotion/TextMotionComposition.tsx`](../src/remotion/TextMotionComposition.tsx)
  - [`src/remotion/EditorComposition.tsx`](../src/remotion/EditorComposition.tsx)
- Learn:
  - every visual state is a function of the current frame
  - durations and offsets are computed, not “played”
- Checkpoint:
  - answer: “what should be true at frame 0, frame 30, and frame 90?”

### Day 3: Sequencing

- Focus: understand how scenes are arranged over time.
- Read:
  - [`src/remotion/TextMotionComposition.tsx`](../src/remotion/TextMotionComposition.tsx)
- Learn:
  - `Sequence`
  - `from`
  - `durationInFrames`
  - cumulative timing from prior scenes
- Checkpoint:
  - explain how `sequencedScenes` is built and why a scene needs `from` and `sceneDuration`.

### Day 4: Interpolation and motion curves

- Focus: understand how values animate across frames.
- Read:
  - [`src/remotion/editor-presets/shared.tsx`](../src/remotion/editor-presets/shared.tsx)
  - [`src/remotion/editor-presets/editorial-stat-ring.tsx`](../src/remotion/editor-presets/editorial-stat-ring.tsx)
- Learn:
  - `interpolate`
  - `spring`
  - `Easing`
  - clamping and controlled value ranges
- Checkpoint:
  - identify three places where a numeric value becomes visible motion.

### Day 5: Absolute composition layering

- Focus: understand how Remotion scenes are composed visually.
- Read:
  - [`src/remotion/TextMotionComposition.tsx`](../src/remotion/TextMotionComposition.tsx)
  - [`src/remotion/editor-presets/layers.tsx`](../src/remotion/editor-presets/layers.tsx)
- Learn:
  - `AbsoluteFill`
  - stacking background, media, overlays, captions
  - composing layers like normal React trees
- Checkpoint:
  - draw a quick layer order diagram for one composition.

### Day 6: Props and repeatability

- Focus: understand why compositional props matter more than local component state.
- Read:
  - [`src/remotion/RemotionRoot.tsx`](../src/remotion/RemotionRoot.tsx)
  - [`src/remotion/default-editor-composition-props.ts`](../src/remotion/default-editor-composition-props.ts)
- Learn:
  - how default props seed a composition
  - why render inputs must be serializable and stable
- Checkpoint:
  - explain the difference between “component code” and “composition input.”

### Day 7: Week 1 review

- Focus: consolidate the mental model.
- Review:
  - [`src/remotion/index.ts`](../src/remotion/index.ts)
  - [`src/remotion/RemotionRoot.tsx`](../src/remotion/RemotionRoot.tsx)
  - [`src/remotion/TextMotionComposition.tsx`](../src/remotion/TextMotionComposition.tsx)
- Expected outcome:
  - you can explain Remotion without mentioning this specific app first.

---

## Week 2: How This Repo Uses Remotion

### Day 8: Remotion entrypoints in this app

- Focus: understand the minimum boot path.
- Read:
  - [`src/remotion/index.ts`](../src/remotion/index.ts)
  - [`src/remotion/RemotionRoot.tsx`](../src/remotion/RemotionRoot.tsx)
- Learn:
  - which compositions exist
  - why there are editor and text-motion compositions
  - why aspect ratio becomes separate composition IDs
- Checkpoint:
  - explain why this repo has both `reel-9-16` and `widescreen-16-9`.

### Day 9: Text-motion as the simpler learning surface

- Focus: use the smallest meaningful renderer in the repo.
- Read:
  - [`src/remotion/TextMotionComposition.tsx`](../src/remotion/TextMotionComposition.tsx)
  - [`src/remotion/text-motion/default-scene-view.tsx`](../src/remotion/text-motion/default-scene-view.tsx)
  - [`src/remotion/text-motion/grid-kinetic.tsx`](../src/remotion/text-motion/grid-kinetic.tsx)
- Learn:
  - how a template changes scene rendering
  - how one project shape maps to multiple scene components
- Checkpoint:
  - explain when `GridKineticSceneView` is used instead of `DefaultSceneView`.

### Day 10: Default editor props

- Focus: understand the default editor composition payload.
- Read:
  - [`src/remotion/default-editor-composition-props.ts`](../src/remotion/default-editor-composition-props.ts)
  - [`src/lib/editor/constants.ts`](../src/lib/editor/constants.ts)
- Learn:
  - default version structure
  - how durations and aspect are seeded
- Checkpoint:
  - describe the minimum data the editor composition needs to render something sensible.

### Day 11: Editor composition orchestration

- Focus: understand the main renderer at a high level.
- Read:
  - [`src/remotion/EditorComposition.tsx`](../src/remotion/EditorComposition.tsx)
- Learn:
  - track building
  - backdrop selection
  - clip sequencing
  - text overlay orchestration
  - audio layering
- Checkpoint:
  - write a short note with the top-level responsibilities of `EditorComposition`.

### Day 12: Domain types behind the renderer

- Focus: connect render logic to editor domain data.
- Read:
  - [`src/lib/editor/types.ts`](../src/lib/editor/types.ts)
  - [`src/lib/editor/schema.ts`](../src/lib/editor/schema.ts)
- Learn:
  - `VersionTimeline`
  - clip/text/audio asset shapes
  - validation vs runtime use
- Checkpoint:
  - identify which types shape the editor composition props directly.

### Day 13: Timeline-to-render transformation

- Focus: understand how timeline state becomes render state.
- Read:
  - [`src/lib/editor/timeline.ts`](../src/lib/editor/timeline.ts)
  - [`src/remotion/EditorComposition.tsx`](../src/remotion/EditorComposition.tsx)
- Learn:
  - `buildRenderTrack`
  - used asset collection
  - normalized render entries
- Checkpoint:
  - explain what “render track” means in this codebase.

### Day 14: Aspect ratio and composition behavior

- Focus: understand how reel vs widescreen changes layout logic.
- Read:
  - [`src/remotion/RemotionRoot.tsx`](../src/remotion/RemotionRoot.tsx)
  - one preset with obvious aspect branching, such as [`src/remotion/editor-presets/editorial-seat-arc.tsx`](../src/remotion/editor-presets/editorial-seat-arc.tsx)
- Learn:
  - composition dimensions vs in-preset responsive logic
- Checkpoint:
  - explain which concerns are handled by the composition and which are handled inside a preset.

---

## Week 3: Presets, Layout Systems, And Visual Architecture

### Day 15: Preset routing

- Focus: understand how preset IDs become render functions.
- Read:
  - [`src/remotion/editor-presets/preset-router.tsx`](../src/remotion/editor-presets/preset-router.tsx)
  - [`src/remotion/editor-presets/editorial-presets.tsx`](../src/remotion/editor-presets/editorial-presets.tsx)
  - [`src/remotion/editor-presets/text-presets.tsx`](../src/remotion/editor-presets/text-presets.tsx)
- Learn:
  - renderer lookup
  - fallback behavior
  - separation between routing and preset logic
- Checkpoint:
  - explain how a `stylePreset` string becomes visible output.

### Day 16: Shared helpers

- Focus: understand the common building blocks.
- Read:
  - [`src/remotion/editor-presets/shared.tsx`](../src/remotion/editor-presets/shared.tsx)
- Learn:
  - font stacks
  - texture helpers
  - clip/media helpers
  - world map projection setup
  - reusable reveal patterns
- Checkpoint:
  - list five helpers in `shared.tsx` and what each one abstracts away.

### Day 17: First preset deep dive

- Focus: master one clean preset before touching harder ones.
- Read:
  - [`src/remotion/editor-presets/editorial-stat-ring.tsx`](../src/remotion/editor-presets/editorial-stat-ring.tsx)
  - [`src/lib/editor/chart-card.ts`](../src/lib/editor/chart-card.ts)
- Learn:
  - editorial texture system
  - headline/highlight reveal
  - chart animation
  - annotation timing
- Checkpoint:
  - explain the preset in layers: background, typography, highlight, chart, labels.

### Day 18: Layer primitives

- Focus: understand reusable layer components that other presets rely on.
- Read:
  - [`src/remotion/editor-presets/layers.tsx`](../src/remotion/editor-presets/layers.tsx)
  - [`src/remotion/editor-presets/motion-typography-layer.tsx`](../src/remotion/editor-presets/motion-typography-layer.tsx)
- Learn:
  - `ClipLayer`
  - asset handling
  - shared motion typography building blocks
- Checkpoint:
  - explain when this repo uses a dedicated layer component instead of inline JSX.

### Day 19: Geometry-heavy preset

- Focus: understand layout math without getting lost in the visuals.
- Read:
  - [`src/remotion/editor-presets/editorial-seat-arc.tsx`](../src/remotion/editor-presets/editorial-seat-arc.tsx)
- Learn:
  - arc geometry
  - leader lines
  - label placement
  - aspect-specific layout adjustments
- Checkpoint:
  - separate the file into “animation logic” vs “geometry math” in your notes.

### Day 20: Timeline-style editorial preset

- Focus: understand information-dense storytelling layouts.
- Read:
  - [`src/remotion/editor-presets/vox-timeline.tsx`](../src/remotion/editor-presets/vox-timeline.tsx)
  - [`src/remotion/editor-presets/vox-timeline-ribbon.tsx`](../src/remotion/editor-presets/vox-timeline-ribbon.tsx)
  - [`src/remotion/editor-presets/vox-timeline-ledger.tsx`](../src/remotion/editor-presets/vox-timeline-ledger.tsx)
  - [`src/lib/editor/vox-timeline.ts`](../src/lib/editor/vox-timeline.ts)
- Learn:
  - structured text parsing
  - event-driven layout
  - annotation timing
  - visual variants over one data model
- Checkpoint:
  - explain how three visual variants can share one data contract.

### Day 21: Map presets

- Focus: understand nontrivial visual data rendering inside Remotion.
- Read:
  - [`src/remotion/editor-presets/world-map-focus.tsx`](../src/remotion/editor-presets/world-map-focus.tsx)
  - [`src/remotion/editor-presets/regional-map-focus.tsx`](../src/remotion/editor-presets/regional-map-focus.tsx)
  - [`src/lib/maps/world.ts`](../src/lib/maps/world.ts)
- Learn:
  - map projection inputs
  - focus choreography
  - annotation and region framing
- Checkpoint:
  - explain what is “map/data prep” vs what is “Remotion render logic.”

### Day 22: Preset system review

- Focus: consolidate preset architecture.
- Review:
  - [`src/remotion/editor-presets/preset-router.tsx`](../src/remotion/editor-presets/preset-router.tsx)
  - [`src/remotion/editor-presets/shared.tsx`](../src/remotion/editor-presets/shared.tsx)
  - one simple preset and one complex preset
- Expected outcome:
  - you can choose the right starting point for a new preset.

---

## Week 4: Fonts, Media, Export, And Capstone

### Day 23: Remotion-side font loading

- Focus: understand fonts in rendered video, not just fonts in Next.js UI.
- Read:
  - [`src/remotion/fonts.ts`](../src/remotion/fonts.ts)
  - [`src/app/layout.tsx`](../src/app/layout.tsx)
- Learn:
  - why `next/font` is not enough for Remotion render output
  - how `@remotion/google-fonts` is used here
  - how font stacks are reused across presets
- Checkpoint:
  - explain why app fonts and render fonts are related but not identical concerns.

### Day 24: Media and audio inside the composition

- Focus: understand render-safe asset handling.
- Read:
  - [`src/remotion/EditorComposition.tsx`](../src/remotion/EditorComposition.tsx)
  - [`src/remotion/editor-presets/shared.tsx`](../src/remotion/editor-presets/shared.tsx)
- Learn:
  - image vs video handling
  - `Img`, `Video`, `OffthreadVideo`, `Audio`
  - how clips and audio are sequenced
- Checkpoint:
  - explain why some assets are rendered differently in preview vs final render modes.

### Day 25: Local render pipeline

- Focus: understand how a composition becomes a file locally.
- Read:
  - [`src/server/render-service.ts`](../src/server/render-service.ts)
- Learn:
  - bundling
  - composition selection
  - `renderMedia`
  - `selectComposition`
  - local output handling
- Checkpoint:
  - trace the local path from composition ID to output file.

### Day 26: Export orchestration

- Focus: understand how editor input is prepared for rendering.
- Read:
  - [`src/server/services/editor-export-service.ts`](../src/server/services/editor-export-service.ts)
  - [`src/server/export-filenames.ts`](../src/server/export-filenames.ts)
  - [`src/server/temp-storage.ts`](../src/server/temp-storage.ts)
- Learn:
  - temp directories
  - asset file preparation
  - inline images vs file URLs
  - final output persistence
- Checkpoint:
  - explain the difference between render service and export service responsibilities.

### Day 27: Vercel render path

- Focus: understand the hosted render flow without implementing changes.
- Read:
  - [`src/server/render-service.ts`](../src/server/render-service.ts)
  - [`create-remotion-snapshot.mjs`](../create-remotion-snapshot.mjs)
  - [`src/server/rendering-environment.ts`](../src/server/rendering-environment.ts)
- Learn:
  - sandbox snapshot usage
  - local vs Vercel branching
  - Blob-backed outputs
- Checkpoint:
  - explain why Vercel rendering needs extra infrastructure that local rendering does not.

### Day 28: Choose your capstone

- Focus: design a small, safe Remotion extension.
- Recommended base files:
  - [`src/remotion/editor-presets/editorial-stat-ring.tsx`](../src/remotion/editor-presets/editorial-stat-ring.tsx)
  - [`src/remotion/editor-presets/chart-card.tsx`](../src/remotion/editor-presets/chart-card.tsx)
  - [`src/remotion/editor-presets/news-clipping.tsx`](../src/remotion/editor-presets/news-clipping.tsx)
- Choose one capstone shape:
  - a new title treatment
  - a new texture variation
  - a new chart flavor
  - a new editorial card derived from an existing preset
- Checkpoint:
  - write down the smallest useful version of the preset before touching code.

### Day 29: Build the capstone in a local branch

- Focus: execute a small preset adaptation, not a giant new system.
- Use:
  - one existing preset file as base
  - [`src/remotion/editor-presets/preset-router.tsx`](../src/remotion/editor-presets/preset-router.tsx)
  - any parser/type file needed for the chosen preset
- Expected outcome:
  - one small original preset variation that works in at least one aspect ratio.

### Day 30: Final review

- Focus: consolidate what you now know.
- Review:
  - [`src/remotion/RemotionRoot.tsx`](../src/remotion/RemotionRoot.tsx)
  - [`src/remotion/EditorComposition.tsx`](../src/remotion/EditorComposition.tsx)
  - [`src/server/render-service.ts`](../src/server/render-service.ts)
- Write short answers to these questions:
  - What is a composition?
  - What role do frames play?
  - How do props flow into Remotion?
  - How do presets stay reusable?
  - How does local render differ from Vercel render?
- Expected outcome:
  - you can explain the repo’s Remotion architecture without rereading the files.

---

## Pitfalls To Avoid

- Do not confuse learning the repo with learning Remotion.
  - This codebase has real product complexity beyond the core video model.
- Do not start with the hardest presets.
  - `editorial-stat-ring` is a much better first deep dive than maps or complex timelines.
- Do not think in “triggered animations.”
  - Think in frame-dependent state.
- Do not mix preview, bundling, and rendering into one mental bucket.
  - They are related, but they are different systems.
- Do not begin with Vercel export or sandbox internals.
  - Learn composition logic first.
- Do not change too many things at once.
  - One timing change or one layout change teaches more than a giant refactor.

## Daily Success Criteria

Each day is complete only if you produce one of the following:

- a short written explanation in your own words
- a tiny diagram of a render/data flow
- a safe local visual tweak on a branch
- a list of symbols/components you now understand

If you finish reading but cannot explain the file in plain English, the day is not done yet.

## Recommended Capstone

Build one small original preset variation rather than a brand-new complex renderer.

Good capstones:

- a new editorial card derived from `chart-card`
- a new highlight/texture treatment for `editorial-stat-ring`
- a simplified documentary opener based on `news-clipping`

Avoid for the first capstone:

- full map systems
- a brand-new timeline engine
- export pipeline changes
- Vercel render infrastructure changes

## What You Should Know By Day 30

By the end of this plan, you should be able to:

- explain Remotion’s core primitives without relying on docs
- identify the role of each main file under `src/remotion`
- trace how timeline/editor data becomes renderable composition props
- read preset files and separate shared logic from preset-specific logic
- understand how media, fonts, and audio are handled for rendering
- explain the local render path and the Vercel render path at a high level
- add a small preset variation safely in this repo
