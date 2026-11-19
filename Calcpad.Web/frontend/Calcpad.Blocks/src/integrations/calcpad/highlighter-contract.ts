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

export const HIGHLIGHTER_CONSTRUCT_KINDS = [
    'Comment', 'HtmlOrMarkdownContent', 'VariableDefinition', 'VariableReassignment',
    'FunctionDefinition', 'FunctionCall', 'MacroDefinition', 'MacroCall',
    'CustomUnitDefinition', 'ControlFlowDirective', 'Command', 'IncludeDirective',
    'DataExchangeDirective', 'InputDirective', 'SettingsDirective', 'MathematicalExpression',
] as const;

export type HighlighterConstructKind = typeof HIGHLIGHTER_CONSTRUCT_KINDS[number];
export type HighlighterOrigin = SourceOrigin;

const knownKinds = new Set<string>(HIGHLIGHTER_CONSTRUCT_KINDS);
const knownOrigins = new Set<string>([
    'Local', 'IncludedFile', 'MacroExpansion', 'Generated', 'Unknown',
]);

/** Wire shape currently serialized from Calcpad.Highlighter.StructuralOutput. */
export interface HighlighterStructuralConstruct {
    readonly kind: string;
    readonly range: SourceRange | null;
    readonly text: string | null;
    readonly origin: string;
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
    readonly rawKind: string;
    readonly text: string | null;
    readonly name?: string | null;
    readonly origin: SourceOrigin;
    readonly rawOrigin: string;
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
    readonly code: 'sourceIdentityUnresolved' | 'bufferUnavailable' | 'invalidRange';
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
        const kind = knownKinds.has(rawKind) ? rawKind as HighlighterConstructKind : 'Unknown';
        const origin = knownOrigins.has(rawOrigin) ? rawOrigin as SourceOrigin : 'Unknown';
        const base = {
            projectionIndex,
            kind,
            rawKind,
            text: construct.text ?? null,
            name: construct.name ?? null,
            origin,
            rawOrigin,
            spanRole: context.spanRoles?.[projectionIndex] ?? 'unknown' as const,
            editable: false,
        };

        const range = construct.range;
        if (!range) return { ...base, mapping: 'unmapped' };

        const binding = bindings.get(range.file);
        if (!binding) {
            diagnostics.push({ code: 'sourceIdentityUnresolved', projectionIndex,
                message: `No host file identity is registered for Highlighter locator "${range.file}".` });
            return { ...base, mapping: 'sourceIdentityUnresolved' };
        }

        const snapshot = binding.snapshot;
        if (!snapshot) {
            diagnostics.push({ code: 'bufferUnavailable', projectionIndex,
                message: `The host snapshot for "${range.file}" was not available for this projection.` });
            return { ...base, mapping: 'bufferUnavailable' };
        }
        if (snapshot.fileId !== binding.fileId) {
            diagnostics.push({ code: 'sourceIdentityUnresolved', projectionIndex,
                message: `Host snapshot identity "${snapshot.fileId}" does not match registered identity "${binding.fileId}".` });
            return { ...base, mapping: 'sourceIdentityUnresolved' };
        }
        const hostRange: SourceRange = { ...range, file: snapshot.fileId };
        if (!sourceRangeToOffsets(snapshot.text, hostRange)) {
            diagnostics.push({ code: 'invalidRange', projectionIndex,
                message: `Highlighter range for "${range.file}" is outside the captured host snapshot.` });
            return { ...base, mapping: 'invalidRange' };
        }

        const source: SourceReference = {
            fileId: snapshot.fileId,
            revision: snapshot.revision,
            range: hostRange,
            origin,
        };
        return {
            ...base,
            mapping: 'verified',
            source,
            editable: canEditSource(origin, snapshot),
        };
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
