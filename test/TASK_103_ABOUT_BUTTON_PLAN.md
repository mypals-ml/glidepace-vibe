## Task 103: About Button in Header

### Implementation Plan
1. Add shared UI state for an `About` modal in the dashboard context so header actions and modal rendering use the same control path as existing overlays.
2. Add an overflow-aware `About` button to the far right side of the header toolbar.
3. Add a matching overflow menu action so the feature remains reachable on narrower widths.
4. Implement a lightweight `About` modal with concise product copy and a source link.
5. Update localization strings and `docs/FEATURES.md` to reflect the new entry point.

### Test Plan
1. Add a focused component test that verifies the header renders an `About` button and opens the modal state callback when clicked.
2. Run `npm run test -- src/components/Header/Header.test.tsx`.
3. Run the required repo verification commands:
   - `npm run lint`
   - `npm run type-check`
   - `npm run build`

### Gap Review / Risks
- The issue only asks for an `About button`, not a detailed information architecture. The modal therefore stays intentionally lightweight instead of introducing a large new settings/help surface.
- The header already uses overflow prioritization. The new button is assigned a low priority so it moves into the overflow menu before more critical controls disappear.
- There were no existing React component tests for the header area. The new test focuses on the regression-prone interaction point rather than trying to snapshot the whole responsive layout.
