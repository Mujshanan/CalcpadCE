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

/** Mirrors Highlighter ISourceBufferProvider; root source is passed separately. */
export interface HighlighterIncludeSourceProvider {
    tryGetSource(fileId: SourceFileId): string | undefined;
}

export interface HighlighterSourceSnapshotProvider
    extends SourceSnapshotProvider, HighlighterIncludeSourceProvider {}

/**
 * Capture the root snapshot immediately and each include snapshot on first access.
 * The same immutable snapshot is then used both for Highlighter input and revision
 * binding. Missing buffers are cached as missing for the lifetime of the request.
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