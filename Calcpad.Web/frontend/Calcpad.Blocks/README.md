# Calcpad.Blocks

An isolated Vue 3 package for the source-backed Calcpad worksheet workbench.

## Current contents

- Host-owned source snapshot, revision, and edit-request contracts.
- Versioned Highlighter-to-Blocks adapter envelope (`calcpad.highlighter.blocks`, version 1).
- Explicit Highlighter file-locator to host file-identity resolution.
- Per-projection immutable source snapshot sessions and manifests, cached by stable host file identity.
- Conservative construct normalization, mapping diagnostics, exact source-slice verification, and UTF-16 source-range validation.
- An inspection workbench with revision freshness indicators, source-file navigation, range highlighting, and keyboard-accessible source preview.
- Construct search and independent filters for kind, source origin, and source-mapping status.
- A selected-construct inspector that exposes normalized and raw Highlighter values, verified range, locator, span role, and editability.
- Explicit source-navigation actions for constructs with mapped source references.
- Bounded construct batches and virtualized source-line preview for large documents.

The adapter does not change Calcpad.Highlighter. It preserves the existing flat construct order and raw enum values, and it does not infer statement boundaries, semantic span roles, containment, complete source coverage, or macro provenance relationships. Unknown future construct kinds and origins are retained rather than treated as fatal errors.

Mapping means a stable host identity, captured snapshot, and valid range—not a complete statement boundary. Exact content verification is reported separately; mismatched source text is non-editable. Freshness is current, stale, or unknown according to host-supplied current revisions.

The workbench remains a read-only inspection surface, not yet the final nested visual worksheet editor. It does not invent semantic block boundaries or nesting, and source edits remain the host editor's responsibility.

## Run the standalone workbench

The package includes a small demo host with mock root/include source snapshots and representative Highlighter output. It exercises the adapter and the read-only workbench without requiring the Calcpad web application or a live Highlighter service.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). Try the construct search, the kind/origin/mapping filters, selecting constructs, and the source-navigation actions. Hosts should pass `sourceFileId`, current revisions, and available included-file snapshots to enable accurate stale-state and source-preview behavior. The demo reports host callbacks in its event panel; it does not edit source.

To validate the package separately, run `npm test`, `npm run typecheck`, and `npm run build` from this directory.

Vue is a peer dependency. The package is not yet wired into calcpad-web; that integration follows after the source contracts and Highlighter projection shape are validated.

See [DEVELOPMENT.md](DEVELOPMENT.md) and [SOURCE_BUFFER_CONTRACT.md](SOURCE_BUFFER_CONTRACT.md) for architecture, contract semantics, and current limitations.
