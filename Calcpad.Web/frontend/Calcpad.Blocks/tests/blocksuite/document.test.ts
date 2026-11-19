import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createCalcpadBlockDocument,
    serializeCalcpadBlockProjection,
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
        assert.equal(document.store.readonly, true);
        assert.ok(document.rootBlockId);
        assert.ok(document.sourceBlockId);
        assert.equal(document.store.root?.children.length, 1);
        assert.equal(document.store.blockSize, 2);
    } finally {
        document.dispose();
    }
});

test('serializes and restores the disposable BlockSuite projection snapshot', () => {
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

test('requires stable host identity and revision before creating a projection', () => {
    assert.throws(() => createCalcpadBlockDocument({
        documentId: '',
        sourceFileId: 'file-1',
        sourceRevision: 'rev-1',
        sourceText: '',
    }));
    assert.throws(() => createCalcpadBlockDocument({
        documentId: 'doc-1',
        sourceFileId: '',
        sourceRevision: 'rev-1',
        sourceText: '',
    }));
    assert.throws(() => createCalcpadBlockDocument({
        documentId: 'doc-1',
        sourceFileId: 'file-1',
        sourceRevision: '',
        sourceText: '',
    }));
});
