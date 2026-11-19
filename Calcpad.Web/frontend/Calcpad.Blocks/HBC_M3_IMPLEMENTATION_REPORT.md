# HBC-M3 — Versioned Blocks Adapter Implementation Report

**Repository:** `Mujshanan/CalcpadCE`  
**Branch:** `hbc-m3/versioned-blocks-adapter`  
**Base:** `3db939150c20d4adc07f06a5d3888a6b4f40d70f`  
**Initial adapter implementation commit:** `97477cbf65d640fdb37343b1c928953a0126c4c4`  
**Status:** Implementation authored; runtime validation pending

## 1. Scope completed

Implemented the versioned TypeScript Highlighter-to-Blocks adapter contract in:

- `Calcpad.Web/frontend/Calcpad.Blocks/src/integrations/calcpad/highlighter-contract.ts`
- `Calcpad.Web/frontend/Calcpad.Blocks/src/core/source/contracts.ts`

The adapter:

- publishes contract ID `calcpad.highlighter.blocks`, version `1`;
- wraps the existing flat Highlighter construct payload without changing its C# model;
- declares current capabilities and explicitly marks unsupported guarantees;
- preserves Highlighter construct order;
- preserves raw construct kinds and origins while normalizing unknown future values to `Unknown`;
- models `HighlighterFileLocator` / `HighlighterSourceRange` separately from host `SourceFileId` / `SourceRange`;
- records the original Highlighter file locator separately from the host file identity;
- deprecates the legacy identity-by-locator buffer helper for new integrations;
- binds source references only after host identity resolution, snapshot capture, and range validation;
- exposes per-projection source snapshot manifests and mapping diagnostics;
- records semantic span role as `unknown`, rather than inferring token/line/statement/container semantics;
- freezes captured snapshots and normalized contract data.

## 2. Source identity and snapshot boundary

Added `createHighlighterSourceSnapshotSession`.

The host supplies a resolver from each Highlighter file locator to a stable host-owned `SourceFileId`. The root locator is pinned to the supplied root snapshot. Included snapshots are captured once per projection and cached, including missing identities and missing buffers.

The adapter never treats an unresolved include path as a host file ID. A source reference is created only when the resolved identity matches the captured snapshot and the Highlighter range is valid against that exact snapshot.

## 3. Compatibility tests added

Updated:

`Calcpad.Web/frontend/Calcpad.Blocks/tests/contracts/highlighter-contract.test.ts`

The tests cover:

- contract identity/version and construct-order preservation;
- stable host identity mapping for included files;
- root/include snapshot manifest entries;
- per-session snapshot caching;
- identity unavailable, buffer unavailable, and identity mismatch;
- invalid and missing source ranges;
- generated-content read-only behavior;
- unknown future kind/origin preservation;
- conservative span-role and capability declarations;
- paired C#/TypeScript compatibility coverage for the ASP.NET Core numeric-enum JSON payload (added during HBC-M3.1; see `HBC_M3_1_VALIDATION_REPORT.md`).

Existing source-range tests and the package test script remain unchanged.

## 4. Documentation updated

- `SOURCE_BUFFER_CONTRACT.md`: versioned envelope, capability matrix, locator-to-identity mapping, snapshot manifest, mapping states, and projection limitations.
- `README.md`: current adapter behavior and limitations.
- `DEVELOPMENT.md`: HBC-M3 implementation status and validation state.

## 5. Explicit non-changes

- No files under `Calcpad.Highlighter` were changed.
- No C# DTOs or serialization changes were introduced.
- No semantic worksheet projection engine was implemented.
- No statement/container boundaries, containment, source coverage, embedded-content subtypes, or macro provenance graph were inferred.
- No BlockSuite integration or host editor changes were made.
- No pull request was opened and no branch was merged.

## 6. Validation status

Compatibility test cases have been authored but have **not** been executed in this environment. The following commands remain required from `Calcpad.Web/frontend/Calcpad.Blocks`:

```bash
npm test
npm run typecheck
npm run build
```

The .NET test suite and Blocks package checks have not yet been executed in this environment. HBC-M3.1 has since added a C# serialization test and a TypeScript consumer test that share the same JSON fixture; this validates the DTO wire shape without changing Highlighter or launching the HTTP server. See `HBC_M3_1_VALIDATION_REPORT.md` for scope and limitations.

## 7. Next step

Run the package test, typecheck, and build commands in a repository checkout. Resolve any failures before treating HBC-M3 as validated. Keep Highlighter unchanged unless a separately approved upstream contract change becomes necessary.
