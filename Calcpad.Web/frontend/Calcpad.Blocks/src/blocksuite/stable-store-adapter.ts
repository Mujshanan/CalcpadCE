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
import type {
    BlockSuiteDocumentAdapter,
    BlockSuiteDocumentHandle,
    BlockSuiteDocumentInput,
} from './adapter-contract';

/**
 * Stable @blocksuite/store 0.22.4 implementation. Keep all BlockSuite-specific
 * lifecycle and snapshot behavior behind BlockSuiteDocumentAdapter.
 */
export function createStableBlockSuiteAdapter(): BlockSuiteDocumentAdapter {
    return {
        createDocument(input: BlockSuiteDocumentInput): BlockSuiteDocumentHandle {
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
                if (disposed) {
                    throw new Error('The BlockSuite projection has been disposed.');
                }
            }

            return {
                rootBlockId,
                sourceBlockId,
                get isReadOnly() {
                    assertActive();
                    return store.readonly;
                },
                get blockCount() {
                    assertActive();
                    return store.blockSize;
                },
                getSourceText() {
                    assertActive();
                    const block = store.getBlock(sourceBlockId);
                    const model = block?.model as {
                        readonly text?: { toString(): string };
                    } | undefined;
                    return model?.text?.toString() ?? '';
                },
                createSnapshot() {
                    assertActive();
                    const snapshot = store.getTransformer().docToSnapshot(doc);
                    if (!snapshot) {
                        throw new Error('BlockSuite could not snapshot the current projection.');
                    }
                    return JSON.parse(JSON.stringify(snapshot)) as DocSnapshot;
                },
                dispose() {
                    if (disposed) return;
                    disposed = true;
                    collection.dispose();
                },
            };
        },
    };
}
