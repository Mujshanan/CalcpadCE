import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createCalcpadBlockDocument,
    serializeCalcpadBlockProjection,
    type BlockSuiteDocumentAdapter,
} from '../../src/blocksuite';

test('creates a read-only BlockSuite projection without changing source text', () => {
    const source = '# Worksheet\r\nA = 12\r\nB = A * 2\r\n';
    const document = createCalcpadBlockDocument({
        documentId: 'worksheet-1',
        sourceFileId: 'file-1',
        sourceRevision: 'rev-7',
        sourceText: source,
    });

    try {
        assert.equal(document.getSourceText(), source);
        assert.equal(document.isReadOnly, true);
        assert.equal(document.blockCount, 2);
        assert.ok(document.rootBlockId);
        assert.ok(document.sourceBlockId);
    } finally {
        document.dispose();
    }
});

test('serializes a disposable projection snapshot without treating it as source persistence', () => {
    const source = 'x = 4\ny = x^2';
    const document = createCalcpadBlockDocument({
        documentId: 'worksheet-snapshot',
        sourceFileId: 'file-snapshot',
        sourceRevision: 'rev-1',
        sourceText: source,
    });

    try {
        const serialized = serializeCalcpadBlockProjection(document);
        const snapshot = JSON.parse(serialized) as {
            type: string;
            blocks: {
                flavour: string;
                children: Array<{ flavour: string; props: { sourceRevision: string } }>;
            };
        };

        assert.equal(snapshot.type, 'page');
        assert.equal(snapshot.blocks.flavour, 'calcpad:worksheet');
        assert.equal(snapshot.blocks.children.length, 1);
        assert.equal(snapshot.blocks.children[0].flavour, 'calcpad:text');
        assert.equal(snapshot.blocks.children[0].props.sourceRevision, 'rev-1');
        assert.match(serialized, /x = 4/);
    } finally {
        document.dispose();
    }
});

test('allows the BlockSuite runtime to be replaced behind a small adapter contract', () => {
    let disposed = false;
    const adapter: BlockSuiteDocumentAdapter = {
        createDocument(input) {
            return {
                rootBlockId: 'runtime-root',
                sourceBlockId: 'runtime-text',
                isReadOnly: true,
                blockCount: 2,
                getSourceText: () => input.sourceText,
                createSnapshot: () => ({ revision: input.sourceRevision }),
                dispose: () => { disposed = true; },
            };
        },
    };

    const document = createCalcpadBlockDocument({
        documentId: 'host-doc',
        sourceFileId: 'host-file',
        sourceRevision: 'host-revision',
        sourceText: 'a = 1',
    }, adapter);

    assert.equal(document.getSourceText(), 'a = 1');
    assert.deepEqual(document.createProjectionSnapshot(), { revision: 'host-revision' });
    document.dispose();
    assert.equal(disposed, true);
    assert.throws(() => document.getSourceText(), /disposed/);
});

test('requires stable host identity and revision before creating a projection', () => {
    const adapter: BlockSuiteDocumentAdapter = {
        createDocument() {
            throw new Error('The adapter must not be called for invalid host input.');
        },
    };

    assert.throws(() => createCalcpadBlockDocument({
        documentId: '',
        sourceFileId: 'file-1',
        sourceRevision: 'rev-1',
        sourceText: '',
    }, adapter));
    assert.throws(() => createCalcpadBlockDocument({
        documentId: 'doc-1',
        sourceFileId: '',
        sourceRevision: 'rev-1',
        sourceText: '',
    }, adapter));
    assert.throws(() => createCalcpadBlockDocument({
        documentId: 'doc-1',
        sourceFileId: 'file-1',
        sourceRevision: '',
        sourceText: '',
    }, adapter));
});
