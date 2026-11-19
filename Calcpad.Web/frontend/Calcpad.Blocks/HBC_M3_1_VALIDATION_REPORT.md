# HBC-M3.1 — Executable Validation and Compatibility Hardening

**Repository:** `Mujshanan/CalcpadCE`  
**Branch:** `hbc-m3/versioned-blocks-adapter`  
**Status:** C#/TypeScript serialization compatibility tests authored; execution pending

## 1. Finding: the current C# wire format uses numeric enums

The C# DTOs in `Calcpad.Highlighter/ContentResolution/StructuralOutput.cs` define `StructuralConstructKind` and `SourceOrigin` as ordinary enums.

The server registers MVC with `AddControllers()` in `Calcpad.Web/backend/Services/CalcpadApiService.cs`. No `JsonStringEnumConverter` or custom MVC JSON options are registered there. ASP.NET Core's default `System.Text.Json` web configuration therefore emits these enum properties as JSON numbers, not enum-name strings. Property names are camel-cased.

This exposed a real mismatch: the original TypeScript adapter accepted only string enum values. The adapter now accepts both numeric and string values. Numeric ordinals map using the C# declaration order; unknown numeric and string values normalize to `Unknown` while retaining the exact raw value.

## 2. Shared cross-language fixture

Added:

- `Calcpad.Tests/Highlighter/Fixtures/structural-output.web.json`
- `Calcpad.Tests/Highlighter/StructuralOutputSerializationCompatibilityTests.cs`

The C# test serializes actual `StructuralOutput`, `StructuralConstruct`, `SourceRange`, and enum DTO instances using `JsonSerializerDefaults.Web`, then compares the result structurally with the shared fixture. The test covers all 16 construct-kind enum ordinals and all 5 origin ordinals, including nullable range/text/name fields and the camel-case property shape.

The fixture is copied to the .NET test output directory by `Calcpad.Tests.csproj`.

## 3. TypeScript compatibility test

Updated `Calcpad.Web/frontend/Calcpad.Blocks/src/integrations/calcpad/highlighter-contract.ts`:

- accepts `kind` and `origin` as either strings or numbers;
- maps numeric enum values by the current C# enum ordinal order;
- preserves raw numeric/string values in `rawKind` and `rawOrigin`;
- maps unknown future numeric values to `Unknown` without discarding their raw values;
- retains string-enum compatibility.

Added a TypeScript test that reads the same fixture consumed by the C# test and passes it through `adaptHighlighterOutput`. It asserts all known kind/origin mappings, raw numeric preservation, valid source binding, and null-range behavior. A separate test covers unknown numeric enum values.

## 4. CI validation

Updated `.github/workflows/hbc-m3-validation.yml` to run:

1. .NET 10 serialization compatibility test:
   `dotnet test ../../../Calcpad.Tests/Calcpad.Tests.csproj --filter FullyQualifiedName~StructuralOutputSerializationCompatibilityTests`
2. Blocks package tests: `npm test`
3. TypeScript typecheck: `npm run typecheck`
4. Blocks package build: `npm run build`

The .NET step uses the shared fixture from the repository checkout; the Node step reads that same fixture. This is a paired producer-contract / consumer-contract test rather than a live HTTP endpoint test.

## 5. Validation limitations

No local .NET or npm test execution is claimed. The environment still cannot establish a local GitHub checkout, and the workflow result must be confirmed from GitHub Actions.

The C# test exercises the exact DTO serialization shape with ASP.NET Core's documented web defaults. It does not launch the server or capture an HTTP response. If the server later adds a custom converter or JSON option, the serialization test and fixture must be updated together.

## 6. Disposition

- Numeric-enum incompatibility identified and addressed in the TypeScript boundary.
- Shared C# JSON fixture and paired C#/TypeScript tests authored.
- CI extended to run both sides of the fixture contract.
- No changes made under `Calcpad.Highlighter`.
- No pull request opened and no merge performed.
- HBC-M3.1 remains open until CI passes.
