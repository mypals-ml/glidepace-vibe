# Task #99 Implementation and Test Plan

## Scope

Refine the animated dependency link line effect in the Gantt view so the flowing dots move much more slowly.

## Implementation Plan

1. Review the dependency-line rendering in `src/components/Dashboard/Views/DependencyLines.tsx`.
2. Replace the hardcoded animated dash duration with a named constant so the display speed is explicit and easy to tune.
3. Slow the rendered dependency-line animation without changing the geometry, hover affordance, or break-link action behavior.
4. Update `docs/FEATURES.md` to reflect the calmer dependency-line motion in the Gantt chart.

## Test Plan

1. Run required static verification:
   - `npm run lint`
   - `npm run type-check`
   - `npm run build`
2. Manual behavior target:
   - Existing dependency lines should still render with animated dashes and arrowheads.
   - The dash motion should remain visible but noticeably slower than before.
   - Hover highlight and break-link controls should still appear.

## Review Notes and Risks

- This is a presentation-only adjustment, so automated coverage is limited to static verification.
- "Very slow" is subjective; if the new speed still feels too active in real usage, the duration constant can be adjusted without further structural changes.
