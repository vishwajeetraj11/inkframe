# Architecture Notes

## Boundaries

- `src/lib/editor`: pure editor-domain logic and Elah project conversion. Avoid React and DOM imports here.
- `src/lib/text-motion`: pure text-motion domain logic only.
- `src/components/editor` and `src/components/text-motion`: UI composition and hooks.
- `src/lib/export`: client-side Elah export and browser download helpers.
- `src/server/services`: OpenAI generation and chat orchestration only.

## Naming rules

- New editor visual presets must keep a stable `stylePreset` literal in `src/lib/editor/types.ts`.
- New editor gallery cards belong in `src/lib/editor/templates/catalog.ts`.
- Structured overlay presets should get their own parser module under `src/lib/editor/parsers/`.
- New text-motion templates belong in `src/lib/text-motion/templates.ts` and must preserve `TextMotionTemplate` literals.
- API routes should stay thin and delegate orchestration to `src/server/services/`.

## Rendering direction

- Keep a single Elah `EditorProvider` around preview and timeline; Elah uses module-level stores.
- Convert Inkframe state with `src/lib/editor/elah-adapter.ts` instead of duplicating timeline state.
- Keep export browser-only through Elah's worker pipeline and MediaBunny.
- Remote asset integrations should register URLs in the Elah project rather than proxying media through an API route.

## Testing expectations

For future refactors, keep at least one test in place for each of these behaviors:

- template lookup
- timeline normalization
- structured preset parsing/building
- AI action parsing
- Elah project projection
- a UI smoke test for whichever panel/router was split
