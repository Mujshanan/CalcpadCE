# Calcpad.Blocks — Source Buffer and Highlighter Adapter Contract

Status: HBC-M3 implementation, contract version 1.

## 1. Verified Highlighter surface

The current Calcpad.Highlighter output remains unchanged:

- `StructuralOutput.Constructs` is a flat list.
- Each `StructuralConstruct` exposes `Kind`, optional `Range`, optional `Text`, `Origin`, and optional `Name`.
- A source range uses zero-based line/column coordinates with an exclusive end.
- The output has no contract version, revision, parent/child relationship, complete source coverage, or semantic span-role declaration.
- `HtmlOrMarkdownContent` still groups several embedded-content token types; it does not reliably distinguish HTML, SVG, Markdown, CSS, or JavaScript.
- Several ranges identify token spans rather than complete statements or containers.
- Include and macro mapping may be partial. Missing or invalid ranges remain explicit limitations.

The source-range converter uses UTF-16 code-unit columns, matching .NET and JavaScript string indexing. CRLF is treated as one line break. Do not convert these coordinates to UTF-8 byte offsets or Unicode scalar indices.

## 2. Versioned Blocks adapter contract

Blocks wraps the unchanged Highlighter payload in this envelope:

- Contract ID: `calcpad.highlighter.blocks`
- Contract version: `1`
- Capabilities: explicit declarations for flat constructs, source ranges, complete source coverage, containment, macro provenance, embedded-content classification, and semantic span roles.
- Source manifest: the exact host snapshots captured or attempted during the projection request.
- Constructs: normalized construct entries, retaining raw Highlighter values.
- Diagnostics: explicit range/identity/snapshot mapping failures.

Versioning belongs to Blocks. It does not require a version field or DTO change in the current C# Highlighter model.

### Current capability declarations

| Capability | Version 1 |
|---|---|
| Flat construct list | Supported |
| Source range field | Supported, optional per construct |
| Complete source coverage | Not supported |
| Verified containment relationships | Not supported |
| Macro provenance graph | Not supported |
| Embedded-content subtype classification | Not supported |
| Semantic span-role classification | Not supported |

The adapter sets `spanRole` to `unknown` for every current construct. It must not infer token, line, statement, or container semantics from the construct kind.

## 3. Host-owned source identity

A Highlighter `SourceRange.File` is a Highlighter-side file locator. It is not assumed to be a stable host file identity.

The host supplies a `HighlighterSourceIdentityResolver` that maps each Highlighter file locator to a stable `SourceFileId`, and optionally retains the canonical locator. The root Highlighter locator is explicitly pinned to the supplied root snapshot.

The adapter must not fall back to using an unmapped include path as a host file ID. If identity resolution fails, the construct is `identityUnavailable`, has no source reference, and is not editable.

## 4. Projection snapshot session and manifest

Create one `HighlighterSourceSnapshotSession` per projection request. It:

1. Pins the root snapshot immediately.
2. Resolves included-file locators through the host identity resolver.
3. Captures each host snapshot at most once.
4. Caches missing identities and missing buffers for the lifetime of the request.
5. Serves the same captured text to Highlighter and the adapter.
6. Exposes a manifest containing every root/include locator requested, its resolved host identity when available, captured revision when available, and resolution status.

Captured snapshots are copied into immutable snapshot objects. A host revision changing during resolution does not change the text or revision already captured for that projection.

Manifest statuses are:

- `captured`
- `identityUnavailable`
- `bufferUnavailable`
- `identityMismatch`

Filesystem fallback performed inside Highlighter does not itself create a host snapshot. If no matching host snapshot is available, Blocks leaves the construct unbound and read-only.

## 5. Construct normalization and mapping

Every normalized construct retains:

- `projectionIndex`: request-local index; not a persistent block ID.
- `kind`: known kind or `Unknown`.
- `rawKind`: exact Highlighter kind value.
- `origin`: known origin or `Unknown`.
- `rawOrigin`: exact Highlighter origin value.
- `rawRange`: original Highlighter range and locator.
- `sourceLocator`: original Highlighter file locator when present.
- `spanRole`: `unknown` in version 1.
- `mapping` / `mappingStatus`: explicit binding result.
- `source`: present only when identity, snapshot, and range validation succeed; its file ID and range file are normalized to the host identity.
- `editable`: true only when the mapped host snapshot is writable and the origin is Local or IncludedFile.

Mapping statuses:

| Status | Meaning |
|---|---|
| `verified` | Stable host identity resolved, snapshot captured, and range validated |
| `unmapped` | Highlighter supplied no range |
| `identityUnavailable` | Locator could not be mapped to a host file identity |
| `bufferUnavailable` | Identity resolved but no host snapshot was available |
| `identityMismatch` | Returned snapshot identity did not match the requested host identity |
| `invalidRange` | Range coordinates were invalid for the captured source text |

A `verified` range is only a valid source correspondence. It is not proof that the range spans a complete statement or visual block.

Unknown future Highlighter kinds and origins are preserved in `rawKind` and `rawOrigin`. They normalize to `Unknown` and remain conservative/read-only as appropriate; they do not cause the adapter to reject the entire output.

## 6. Ordering and projection limits

The adapter preserves the Highlighter construct order exactly. It does not sort constructs by original line numbers, because constructs can refer to different files and expanded content.

Version 1 does not infer:

- statement or container boundaries;
- parent/child containment;
- complete source coverage or fallback text regions;
- macro definition/invocation/expansion relationships;
- HTML/SVG/Markdown/JavaScript/CSS subtypes;
- semantic span roles.

The adapter is a compatibility and source-binding layer, not a second parser or a semantic projection engine.

## 7. Editing and source references

A `SourceReference` contains the host-owned file ID, captured revision, normalized half-open range, and normalized source origin.

All edits continue through `SourceBufferHost.applyEdits` with an expected revision. The host validates and applies edits through its existing persistence and undo/redo lifecycle.

- Local source can be editable when the host snapshot is writable.
- Included source can be editable only when the host confirms it is writable.
- MacroExpansion, Generated, and Unknown origins remain read-only.
- Missing identity, missing snapshot, missing range, and invalid range never produce an editable source reference.
- Blocks does not regenerate source from block properties or maintain an independent source history.

## 8. Required validation

The Blocks package tests cover:

- versioned envelope and construct-order preservation;
- explicit include locator-to-host identity mapping;
- root and include snapshot manifest entries;
- one-time snapshot capture within a projection session;
- identity unavailable, buffer unavailable, and identity mismatch states;
- invalid and missing ranges;
- generated-content read-only behavior;
- unknown future kind/origin preservation;
- conservative unknown span-role and capability declarations.

Runtime compatibility against serialized C# Highlighter output still requires an integration fixture or host-side invocation. The adapter tests currently exercise the exact TypeScript shape corresponding to the inspected C# model; they do not execute the .NET Highlighter.
