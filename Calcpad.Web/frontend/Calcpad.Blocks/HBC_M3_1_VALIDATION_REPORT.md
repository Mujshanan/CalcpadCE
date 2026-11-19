# HBC-M3.1 — Executable Validation and Compatibility Hardening

**Repository:** `Mujshanan/CalcpadCE`  
**Branch:** `hbc-m3/versioned-blocks-adapter`  
**Validation workflow commit:** `5c575a831a7a470f09b87a6e0a56773b3769f068`  
**Status:** CI workflow added; execution result not yet observable

## 1. Work performed

Added `.github/workflows/hbc-m3-validation.yml` to run the Blocks package checks on pushes to HBC-M3 branches, relevant pull requests, and manual dispatch.

The workflow:

1. Checks out the repository.
2. Sets up Node.js 22.
3. Installs package dependencies with npm.
4. Runs `npm test`.
5. Runs `npm run typecheck`.
6. Runs `npm run build`.

The workflow intentionally does not use npm's setup-node cache because the Blocks package does not currently commit a package lockfile. This avoids a cache setup failure caused by a missing lockfile.

## 2. Execution constraints

A local checkout could not be established in this environment because outbound DNS/network access to GitHub is unavailable. The GitHub connector exposes commit-associated workflow runs only for pull-request-triggered runs; it returned no runs for the validation commits. The commit status endpoint also returned no reported statuses.

Therefore, no test, typecheck, or build result is claimed. The workflow has been committed to the branch, but its execution and result must be confirmed from the repository's Actions page.

## 3. Compatibility coverage still required

The existing TypeScript tests cover the adapter's normalization and source-binding behavior using fixtures. A further integration test should capture or construct a representative JSON payload from the actual C# `StructuralOutput` serialization path and feed it through the TypeScript adapter.

That test should verify:

- enum serialization names and casing;
- null and absent range behavior;
- zero-based, exclusive-end coordinate semantics;
- included-file locator values as emitted by the resolver;
- nullable `Text` and `Name` fields;
- unknown future enum values.

Do not change `Calcpad.Highlighter` merely to make the adapter tests pass. If the real serialized payload differs from the TypeScript contract, document the observed payload and adapt the TypeScript boundary.

## 4. Current disposition

- CI workflow authored and committed.
- Highlighter source remains unchanged.
- No merge or pull request created.
- Runtime package validation remains pending.
- HBC-M3.1 remains open until the workflow passes and real-payload compatibility is covered.
