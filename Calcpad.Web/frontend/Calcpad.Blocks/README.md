# Calcpad.Blocks

An isolated Vue 3 package for the source-backed Calcpad worksheet workbench.

## Current contents

- Host-owned source snapshot, revision, and edit-request contracts.
- Versioned Highlighter-to-Blocks adapter envelope (`calcpad.highlighter.blocks`, version 1).
- Explicit Highlighter file-locator to host file-identity resolution.
- Per-projection immutable source snapshot sessions and manifests.
- Conservative construct normalization, mapping diagnostics, and UTF-16 source-range validation.
- An inspection workbench that shows original source beside recognized Highlighter constructs, with construct search, mapping status, and explicit source-navigation actions.

The adapter does not change Calcpad.Highlighter. It preserves the existing flat construct order and raw enum values, and it does not infer statement boundaries, semantic span roles, containment, complete source coverage, or macro provenance relationships. Unknown future construct kinds and origins are retained rather than treated as fatal errors.

The workbench remains an inspection surface, not yet the final nested visual worksheet editor. It does not invent semantic block boundaries or nesting.

## Development

Run `npm install`, `npm test`, `npm run typecheck`, and `npm run build` from this directory.

Vue is a peer dependency. The package is not yet wired into calcpad-web; that integration follows after the source contracts and Highlighter projection shape are validated.

See [DEVELOPMENT.md](DEVELOPMENT.md) and [SOURCE_BUFFER_CONTRACT.md](SOURCE_BUFFER_CONTRACT.md) for architecture, contract semantics, and current limitations.
