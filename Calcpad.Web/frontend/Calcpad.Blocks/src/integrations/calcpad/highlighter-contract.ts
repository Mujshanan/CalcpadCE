import {
    canEditSource,
    type SourceBufferSnapshot,
    type SourceOrigin,
    type SourceReference,
    type SourceRange,
} from '../../core/source/contracts';
import { sourceRangeToOffsets } from '../../core/source/range';

/**
 * Blocks-owned adapter contract. This version describes the normalized projection
 * boundary; it does not claim that Highlighter supplies semantic spans or coverage.
 */
export const BLOCKS_HIGHLIGHTER_CONTRACT_ID = 'calcpad.highlighter-to-blocks' as const;
export const BLOCKS_HIGHLIGHTER_CONTRACT_VERSION = 1 as const;

/**
 * Ordinal table copied from:
 * Calcpad.Highlighter/ContentResolution/StructuralOutput.cs,
 * enum StructuralConstructKind (Mujshanan/CalcpadCE,
 * feature/calcpad-blocks-foundation).
 *
 * The C# enum declares no explicit numeric values, so its underlying Int32 values
 * are zero-based and follow declaration order. Keep this table in exact lockstep
 * with that enum; update it only with a reviewed upstream enum change.
 */
export const HIGHLIGHTER_CONSTRUCT_KINDS = [
    'Comment',
    'HtmlOrMarkdownContent',
    'VariableDefinition',
    'VariableReassignment',
    'FunctionDefinition',
    'FunctionCall',
    'MacroDefinition',
    'MacroCall',
    'CustomUnitDefinition',
    'ControlFlowDirective',
    'Command',
    'IncludeDirective',
    'DataExchangeDirective',
    'InputDirective',
    'SettingsDirective',
    'MathematicalExpression',
] as const;

export const HIGHLIGHTER_CONSTRUCT_KIND_COUNT = HIGHLIGHTER_CONSTRUCT_KINDS.length;

/**
 * Ordinal table copied from:
 * Calcpad.Highlighter/ContentResolution/StructuralOutput.cs,
 * enum SourceOrigin (same repository/ref as the construct-kind table).
 * The C# enum has implicit zero-based values in declaration order.
 */
export const HIGHLIGHTER_SOURCE_ORIGINS = [
    'Local',
    'IncludedFile',
    'MacroExpansion',
    'Generated',
    'Unknown',
] as const;

export const HIGHLIGHTER_SOURCE_ORIGIN_COUNT = HIGHLIGHTER_SOURCE_ORIGINS.length;

export type HighlighterConstructKind = typeof HIGHLIGHTER_CONSTRUCT_KINDS[number];
export type HighlighterOrigin = SourceOrigin;
export type HighlighterEnumValue = string | number;

const knownKinds = new Set<string>(HIGHLIGHTER_CONSTRUCT_KINDS);
const knownOrigins = new Set<string>(HIGHLIGHTER_SOURCE_ORIGINS);

type EnumResolution<T extends string> =
    | { readonly status: 'known'; readonly value: T }
    | { readonly status: 'unknown'; readonly reason: 'ordinal' | 'name' };

function resolveOrdinalOrName<T extends string>(
    raw: HighlighterEnumValue,
    ordinalTable: readonly T[],
    knownNames: ReadonlySet<string>,
): EnumResolution<T> {
    if (typeof raw === 'number') {
        if (Number.isInteger(raw) && raw >= 0 && raw < ordinalTable.length) {
            return { status: 'known', value: ordinalTable[raw] };
        }
        return { status: 'unknown', reason: 'ordinal' };
    }

    if (knownNames.has(raw)) {
        return { status: 'known', value: raw as T };
    }
    return { status: 'unknown', reason: 'name' };
}

/** Wire shape serialized from Calcpad.Highlighter.StructuralOutput. */
export interface HighlighterStructuralConstruct {
    /** .NET enum JSON values may be numeric ordinals or configured string names. */
    readonly kind: HighlighterEnumValue;
    readonly range: SourceRange | null;
    readonly text: string | null;
    readonly origin: HighlighterEnumValue;
    readonly name?: string | null;
}

/** Existing Highlighter output is intentionally flat and unversioned. */
export interface HighlighterStructuralOutput {
    readonly constructs: readonly HighlighterStructuralConstruct[];
}

export type ConstructMappingStatus =
    | 'verified'
    | 'unmapped'
    | 'bufferUnavailable'
    | 'invalidRange'
    | 'sourceIdentityUnresolved';

export type ConstructSpanRole = 'token' | 'line' | 'construct' | 'unknown';

export type EnumValueStatus = 'known' | 'unknown';

/**
 * The host supplies an explicit mapping from Highlighter's file locator (often a
 * resolved include path) to its stable file ID and immutable captured snapshot.
 */
export interface HighlighterSourceBinding {
    readonly sourceLocator: string;
    readonly fileId: string;
    readonly snapshot?: SourceBufferSnapshot;
}

export interface HighlighterProjectionContext {
    /** Complete set of source snapshots actually supplied to this Highlighter run. */
    readonly sources: readonly HighlighterSourceBinding[];
    /** Optional roles are caller assertions; absent roles remain unknown. */
    readonly spanRoles?: Readonly<Record<number, ConstructSpanRole>>;
}

export interface ProjectionSourceManifestEntry {
    readonly sourceLocator: string;
    readonly fileId: string;
    readonly revision?: string;
    readonly writable: boolean;
    readonly available: boolean;
}

export interface BoundHighlighterConstruct {
    /** Projection-local identity only; never persist as a document/block ID. */
    readonly projectionIndex: number;
    /** Known kind when recognized; unknown future values are preserved in rawKind. */
    readonly kind: HighlighterConstructKind | 'Unknown';
    readonly kindStatus: EnumValueStatus;
    readonly rawKind: HighlighterEnumValue;
    readonly text: string | null;
    readonly name?: string | null;
    readonly origin: SourceOrigin;
    readonly originStatus: EnumValueStatus;
    readonly rawOrigin: HighlighterEnumValue;
    readonly mapping: ConstructMappingStatus;
    /** A valid source range is not necessarily a complete semantic block span. */
    readonly spanRole: ConstructSpanRole;
    readonly source?: SourceReference;
    readonly editable: boolean;
}

export interface BlocksHighlighterCapabilities {
    readonly sourceCoverage: 'recognized-constructs-only';
    readonly containment: 'not-provided';
    readonly semanticSpanRoles: 'unknown-unless-host-asserted';
    readonly macroProvenance: 'origin-enum-only';
    readonly embeddedContentKinds: 'collapsed-by-highlighter';
    readonly ordering: 'highlighter-output-order-preserved';
}

export interface ProjectionDiagnostic {
    readonly code:
        | 'unknownKindOrdinal'
        | 'unknownKindName'
        | 'unknownOriginOrdinal'
        | 'unknownOriginName'
        | 'sourceIdentityUnresolved'
        | 'bufferUnavailable'
        | 'invalidRange';
    readonly projectionIndex: number;
    readonly message: string;
}

export interface BlocksHighlighterProjection {
    readonly contractId: typeof BLOCKS_HIGHLIGHTER_CONTRACT_ID;
    readonly contractVersion: typeof BLOCKS_HIGHLIGHTER_CONTRACT_VERSION;
    readonly capabilities: BlocksHighlighterCapabilities;
    readonly sourceManifest: readonly ProjectionSourceManifestEntry[];
    readonly constructs: readonly BoundHighlighterConstruct[];
    readonly diagnostics: readonly ProjectionDiagnostic[];
}

type SourceResolution =
    | { readonly status: 'unmapped' }
    | { readonly status: 'sourceIdentityUnresolved'; readonly message: string }
    | { readonly status: 'bufferUnavailable'; readonly message: string }
    | { readonly status: 'invalidRange'; readonly message: string }
    | { readonly status: 'verified'; readonly source: SourceReference; readonly editable: boolean };

function resolveConstructSource(
    range: SourceRange | null,
    origin: SourceOrigin,
    bindings: ReadonlyMap<string, HighlighterSourceBinding>,
): SourceResolution {
    if (!range) return { status: 'unmapped' };

    const binding = bindings.get(range.file);
    if (!binding) {
        return {
            status: 'sourceIdentityUnresolved',
            message: 'No host file identity is registered for Highlighter locator "' + range.file + '".',
        };
    }

    const snapshot = binding.snapshot;
    if (!snapshot) {
        return {
            status: 'bufferUnavailable',
            message: 'The host snapshot for "' + range.file + '" was not available for this projection.',
        };
    }

    if (snapshot.fileId !== binding.fileId) {
        return {
            status: 'sourceIdentityUnresolved',
            message: 'Host snapshot identity "' + snapshot.fileId +
                '" does not match registered identity "' + binding.fileId + '".',
        };
    }

    const hostRange: SourceRange = { ...range, file: snapshot.fileId };
    if (!sourceRangeToOffsets(snapshot.text, hostRange)) {
        return {
            status: 'invalidRange',
            message: 'Highlighter range for "' + range.file +
                '" is outside the captured host snapshot.',
        };
    }

    const source: SourceReference = {
        fileId: snapshot.fileId,
        revision: snapshot.revision,
        range: hostRange,
        origin,
    };
    return {
        status: 'verified',
        source,
        editable: canEditSource(origin, snapshot),
    };
}

function assertNever(value: never): never {
    throw new Error('Unhandled Highlighter source-resolution status: ' + String(value));
}

/**
 * Normalize existing Highlighter output against exactly the snapshots used by the
 * request. Locator-to-file-ID mapping is explicit; filesystem paths are not IDs.
 */
export function adaptHighlighterOutput(
    output: HighlighterStructuralOutput,
    context: HighlighterProjectionContext,
): BlocksHighlighterProjection {
    const bindings = new Map(context.sources.map((entry) => [entry.sourceLocator, entry]));
    const sourceManifest = context.sources.map(({ sourceLocator, fileId, snapshot }) => ({
        sourceLocator,
        fileId,
        revision: snapshot?.revision,
        writable: snapshot?.writable ?? false,
        available: snapshot !== undefined,
    }));

    const diagnostics: ProjectionDiagnostic[] = [];
    const constructs = output.constructs.map<BoundHighlighterConstruct>((construct, projectionIndex) => {
        const rawKind = construct.kind;
        const rawOrigin = construct.origin;
        const kindResolution = resolveOrdinalOrName(
            rawKind, HIGHLIGHTER_CONSTRUCT_KINDS, knownKinds,
        );
        const originResolution = resolveOrdinalOrName(
            rawOrigin, HIGHLIGHTER_SOURCE_ORIGINS, knownOrigins,
        );
        const kind = kindResolution.status === 'known' ? kindResolution.value : 'Unknown';
        const origin = originResolution.status === 'known' ? originResolution.value : 'Unknown';

        if (kindResolution.status === 'unknown') {
            const code = kindResolution.reason === 'ordinal' ? 'unknownKindOrdinal' : 'unknownKindName';
            diagnostics.push({
                code,
                projectionIndex,
                message: 'Unknown Highlighter construct kind ' + JSON.stringify(rawKind) +
                    (kindResolution.reason === 'ordinal' ? ' (ordinal).' : ' (name).'),
            });
        }
        if (originResolution.status === 'unknown') {
            const code = originResolution.reason === 'ordinal' ? 'unknownOriginOrdinal' : 'unknownOriginName';
            diagnostics.push({
                code,
                projectionIndex,
                message: 'Unknown Highlighter source origin ' + JSON.stringify(rawOrigin) +
                    (originResolution.reason === 'ordinal' ? ' (ordinal).' : ' (name).'),
            });
        }

        const base = {
            projectionIndex,
            kind,
            kindStatus: kindResolution.status,
            rawKind,
            text: construct.text ?? null,
            name: construct.name ?? null,
            origin,
            originStatus: originResolution.status,
            rawOrigin,
            spanRole: context.spanRoles?.[projectionIndex] ?? 'unknown' as const,
            editable: false,
        };

        const resolution = resolveConstructSource(construct.range, origin, bindings);
        switch (resolution.status) {
            case 'unmapped':
                return { ...base, mapping: 'unmapped' };
            case 'sourceIdentityUnresolved':
                diagnostics.push({ code: resolution.status, projectionIndex, message: resolution.message });
                return { ...base, mapping: resolution.status };
            case 'bufferUnavailable':
                diagnostics.push({ code: resolution.status, projectionIndex, message: resolution.message });
                return { ...base, mapping: resolution.status };
            case 'invalidRange':
                diagnostics.push({ code: resolution.status, projectionIndex, message: resolution.message });
                return { ...base, mapping: resolution.status };
            case 'verified':
                return {
                    ...base,
                    mapping: 'verified',
                    source: resolution.source,
                    editable: resolution.editable,
                };
            default:
                return assertNever(resolution);
        }
    });

    return {
        contractId: BLOCKS_HIGHLIGHTER_CONTRACT_ID,
        contractVersion: BLOCKS_HIGHLIGHTER_CONTRACT_VERSION,
        capabilities: {
            sourceCoverage: 'recognized-constructs-only',
            containment: 'not-provided',
            semanticSpanRoles: 'unknown-unless-host-asserted',
            macroProvenance: 'origin-enum-only',
            embeddedContentKinds: 'collapsed-by-highlighter',
            ordering: 'highlighter-output-order-preserved',
        },
        sourceManifest,
        constructs,
        diagnostics,
    };
}

/** Compatibility helper for callers that already use file IDs as Highlighter locators. */
export function bindHighlighterOutput(
    output: HighlighterStructuralOutput,
    snapshots: { getSnapshot(fileId: string): SourceBufferSnapshot | undefined },
): readonly BoundHighlighterConstruct[] {
    const sources: HighlighterSourceBinding[] = [];
    const locators = new Set(output.constructs.flatMap((construct) =>
        construct.range ? [construct.range.file] : []));
    for (const sourceLocator of locators) {
        const snapshot = snapshots.getSnapshot(sourceLocator);
        sources.push({ sourceLocator, fileId: sourceLocator, snapshot });
    }
    return adaptHighlighterOutput(output, { sources }).constructs;
}
