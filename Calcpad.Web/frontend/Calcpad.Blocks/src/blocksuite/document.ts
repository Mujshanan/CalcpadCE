import {
    DocCollection,
    Text,
    type DocSnapshot,
} from '@blocksuite/store';
import {
    CALCPAD_TEXT_FLAVOUR,
    CALCPAD_WORKSHEET_FLAVOUR,
    createCalcpadBlockSchema,
} from './schema';

export interface CalcpadBlockDocumentInput {
    /** Host document identity; never generated from a BlockSuite block ID. */
    readonly documentId: string;
    readonly sourceFileId: string;
    readonly sourceRevision: string;
    readonly sourceText: string;
    readonly projectionId?: string;
}

export interface CalcpadBlockDocument {
    readonly documentId: string;
    readonly sourceRevision: string;
    readonly rootBlockId: string;
    readonly sourceBlockId: string;
    /** BlockSuite runtime model, exposed for the package's renderer only. */
    readonly store: ReturnType<ReturnType<DocCollection['createDoc']>['getStore']>;
    /** Read the text from the BlockSuite model, not from a parallel UI copy. */
    getSourceText(): string;
    /** Export a disposable BlockSuite snapshot for diagnostics/tests, never source persistence. */
    createProjectionSnapshot(): DocSnapshot;
    dispose(): void;
}

/**
 * Creates an isolated, read-only BlockSuite projection of one immutable source
 * snapshot. The document is intentionally one text block until Highlighter
 * supplies reliable semantic spans and containment relationships.
 *
 * This collection is transient: callers must dispose it when the source
 * revision changes or the view unmounts. Do not persist this snapshot or use
 * BlockSuite IDs as Calcpad document/block identities.
 */
export function createCalcpadBlockDocument(
    input: CalcpadBlockDocumentInput,
): CalcpadBlockDocument {
    if (!input.documentId.trim()) throw new Error('A host document ID is required.');
    if (!input.sourceFileId.trim()) throw new Error('A host source file ID is required.');
    if (!input.sourceRevision.trim()) throw new Error('A source revision is required.');

    const schema = createCalcpadBlockSchema();
    const collection = new DocCollection({ schema });
    collection.meta.initialize();

    const doc = collection.createDoc(input.documentId);
    let rootBlockId = '';
    let sourceBlockId = '';

    doc.load(() => {
        rootBlockId = doc.addBlock(CALCPAD_WORKSHEET_FLAVOUR, {
            documentId: input.documentId,
            sourceRevision: input.sourceRevision,
            projectionId: input.projectionId ?? input.sourceRevision,
        });
        sourceBlockId = doc.addBlock(CALCPAD_TEXT_FLAVOUR, {
            text: new Text(input.sourceText),
            sourceFileId: input.sourceFileId,
            sourceRevision: input.sourceRevision,
            sourceStart: 0,
            sourceEnd: input.sourceText.length,
            sourceOrigin: 'Local',
            projectionKey: 'source:0',
            editable: false,
        }, rootBlockId);
    });

    const store = doc.getStore();
    // Source edits and undo/redo remain exclusively in the host application.
    store.readonly = true;

    let disposed = false;

    function assertActive(): void {
        if (disposed) throw new Error('The Calcpad BlockSuite projection has been disposed.');
    }

    return {
        documentId: input.documentId,
        sourceRevision: input.sourceRevision,
        rootBlockId,
        sourceBlockId,
        store,
        getSourceText() {
            assertActive();
            const block = store.getBlock(sourceBlockId);
            const model = block?.model as { readonly text?: { toString(): string } } | undefined;
            return model?.text?.toString() ?? '';
        },
        createProjectionSnapshot() {
            assertActive();
            const snapshot = store.getTransformer().docToSnapshot(doc);
            if (!snapshot) throw new Error('BlockSuite could not snapshot the current projection.');
            return JSON.parse(JSON.stringify(snapshot)) as DocSnapshot;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            collection.dispose();
        },
    };
}

/** JSON round-trip helper for ephemeral projection diagnostics and tests only. */
export function serializeCalcpadBlockProjection(
    document: CalcpadBlockDocument,
): string {
    return JSON.stringify(document.createProjectionSnapshot());
}
