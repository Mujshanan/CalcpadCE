# Calcpad.Blocks — Source Buffer Contract

Status: initial TypeScript contract aligned to the current Highlighter implementation.

## 1. Verified Highlighter surface

The current Calcpad.Highlighter branch exposes:

- ContentResolver.GetStagedContent(content, sourceFilePath, macroCalls, sourceBuffers) accepts root source as a string and an optional ISourceBufferProvider.
- ISourceBufferProvider.TryGetSource(file, out source) is a synchronous lookup for the exact current text of a resolved included file. It does not expose revisions, writes, selections, or editor lifecycle.
- StructuralOutputBuilder.Build(rootSource, rootSourceId, staged, sourceBuffers) builds a flat list of StructuralConstruct values.
- StructuralConstruct.Range is optional. When present, coordinates are zero-based line/column positions with an exclusive end.
- StructuralOutput has no parent/child relationship, no complete source coverage guarantee, and no revision field.
- HtmlOrMarkdownContent groups several token types, including HTML, JavaScript, CSS, and SVG. It is not yet a reliable HTML-versus-SVG discriminator.
- Several ranges identify recognized token spans, not complete statements or containers. They must not be treated as complete visual block boundaries.
- Macro expansion and include mapping can be incomplete. An absent or invalid range is an explicit unmapped construct.

The current SourceRange uses .NET string positions, which are UTF-16 code-unit columns. JavaScript string offsets are also UTF-16 code units. Do not convert these coordinates to UTF-8 byte offsets or Unicode scalar indices.

## 2. Ownership

The host editor owns mutable source buffers, stable file identities, revision tokens, persistence, dirty state, file lifecycle, conflicts, edit validation, undo/redo, and editor selection/reveal.

Calcpad.Blocks owns immutable source references bound to a host revision, Highlighter-output adaptation, projection/presentation, block selection, and source-edit requests expressing user intent.

Blocks must not maintain a second mutable source document or independent authoritative undo stack.

## 3. Buffer snapshot contract

SourceBufferSnapshot contains fileId, revision, text, and writable.

The root snapshot text is passed as content to GetStagedContent. Included-file snapshots are exposed through HighlighterIncludeSourceProvider.tryGetSource, which adapts to the current C# ISourceBufferProvider.TryGetSource contract.

The source provider captures the root snapshot immediately and each include snapshot on first access. It then serves the same text and revision for the entire projection request, even if the host buffer changes while resolution is running. A missing include snapshot is also cached as missing for that request.

## 4. Source references and coordinates

A SourceReference contains fileId, revision, original Highlighter range, and source origin.

Ranges are half-open: [start, end). Line and column values are zero-based. Columns are UTF-16 code units. Line-ending characters are not included in a line's column count. The range conversion helper treats CRLF as one line break and preserves .NET/JavaScript UTF-16 indexing.

A source reference is verified only if the range names a file with a host snapshot, both endpoints are valid in that snapshot, and the range is ordered and within the source.

No range, missing snapshot, or invalid coordinates remain distinct mapping statuses.

## 5. Edit request contract

All edits go through SourceBufferHost.applyEdits with fileId, expectedRevision, and source ranges plus replacement strings.

The host must reject stale revisions, read-only files, invalid ranges, and conflicting edits. It validates every range against the expected snapshot and applies accepted edits through its existing undo/redo mechanism.

Blocks does not optimistically mutate source text or claim an edit succeeded before the host returns status applied.

Local and included-file source may be editable only when the host snapshot says it is writable. Macro expansions, generated content, and unknown origins remain read-only even if a mapped source range exists. Macro expansion may navigate to its known origin but must not be edited as generated text.

## 6. Projection limitations and next Highlighter work

The current structural output is a flat recognized-construct list. It is sufficient to bind verified source markers and build an inspection UI, but not sufficient to produce the final nested worksheet block tree.

Before the full visual projection is implemented, Highlighter needs to provide, where the language pipeline can prove them:

1. Complete source spans for recognized statements and containers, not just identifier/keyword token spans.
2. Explicit parent/child or containment relationships for genuinely nested constructs.
3. Stable source identity for every range, including included-file source.
4. Precise construct kinds for HTML, SVG, Markdown, and other embedded content when those modes can be distinguished.
5. Explicit mapping status/provenance when expansion or continuation mapping is partial.

Blocks must not add a second keyword scanner to compensate. Until these contracts exist, the workbench displays original source unchanged and lists recognized constructs without inventing nesting or semantic block boundaries.