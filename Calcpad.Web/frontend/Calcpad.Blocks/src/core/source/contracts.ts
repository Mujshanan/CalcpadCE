/**
 * Host-owned source buffer contracts. Blocks holds immutable references only;
 * persistence, revisions, edits, and undo/redo remain with the host editor.
 */
export type SourceFileId = string;
export type SourceRevision = string;

export type SourceOrigin =
    | 'local'
    | 'includedFile'
    | 'macroExpansion'
    | 'generated'
    | 'unknown';

/** Highlighter coordinates: zero-based UTF-16 lines/columns, exclusive end. */
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

export function createHighlighterIncludeSourceProvider(
    snapshots: SourceSnapshotProvider,
): HighlighterIncludeSourceProvider {
    return {
        tryGetSource(fileId) {
            return snapshots.getSnapshot(fileId)?.text;
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
    return (
        snapshot !== undefined &&
        snapshot.writable &&
        (origin === 'local' || origin === 'includedFile')
    );
}