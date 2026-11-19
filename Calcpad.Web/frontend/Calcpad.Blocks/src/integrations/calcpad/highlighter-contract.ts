import {
    canEditSource,
    type HighlighterIncludeSourceProvider,
    type SourceBufferSnapshot,
    type HighlighterFileLocator,
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

/**
 * Ordinals mirror Calcpad.Highlighter.ContentResolution.StructuralConstructKind.
 * Provenance: Calcpad.Highlighter/ContentResolution/StructuralOutput.cs,
 * Git blob 98c9c1c7223d61ee65568542d646f07b4a931154 on
 * hbc-m3/versioned-blocks-adapter.
 * Any upstream reorder/insertion/removal requires updating this table and
 * incrementing BLOCKS_HIGHLIGHTER_CONTRACT_VERSION.
 */
const kindNames: readonly HighlighterConstructKind[] = Object.freeze([
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

/**
 * Ordinals mirror Calcpad.Highlighter.ContentResolution.SourceOrigin.
 * Provenance: same pinned StructuralOutput.cs blob documented above.
 */
const originNames: readonly SourceOrigin[] = Object.freeze([
    'Local',
    'IncludedFile',
    'MacroExpansion',
    'Generated',
    'Unknown',
]);

/** Exported for contract-drift tests; these are local table sizes, not upstream discovery. */
export const HIGHLIGHTER_KIND_ORDINAL_COUNT = kindNames.length;
export const HIGHLIGHTER_ORIGIN_ORDINAL_COUNT = originNames.length;

const knownKinds = new Set<string>(kindNames);
const knownOrigins = new Set<string>(originNames);

/**
 * Current ASP.NET Core MVC JSON uses System.Text.Json web defaults and does not
 * register JsonStringEnumConverter. Enum fields therefore arrive as numeric
 * ordinals. String values are also accepted for compatibility with explicit
 * string-enum serializers and older fixtures. Unknown values remain lossless.
 */
export interface HighlighterSourceRange {
    /** Highlighter-side path/URI locator, not a host SourceFileId. */
    readonly file: HighlighterFileLocator;
    readonly startLine: number;
    readonly startColumn: number;
    readonly endLine: number;
    readonly endColumn: number;
}

export interface HighlighterStructuralConstruct {
    /** System.Text.Json emits enum values as integers unless a string converter is configured. */
    readonly kind: string | number;
    readonly range: HighlighterSourceRange | null;
    readonly text: string | null;
    readonly origin: string | number;
    readonly name?: string | null;
}

export interface HighlighterStructuralOutput {
    /** Flat list. The adapter preserves this order exactly. */
    readonly constructs: readonly HighlighterStructuralConstruct[];
}

export type ConstructMappingStatus =
    | 'mapped'
    | 'unmapped'
    | 'identityUnavailable'
    | 'bufferUnavailable'
    | 'identityMismatch'
    | 'invalidRange';

export type HighlighterSpanRole = 'unknown';
export type ContentVerificationStatus =
    | 'matched'
    | 'mismatched'
    | 'notComparable'
    | 'notApplicable';

export interface HighlighterSourceIdentity {
    /** Stable identity issued and owned by the host editor. */
    readonly fileId: SourceFileId;
    /** Optional canonical path/URI retained for diagnostics and navigation. */
    readonly locator?: string;
}

export type HighlighterSourceIdentityResolver =
    (highlighterFile: HighlighterFileLocator) => HighlighterSourceIdentity | undefined;

export type SourceManifestStatus =
    | 'captured'
    | 'identityUnavailable'
    | 'bufferUnavailable'
    | 'identityMismatch';

export interface ProjectionSourceManifestEntry {
    /**
     * File key as it appeared in the Highlighter output/resolution pipeline.
     * Manifest entries are per locator, so fileId is not unique: multiple
     * Highlighter locators may resolve to the same host file.
     */
    readonly highlighterFile: HighlighterFileLocator;
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
export interface HighlighterSourceResolution {
    readonly identity?: HighlighterSourceIdentity;
    readonly snapshot?: SourceBufferSnapshot;
    readonly status: SourceManifestStatus;
    /** Distinguishes a provider exception from a normal missing buffer. */
    readonly failureReason?: 'snapshot-provider-failed';
}

export interface HighlighterSourceSnapshotSession extends HighlighterIncludeSourceProvider {
    resolveHighlighterFile(highlighterFile: HighlighterFileLocator): HighlighterSourceResolution;
    tryGetSource(highlighterFile: HighlighterFileLocator): string | undefined;
    getSnapshotForHighlighterFile(highlighterFile: HighlighterFileLocator): SourceBufferSnapshot | undefined;
    getManifest(): readonly ProjectionSourceManifestEntry[];
}

/**
 * Create a snapshot session with an explicit Highlighter-locator -> host-ID
 * mapping. The root locator is pinned to rootSnapshot and never re-read from
 * the host provider.
 */
export function createHighlighterSourceSnapshotSession(
    rootSnapshot: SourceBufferSnapshot,
    rootHighlighterFile: HighlighterFileLocator,
    hostSnapshots: SourceSnapshotProvider,
    resolveIdentity: HighlighterSourceIdentityResolver,
): HighlighterSourceSnapshotSession {
    const root = freezeSnapshot(rootSnapshot);
    const resolutions = new Map<string, HighlighterSourceResolution>();
    // Locator aliases may resolve to the same host document. Capture by stable
    // host identity so one projection cannot mix revisions for that document.
    const snapshotsByFileId = new Map<string, HighlighterSourceResolution>();
    snapshotsByFileId.set(root.fileId, Object.freeze({
        identity: Object.freeze({ fileId: root.fileId, locator: rootHighlighterFile }),
        snapshot: root,
        status: 'captured' as const,
    }));

    resolutions.set(rootHighlighterFile, Object.freeze({
        identity: Object.freeze({ fileId: root.fileId, locator: rootHighlighterFile }),
        snapshot: root,
        status: 'captured' as const,
    }));

    function resolve(highlighterFile: HighlighterFileLocator): HighlighterSourceResolution {
        const cached = resolutions.get(highlighterFile);
        if (cached) return cached;

        const resolvedIdentity = resolveIdentity(highlighterFile);
        if (!resolvedIdentity || !resolvedIdentity.fileId) {
            const missing: HighlighterSourceResolution = Object.freeze({ status: 'identityUnavailable' as const });
            resolutions.set(highlighterFile, missing);
            return missing;
        }

        const identity: HighlighterSourceIdentity = Object.freeze({
            fileId: resolvedIdentity.fileId,
            locator: resolvedIdentity.locator,
        });
        const cachedByIdentity = snapshotsByFileId.get(identity.fileId);
        if (cachedByIdentity) {
            const result: HighlighterSourceResolution = Object.freeze({
                ...cachedByIdentity,
                identity,
            });
            resolutions.set(highlighterFile, result);
            return result;
        }

        let candidate: SourceBufferSnapshot | undefined;
        try {
            candidate = hostSnapshots.getSnapshot(identity.fileId);
        } catch {
            const failed: HighlighterSourceResolution = Object.freeze({
                identity,
                status: 'bufferUnavailable' as const,
                failureReason: 'snapshot-provider-failed' as const,
            });
            snapshotsByFileId.set(identity.fileId, failed);
            resolutions.set(highlighterFile, failed);
            return failed;
        }

        if (!candidate) {
            const missing: HighlighterSourceResolution = Object.freeze({
                identity,
                status: 'bufferUnavailable' as const,
            });
            snapshotsByFileId.set(identity.fileId, missing);
            resolutions.set(highlighterFile, missing);
            return missing;
        }

        if (candidate.fileId !== identity.fileId) {
            const mismatch: HighlighterSourceResolution = Object.freeze({
                identity,
                status: 'identityMismatch' as const,
            });
            snapshotsByFileId.set(identity.fileId, mismatch);
            resolutions.set(highlighterFile, mismatch);
            return mismatch;
        }

        const captured = freezeSnapshot(candidate);
        const result: HighlighterSourceResolution = Object.freeze({
            identity,
            snapshot: captured,
            status: 'captured' as const,
        });
        snapshotsByFileId.set(identity.fileId, result);
        resolutions.set(highlighterFile, result);
        return result;
    }

    return {
        resolveHighlighterFile(highlighterFile) {
            return resolve(highlighterFile);
        },
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
    /** UI dispatch must use kindStatus, not kind === 'Unknown'. */
    readonly kindStatus: 'known' | 'unknown';
    /** Exact enum/string value returned by Highlighter. */
    readonly rawKind: string | number;
    readonly text: string | null;
    readonly name?: string | null;
    readonly origin: SourceOrigin;
    /** UI dispatch must use originStatus, not origin === 'Unknown'. */
    readonly originStatus: 'known' | 'unknown';
    /** Exact origin value returned by Highlighter. */
    readonly rawOrigin: string | number;
    /** Original range, retaining the Highlighter file locator. */
    readonly rawRange: HighlighterSourceRange | null;
    readonly sourceLocator?: string;
    /** Highlighter does not currently expose a reliable semantic span role. */
    readonly spanRole: HighlighterSpanRole;
    readonly mappingStatus: ConstructMappingStatus;
    /** Exact source-slice comparison; no trimming or normalization is applied. */
    readonly contentVerification: ContentVerificationStatus;
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
        | 'source-range-invalid'
        | 'source-content-mismatch'
        | 'source-buffer-provider-failed'
        | 'unknown-kind-ordinal'
        | 'unknown-kind-name'
        | 'unknown-origin-ordinal'
        | 'unknown-origin-name';
    readonly projectionIndex: number;
    readonly sourceLocator?: string;
    /** Verbatim Highlighter value, present only for unknown kind/origin diagnostics. */
    readonly rawValue?: string | number;
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
        const rawRange = construct.range ? Object.freeze({ ...construct.range }) : null;
        const rawKind = construct.kind;
        const rawOrigin = construct.origin;
        const kindResult = normalizeKind(rawKind);
        const originResult = normalizeOrigin(rawOrigin);
        if (kindResult.diagnostic) {
            diagnostics.push({
                code: kindResult.diagnostic,
                projectionIndex,
                rawValue: rawKind,
            });
        }
        if (originResult.diagnostic) {
            diagnostics.push({
                code: originResult.diagnostic,
                projectionIndex,
                rawValue: rawOrigin,
            });
        }
        const common = {
            projectionIndex,
            kind: kindResult.kind,
            kindStatus: kindResult.status,
            rawKind,
            text: construct.text,
            name: construct.name,
            origin: originResult.origin,
            originStatus: originResult.status,
            rawOrigin,
            rawRange,
            sourceLocator: rawRange?.file,
            spanRole: 'unknown' as const,
        };

        if (!rawRange) {
            diagnostics.push({ code: 'range-unavailable', projectionIndex });
            return {
                ...common,
                mappingStatus: 'unmapped',
                contentVerification: 'notComparable',
                editable: false,
            };
        }

        const resolution = snapshots.resolveHighlighterFile(rawRange.file);
        const snapshot = resolution.snapshot;
        if (!snapshot) {
            let mapping: Exclude<ConstructMappingStatus, 'mapped' | 'unmapped' | 'invalidRange'>;
            switch (resolution.status) {
                case 'identityUnavailable':
                    mapping = 'identityUnavailable';
                    break;
                case 'identityMismatch':
                    mapping = 'identityMismatch';
                    break;
                case 'bufferUnavailable':
                    mapping = 'bufferUnavailable';
                    break;
                case 'captured':
                    throw new Error(
                        `highlighter-contract: captured resolution missing snapshot at projectionIndex=${projectionIndex}`,
                    );
                default: {
                    const exhaustive: never = resolution.status;
                    throw new Error(
                        `highlighter-contract: unhandled resolution status: ${String(exhaustive)}`,
                    );
                }
            }
            diagnostics.push({
                code: resolution.failureReason === 'snapshot-provider-failed'
                    ? 'source-buffer-provider-failed'
                    : mapping === 'identityUnavailable'
                        ? 'source-identity-unavailable'
                        : mapping === 'identityMismatch'
                            ? 'source-identity-mismatch'
                            : 'source-buffer-unavailable',
                projectionIndex,
                sourceLocator: rawRange.file,
            });
            return {
                ...common,
                mappingStatus: mapping,
                contentVerification: 'notComparable',
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
                mappingStatus: 'invalidRange',
                contentVerification: 'notComparable',
                editable: false,
            };
        }

        const fileId = resolution.identity?.fileId ?? snapshot.fileId;
        const normalizedRange: SourceRange = Object.freeze({
            ...rawRange,
            file: fileId,
        });
        const source: SourceReference = Object.freeze({
            fileId,
            revision: snapshot.revision,
            range: normalizedRange,
            origin,
        });
        const sourceSlice = snapshot.text.slice(offsets.start, offsets.end);
        const contentVerification: ContentVerificationStatus =
            origin === 'Local' || origin === 'IncludedFile'
                ? construct.text === null
                    ? 'notComparable'
                    : sourceSlice === construct.text
                        ? 'matched'
                        : 'mismatched'
                : 'notApplicable';

        if (contentVerification === 'mismatched') {
            diagnostics.push({
                code: 'source-content-mismatch',
                projectionIndex,
                sourceLocator: rawRange.file,
            });
        }

        return {
            ...common,
            mappingStatus: 'mapped',
            contentVerification,
            source,
            // A range that does not reproduce the Highlighter text is not safe
            // to expose as an editable source target.
            editable: contentVerification !== 'mismatched' && canEditSource(origin, snapshot),
        };
    });

    return Object.freeze({
        contractId: BLOCKS_HIGHLIGHTER_CONTRACT_ID,
        contractVersion: BLOCKS_HIGHLIGHTER_CONTRACT_VERSION,
        capabilities: CURRENT_HIGHLIGHTER_CAPABILITIES,
        sourceManifest: snapshots.getManifest(),
        constructs: Object.freeze(constructs.map((item) => Object.freeze(item))),
        diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))),
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

interface NormalizedKindResult {
    readonly kind: HighlighterConstructKind | 'Unknown';
    readonly status: 'known' | 'unknown';
    readonly diagnostic?: 'unknown-kind-ordinal' | 'unknown-kind-name';
}

interface NormalizedOriginResult {
    readonly origin: SourceOrigin;
    readonly status: 'known' | 'unknown';
    readonly diagnostic?: 'unknown-origin-ordinal' | 'unknown-origin-name';
}

function normalizeKind(kind: string | number): NormalizedKindResult {
    if (typeof kind === 'number') {
        if (!Number.isInteger(kind) || kind < 0 || kind >= kindNames.length) {
            return {
                kind: 'Unknown',
                status: 'unknown',
                diagnostic: 'unknown-kind-ordinal',
            };
        }
        return { kind: kindNames[kind], status: 'known' };
    }
    if (knownKinds.has(kind)) {
        return { kind: kind as HighlighterConstructKind, status: 'known' };
    }
    return { kind: 'Unknown', status: 'unknown', diagnostic: 'unknown-kind-name' };
}

function normalizeOrigin(origin: string | number): NormalizedOriginResult {
    if (typeof origin === 'number') {
        if (!Number.isInteger(origin) || origin < 0 || origin >= originNames.length) {
            return {
                origin: 'Unknown',
                status: 'unknown',
                diagnostic: 'unknown-origin-ordinal',
            };
        }
        return { origin: originNames[origin], status: 'known' };
    }
    if (knownOrigins.has(origin)) {
        return { origin: origin as SourceOrigin, status: 'known' };
    }
    return { origin: 'Unknown', status: 'unknown', diagnostic: 'unknown-origin-name' };
}
