# BlockSuite integration foundation

**Status:** Initial stable-version schema integration  
**BlockSuite version:** `@blocksuite/store@0.22.4`  
**Scope:** Phase 5 foundation only; not yet a mounted editor.

## Ownership

Calcpad source remains the sole authoritative authored worksheet. The BlockSuite
tree is a disposable runtime projection. Do not persist it as a second worksheet,
attach an independent authored undo history, or use its serialized state to
reconstruct source.

The host continues to own source buffers, file identity, revisions, persistence,
source edits, conflict handling, and undo/redo. Blocks owns the visual projection
and its transient editor state.

## Initial schema

The first stable BlockSuite integration deliberately registers only:

- `calcpad:worksheet`: root document block with host document/revision identity.
- `calcpad:text`: leaf source-text block with source file, revision, source offsets,
  origin, projection key, and editability metadata.

This is an intentionally narrow vertical-slice schema. Specialized semantic
blocks, nested containers, renderers, commands, and source editing are not part
of this initial foundation. They must be added only when the Highlighter supplies
reliable semantic spans and structural relationships.

## Version policy

All direct BlockSuite packages must use the same exact published version. The
initial dependency is pinned to `@blocksuite/store@0.22.4`; do not use `^0.22.4`,
`latest`, or canary tags. If more BlockSuite packages are added, pin each to
`0.22.4` and verify peer/dependency compatibility before installation.

## Validation

The schema tests verify registration, schema versions, root/child constraints,
and the prohibition on nested text blocks. Run from this directory:

```sh
npm install
npm test
npm run typecheck
npm run build
```

The test suite and build must pass in a real package environment before this
foundation is considered verified. A schema registry alone is not a complete
BlockSuite editor; the next increment must add the pinned renderer/runtime
packages and prove a standalone mounted workspace without integrating Calcpad Web.
