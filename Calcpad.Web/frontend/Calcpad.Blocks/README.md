# Calcpad.Blocks

An isolated Vue 3 package for the source-backed Calcpad worksheet workbench.

## Current contents

- Host-owned source snapshot, revision, and edit-request contracts.
- An adapter matching the current Highlighter structural-output shape.
- UTF-16 source-range conversion with CRLF handling.
- A first inspection workbench that shows original source beside recognized Highlighter constructs.

The workbench is deliberately an inspection surface, not yet the final nested visual worksheet editor. The current Highlighter output is flat and some ranges are token-sized; the UI therefore does not invent semantic block boundaries or nesting.

## Development

Run npm install, npm test, npm run typecheck, and npm run build from this directory.

Vue is a peer dependency. The package is not yet wired into calcpad-web; that integration follows after the source contracts and Highlighter projection shape are validated.

See DEVELOPMENT.md and SOURCE_BUFFER_CONTRACT.md for architecture and current limitations.