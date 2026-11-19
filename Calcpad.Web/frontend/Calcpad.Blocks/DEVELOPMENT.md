# Calcpad.Blocks — Development Guide

> Status: initial architecture and development plan  \
> Package location: `Calcpad.Web/frontend/Calcpad.Blocks/`  \
> Implementation status: source-buffer contracts, versioned Highlighter adapter contract, compatibility tests, and Vue inspection workbench are implemented; semantic block projection and BlockSuite editor are not implemented.

## Current implementation status

The package contains:

- Host-owned immutable source snapshot, revision, and edit-request contracts.
- A versioned Blocks adapter for the current flat Calcpad.Highlighter structural-output shape.
- Explicit mapping from Highlighter file locators to stable host-owned file identities.
- Per-projection snapshot capture and a source manifest.
- Conservative mapping statuses, unknown-kind/origin preservation, numeric and string enum compatibility, and UTF-16 range validation.
- A Vue inspection workbench with construct search, independent kind/origin/mapping filters, selection state, a selected-construct inspector, and explicit host source-navigation actions.

The adapter preserves the Highlighter's construct order and raw kind/origin values. It accepts the numeric enum ordinals emitted by the current ASP.NET Core/System.Text.Json web defaults as well as string enum values, and retains unknown raw values. A shared C# JSON fixture is checked by a .NET serialization test and consumed by the TypeScript adapter test. It does not infer semantic span roles, statement/container boundaries, containment, complete source coverage, embedded-content subtypes, or macro provenance relationships.

The current workbench shows original source unchanged beside the flat constructs returned by Highlighter. Search and filters narrow the construct list; the inspector exposes both normalized and raw Highlighter values plus only verified source-range information. It deliberately does not split the worksheet into semantic blocks or infer nesting because current ranges can be token-sized and the output has no containment relationships. Source navigation is an explicit host action, and the source pane remains read-only. HBC-M3 compatibility tests include a shared C#-serialized JSON fixture consumed by TypeScript. The .NET serialization test, `npm test`, `npm run typecheck`, and `npm run build` are wired into the HBC-M3 validation workflow; execution results remain pending.

The UI is not yet wired into calcpad-web. A standalone Vite demo host lives in `demo/`; it creates in-memory root and included-file snapshots, runs representative mock Highlighter output through the real versioned adapter, and mounts the workbench. Run `npm install` then `npm run dev` from the package directory and open the local URL printed by Vite. Search, filters, selection, mapping states, and source-navigation host callbacks can be exercised without a running Calcpad backend. The demo intentionally does not implement source editing or persist data. BlockSuite integration remains a separate step after the source projection contract is complete; the BlockSuite document must remain an ephemeral rendering projection, never another persisted worksheet or undo history.

## 1. Purpose

Calcpad.Blocks is a visual worksheet-editing layer for Calcpad. It presents Calcpad source as readable, specialized, and potentially nested blocks while preserving the original Calcpad source as the authoritative document.

The package is not a new calculation engine, a replacement parser, or a second persisted document format. It is an optional visual editing surface integrated with the existing Calcpad frontend and Monaco editor.

### Core principles

1. **Source is authoritative.** The original Calcpad source is the only persisted authored document representation.
2. **Text is the default.** Every source region begins as ordinary text. It becomes a specialized block only when a construct is reliably recognized.
3. **Contiguous text regions.** Ordinary text is grouped into contiguous regions, not one block per line. Split only at a recognized construct or meaningful source boundary.
4. **Nested when the language is nested.** Structural blocks may contain child blocks, but hierarchy must come from reliable Calcpad structural information. The UI must not invent nesting.
5. **Original source is always accessible.** Double-clicking a source-backed block opens its original source range in the host Monaco editor.
6. **Host owns editing history.** Source edits, persistence, revisions, conflict handling, and undo/redo remain the host application's responsibility.
7. **No second parser.** Calcpad.Highlighter is the source of structural recognition. Calcpad.Blocks adapts its output for presentation and interaction.

## 2. Package location and proposed folder structure

The package is located beside the existing frontend projects:

```text
Calcpad.Web/
└── frontend/
    └── Calcpad.Blocks/
        ├── DEVELOPMENT.md
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── core/
        │   │   ├── document/
        │   │   ├── projection/
        │   │   ├── source/
        │   │   ├── selection/
        │   │   ├── commands/
        │   │   └── contracts/
        │   ├── blocks/
        │   │   ├── text/
        │   │   ├── definition/
        │   │   ├── variable/
        │   │   ├── function/
        │   │   ├── math-expression/
        │   │   ├── vector/
        │   │   ├── matrix/
        │   │   ├── table/
        │   │   ├── svg-drawing/
        │   │   ├── html-dom/
        │   │   ├── control-flow/
        │   │   ├── macro/
        │   │   ├── include/
        │   │   ├── data-exchange/
        │   │   ├── input/
        │   │   ├── settings/
        │   │   ├── comment/
        │   │   └── source-fallback/
        │   ├── blocksuite/
        │   │   ├── base/
        │   │   ├── registry/
        │   │   └── adapters/
        │   ├── integrations/
        │   │   ├── calcpad/
        │   │   └── monaco/
        │   └── index.ts
        └── tests/
            ├── core/
            ├── projection/
            ├── blocks/
            ├── contracts/
            └── integrations/
```

This is the planned structure, not a claim that these directories or source files already exist. Create directories as their implementation begins; avoid empty placeholder modules.

Each block gets its own folder when it has meaningful schema, rendering, commands, source behavior, or tests. Keep simple blocks small. Shared behavior belongs in `core/` or shared block infrastructure, not duplicated across block folders.

## 3. Source-to-block projection

The projection pipeline has three conceptual steps:

1. Obtain the original source and structural output for a document revision.
2. Use Calcpad.Highlighter's recognized constructs, ranges, file identity, and provenance to identify specialized regions and reliable nesting.
3. Fill all remaining source intervals with contiguous text blocks.

### Contiguous text rule

- Do not create a block for every source line.
- Keep adjacent ordinary or unrecognized source in one contiguous text block.
- Preserve blank lines, whitespace, comments, and line endings.
- Split when a recognized construct starts or ends, a meaningful structural boundary occurs, or source ownership changes.
- Do not split merely because ordinary text has different visual styles.
- Keep unsupported syntax visible as text or a source-fallback block.

### Hierarchy and ordering

- Use parser/structural evidence to determine parent-child relationships.
- A definition, conditional, loop, or other genuinely structural construct may contain nested blocks.
- Preserve source order and source ownership.
- Do not infer semantic nesting from indentation or visual proximity alone.
- HTML DOM and SVG may have their own internal DOM/XML structure, but their internal elements do not automatically become Calcpad worksheet blocks.
- Included-file content must retain the identity of its owning file.

### Source fidelity

The projection must retain enough source coverage and ordering information to reproduce the original source exactly when serialized from a complete, unchanged projection. If exact coverage cannot be guaranteed, the host source remains authoritative and the projection must not be used to regenerate the document.

## 4. Block catalogue

The initial catalogue includes the following first-class Calcpad block types:

| Block | Responsibility |
|---|---|
| `TextBlock` | Default contiguous ordinary or unrecognized source region |
| `DefinitionBlock` | Recognized `#def` definition and its nested content |
| `VariableBlock` | Variable definition or reassignment |
| `FunctionBlock` | Function definition or call, where identified |
| `MathExpressionBlock` | Source-backed mathematical expression |
| `VectorBlock` | Calcpad vector construct |
| `MatrixBlock` | Calcpad matrix construct |
| `TableBlock` | Calcpad table and tabular data |
| `SvgDrawingBlock` | Recognized inline SVG drawing |
| `HtmlDomBlock` | Recognized HTML content with a controlled DOM preview |
| `ControlFlowBlock` | Conditional and loop structures, including nested content |
| `MacroBlock` | Macro definition or invocation, with provenance |
| `IncludeBlock` | Included file/reference and, where supported, included projection |
| `DataExchangeBlock` | Data import/export constructs |
| `InputBlock` | Input constructs |
| `SettingsBlock` | Document/calculation settings |
| `CommentBlock` | Comments when structurally distinguishable |
| `SourceFallbackBlock` | Recognized source construct without a safe specialized renderer or edit operation |

Recognition must be evidence-based. A block must not claim semantic fields that the structural output does not provide.

### Important block-specific requirements

- **Definition:** `#def` is its own block type, not automatically a function or macro. Its body may contain nested blocks.
- **Vector and matrix:** these are mathematical structures, not tables with different styling. Preserve shape and expression text; evaluation remains Calcpad's responsibility.
- **Table:** distinguish literal cell content from expressions. Cell-level source editing requires reliable cell-to-source mappings; otherwise edit the table as a whole source range.
- **SVG:** Highlighter exposes the recognized source construct and source mapping. Blocks renders and validates it. Do not silently rewrite the original SVG.
- **HTML DOM:** Highlighter exposes recognized HTML source and ranges. Blocks owns DOM construction, preview, CSS isolation, sanitization, and rendering. Do not execute arbitrary scripts in the editor.
- **Control flow and macros:** nested children and provenance must follow structural evidence. Generated expansions are not editable as if they were original source.
- **Fallback:** unknown or unsupported syntax must remain visible and source-accessible.

## 5. Calcpad.Highlighter boundary

Calcpad.Highlighter owns Calcpad structural recognition. Calcpad.Blocks must not implement another Calcpad keyword scanner or parser.

The version 1 Blocks adapter is defined in `src/integrations/calcpad/highlighter-contract.ts`. It wraps the current C# payload without changing Highlighter. It adds Blocks-owned contract metadata, explicit host identity mapping, snapshot binding, and diagnostics.

The current contract explicitly reports missing information rather than synthesizing it:

- construct kinds and origins are preserved, including unknown future values;
- Highlighter order is preserved;
- source references are created only after host identity, snapshot, and range validation;
- semantic span role remains unknown;
- complete source coverage, containment, macro provenance graph, and embedded-content subtype classification remain unsupported.

If an upstream Highlighter PR is accepted in the future, maintainers may add corresponding C# contract DTOs. That is optional and is not a prerequisite for this adapter.

The Highlighter does not render HTML or SVG and does not depend on BlockSuite, Vue, Monaco, or DOM APIs.

## 6. BlockSuite integration

BlockSuite provides the block-editor infrastructure and rendering lifecycle. Calcpad.Blocks provides Calcpad-specific semantic blocks, projection, source bindings, and commands.

### Base BlockSuite blocks to evaluate for reuse

| BlockSuite/AFFiNE block | Intended use | Reuse policy |
|---|---|---|
| `affine:page` | Document root | Reuse if compatible with the installed BlockSuite version |
| `affine:note` | Ordered worksheet container | Reuse if compatible |
| `affine:paragraph` | Ordinary text | Reuse where source fidelity can be preserved |
| `affine:list` | Ordinary lists | Reuse where compatible |
| `affine:code` | Code/source fallback presentation | Reuse as a renderer, not as a separate source of truth |
| `affine:divider` | Visual section separator | Reuse where appropriate |
| `affine:image` | Static image content | Reuse where appropriate |
| `affine:table` | Ordinary rich-text tables | Reuse only if its model fits Calcpad table semantics |
| `affine:latex` | Standalone mathematical presentation | Reuse only if its model fits source-backed Calcpad expressions |

These names and specifications must be checked against the exact BlockSuite version selected for the package. Do not assume an AFFiNE block is a stable public API merely because it exists in an AFFiNE build.

Do not use an Edgeless/surface-first document as the primary worksheet model. Calcpad worksheets are ordered source documents. A canvas may be considered later for a separate drawing workflow.

### Calcpad block namespace

Use a separate namespace for custom block types, for example:

```text
calcpad:text
calcpad:definition
calcpad:variable
calcpad:function
calcpad:vector
calcpad:matrix
calcpad:table
calcpad:svg-drawing
calcpad:html-dom
calcpad:math-expression
calcpad:control-flow
calcpad:macro
calcpad:include
calcpad:data-exchange
calcpad:input
calcpad:settings
calcpad:comment
calcpad:source-fallback
```

Use BlockSuite's native block-specification and view architecture. Confirm the framework and Lit integration against the selected BlockSuite release before implementation. Keep semantic contracts framework-independent.

### Projection versus persistence

BlockSuite's block tree is a runtime representation of the current Calcpad source projection. It is not a second persisted authored worksheet. Do not enable an independent BlockSuite history that can diverge from the host's source history.

## 7. Core contracts

The following are conceptual contract responsibilities. Final TypeScript signatures must be specified and tested before implementation.

- **StructureProvider:** obtains structural output/projection for a document revision.
- **BlockProjection:** immutable projection snapshot with document identity and revision.
- **BlockDescriptor:** block kind, source reference, origin, properties, capabilities, and parent/child relationships.
- **SourceReference:** file identity plus a verified source range.
- **TextBuffer:** host-owned revision, selection, source edit, reveal, and select operations.
- **BlockCommand:** user intent tied to a block and expected revision.
- **EditResult:** accepted/rejected result and resulting revision.

### Ownership rules

The host owns:
- original source buffers and file lifecycle;
- persistence;
- document revisions and conflict handling;
- source edits and edit validation;
- undo/redo;
- Monaco lifecycle and editor selection.

Calcpad.Blocks owns:
- projection and block presentation;
- block selection state;
- block-specific UI commands;
- conversion of supported user actions into source-edit requests;
- renderer state that is not authored source.

No public Blocks API should expose a second authoritative `getSource()`/`setSource()` document model.

## 8. Visual mode and source mode

Every source-backed block has a visual representation and access to its original source.

### Double-click behavior

- Double-click a leaf block: open its exact original source range in Monaco.
- Double-click a structural/container block: open its full verified source range.
- Double-click a nested block: open the nested construct's own range.
- Double-click included content: navigate to the owning file and range.
- Double-click generated/macro-expanded content: navigate to its known origin; do not edit generated text as original source.
- If a range is missing or stale, do not guess. Show the limitation and offer navigation only when a reliable origin exists.

An explicit **Edit source** action should also be available from the selected block's toolbar or context menu.

The source editor must show original source, not code regenerated from block properties. Source edits go through the host TextBuffer and trigger a new projection. Single-click selects; it must not unexpectedly modify source.

## 9. Editability and safety

| Source condition | Display | Editing |
|---|---|---|
| Local source with verified range | Yes | Allowed through host edit contract |
| Included source | Yes | Only if host confirms file is writable |
| Macro expansion | Yes | Read-only; navigate to origin |
| Generated source | Yes | Read-only |
| Unknown origin | Yes | Read-only |
| Missing/invalid range | Yes | Display-only |

Additional rules:

- Reject stale-revision commands.
- Never edit through approximate ranges.
- Preserve line endings, whitespace, comments, and untouched source.
- Do not mutate the visual model as if that alone changed Calcpad source.
- Keep SVG and HTML previews isolated and sanitized.
- Never run arbitrary HTML scripts in the editor preview.

## 10. Proposed package dependencies

- Reuse the existing Calcpad frontend's TypeScript/Vue ecosystem where integration requires it.
- Use BlockSuite's native specifications and supported view technology for the selected release.
- Keep `core/` independent of Vue, Lit, Monaco, browser DOM types, and BlockSuite internals.
- Keep Monaco integration behind an adapter.
- Keep Calcpad structural-output integration behind an adapter.
- Avoid adding a second UI framework unless the BlockSuite version makes it unavoidable and the decision is documented.
- Do not introduce a new parser or calculation engine.

The exact package manager, workspace configuration, dependency versions, and build setup must be inspected before adding `package.json` or build configuration.

## 11. Development phases

### Phase 1 — Validate upstream structural output
- Review the current Calcpad.Highlighter structural-output implementation.
- Verify source ranges, coordinate conventions, file identity, include buffers, macro provenance, and construct coverage.
- Identify gaps for `#def`, tables, vectors, matrices, HTML, SVG, and nested control flow.
- Refine the upstream contract only where evidence requires it.

**Exit:** Blocks can consume structural output without implementing another Calcpad parser.

### Phase 2 — Finalize Blocks contracts
- Define projection and block identity lifecycle.
- Define nested block relationships and deterministic ordering.
- Define TextBuffer and source-edit contracts.
- Define revision and stale-command behavior.
- Define capabilities and source ownership.
- Add compile-time and unit contract tests.

**Exit:** contracts are testable without rendering dependencies.

### Phase 3 — Validate and integrate BlockSuite
- Identify the exact BlockSuite version and its supported public APIs.
- Verify reusable base block specifications.
- Establish the worksheet root and ordered block container.
- Register one minimal custom Calcpad block.
- Verify that projection state does not become a second persisted authored document.

**Exit:** a minimal standalone BlockSuite workspace can render a Calcpad custom block.

### Phase 4 — Implement the projection engine
- Convert recognized structural constructs into specialized block descriptors.
- Group unrecognized source into contiguous text regions.
- Split only at recognized constructs and meaningful source boundaries.
- Build nesting only from reliable structural evidence.
- Preserve source order, file identity, provenance, and exact ranges.
- Handle incomplete or unsupported constructs safely.

**Exit:** deterministic projection tests pass for representative worksheets.

### Phase 5 — Implement block renderers
Implement in increments:
1. Text, definition, variable, function, expression, comment, and fallback.
2. Control flow and macro containers.
3. Vector, matrix, and table.
4. SVG drawing and HTML DOM.
5. Include, data exchange, input, settings, and image/reference blocks.

Each block needs a renderer, source binding, capability declaration, error state, and focused tests. Add separate schema/model/commands/styles/source files only where useful.

### Phase 6 — Integrate source editing
- Connect TextBuffer and Monaco adapters.
- Implement single-click selection and double-click source navigation/editing.
- Synchronize source and block selections.
- Apply source edits through the host.
- Refresh projections after revisions.
- Verify host undo/redo and stale-edit rejection.

**Exit:** visual/source round-trips preserve the original source and host history.

### Phase 7 — Advanced block interactions
- Table cell editing and import/export where source mapping supports it.
- Vector and matrix editing.
- SVG zoom and inspection.
- HTML DOM preview and inspection.
- Container expand/collapse and nested navigation.
- Include and macro provenance navigation.
- Block inspectors and context menus.

### Phase 8 — Validation and application integration
- Test large and deeply nested worksheets.
- Test invalid/incomplete source and partial mappings.
- Test multiple included files and macro expansion.
- Test source fidelity, undo/redo, and stale revisions.
- Test HTML/SVG preview security.
- Measure projection and rendering performance.
- Integrate into the main Calcpad editor only after standalone validation.

## 12. Testing requirements

### Projection tests
- Contiguous ordinary source becomes one text region.
- No block is created per line by default.
- Recognized constructs split text regions at exact boundaries.
- Blank lines and comments are preserved.
- Nested structures match structural evidence.
- Unsupported syntax remains visible.
- Included constructs retain file identity.
- Ordering is deterministic.
- Source coverage has no unexplained gaps or overlaps.

### Source-edit tests
- Double-click opens the exact original source range.
- Nested block opens its own range.
- Container opens its full verified range.
- Stale revisions are rejected.
- Missing/invalid ranges cannot be edited.
- Included-file edits respect host permissions.
- Undo/redo is owned by the host.
- Source edits refresh the projection without source regeneration.

### Block tests
- Definition, vector, matrix, table, SVG, and HTML preserve source bindings.
- Mathematical evaluation is delegated to Calcpad.
- HTML and SVG previews are isolated and sanitized.
- Invalid content has a visible error state and remains source-accessible.

## 13. Initial acceptance criteria

The first usable milestone is complete when:

1. A Calcpad worksheet can be projected into contiguous text and recognized specialized blocks.
2. Verified nested constructs render as nested blocks.
3. The required definition, mathematical, table, SVG, and HTML block types are represented.
4. Selecting a block navigates to its source.
5. Double-clicking opens the original code in Monaco.
6. Editing source refreshes the block projection.
7. The original source remains the only persisted authored document.
8. Unsupported or unmappable source remains visible and is never edited through guessed ranges.

## 14. Work discipline

- Design and contract review precede implementation.
- Do not assume a Highlighter capability until verified in the upstream code and tests.
- Do not assume BlockSuite/AFFiNE block names or APIs are stable until checked against the selected package version.
- Keep Calcpad.Blocks independently testable.
- Keep changes scoped to this package unless an upstream contract change is explicitly required.
- Do not open or merge a pull request without explicit authorization.
