# BlockSuite integration foundation

**Status:** Standalone, read-only BlockSuite projection/editor foundation  
**BlockSuite version:** `@blocksuite/store@0.22.4`  
**Scope:** Phase 5 only; Calcpad Web integration and source editing remain out of scope.

## Runtime and replaceable adapter

The package now creates a real BlockSuite `DocCollection`, `Doc`, and `Store`
through a dedicated `BlockSuiteDocumentAdapter` boundary. The stable adapter is
implemented with `@blocksuite/store@0.22.4`; Calcpad's document and Vue UI
contracts do not expose BlockSuite classes. A different BlockSuite release or
runtime can be substituted by implementing the same adapter contract.

The initial document has one worksheet root and one source-text leaf. The Vue
renderer reads the text from the BlockSuite model itself, not from a parallel
copy. This is a deliberately narrow visual vertical slice, not an AFFiNE
PageEditor preset.

The document is rebuilt when the host supplies a new document, file, revision,
or source snapshot, and disposed when replaced or unmounted.

## Projection fidelity

Current Highlighter output is flat, its ranges may be token-sized, and it does
not provide containment. The initial BlockSuite document therefore contains
one full-source text block. It does not infer semantic boundaries or nesting.
The full source is kept as a single text value so whitespace and CRLF are not
split or normalized by the projection layer.

## Ownership and persistence

Calcpad source remains the sole authoritative authored worksheet. The BlockSuite
tree is a disposable runtime projection. The package exposes BlockSuite snapshot
serialization only for diagnostics and round-trip tests; it is not a worksheet
save format and must never be used to reconstruct or overwrite source.

The host continues to own source buffers, file identity, revisions, persistence,
source edits, conflict handling, and undo/redo. The BlockSuite store is placed in
read-only mode. No independent authored history or persistence provider is
attached to the collection.

## Initial schema

- `calcpad:worksheet`: root with host document/revision identity.
- `calcpad:text`: leaf with the source text and source identity/revision metadata.

Specialized semantic blocks, nested containers, source navigation, commands,
and source editing are not part of this phase. Add them only when the Highlighter
supplies reliable semantic spans and structural relationships.

## Version policy

The direct BlockSuite dependency is pinned to the exact stable release
`@blocksuite/store@0.22.4`. Do not use a range, `latest`, or a canary tag.
The editor uses the store/model layer and a Calcpad-owned Vue renderer; it does
not depend on AFFiNE presets or internal AFFiNE block implementations.

## Validation

Run from this directory:

```sh
npm install
npm test
npm run typecheck
npm run build
```

The test suite covers schema registration/relationships, source fidelity in the
runtime model, read-only behavior, adapter substitution/disposal, and projection
snapshot serialization. These commands still need to be run in a real package
environment before the phase is marked verified.
