# Calcpad.Blocks UI Build Order

> **Status:** Implementation plan  
> **Scope:** `Calcpad.Web/frontend/Calcpad.Blocks`  
> **Target branch:** `feature/calcpad-blocks-foundation`  
> **Purpose:** Define the dependency-safe implementation order for the source-backed Highlighter inspection workspace.

This document is the execution order for the next UI implementation. It does not authorize changes to Calcpad.Highlighter, the host editor, or unrelated Calcpad projects. Contract changes must be reviewed explicitly; do not silently expand the adapter's claims.

## 1. Build rule

**Nothing in `src/ui/` is written before its adapter imports resolve, and no component is written before its composable exists.**

Work proceeds through the gates below. A gate is complete only when its acceptance criteria and tests pass. Do not start the next phase to work around a failed gate.

All paths in this document are relative to `Calcpad.Web/frontend/Calcpad.Blocks/`.

## 2. Current repository baseline

The following foundation already exists on the target branch:

- `src/core/source/contracts.ts`: host-owned source IDs, revisions, ranges, immutable snapshots, source-buffer providers, edit requests, and source host contracts.
- `src/core/source/range.ts`: source-range conversion helpers.
- `src/integrations/calcpad/highlighter-contract.ts`: current Highlighter structural-output adapter, projection contract, source binding, and session/projection factory.
- `src/ui/CalcpadBlocksWorkbench.vue`: initial source/construct inspection workbench.
- `src/ui/index.ts`: current UI entry point.
- `tests/contracts/highlighter-contract.test.ts` and `tests/core/source-range.test.ts`: existing test naming convention uses `.test.ts`.

The source-contract blocker mentioned in the original planning discussion is cleared on this branch: `src/core/source/contracts.ts` exists. Composables should use its actual exported types rather than inferred or duplicated substitutes.

The existing workbench is an inspection prototype. The planned `WorkspaceShell` is the structured workspace described below; do not silently delete or replace the prototype. Preserve it, adapt it, or explicitly deprecate it in a separately reviewed change.

## 3. Dependency and ownership rules

### 3.1 Layer boundaries

- Source contracts define host-owned source identity, snapshots, revisions, ranges, and edit requests.
- The Calcpad integration adapts Highlighter output against the exact snapshots supplied to that run.
- UI composables own UI state and derive everything else.
- Components render props and emit intent; they do not own competing copies of workspace state.
- The host owns source buffers, persistence, edits, and actual navigation behavior.

The UI may import the public host callback types it needs. The host must not import UI implementation details. Keep this as a one-way compile-time contract: the UI calls only the supplied host interface, and the host implements that interface outside the UI package. Avoid circular imports.

### 3.2 Non-negotiable invariants

1. UI imports the Calcpad integration through `src/integrations/calcpad/index.ts`; it never imports `highlighter-contract.ts` directly.
2. `useWorkspace` is the composition root and the sole owner of workspace mode and composed UI state.
3. Writable state is limited to mode, selection index, filter inputs, and the collapse map. Other values are computed/read-only.
4. Components receive controlled values and callbacks through props/events. They do not instantiate their own state-owning composables.
5. `useSourceNavigation` is the only UI path that invokes the host's `onNavigate` callback.
6. Source text is read-only. No `v-model` or direct mutation of source text. Future editing must use a host-owned edit-request contract.
7. No inference: do not infer statement boundaries, semantic span roles, containment, nesting, or macro provenance beyond what the adapter explicitly supplies.
8. Unknown kinds, origins, ordinals, names, and unverified ranges remain visible and diagnosable; they are never silently dropped or fatal.
9. A valid source range is not automatically a semantic construct span. Do not label it verified unless the adapter's mapping status supports that claim.
10. Keep selection and filter inputs across mode changes. Do not auto-scroll when selection changes.

## 4. Phase 0 — Foundation hardening

**Status:** Adapter and source contracts exist; the review items below remain open until verified and tested.

Files:

- `src/integrations/calcpad/highlighter-contract.ts`
- `tests/contracts/highlighter-contract.test.ts` (existing convention)
- `tests/contracts/adapter.test.ts` (add if adapter coverage is not already in the contract test)

Complete in this order:

1. Pin kind and origin ordinal tables to the authoritative upstream definitions. Add provenance comments identifying the source type/file and version or commit used. Export table lengths.
2. Emit diagnostics for unknown kind/origin ordinals and names. Preserve the raw value; do not coerce an unknown value into a known one.
3. Add explicit `kindStatus` and `originStatus` discriminators to `BoundHighlighterConstruct`, with a documented known/unknown shape. Preserve `rawKind` and `rawOrigin`.
4. Exhaustively handle every `resolution.status` variant. Use an exhaustive check so a future variant fails type-checking/tests rather than falling through silently.
5. Add tests for known and unknown ordinals, known and unknown names, raw-value preservation, every resolution status, missing source bindings, unavailable snapshots, invalid ranges, and valid mappings.
6. Verify existing adapter behavior remains compatible for valid current Highlighter output.

**Do not** add UI-specific labels, presentation state, inferred semantic roles, or parent/child relationships to this adapter-hardening change.

**Gate 0:** contract and adapter tests pass; unknown values are preserved and diagnosed; all resolution variants are exhaustive.

## 5. Phase 1 — Public integration and host surface

**Implementation status:** files added on `feature/calcpad-blocks-foundation`; Gate 1 remains pending typecheck/build verification.

No Vue components or UI composables in this phase.

| Order | File | Depends on | Work |
|---|---|---|---|
| 1.1 | `src/integrations/calcpad/index.ts` | Existing adapter contract | Public integration barrel |
| 1.2 | `src/host/types.ts` | None | Host callback type definitions |
| 1.3 | `src/host/index.ts` | 1.2 | Public host barrel |

### 1.1 Calcpad integration barrel

Export only supported public items:

- Contract identifiers and version.
- Public projection/construct/diagnostic types.
- Adapter entry points.
- Session or projection factory.
- Public ordinal tables and lengths, if intended as supported contract data.

Keep implementation helpers and mutable internal collections module-local.

### 1.2 Host callback types

Define callback shapes only; do not implement host behavior here:

- `onNavigate`: request that the host reveal/navigate to a supplied, validated source reference.
- `onSelect`: notify the host about a UI selection, if the host needs that notification.
- `onEditRequest`: reserve a typed future edit-request shape; it is not implemented or emitted in v1.

Keep selection notification separate from source navigation. Do not make `onSelect` an alternate navigation path.

### 1.3 Host barrel

Re-export the public host types. Avoid exporting host implementation details.

**Gate 1:** imports from the integration barrel and host barrel compile without consumers reaching into implementation files. No UI file imports `highlighter-contract.ts` directly.

## 6. Phase 2 — UI composables

**Implementation status:** all seven composables and focused tests have been added; Gate 2 remains pending test/typecheck/build verification.

No components are written in this phase. Implement and test state ownership first.

The source contract is available at `src/core/source/contracts.ts`; use its actual types. Do not create duplicate source range, source reference, snapshot, or revision types.

### 2.1 Independent composables

Implement in this dependency order:

| Order | File | Depends on | Owns / exposes |
|---|---|---|---|
| 2.1 | `src/ui/composables/useSession.ts` | Integration barrel | Read-only session access and derived lookups |
| 2.2 | `src/ui/composables/useConstructFilters.ts` | Integration barrel | Query, kind, origin, mapping-status filters and filtered list |
| 2.3 | `src/ui/composables/useSelection.ts` | Integration barrel | One selected projection index and derived construct |
| 2.4 | `src/ui/composables/useCollapseState.ts` | None | Collapse map keyed by `projectionIndex` |
| 2.5 | `src/ui/composables/useDiagnostics.ts` | `useSession` | Aggregated diagnostics |
| 2.6 | `src/ui/composables/useSourceNavigation.ts` | Host types, `useSession` | Freshness-checked host navigation |
| 2.7 | `src/ui/composables/useWorkspace.ts` | 2.1–2.6 | Workspace composition root |

#### useSession

- Expose a read-only session/contract accessor.
- Provide derived lookup by projection ID/index as supported by the actual contract.
- Expose revision and freshness information only when present in the session contract.
- Do not duplicate or mutate the session.

#### useConstructFilters

Own only the filter inputs:

- Query.
- Kind.
- Origin.
- Mapping status.

The filtered list is computed using conjunction:

`query AND kind AND origin AND mappingStatus`

An unset filter does not exclude constructs. Filtering must preserve the adapter's projection order.

#### useSelection

- Own exactly one writable selected projection index.
- Derive the selected construct and validity.
- Do not reset selection when the display mode changes.
- Do not add automatic scrolling.

#### useCollapseState

- Own a collapse map keyed by `projectionIndex`.
- Expose read, toggle, expand, and collapse operations.
- Do not mutate constructs or infer children.

#### useDiagnostics

- Aggregate diagnostics already present in the session.
- Expose all diagnostics and computed groupings/counts by level and code.
- Do not manufacture diagnostics by interpreting source text or UI layout.

#### useSourceNavigation

- Be the only composable that invokes `HostCallbacks.onNavigate`.
- Validate session freshness and source-reference eligibility immediately before invoking the callback.
- Refuse navigation for stale sessions, missing references, or unverified/unusable mappings.
- Return or expose a clear refusal result for UI feedback.
- Do not navigate using a range reconstructed by a component.

#### useWorkspace

Compose the preceding composables and own the writable display mode: `source`, `split`, or `blocks`.

Return the complete read-only state and explicit actions needed by a shell. The shell must not need to recreate state or reach into private composable refs.

### 2.2 Composable tests

Add focused tests using the repository's established test naming convention:

- Session access, lookups, and read-only behavior.
- Filter conjunction, empty filters, query behavior, and zero results.
- Selection validity and persistence through source → split → blocks → source.
- Collapse state independence by projection index.
- Diagnostic grouping/counts.
- Stale-session navigation refusal.
- The host navigation callback is invoked only through `useSourceNavigation`.

**Gate 2:** `useWorkspace(session, hostCallbacks)` exposes everything required by the shell; all writable state has one owner; no component code is needed to prove the state model.

## 7. Phase 3 — Leaf components

Begin only after Gate 2 passes. Every leaf is independently renderable, receives props, and emits events where necessary. No leaf imports a composable or calls a host callback.

### 3.1 Styling foundation

| Order | File | Responsibility |
|---|---|---|
| 3.1 | `src/ui/styles/tokens.css` | Shared color, spacing, radius, typography, and diagnostic tokens |
| 3.2 | `src/ui/styles/layout.css` | Split grid, pane behavior, card spacing, and responsive primitives |

Use semantic tokens for verified, unverified, unknown, and diagnostic severity states. Do not scatter one-off colors or spacing values across components.

### 3.2 Stateless block primitives

| Order | File | Depends on | Renders |
|---|---|---|---|
| 3.3 | `src/ui/components/blocks/StatusDot.vue` | 3.1 | Verified / unverified / unknown mapping state |
| 3.4 | `src/ui/components/blocks/OriginBadge.vue` | 3.1 | Local / IncludedFile / MacroExpansion / Generated / Unknown |
| 3.5 | `src/ui/components/blocks/SpanChip.vue` | 3.1 | Verified source reference/locator or unverified state |
| 3.6 | `src/ui/components/blocks/DiagnosticList.vue` | 3.1 | One construct's diagnostic list |
| 3.7 | `src/ui/fields/raw-fallback.ts` | Integration types | Default text and collapsible raw-range field descriptor |
| 3.8 | `src/ui/fields/field-map.ts` | 3.7 | Kind-to-field registry with raw fallback |
| 3.9 | `src/ui/components/blocks/BlockFields.vue` | 3.7–3.8 | Field descriptor dispatch |
| 3.10 | `src/ui/components/blocks/BlockHeader.vue` | 3.3–3.4 | Ordinal, verbatim kind, origin, status, optional collapse control |

Start the field registry with the agreed initial kinds: `assignment`, `expression`, and `directive`, after confirming their exact normalized kind identifiers. Unknown kinds always use the raw fallback.

The status indicator must be driven by the adapter's mapping status, not by the mere presence of a range. The span chip must not claim verification when source mapping is unresolved.

**Gate 3:** every leaf renders in isolation; unknown values have a visible representation; no leaf imports composables or host modules.

## 8. Phase 4 — Composite components and shell

Components remain controlled and stateless with respect to workspace concerns. The shell owns `useWorkspace` and passes values/actions down through props; child events travel back up.

| Order | File | Depends on | Responsibility |
|---|---|---|---|
| 4.1 | `src/ui/components/blocks/BlockCard.vue` | BlockFields, BlockHeader, SpanChip, DiagnosticList | One construct card; emits select and navigation intent |
| 4.2 | `src/ui/components/blocks/BlockChildren.vue` | BlockCard, explicit relationship data, collapse props | Render linked children only |
| 4.3 | `src/ui/components/blocks/BlockDocument.vue` | BlockCard, BlockChildren | Ordered flat card list in v1 |
| 4.4 | `src/ui/components/SourcePane.vue` | Source/session display props | Read-only source and verified span highlight; emits selection intent |
| 4.5 | `src/ui/components/FilterBar.vue` | Filter values/actions | Controlled filter UI |
| 4.6 | `src/ui/components/ModeSwitch.vue` | Mode value/action | Controlled source/split/blocks switch |
| 4.7 | `src/ui/components/DiagnosticsTray.vue` | Aggregated diagnostics props | Diagnostic summary; emits selection intent |
| 4.8 | `src/ui/components/EmptyState.vue` | None | Explains why current filters yield no constructs |
| 4.9 | `src/ui/components/WorkspaceStatus.vue` | Session and diagnostic summary props | Revision, adapter/session status, diagnostic count |
| 4.10 | `src/ui/components/SplitLayout.vue` | SourcePane, BlockDocument | Responsive two-pane composition |
| 4.11 | `src/ui/components/WorkspaceShell.vue` | useWorkspace, 4.1–4.10 | Owns workspace composition and routes events |
| 4.12 | `src/ui/index.ts` | Public UI surface | Exports only WorkspaceShell, WorkspaceStatus, and supported composables |

### Composite behavior

- `BlockCard` emits selection and navigation intent; it never invokes host callbacks.
- `BlockChildren` renders children only when explicit relationship links exist. Range containment is not a relationship.
- `BlockDocument` preserves projection order and remains flat in v1.
- `SourcePane` is read-only and emits selection intent on interaction.
- `FilterBar` and `ModeSwitch` receive controlled state and emit changes.
- `DiagnosticsTray` emits a selection request; it does not mutate selection itself.
- `WorkspaceShell` owns `useWorkspace`, translates component events into composable actions, and is the only component-level integration point for workspace state.
- Navigation intent from any component is delegated to `useSourceNavigation`; no component calls a callback prop directly.

### Responsive behavior

Below the split breakpoint, render the source view as the narrow-screen fallback without overwriting the user's selected mode. The selected mode, selection, and filter inputs remain intact and are restored when the layout becomes wide enough. Do not create a second writable responsive-mode state.

**Gate 4:** WorkspaceShell renders a real session in all supported modes; selection and filters survive mode changes; source remains read-only; navigation has one path; public exports are constrained.

## 9. Phase 5 — Demo fixtures and end-to-end validation

The demo is the integration harness for the adapter, session, composables, components, and host callbacks.

### 5.1 Demo infrastructure

| Order | File | Responsibility |
|---|---|---|
| 5.1 | `demo/fixtures.ts` | Fixture loader and fixture switcher |
| 5.2 | `demo/DemoApp.vue` | Host harness: create/load session, pass callbacks, log events |

The harness must load fixtures through the public integration API, pass the resulting session to `WorkspaceShell`, and log navigation/selection callbacks. Fixture switching must not mutate fixture source data.

### 5.2 Fixtures

Create under `demo/examples/`:

1. `simple.cpd.json` — happy path covering all currently known kinds.
2. `nested-ranges-only.cpd.json` — ranges nest but explicit links are absent; render flat.
3. `macro-origin.cpd.json` — MacroExpansion origin.
4. `unknown-kind.cpd.json` — unknown kind remains visible through raw fallback.
5. `locator-miss.cpd.json` — locator-miss/source-identity diagnostic appears in tray.
6. `empty.cpd.json` — empty-state explanation.
7. `stale-revision.cpd.json` — stale status banner and navigation refusal.

Use fixture schemas accepted by the real adapter/session factory. Do not invent fixture-only fields that production contracts do not support.

### 5.3 Test inventory

Use `.test.ts` filenames to match the current package convention unless the package test configuration is deliberately changed.

- Contract: `tests/contracts/highlighter-contract.test.ts`, adapter tests.
- Snapshot/session: `tests/integration/snapshot-session.test.ts`.
- Filters: `tests/ui/filters.test.ts`.
- Selection: `tests/ui/selection.test.ts`.
- Fields: `tests/ui/fields.test.ts`.
- Nesting/no inference: `tests/ui/nesting.test.ts`, `tests/ui/no-inference.test.ts`.
- Stale state: `tests/ui/stale-state.test.ts`.
- Navigation: `tests/ui/navigation.test.ts`.
- Accessibility: `tests/ui/accessibility.test.ts`.

Required coverage:

- Snapshot root pinning, aliasing, failure modes, and manifest.
- `kind AND origin AND mappingStatus AND query` filtering.
- Selection shared across modes; no automatic scrolling.
- Known kind maps to a field descriptor; unknown kind maps to raw fallback.
- Nested ranges without explicit links render flat.
- No `VerifiedSpan` is constructed outside the adapter.
- Stale revision refuses navigation.
- Host navigation callback is reachable only through `useSourceNavigation`.
- Keyboard navigation, focus order, and accessible card/diagnostic controls.

Run the package checks from `Calcpad.Web/frontend/Calcpad.Blocks/`:

- `npm test`
- `npm run typecheck`
- `npm run build`

If scripts or test locations differ from this plan, inspect `package.json` and the existing test configuration before changing them. Do not claim a check passed unless it was run.

**Gate 5:** all demo fixtures behave as specified; focused tests, typecheck, and build pass.

## 10. Phase 6 — Explicit nesting (deferred)

Nesting is out of scope for the initial ship. The current Highlighter projection is flat and does not provide containment.

Before implementing nesting, approve a contract change that supplies explicit relationship data, such as optional `parentId` and/or `childIds`. Decide whether both are needed and define consistency rules. Because this changes the public projection contract, update `BLOCKS_HIGHLIGHTER_CONTRACT_VERSION` according to the contract's versioning policy.

Implementation order:

1. Approve and document the relationship contract.
2. Update adapter mapping and validation.
3. Define behavior for missing references, duplicate links, cycles, and ordering.
4. Add contract and adapter tests.
5. Update `BlockChildren` and document rendering.
6. Add explicit-link fixtures and UI tests.

**Hard rule:** range-based containment inference remains forbidden, including as a fallback when explicit links are missing.

## 11. Phase 7 — Polish (deferred)

Only after the initial workspace passes Gate 5:

- Keyboard navigation: Up/Down/Enter on cards.
- `/` shortcut to focus the filter.
- Additional per-kind field maps, prioritized by actual use.
- Export the session manifest as JSON for bug reports.

Polish must not weaken unknown-safe behavior, source immutability, or the adapter/UI boundary.

## 12. Per-file implementation protocol

For every file:

1. Inspect the actual dependency files and current package conventions.
2. Verify every required import exists and is public at the intended boundary.
3. Define the file's public interface before implementation.
4. Implement the smallest complete behavior.
5. Add focused tests for its contract and edge cases.
6. Run the narrowest relevant tests, then typecheck when a gate is reached.
7. Review imports against the layer rules and the no-inference invariants.
8. Mark the file complete only after validation.

For every milestone, record implemented files, tests run and results, unresolved assumptions, contract changes, and blockers. Keep unrelated changes out of the milestone.

## 13. Release gates

| Gate | Evidence required | Unlocks |
|---|---|---|
| 0 — Foundation | Contract and adapter tests pass; unknown values preserved; resolution exhaustive | Phase 1 |
| 1 — Public surface | Integration and host barrels compile; import boundaries hold | Phase 2 |
| 2 — State model | All composables tested; one owner per writable concern; cross-mode persistence | Phase 3 |
| 3 — Leaf UI | Isolated leaf rendering; no composable/host imports | Phase 4 |
| 4 — Workspace | Shell works in all modes; controlled components; single navigation path | Phase 5 |
| 5 — Initial ship | Fixtures, UI tests, accessibility, typecheck, and build pass | Release; later nesting/polish |
| 6 — Nesting | Explicit relationship contract approved and validated | Nesting implementation |

**Execution priority:** Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Phase 6 and Phase 7 remain deferred.

No phase is considered complete because its files exist; completion requires the corresponding gate evidence.
