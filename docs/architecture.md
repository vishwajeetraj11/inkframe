# Architecture Notes

## Boundaries

- `src/lib/editor`: pure editor-domain logic only. Avoid React, DOM, or Remotion imports here.
- `src/lib/text-motion`: pure text-motion domain logic only.
- `src/components/editor` and `src/components/text-motion`: UI composition and hooks.
- `src/server/services`: orchestration for filesystem, OpenAI, and render flows.
- `src/remotion`: composition and renderer code only.

## Naming rules

- New editor visual presets must keep a stable `stylePreset` literal in `src/lib/editor/types.ts`.
- New editor gallery cards belong in `src/lib/editor/templates/catalog.ts`.
- Structured overlay presets should get their own parser module under `src/lib/editor/parsers/`.
- New text-motion templates belong in `src/lib/text-motion/templates.ts` and must preserve `TextMotionTemplate` literals.
- API routes should stay thin and delegate orchestration to `src/server/services/`.

## Refactor direction

- `src/remotion/EditorComposition.tsx` is still the largest remaining hotspot.
- The next renderer pass should move preset-specific renderers behind `src/remotion/editor-presets/` and keep `EditorComposition.tsx` as orchestration only.
- Shared renderer helpers should be placed beside preset contracts rather than reintroduced into a single monolithic file.

## Testing expectations

For future refactors, keep at least one test in place for each of these behaviors:

- template lookup
- timeline normalization
- structured preset parsing/building
- AI action parsing
- service validation or route error mapping
- a UI smoke test for whichever panel/router was split
