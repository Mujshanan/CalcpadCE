import type {
    BlockSuiteDocumentAdapter,
    BlockSuiteDocumentHandle,
    BlockSuiteDocumentInput,
} from './adapter-contract';
import { createStableBlockSuiteAdapter } from './stable-store-adapter';

export type CalcpadBlockDocumentInput = BlockSuiteDocumentInput;

export interface CalcpadBlockDocument {
    readonly documentId: string;
    readonly sourceRevision: string;
    readonly rootBlockId: string;
    readonly sourceBlockId: string;
    readonly isReadOnly: boolean;
    readonly blockCount: number;
    getSourceText(): string;
    /** Export a disposable BlockSuite snapshot for diagnostics/tests, never source persistence. */
    createProjectionSnapshot(): unknown;
    dispose(): void;
}

/**
 * Creates an isolated, read-only block projection of one immutable source
 * snapshot. A caller may inject another adapter without changing Calcpad's
 * document or UI contracts.
 *
 * The default adapter uses the stable BlockSuite store. The projection is
 * intentionally one text block until Highlighter supplies reliable semantic
 * spans and containment relationships.
 */
export function createCalcpadBlockDocument(
    input: CalcpadBlockDocumentInput,
    adapter: BlockSuiteDocumentAdapter = createStableBlockSuiteAdapter(),
): CalcpadBlockDocument {
    if (!input.documentId.trim()) throw new Error('A host document ID is required.');
    if (!input.sourceFileId.trim()) throw new Error('A host source file ID is required.');
    if (!input.sourceRevision.trim()) throw new Error('A source revision is required.');

    const handle: BlockSuiteDocumentHandle = adapter.createDocument(input);
    let disposed = false;

    function assertActive(): void {
        if (disposed) throw new Error('The Calcpad BlockSuite projection has been disposed.');
    }

    return {
        documentId: input.documentId,
        sourceRevision: input.sourceRevision,
        rootBlockId: handle.rootBlockId,
        sourceBlockId: handle.sourceBlockId,
        get isReadOnly() {
            assertActive();
            return handle.isReadOnly;
        },
        get blockCount() {
            assertActive();
            return handle.blockCount;
        },
        getSourceText() {
            assertActive();
            return handle.getSourceText();
        },
        createProjectionSnapshot() {
            assertActive();
            return handle.createSnapshot();
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            handle.dispose();
        },
    };
}

/** JSON round-trip helper for ephemeral projection diagnostics and tests only. */
export function serializeCalcpadBlockProjection(
    document: CalcpadBlockDocument,
): string {
    return JSON.stringify(document.createProjectionSnapshot());
}
