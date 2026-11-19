import {
    canEditSource,
    type SourceBufferSnapshot,
    type SourceFileId,
    type SourceOrigin,
    type SourceReference,
    type SourceRevision,
    type SourceRange,
    type SourceSnapshotProvider,
} from '../../core/source/contracts';
import { sourceRangeToOffsets } from '../../core/source/range';

/** Names currently defined by Calcpad.Highlighter.StructuralConstructKind. */
export type HighlighterConstructKind =
    | 'Comment'
    | 'HtmlOrMarkdownContent'
    | 'VariableDefinition'
    | 'VariableReassignment'
    | 'FunctionDefinition'
    | 'FunctionCall'
    | 'MacroDefinition'
    | 'MacroCall'
    | 'CustomUnitDefinition'
    | 'ControlFlowDirective'
    | 'Command'
    | 'IncludeDirective'
    | 'DataExchangeDirective'
    | 'InputDirective'
    | 'SettingsDirective'
    | 'MathematicalExpression';

export const BLOCKS_HIGHLIGHTER_CONTRACT_ID = 'calcpad.highlighter.blocks' as const;
export const BLOCKS_HIGHLIGHTER_CONTRACT_VERSION = 1 as const;

const knownKinds = new Set<string>([
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
]);

const knownOrigins = new Set<string>([
    'Local',
    'IncludedFile',
    'MacroExpansion',
    'Generated',
    'Unknown',
]);

/**
 * This is the current C# Highlighter payload shape. The kind and origin are
 * accepted as strings deliberately: a newer Highlighter may add enum members
 * before this adapter is updated, and those values must not break projection.
 */
export interface HighlighterStructuralConstruct {
    readonly kind: string;
    readonly range: SourceRange | null;
    readonly text: string | null;
    readonly origin: string;
    readonly name?: string | null;
}

export interface HighlighterStructuralOutput {
    /** Flat list. The adapter preserves this order exactly. */
    readonly constructs: readonly HighlighterStructuralConstruct[];
}

export type ConstructMappingStatus =
    | 'verified'
    | 'unmapped'
    | 'identityUnavailable'
    | 'bufferUnavailable'
    | 'identityMismatch'
    | 'invalidRange';

export type HighlighterSpanRole = 'unknown';

export interface HighlighterSourceIdentity {
    /** Stable identity issued and owned by the host editor. */
    readonly fileId: SourceFileId;
    /** Optional canonical path/URI retained for diagnostics and navigation. */
    readonly locator?: string;
}

export type HighlighterSourceIdentityResolver =
    (highlighterFile: string) => HighlighterSourceIdentity | undefined;

export type SourceManifestStatus =
    | 'captured'
    | 'identityUnavailable'
    | 'bufferUnavailable'
    | 'identityMismatch';

export interface ProjectionSourceManifestEntry {
    /** File key as it appeared in the Highlighter output/resolution pipeline. */
    readonly highlighterFile: string;
    /** Host identity is present only when resolution succeeded. */
    readonly fileId?: SourceFileId;
    readonly locator?: string;
    readonly revision?: SourceRevision;
    readonly status: SourceManifestStatus;
}

/**
 * A per-projection snapshot session. Include buffers are resolved and captured
 * once; the same immutable text/revision pair is used for Highlighter input,
 * construct binding, and the resulting manifest.
 */
export interface HighlighterSourceSnapshotSession {
    tryGetSource(highlighterFile: string): string | undefined;
    getSnapshotForHighlighterFile(highlighterFile: string): SourceBufferSnapshot | undefined;
    getManifest(): readonly ProjectionSourceManifestEntry[];
}

/**
 * Create a snapshot session with an explicit Highlighter-locator -> host-ID
 * mapping. The root locator is pinned to rootSnapshot and never re-read from
 * the host provider.
 */
export function createHighlighterSourceSnapshotSession(
    rootSnapshot: SourceBufferSnapshot,
    rootHighlighterFile: string,
    hostSnapshots: SourceSnapshotProvider,
    resolveIdentity: HighlighterSourceIdentityResolver,
): HighlighterSourceSnapshotSession {
    const root = freezeSnapshot(rootSnapshot);
    const resolutions = new Map<string, {
        readonly identity?: HighlighterSourceIdentity;
        readonly snapshot?: SourceBufferSnapshot;
        readonly status: SourceManifestStatus;
    }>();

    resolutions.set(rootHighlighterFile, {
        identity: { fileId: root.fileId },
        snapshot: root,
        status: 'captured',
    });

    function resolve(highlighterFile: string) {
        const cached = resolutions.get(highlighterFile);
        if (cached) return cached;

        const identity = resolveIdentity(highlighterFile);
        if (!identity || !identity.fileId) {
            const missing = { status: 'identityUnavailable' as const };
            resolutions.set(highlighterFile, missing);
            return missing;
        }

        const candidate = identity.fileId === root.fileId
            ? root
            : hostSnapshots.getSnapshot(identity.fileId);

        if (!candidate) {
            const missing = {
                identity,
                status: 'bufferUnavailable' as const,
            };
            resolutions.set(highlighterFile, missing);
            return missing;
        }

        if (candidate.fileId !== identity.fileId) {
            const mismatch = {
                identity,
                status: 'identityMismatch' as const,
            };
            resolutions.set(highlighterFile, mismatch);
            return mismatch;
        }

        const captured = freezeSnapshot(candidate);
        const result = {
            identity,
            snapshot: captured,
            status: 'captured' as const,
        };
        resolutions.set(highlighterFile, result);
        return result;
    }

    return {
        tryGetSource(highlighterFile) {
            return resolve(highlighterFile).snapshot?.text;
        },
        getSnapshotForHighlighterFile(highlighterFile) {
            return resolve(highlighterFile).snapshot;
        },
        getManifest() {
            const entries: ProjectionSourceManifestEntry[] = [];
            for (const [highlighterFile, item] of resolutions) {
                entries.push(Object.freeze({
                    highlighterFile,
                    fileId: item.identity?.fileId,
                    locator: item.identity?.locator,
                    revision: item.snapshot?.revision,
                    status: item.status,
                }));
            }
            return Object.freeze(entries);
        },
    };
}

export interface HighlighterContractCapabilities {
    readonly flatConstructs: true;
    readonly sourceRanges: true;
    readonly completeSourceCoverage: false;
    readonly containmentRelationships: false;
    readonly macroProvenanceGraph: false;
    readonly embeddedContentClassification: false;
    readonly semanticSpanRoles: false;
}

export const CURRENT_HIGHLIGHTER_CAPABILITIES: HighlighterContractCapabilities =
    Object.freeze({
        flatConstructs: true,
        sourceRanges: true,
        completeSourceCoverage: false,
        containmentRelationships: false,
        macroProvenanceGraph: false,
        embeddedContentClassification: false,
        semanticSpanRoles: false,
    });

export interface BoundHighlighterConstruct {
    /** Projection-local identity; never persist as a document/block ID. */
    readonly projectionIndex: number;
    /** Known normalized kind, or Unknown when the runtime value is not known. */
    readonly kind: HighlighterConstructKind | 'Unknown';
    /** Exact enum/string value returned by Highlighter. */
    readonly rawKind: string;
    readonly text: string | null;
    readonly name?: string | null;
    readonly origin: SourceOrigin;
    /** Exact origin value returned by Highlighter. */
    readonly rawOrigin: string;
    /** Original range, retaining the Highlighter file locator. */
    readonly rawRange: SourceRange | null;
    readonly sourceLocator?: string;
    /** Highlighter does not currently expose a reliable semantic span role. */
    readonly spanRole: HighlighterSpanRole;
    readonly mapping: ConstructMappingStatus;
    /** Explicitly named equivalent for new consumers. */
    readonly mappingStatus: ConstructMappingStatus;
    /** Range normalized to the host-owned file identity. */
    readonly source?: SourceReference;
    readonly editable: boolean;
}

export interface HighlighterContractDiagnostic {
    readonly code:
        | 'range-unavailable'
        | 'source-identity-unavailable'
        | 'source-buffer-unavailable'
        | 'source-identity-mismatch'
        | 'source-range-invalid';
    readonly projectionIndex: number;
    readonly sourceLocator?: string;
}

export interface BlocksHighlighterContract {
    readonly contractId: typeof BLOCKS_HIGHLIGHTER_CONTRACT_ID;
    readonly contractVersion: typeof BLOCKS_HIGHLIGHTER_CONTRACT_VERSION;
    readonly capabilities: HighlighterContractCapabilities;
    readonly sourceManifest: readonly ProjectionSourceManifestEntry[];
    readonly constructs: readonly BoundHighlighterConstruct[];
    readonly diagnostics: readonly HighlighterContractDiagnostic[];
}

/**
 * Adapt the current Highlighter output into the versioned Blocks contract.
 * Construct order is preserved. No statement spans, hierarchy, coverage,
 * embedded-content subtype, or provenance graph is inferred here.
 */
export function adaptHighlighterOutput(
    output: HighlighterStructuralOutput,
    snapshots: HighlighterSourceSnapshotSession,
): BlocksHighlighterContract {
    const diagnostics: HighlighterContractDiagnostic[] = [];
    const constructs = output.constructs.map<BoundHighlighterConstruct>((construct, projectionIndex) => {
        const rawRange = construct.range;
        const rawKind = construct.kind;
        const rawOrigin = construct.origin;
        const kind = normalizeKind(rawKind);
        const origin = normalizeOrigin(rawOrigin);
        const common = {
            projectionIndex,
            kind,
            rawKind,
            text: construct.text,
            name: construct.name,
            origin,
            rawOrigin,
            rawRange,
            sourceLocator: rawRange?.file,
            spanRole: 'unknown' as const,
        };

        if (!rawRange) {
            diagnostics.push({ code: 'range-unavailable', projectionIndex });
            return {
                ...common,
                mapping: 'unmapped',
                mappingStatus: 'unmapped',
                editable: false,
            };
        }

        const snapshot = snapshots.getSnapshotForHighlighterFile(rawRange.file);
        if (!snapshot) {
            const manifest = snapshots.getManifest().find(
                (entry) => entry.highlighterFile === rawRange.file,
            );
            const mapping = manifest?.status === 'identityUnavailable'
                ? 'identityUnavailable'
                : manifest?.status === 'identityMismatch'
                    ? 'identityMismatch'
                    : 'bufferUnavailable';
            diagnostics.push({
                code: mapping === 'identityUnavailable'
                    ? 'source-identity-unavailable'
                    : mapping === 'identityMismatch'
                        ? 'source-identity-mismatch'
                        : 'source-buffer-unavailable',
                projectionIndex,
                sourceLocator: rawRange.file,
            });
            return {
                ...common,
                mapping,
                mappingStatus: mapping,
                editable: false,
            };
        }

        const offsets = sourceRangeToOffsets(snapshot.text, rawRange);
        if (!offsets) {
            diagnostics.push({
                code: 'source-range-invalid',
                projectionIndex,
                sourceLocator: rawRange.file,
            });
            return {
                ...common,
                mapping: 'invalidRange',
                mappingStatus: 'invalidRange',
                editable: false,
            };
        }

        const identity = snapshots.getManifest().find(
            (entry) => entry.highlighterFile === rawRange.file,
        );
        const fileId = identity?.fileId ?? snapshot.fileId;
        const normalizedRange: SourceRange = {
            ...rawRange,
            file: fileId,
        };
        const source: SourceReference = {
            fileId,
            revision: snapshot.revision,
            range: normalizedRange,
            origin,
        };

        return {
            ...common,
            mapping: 'verified',
            mappingStatus: 'verified',
            source,
            editable: canEditSource(origin, snapshot),
        };
    });

    return Object.freeze({
        contractId: BLOCKS_HIGHLIGHTER_CONTRACT_ID,
        contractVersion: BLOCKS_HIGHLIGHTER_CONTRACT_VERSION,
        capabilities: CURRENT_HIGHLIGHTER_CAPABILITIES,
        sourceManifest: snapshots.getManifest(),
        constructs: Object.freeze(constructs),
        diagnostics: Object.freeze(diagnostics),
    });
}

function freezeSnapshot(snapshot: SourceBufferSnapshot): SourceBufferSnapshot {
    return Object.freeze({
        fileId: snapshot.fileId,
        revision: snapshot.revision,
        text: snapshot.text,
        writable: snapshot.writable,
    });
}

function normalizeKind(kind: string): HighlighterConstructKind | 'Unknown' {
    return knownKinds.has(kind) ? kind as HighlighterConstructKind : 'Unknown';
}

function normalizeOrigin(origin: string): SourceOrigin {
    return knownOrigins.has(origin) ? origin as SourceOrigin : 'Unknown';
}
