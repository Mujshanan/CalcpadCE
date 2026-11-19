# HBC-M1 — Calcpad.Highlighter Structural Output Audit

**Repository:** `Mujshanan/CalcpadCE`  
**Branch:** `feature/calcpad-blocks-foundation`  
**Audited baseline:** `5ed21fee129afcb3bedcf48ca058320644785247`  
**Audit type:** Read-only implementation and contract audit  
**Status:** Static inspection complete; runtime verification pending  
**Scope:** Calcpad.Highlighter structural output, source mapping, include/macro provenance, Blocks adapter, and existing tests

---

## 1. Executive summary

The existing Highlighter-to-Blocks foundation is directionally sound: Calcpad source remains authoritative, the Highlighter owns language recognition, the host owns source buffers and revisions, and Blocks adapts structural output for presentation.

The current structural output is nevertheless an inspection-oriented list of recognized markers, not a sufficient input for a semantic worksheet projection engine.

The most important gaps are:

1. Most token-derived ranges identify tokens, not complete statements or semantic containers.
2. Root source identity and included-file path identity are not normalized into one stable host identity contract.
3. Macro expansion has useful per-character mapping internally, but the public structural model does not expose enough provenance relationships.
4. Structural output is flat and has no verified containment relationships.
5. Embedded content distinctions available in the tokenizer/Stage 3 pipeline are collapsed at the structural-output boundary.
6. Structural output does not provide complete source coverage or fallback regions.
7. Revision binding is correctly left to the host/Blocks adapter, but there is no explicit projection snapshot manifest contract.
8. Structural-output contract versioning/capabilities are absent.

**Recommendation:** Do not implement the semantic projection engine against the current output. First define and validate a versioned structural-output contract, then make targeted Highlighter improvements. Do not add a second Calcpad parser or keyword scanner in Blocks.

This audit makes no changes to Highlighter behavior, Blocks architecture, or existing source contracts.

## 2. Baseline and inspected files

The audited branch resolved to the reported commit:

`5ed21fee129afcb3bedcf48ca058320644785247`

Inspected implementation and guidance:

- `.claude/skills/calcpad-highlighter-developer/SKILL.md`
- `.claude/skills/calcpad-highlighter-developer/reference/architecture.md`
- `.claude/skills/calcpad-highlighter-developer/testing.md`
- `Calcpad.Highlighter/ContentResolution/ContentResolver.cs`
- `Calcpad.Highlighter/ContentResolution/ContentResolver.Stage1.cs`
- `Calcpad.Highlighter/ContentResolution/ContentResolver.Stage2.cs`
- `Calcpad.Highlighter/ContentResolution/ContentResolver.Stage3.cs`
- `Calcpad.Highlighter/ContentResolution/ISourceBufferProvider.cs`
- `Calcpad.Highlighter/ContentResolution/StructuralOutput.cs`
- `Calcpad.Highlighter/ContentResolution/StructuralOutputBuilder.cs`
- `Calcpad.Highlighter/ContentResolution/ContentResolverResult.cs`
- `Calcpad.Highlighter/Linter/Helpers/SourceMapper.cs`
- `Calcpad.Highlighter/Tokenizer/Models/Token.cs`
- `Calcpad.Tests/Highlighter/StructuralOutputBuilderTests.cs`
- `Calcpad.Web/frontend/Calcpad.Blocks/src/integrations/calcpad/highlighter-contract.ts`
- `Calcpad.Web/frontend/Calcpad.Blocks/src/core/source/contracts.ts`
- `Calcpad.Web/frontend/Calcpad.Blocks/SOURCE_BUFFER_CONTRACT.md`
- `Calcpad.Web/frontend/Calcpad.Blocks/tests/contracts/highlighter-contract.test.ts`
- `Calcpad.Web/frontend/Calcpad.Blocks/package.json`
- `Calcpad.Web/frontend/Calcpad.Blocks/DEVELOPMENT.md`

## 3. Actual pipeline and structural-output behavior

The resolver uses three stages:

1. **Stage 1:** line-continuation processing, retaining source maps and continuation segments.
2. **Stage 2:** include resolution and macro collection through Core's `MacroParser`; supplied include buffers are preferred, with filesystem fallback.
3. **Stage 3:** macro-expanded lines, tokenization, definition/type collection, and mapping/index construction.

`StructuralOutputBuilder.Build` consumes the staged result and projects selected Stage 3 tokens plus selected Stage 2 metadata into a flat list.

The public structural model currently contains:

- `StructuralOutput.Constructs`
- `StructuralConstruct.Kind`
- Optional `Range`
- Optional `Text`
- `Origin`
- Optional `Name`

The range stores file, start line/column, and end line/column. The model documents zero-based positions and an exclusive end. It does not expose a contract version, revision, parent/child relation, coverage information, or explicit mapping status.

The builder sorts candidates by a staged line, column, and insertion sequence. This gives deterministic ordering for the current candidate stream, but the ordering semantics across root source, included files, and macro-expanded content are not documented as a stable public contract.

## 4. Findings

### HBC-F01 — Token ranges are not complete construct spans

**Severity:** Critical  
**Status:** Partially implemented; blocks semantic projection.

For most token-derived constructs, the builder calls `TryMapStage3Range` with the token's line, column, and token length. This produces a source span for the token, not the complete statement or container.

Examples include variable names, function names/calls, control-flow keywords, commands, and directive tokens.

Some special cases use broader ranges:

- Macro definitions: the corresponding Stage 2 definition line.
- Custom units: a whole source line.
- Root include directives: a whole source line.
- Raw HTML/Markdown: individual lines.

These exceptions do not establish complete construct spans generally. The mapping helper also requires the mapped characters to remain contiguous on one original source line. A logical construct crossing continuation segments may therefore remain unmapped rather than being represented as multiple source ranges.

**Required follow-up:** distinguish token, statement, and complete construct/container spans. Add multi-segment source mapping only where the language pipeline can prove it. Never widen a token range heuristically in Blocks.

### HBC-F02 — Included-file path is not a stable host identity

**Severity:** Critical  
**Status:** Partially implemented; blocks reliable cross-file binding.

The Highlighter's `ISourceBufferProvider.TryGetSource(file, out source)` receives the resolved include identity used by the resolver, which is a resolved path in the current pipeline.

The structural builder places that path in `SourceRange.File` for included-file constructs. By contrast, the Blocks source contract describes `SourceFileId` as a stable host-owned file identity.

The root source receives the caller-supplied `rootSourceId`, while included files use resolved paths. There is no explicit public mapping contract that converts an include path to the host's stable file identity.

The current implementation can work when the host deliberately uses canonical paths as file IDs, but that is an unstated coupling and is not guaranteed by the contract.

**Required follow-up:** define a source-identity resolution boundary. Preserve resolved path as a locator/display attribute where useful, but bind every source range to a host-issued stable identity before Blocks creates a revision-bound source reference.

### HBC-F03 — Macro provenance is useful internally but incomplete publicly

**Severity:** Critical  
**Status:** Partially implemented.

The resolver already retains meaningful macro information:

- Macro names and expansion context.
- Call-site line and Stage 2 line.
- Expanded content line index/count.
- Per-character Stage 2 origin positions.
- Source columns for text originating on the call-site line.

The structural builder attempts character-by-character mapping through Stage 3 expansion origins and marks mapped expanded text as `MacroExpansion`. Unmapped expanded content can fall back to `Generated`.

This is a strong foundation. However, the public construct model exposes only one range and one origin enum. It does not describe the relationship among the macro definition, invocation, expansion fragment, and nested expansion chain. A single `MacroExpansion` value cannot communicate all those locations.

**Required follow-up:** expose verified provenance references/relationships, retaining separate authored-definition, invocation, and expansion-context locations where available. Keep generated fragments read-only. Do not assume a mapped expansion fragment is itself editable authored text.

### HBC-F04 — Structural containment is absent

**Severity:** Critical  
**Status:** Missing.

`StructuralOutput` exposes a flat list only. No parent ID, child relationship, containment range, or nesting status is exported.

The Highlighter has control-flow and balance validation machinery, but the current structural-output builder does not expose a verified block hierarchy.

Blocks must not derive nesting from indentation, token proximity, or keyword matching.

**Required follow-up:** determine which relationships can be obtained reliably from existing language structures. Export containment only when the Highlighter can prove it. Represent unknown containment explicitly rather than treating it as top-level.

### HBC-F05 — Embedded-content distinctions are discarded

**Severity:** Major  
**Status:** Partially implemented; useful information already exists upstream.

The tokenizer distinguishes token categories including HTML content, JavaScript, CSS, SVG, and tags. Stage 3 also retains per-line parse modes and raw-content lines.

However, `StructuralOutputBuilder.TryGetKind` maps tags, HTML content, JavaScript, CSS, and SVG to `HtmlOrMarkdownContent`. Raw HTML/Markdown lines are emitted with the same broad kind.

The structural output therefore loses distinctions available in the underlying pipeline. It cannot reliably select separate HTML, SVG, Markdown, or script/style handling.

**Required follow-up:** expose an embedded-content format/category from existing Highlighter recognition. Do not introduce HTML/SVG/Markdown keyword or markup detection in Blocks. Keep rendering and sanitization in the UI layer.

### HBC-F06 — Complete source coverage and fallback are absent

**Severity:** Critical  
**Status:** Missing.

The builder emits recognized constructs only. It does not emit contiguous ordinary text regions, whitespace regions, unrecognized source regions, or a source-coverage manifest.

The projection engine will need to preserve every authored source character. It cannot safely use current token-sized ranges as complete semantic block boundaries.

**Required follow-up:** define a source-coverage invariant per source file. Recognized constructs should identify safe spans; remaining source intervals should be represented as contiguous fallback/text regions. Nested references must not cause duplicate ownership at the same projection level. Preserve comments, whitespace, and line endings.

### HBC-F07 — Revision binding is correctly outside Highlighter, but projection consistency needs a manifest

**Severity:** Major  
**Status:** Ownership correct; end-to-end contract incomplete.

The Highlighter does not own editor revisions, which is correct. The Blocks adapter captures the root snapshot and caches included-file snapshots on first access. It then binds constructs to the snapshot revision.

Stage 2 also records SHA-256 hashes and exact source text for included files consumed during resolution.

However:

- Structural output has no revision information.
- There is no explicit projection-level manifest listing all snapshots used.
- The host-snapshot provider and Highlighter's resolved-path include lookup do not yet share a formally specified identity mapping.
- Filesystem fallback can supply content that is not represented by a host snapshot; Blocks must keep such constructs unbound/read-only until it obtains a matching host snapshot.

**Required follow-up:** keep revisions host-owned, but create a projection snapshot manifest in Blocks. It must list the root and every included source snapshot actually consumed, using stable file IDs and revision tokens. The same immutable captured snapshots must be used for resolution and binding.

### HBC-F08 — Mapping status is not part of the Highlighter structural model

**Severity:** Major  
**Status:** Partially implemented in Blocks.

The C# structural model represents missing ranges through a null range. Blocks separately classifies a construct as unmapped, buffer unavailable, invalid range, or verified.

That separation is useful, but the adapter's current `verified` status means the returned range is valid against the captured text. It does not prove that the range is a complete semantic construct span.

Keep source correspondence and semantic completeness as separate concepts. A range can be exact for a token while incomplete for a visual block.

**Required follow-up:** preserve mapping status/provenance and add an explicit span role/completeness concept. Do not call a token range a complete construct span.

### HBC-F09 — Contract version and capabilities are absent

**Severity:** Major  
**Status:** Missing.

The structural output contains no version or capability declaration. Blocks therefore assumes the current shape and semantics.

**Required follow-up:** version the public structural-output contract and define compatibility behavior. Capability declarations should describe supported guarantees, not internal implementation details.

### HBC-F10 — Ordering is deterministic but its public semantics are underspecified

**Severity:** Major  
**Status:** Partially implemented.

The builder sorts candidates by staged line, column, and sequence. Stage 2 flattens include content into the resolution stream; Stage 3 maps expanded lines back to Stage 2 lines. This supports deterministic ordering for the current flattened stream.

However, the contract does not say whether consumers receive root-document order, include-expansion order, or per-file source order. Constructs from different source files cannot be ordered by comparing their original line numbers alone.

**Required follow-up:** define ordering within each source file and define explicit placement/relationship for included content and generated expansion. Preserve the Highlighter's order rather than recomputing semantic order in Blocks.

## 5. Capability matrix

| Capability | Actual status | Projection readiness |
|---|---|---|
| Root source identity input | Implemented | Partial |
| Included source path | Implemented | Partial |
| Stable host identity for included files | Missing | Blocker |
| Zero-based, exclusive source ranges | Implemented | Partial |
| Token source spans | Implemented | Ready for inspection only |
| Complete statement spans | Missing/incomplete | Blocker |
| Complete container spans | Missing | Blocker |
| Line-continuation mapping | Partially implemented | Blocker for multi-segment constructs |
| Include provenance | Implemented internally | Partial |
| Macro per-character mapping | Implemented internally | Partial |
| Public macro relationship graph | Missing | Blocker |
| Source origin enum | Implemented | Partial |
| Verified parent/child containment | Missing | Blocker |
| HTML/Markdown/SVG distinction | Partially available upstream; collapsed in output | Blocker |
| Flat deterministic candidate ordering | Implemented | Partial |
| Complete source coverage | Missing | Blocker |
| Fallback text regions | Missing | Blocker |
| Host revision ownership | Correctly external | Ready as ownership principle |
| Projection snapshot manifest | Missing | Blocker |
| Mapping status | Blocks adapter only | Partial |
| Contract version/capabilities | Missing | Blocker |
| Host-owned source edit request | Defined in Blocks | Not validated end-to-end |

## 6. Existing test coverage

The repository contains `Calcpad.Tests/Highlighter/StructuralOutputBuilderTests.cs`. The inspected class covers:

1. Variable assignment/reassignment, comments, and independent control directives.
2. Resolving an include from an unsaved host buffer.
3. Reading exact disk source for an included construct.
4. Preferring the host buffer over disk content.
5. Avoiding invented mathematical-expression boundaries.

The Blocks package also contains source-range tests and adapter contract tests for revision binding, missing include snapshots, generated read-only behavior, missing ranges, and include snapshot caching.

These are useful foundation tests, but the structural-output tests do not currently establish the full HBC contract.

### Required test additions

- **Span completeness:** token vs statement vs complete definition/control-flow container.
- **Continuations:** constructs spanning continuation segments; exact multi-range mapping or explicit unavailable mapping.
- **Includes:** stable host identity mapping, nested includes, include source ordering, host buffer and filesystem fallback behavior.
- **Macros:** inline/multiline definitions, argument-origin fragments, macro-body fragments, nested macros, included macro definitions, unmappable generated text.
- **Containment:** nested conditionals/loops/definitions, malformed/unclosed constructs, unknown containment.
- **Embedded content:** HTML, SVG, Markdown, CSS, JavaScript, mixed content, unknown content.
- **Coverage:** ordinary text, comments, whitespace, blank lines, CRLF/LF, final empty line, unrecognized syntax.
- **Ordering:** multiple constructs on a line, included files, expanded lines, deterministic repeat projections.
- **Revisions:** root and include snapshots changing during a projection, missing host snapshots, subsequent projection with new revisions.
- **Contract compatibility:** supported and unsupported output versions/capabilities.
- **Editing safety:** stale revisions, read-only included files, generated content, overlapping edits, invalid UTF-16 boundaries, atomic multi-edit rejection.

### Fixture reuse

Existing fixtures already cover many useful language cases, including:

- `control_flow.cpd`
- `functions.cpd`
- `macros.cpd`
- `nested_macros.cpd`
- `nestedMacroInclude.cpd`
- `nestedMacroInclude2.cpd`
- `include.cpd`
- `import.cpd`
- `HTML.cpd`
- `markdown.cpd`
- `data_exchange.cpd`
- `matrices.cpd`
- `vectors.cpd`
- `line_continuation.cpd)
- `multiline_def_quotes.cpd`

These should be reused where possible rather than creating redundant fixtures.

## 7. Recommended contract changes

The audit recommends formalizing five independent models before implementation:

1. **Source model:** stable source identity, source locator/path, position, range, and snapshot binding.
2. **Structural model:** construct kind, span role/completeness, and verified containment.
3. **Provenance model:** authored origin, include relationship, macro definition/invocation/expansion relationships, and generated status.
4. **Projection binding model:** projection identity, contract version/capabilities, and immutable snapshot manifest.
5. **Editing model:** host-owned revision-checked transactions, with atomicity and range validation.

These models should remain framework-independent. Do not add Vue, BlockSuite, Monaco, DOM, or renderer-specific fields to the Highlighter contract.

## 8. Recommended implementation sequence

### HBC-M2 — Contract specification

Define the versioned public contract, including stable source identity semantics, span roles, provenance relationships, containment, embedded-content classification, ordering, and capability negotiation.

No semantic projection engine yet.

### HBC-M3 — Targeted Highlighter improvements

Implement only the upstream information that the language pipeline can prove. Prioritize source identity resolution, complete source spans, provenance, and verified containment. Preserve conservative unmapped behavior.

### HBC-M4 — Adapter and contract tests

Bind structural output to immutable host snapshots, validate ranges and containment, retain provenance, and produce a projection snapshot manifest. Add real-fixture integration tests.

### HBC-M5 — Projection specification

Define source coverage, contiguous fallback regions, ordering, nesting, and source-fidelity invariants using the validated contract.

### HBC-M6 — Semantic projection engine

Implement projection only after HBC-M4 and HBC-M5 acceptance criteria pass.

## 9. Audit boundaries and verification status

This was a static repository inspection at the audited baseline.

- No Highlighter source files were modified.
- No Blocks source contracts or architecture files were modified.
- No projection engine was implemented.
- No branch merge or pull request was created.
- Existing test source files were inspected.
- .NET tests, frontend tests, typecheck, and build were **not executed** in this session.
- No runtime behavior is claimed as verified.

The repository's Highlighter developer guide identifies the relevant verification commands:

```bash
dotnet test Calcpad.Tests/Calcpad.Tests.csproj --filter "FullyQualifiedName~Calcpad.Tests.Highlighter"
dotnet test tools/highlighter-examples-test/HighlighterExamplesTest.csproj
```

For the Blocks package, run from `Calcpad.Web/frontend/Calcpad.Blocks` using the repository's package manager:

```bash
npm test
npm run typecheck
npm run build
```

## 10. HBC-M1 completion assessment

**Static audit:** Complete.  
**Runtime verification:** Pending.  
**Semantic projection readiness:** Not ready.

HBC-M1 establishes the actual capability gaps and the next contract work. It does not authorize implementation of the semantic projection engine.

**Final recommendation:** Proceed to HBC-M2, the formal versioned Highlighter-to-Blocks contract specification. Keep the current source-first architecture and require explicit evidence for every span, provenance relationship, and containment edge.
