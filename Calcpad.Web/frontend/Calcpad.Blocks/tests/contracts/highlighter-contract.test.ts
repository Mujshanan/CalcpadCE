import assert from 'node:assert/strict';
import test from 'node:test';
import {
    bindHighlighterOutput,
    type HighlighterStructuralOutput,
} from '../../src/integrations/calcpad/highlighter-contract';
import {
    createHighlighterSourceBufferProvider,
    type SourceBufferSnapshot,
    type SourceSnapshotProvider,
} from '../../src/core/source/contracts';

function snapshotsOf(entries: readonly SourceBufferSnapshot[]): SourceSnapshotProvider {
    const snapshots = new Map(entries.map((entry) => [entry.fileId, entry]));
    return { getSnapshot: (fileId) => snapshots.get(fileId) };
}

test('binds ranges to the exact file snapshot revision', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'VariableDefinition',
            range: { file: '/work/main.cpd', startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
            text: 'x', origin: 'Local', name: 'x',
        }],
    };
    const bound = bindHighlighterOutput(output, snapshotsOf([{
        fileId: '/work/main.cpd', revision: 'r17', text: 'x = 1', writable: true,
    }]));
    assert.equal(bound[0].mapping, 'verified');
    assert.equal(bound[0].source?.revision, 'r17');
    assert.equal(bound[0].editable, true);
});

test('does not invent a revision when an include snapshot is missing', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'VariableDefinition',
            range: { file: '/work/lib.cpd', startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
            text: 'x', origin: 'IncludedFile',
        }],
    };
    const bound = bindHighlighterOutput(output, snapshotsOf([]));
    assert.equal(bound[0].mapping, 'bufferUnavailable');
    assert.equal(bound[0].source, undefined);
    assert.equal(bound[0].editable, false);
});

test('keeps generated constructs read-only even with a writable buffer', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'MacroCall',
            range: { file: '/work/main.cpd', startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
            text: '$', origin: 'Generated',
        }],
    };
    const bound = bindHighlighterOutput(output, snapshotsOf([{
        fileId: '/work/main.cpd', revision: 'r18', text: '$', writable: true,
    }]));
    assert.equal(bound[0].mapping, 'verified');
    assert.equal(bound[0].editable, false);
});

test('preserves constructs without source ranges as unmapped', () => {
    const output: HighlighterStructuralOutput = {
        constructs: [{
            kind: 'HtmlOrMarkdownContent', range: null, text: null, origin: 'Unknown',
        }],
    };
    const bound = bindHighlighterOutput(output, snapshotsOf([]));
    assert.equal(bound[0].mapping, 'unmapped');
    assert.equal(bound[0].source, undefined);
});

test('caches each include snapshot for the lifetime of one Highlighter request', () => {
    let revision = 'before';
    const host: SourceSnapshotProvider = {
        getSnapshot(fileId) {
            return { fileId, revision, text: revision, writable: true };
        },
    };
    const root = { fileId: '/work/main.cpd', revision: 'root-1', text: 'x=1', writable: true };
    const provider = createHighlighterSourceBufferProvider(root, host);
    assert.equal(provider.tryGetSource('/work/lib.cpd'), 'before');
    revision = 'after';
    assert.equal(provider.tryGetSource('/work/lib.cpd'), 'before');
    assert.equal(provider.getSnapshot('/work/lib.cpd')?.revision, 'before');
    assert.equal(provider.getSnapshot(root.fileId)?.revision, 'root-1');
});