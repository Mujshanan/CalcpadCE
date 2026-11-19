/**
 * Host-owned source buffer contracts. Blocks holds immutable references only;
 * persistence, revisions, edits, and undo/redo remain with the host editor.
 */
export type SourceFileId = string;
export type SourceRevision = string;

/** Values match Calcpad.Highlighter.ContentResolution.SourceOrigin. */
export type SourceOrigin = 'Local' | 'IncludedFile' | 'MacroExpansion' | 'Generated' | 'Unknown';

export interface SourceRange {
    readonly file: SourceFileId;
    readonly startLine: number;
    readonly startColumn: number;
    readonly endLine: number;
    readonly endColumn: number;
}

export interface SourceReference {
    readonly fileId: SourceFileId;
    readonly revision: SourceRevision;
    readonly range: SourceRange;
    readonly origin: SourceOrigin;
}

export interface SourceBufferSnapshot {
    readonly fileId: SourceFileId;
    readonly revision: SourceRevision;
    readonly text: string;
    readonly writable: boolean;
}

export interface SourceSnapshotProvider {
    getSnapshot(fileId: SourceFileId): SourceBufferSnapshot | undefined;
}

/** A path/URI-style locator supplied by the current Highlighter include resolver. */
export type HighlighterFileLocator = string;

/** Mirrors Highlighter ISourceBufferProvider; root source is passed separately. */
export interface HighlighterIncludeSourceProvider {
    tryGetSource(highlighterFile: HighlighterFileLocator): string | undefined;
}

export interface HighlighterSourceSnapshotProvider
    extends SourceSnapshotProvider, HighlighterIncludeSourceProvider {}

/**
 * @deprecated Use createHighlighterSourceSnapshotSession from the Calcpad integration.
 * This compatibility helper treats Highlighter locators as host file IDs and is safe
 * only when the host deliberately uses the same canonical value for both identities.
 * New integrations must resolve Highlighter locators to stable host-owned IDs explicitly.
 */
export function createHighlighterSourceBufferProvider(
    rootSnapshot: SourceBufferSnapshot,
    hostSnapshots: SourceSnapshotProvider,
): HighlighterSourceSnapshotProvider {
    const captured = new Map<string, SourceBufferSnapshot | null>([[rootSnapshot.fileId, rootSnapshot]]);
    const getSnapshot = (fileId: SourceFileId): SourceBufferSnapshot | undefined => {
        if (!captured.has(fileId)) {
            captured.set(fileId, hostSnapshots.getSnapshot(fileId) ?? null);
        }
        return captured.get(fileId) ?? undefined;
    };
    return {
        getSnapshot,
        tryGetSource(fileId) {
            return getSnapshot(fileId)?.text;
        },
    };
}

export interface SourceTextEdit {
    readonly range: SourceRange;
    readonly text: string;
}

export interface SourceEditRequest {
    readonly fileId: SourceFileId;
    readonly expectedRevision: SourceRevision;
    readonly edits: readonly SourceTextEdit[];
}

export type SourceEditRejectionReason =
    | 'staleRevision'
    | 'readOnly'
    | 'invalidRange'
    | 'fileUnavailable'
    | 'conflict';

export type SourceEditResult =
    | { readonly status: 'applied'; readonly revision: SourceRevision }
    | {
          readonly status: 'rejected';
          readonly reason: SourceEditRejectionReason;
          readonly currentRevision?: SourceRevision;
          readonly message?: string;
      };

export interface SourceBufferHost extends SourceSnapshotProvider {
    applyEdits(request: SourceEditRequest): Promise<SourceEditResult>;
    revealRange(reference: SourceReference): Promise<void>;
    selectRange(reference: SourceReference): Promise<void>;
}

export function canEditSource(
    origin: SourceOrigin,
    snapshot: SourceBufferSnapshot | undefined,
): boolean {
    return snapshot !== undefined &&
        snapshot.writable &&
        (origin === 'Local' || origin === 'IncludedFile');
}