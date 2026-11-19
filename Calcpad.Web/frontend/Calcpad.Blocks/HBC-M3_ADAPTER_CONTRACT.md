# HBC-M3 — Versioned Highlighter Adapter Contract

**Status:** Implemented on `feature/calcpad-blocks-foundation`; runtime verification pending  
**Contract owner:** Calcpad.Blocks  
**Upstream dependency:** Existing, unchanged `Calcpad.Highlighter.StructuralOutput`

## 1. Boundary

The C# Highlighter output remains the wire/input shape. Blocks normalizes it into the versioned TypeScript projection contract:

- Contract ID: `calcpad.highlighter-to-blocks`
- Contract version: `1`
- Adapter: `adaptHighlighterOutput`
- Compatibility helper: `bindHighlighterOutput`

No Highlighter C# DTO, parser, tokenizer, source-map, or builder changes are required by this milestone.

## 2. Source identity and snapshot binding

Highlighter `SourceRange.File` is treated as a source locator, not automatically as a host file ID. The host supplies an explicit `HighlighterSourceBinding` for every locator it wants Blocks to bind:

- `sourceLocator`: exact locator emitted by Highlighter (root ID or resolved include path).
- `fileId`: stable host-owned file identity.
- `snapshot`: immutable captured source snapshot, when available.

The adapter rewrites the bound `SourceReference.range.file` to the stable host file ID. It never creates a revision or infers a host identity from a path. A known locator without a snapshot is reported as `bufferUnavailable`; a locator with no registered identity is `sourceIdentityUnresolved`.

The `sourceManifest` records each supplied locator, host file ID, optional revision, writability, and snapshot availability. The caller is responsible for supplying the complete set of snapshots actually consumed by the Highlighter request, including root and included sources.

## 3. Mapping and editability

Mapping states:

- `verified`: range coordinates validate against the exact captured snapshot.
- `unmapped`: Highlighter supplied no range.
- `bufferUnavailable`: locator is known, but its host snapshot is absent.
- `sourceIdentityUnresolved`: no explicit locator-to-host-identity binding exists.
- `invalidRange`: coordinates do not validate against the captured snapshot.

A verified range only establishes coordinate validity. It does not establish that the range covers a complete statement, semantic construct, or visual block. `spanRole` is `unknown` unless a caller explicitly supplies an assertion in `spanRoles`; the adapter does not infer span semantics.

Editability continues to be determined by the source origin and snapshot writability. Macro-expanded/generated and unknown-origin content is not made editable by this adapter.

## 4. Forward compatibility

Unknown construct kinds and origins are retained in `rawKind` and `rawOrigin`, while normalized values become `Unknown`. They do not cause the adapter to throw or silently acquire known semantics.

The projection declares current limitations explicitly:

| Capability | Version 1 declaration |
|---|---|
| Source coverage | Recognized constructs only |
| Containment | Not provided |
| Semantic span roles | Unknown unless host-asserted |
| Macro provenance | Origin enum only |
| Embedded content kinds | Collapsed by Highlighter |
| Ordering | Highlighter output order preserved |

Diagnostics are emitted for unresolved source identity, unavailable snapshots, and invalid ranges.

## 5. Preserved non-goals

Version 1 does not:

- Parse or reinterpret Calcpad source.
- Infer statement or container boundaries from token ranges.
- Build a parent/child hierarchy.
- Invent full source coverage or fallback regions.
- Reconstruct macro definition/invocation/expansion relationships.
- Sort constructs independently of Highlighter output.
- Own file identity, source revisions, persistence, edits, or undo/redo.

## 6. Verification

The compatibility test suite covers version metadata, exact revision binding, explicit path-to-host identity mapping, unavailable and unresolved sources, invalid ranges, unmapped constructs, generated read-only behavior, unknown future kinds/origins, capability declarations, diagnostics, and the legacy helper.

Run from this directory:

```sh
npm test
npm run typecheck
npm run build
```

These commands have not yet been executed in the current implementation session. Until they pass in a runtime environment, this milestone is code-authored but not runtime-verified.
