# Calcpad.Blocks

An isolated Vue 3 package for a source-backed Calcpad worksheet projection.

## Current contents

- Host-owned source snapshot, revision, and edit-request contracts.
- A Highlighter structural-output adapter with explicit source identity mapping.
- UTF-16 source-range conversion with CRLF handling.
- A stable BlockSuite store schema and transient document factory.
- A read-only Vue renderer that reads the source text from the BlockSuite model.
- Tests for source fidelity, schema relationships, lifecycle boundaries, and
  projection snapshot serialization.

The current Highlighter output is flat and some ranges are token-sized. The
initial BlockSuite document therefore contains one source-text block; it does
not infer semantic boundaries or nesting.

## Ownership

Calcpad source remains authoritative. BlockSuite is a disposable projection,
not a second worksheet format. The host owns persistence, revisions, editing,
conflicts, and undo/redo. The BlockSuite store is read-only.

## Development

Run `npm install`, `npm test`, `npm run typecheck`, and `npm run build`
from this directory. See [DEVELOPMENT.md](DEVELOPMENT.md) and
[BLOCKSUITE_INTEGRATION.md](BLOCKSUITE_INTEGRATION.md) for architecture and
current limitations.
