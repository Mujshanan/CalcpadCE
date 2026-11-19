import assert from 'node:assert/strict';
import test from 'node:test';
import {
    adaptHighlighterOutput,
    bindHighlighterOutput,
    BLOCKS_HIGHLIGHTER_CONTRACT_ID,
    BLOCKS_HIGHLIGHTER_CONTRACT_VERSION,
    type HighlighterStructuralOutput,
} from '../../src/integrations/calcpad/highlighter-contract';
import {
    type SourceBufferSnapshot,
    type SourceSnapshotProvider,
} from '../../src/core/source/contracts';

const root: SourceBufferSnapshot = {
    fileId: 'host-root-id', revision: 'root-r17', text: 'x = 1', writable: true,
};

test('emits the versioned Blocks contract and binds the exact host snapshot', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'VariableDefinition',
            range: { file: '/resolved/main.cpd', startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
            text: 'x', origin: 'Local', name: 'x',
        }],
    };
    const projection = adaptHighlighterOutput(output, {
        sources: [{ sourceLocator: '/resolved/main.cpd', fileId: root.fileId, snapshot: root }],
        spanRoles: { 0: 'token' },
    });
    assert.equal(projection.contractId, BLOCKS_HIGHLIGHTER_CONTRACT_ID);
    assert.equal(projection.contractVersion, BLOCKS_HIGHLIGHTER_CONTRACT_VERSION);
    assert.deepEqual(projection.sourceManifest, [{
        sourceLocator: '/resolved/main.cpd', fileId: 'host-root-id',
        revision: 'root-r17', writable: true, available: true,
    }]);
    assert.equal(projection.constructs[0].mapping, 'verified');
    assert.equal(projection.constructs[0].source?.fileId, 'host-root-id');
    assert.equal(projection.constructs[0].source?.revision, 'root-r17');
    assert.equal(projection.constructs[0].source?.range.file, 'host-root-id');
    assert.equal(projection.constructs[0].editable, true);
    assert.equal(projection.constructs[0].spanRole, 'token');
});

test('distinguishes a known include locator with an unavailable host snapshot', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'VariableDefinition',
            range: { file: '/resolved/lib.cpd', startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
            text: 'x', origin: 'IncludedFile',
        }],
    };
    const projection = adaptHighlighterOutput(output, {
        sources: [{ sourceLocator: '/resolved/lib.cpd', fileId: 'host-lib-id' }],
    });
    assert.equal(projection.constructs[0].mapping, 'bufferUnavailable');
    assert.equal(projection.constructs[0].source, undefined);
    assert.equal(projection.constructs[0].editable, false);
    assert.equal(projection.sourceManifest[0].available, false);
});

test('does not bind an include path without an explicit host identity mapping', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'VariableDefinition',
            range: { file: '/resolved/lib.cpd', startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
            text: 'x', origin: 'IncludedFile',
        }],
    };
    const projection = adaptHighlighterOutput(output, { sources: [] });
    assert.equal(projection.constructs[0].mapping, 'sourceIdentityUnresolved');
    assert.equal(projection.constructs[0].source, undefined);
});

test('keeps generated constructs read-only even with a writable host snapshot', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'MacroCall',
            range: { file: '/resolved/main.cpd', startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
            text: '$', origin: 'Generated',
        }],
    };
    const projection = adaptHighlighterOutput(output, {
        sources: [{ sourceLocator: '/resolved/main.cpd', fileId: root.fileId, snapshot: { ...root, text: '$' } }],
    });
    assert.equal(projection.constructs[0].mapping, 'verified');
    assert.equal(projection.constructs[0].editable, false);
});

test('preserves constructs without ranges as unmapped', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'HtmlOrMarkdownContent', range: null, text: null, origin: 'Unknown',
        }],
    };
    const projection = adaptHighlighterOutput(output, { sources: [] });
    assert.equal(projection.constructs[0].mapping, 'unmapped');
    assert.equal(projection.constructs[0].source, undefined);
});

test('preserves unknown future kinds and origins without misclassifying them', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'FutureConstructKind', range: null, text: 'future', origin: 'FutureOrigin',
        }],
    };
    const item = adaptHighlighterOutput(output, { sources: [] }).constructs[0];
    assert.equal(item.kind, 'Unknown');
    assert.equal(item.rawKind, 'FutureConstructKind');
    assert.equal(item.origin, 'Unknown');
    assert.equal(item.rawOrigin, 'FutureOrigin');
});

test('rejects invalid coordinates against the captured host snapshot', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'Comment',
            range: { file: '/resolved/main.cpd', startLine: 0, startColumn: 0, endLine: 2, endColumn: 0 },
            text: null, origin: 'Local',
        }],
    };
    const projection = adaptHighlighterOutput(output, {
        sources: [{ sourceLocator: '/resolved/main.cpd', fileId: root.fileId, snapshot: root }],
    });
    assert.equal(projection.constructs[0].mapping, 'invalidRange');
});

test('legacy binding helper remains available when locator equals host file ID', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'VariableDefinition',
            range: { file: root.fileId, startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
            text: 'x', origin: 'Local',
        }],
    };
    const snapshots: SourceSnapshotProvider = { getSnapshot: (fileId) => fileId === root.fileId ? root : undefined };
    const bound = bindHighlighterOutput(output, snapshots);
    assert.equal(bound[0].mapping, 'verified');
    assert.equal(bound[0].source?.revision, root.revision);
});
