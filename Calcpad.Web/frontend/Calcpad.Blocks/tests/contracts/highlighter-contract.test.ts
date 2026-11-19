import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    adaptHighlighterOutput,
    BLOCKS_HIGHLIGHTER_CONTRACT_ID,
    BLOCKS_HIGHLIGHTER_CONTRACT_VERSION,
    createHighlighterSourceSnapshotSession,
    type HighlighterStructuralOutput,
} from '../../src/integrations/calcpad/highlighter-contract';
import type {
    SourceBufferSnapshot,
    SourceSnapshotProvider,
} from '../../src/core/source/contracts';

const rootSnapshot: SourceBufferSnapshot = {
    fileId: 'host:main',
    revision: 'root-r1',
    text: 'x = 1',
    writable: true,
};

function hostOf(entries: readonly SourceBufferSnapshot[]): SourceSnapshotProvider {
    const snapshots = new Map(entries.map((entry) => [entry.fileId, entry]));
    return { getSnapshot: (fileId) => snapshots.get(fileId) };
}

function session(
    included: readonly SourceBufferSnapshot[] = [],
    resolve: (file: string) => { fileId: string; locator?: string } | undefined =
        (file) => file === '/resolved/lib.cpd'
            ? { fileId: 'host:library', locator: file }
            : undefined,
) {
    return createHighlighterSourceSnapshotSession(
        rootSnapshot,
        '/workspace/main.cpd',
        hostOf(included),
        resolve,
    );
}

function construct(
    overrides: Partial<HighlighterStructuralOutput['constructs'][number]> = {},
) {
    return {
        kind: 'VariableDefinition',
        range: {
            file: '/workspace/main.cpd',
            startLine: 0,
            startColumn: 0,
            endLine: 0,
            endColumn: 1,
        },
        text: 'x',
        origin: 'Local',
        name: 'x',
        ...overrides,
    };
}

test('emits the versioned Blocks contract and preserves Highlighter order', () => {
    const result = adaptHighlighterOutput({
        constructs: [
            construct({ kind: 'Comment', text: '// first' }),
            construct({ kind: 'VariableDefinition', text: 'x' }),
        ],
    }, session());

    assert.equal(result.contractId, BLOCKS_HIGHLIGHTER_CONTRACT_ID);
    assert.equal(result.contractVersion, BLOCKS_HIGHLIGHTER_CONTRACT_VERSION);
    assert.deepEqual(result.constructs.map((item) => item.projectionIndex), [0, 1]);
    assert.deepEqual(result.constructs.map((item) => item.rawKind), ['Comment', 'VariableDefinition']);
    assert.equal(result.capabilities.containmentRelationships, false);
    assert.equal(result.capabilities.completeSourceCoverage, false);
    assert.equal(result.capabilities.semanticSpanRoles, false);
});

test('maps Highlighter locators to stable host identities, not path-shaped IDs', () => {
    const snapshots = session([{
        fileId: 'host:library',
        revision: 'lib-r7',
        text: 'y = 2',
        writable: true,
    }]);
    const result = adaptHighlighterOutput({
        constructs: [construct({
            range: {
                file: '/resolved/lib.cpd',
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 1,
            },
            origin: 'IncludedFile',
            text: 'y',
            name: 'y',
        })],
    }, snapshots);

    assert.equal(result.constructs[0].mappingStatus, 'mapped');
    assert.equal(result.constructs[0].source?.fileId, 'host:library');
    assert.equal(result.constructs[0].source?.range.file, 'host:library');
    assert.equal(result.constructs[0].source?.revision, 'lib-r7');
    assert.equal(result.constructs[0].sourceLocator, '/resolved/lib.cpd');
    assert.equal(result.constructs[0].editable, true);
    assert.deepEqual(result.sourceManifest.map((entry) => ({
        highlighterFile: entry.highlighterFile,
        fileId: entry.fileId,
        revision: entry.revision,
        status: entry.status,
    })), [
        {
            highlighterFile: '/workspace/main.cpd',
            fileId: 'host:main',
            revision: 'root-r1',
            status: 'captured',
        },
        {
            highlighterFile: '/resolved/lib.cpd',
            fileId: 'host:library',
            revision: 'lib-r7',
            status: 'captured',
        },
    ]);
});

test('captures each include snapshot once for the entire projection session', () => {
    let revision = 'lib-before';
    const host: SourceSnapshotProvider = {
        getSnapshot(fileId) {
            return {
                fileId,
                revision,
                text: revision,
                writable: true,
            };
        },
    };
    const snapshots = createHighlighterSourceSnapshotSession(
        rootSnapshot,
        '/workspace/main.cpd',
        host,
        (file) => file === '/resolved/lib.cpd'
            ? { fileId: 'host:library' }
            : undefined,
    );

    assert.equal(snapshots.tryGetSource('/resolved/lib.cpd'), 'lib-before');
    revision = 'lib-after';
    assert.equal(snapshots.tryGetSource('/resolved/lib.cpd'), 'lib-before');
    assert.equal(
        snapshots.getSnapshotForHighlighterFile('/resolved/lib.cpd')?.revision,
        'lib-before',
    );
});

test('captures one immutable snapshot for different locators resolving to the same fileId', () => {
    let calls = 0;
    const host: SourceSnapshotProvider = {
        getSnapshot(fileId) {
            calls++;
            return { fileId, revision: `revision-${calls}`, text: `source-${calls}`, writable: true };
        },
    };
    const snapshots = createHighlighterSourceSnapshotSession(
        rootSnapshot,
        '/workspace/main.cpd',
        host,
        (file) => file === '/resolved/a.cpd' || file === '/workspace/./a.cpd'
            ? { fileId: 'host:shared', locator: file }
            : undefined,
    );

    const first = snapshots.resolveHighlighterFile('/resolved/a.cpd');
    const second = snapshots.resolveHighlighterFile('/workspace/./a.cpd');

    assert.equal(calls, 1);
    assert.equal(first.snapshot?.revision, 'revision-1');
    assert.equal(second.snapshot?.revision, 'revision-1');
    assert.equal(first.snapshot?.text, 'source-1');
    assert.equal(second.snapshot?.text, 'source-1');
    assert.deepEqual(
        snapshots.getManifest().filter((entry) => entry.fileId === 'host:shared')
            .map((entry) => entry.highlighterFile),
        ['/resolved/a.cpd', '/workspace/./a.cpd'],
    );
});

test('reports identityUnavailable instead of treating an include path as a host ID', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({
            range: {
                file: '/unmapped/library.cpd',
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 1,
            },
            origin: 'IncludedFile',
        })],
    }, session());

    assert.equal(result.constructs[0].mappingStatus, 'identityUnavailable');
    assert.equal(result.constructs[0].source, undefined);
    assert.equal(result.constructs[0].editable, false);
    assert.equal(result.diagnostics[0].code, 'source-identity-unavailable');
    assert.equal(result.sourceManifest[1].status, 'identityUnavailable');
});

test('reports bufferUnavailable when a stable host identity has no captured snapshot', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({
            range: {
                file: '/resolved/lib.cpd',
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 1,
            },
            origin: 'IncludedFile',
        })],
    }, session());

    assert.equal(result.constructs[0].mappingStatus, 'bufferUnavailable');
    assert.equal(result.constructs[0].source, undefined);
    assert.equal(result.diagnostics[0].code, 'source-buffer-unavailable');
});

test('converts host snapshot-provider exceptions into bufferUnavailable diagnostics', () => {
    const host: SourceSnapshotProvider = {
        getSnapshot() {
            throw new Error('host buffer temporarily unavailable');
        },
    };
    const snapshots = createHighlighterSourceSnapshotSession(
        rootSnapshot,
        '/workspace/main.cpd',
        host,
        () => ({ fileId: 'host:library' }),
    );
    const result = adaptHighlighterOutput({
        constructs: [construct({
            range: {
                file: '/resolved/lib.cpd',
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 1,
            },
            origin: 'IncludedFile',
        })],
    }, snapshots);

    assert.equal(result.constructs[0].mappingStatus, 'bufferUnavailable');
    assert.equal(result.constructs[0].source, undefined);
    assert.equal(result.diagnostics[0].code, 'source-buffer-provider-failed');
    assert.equal(result.sourceManifest[1].status, 'bufferUnavailable');
});

test('rejects a snapshot whose identity does not match the resolved host identity', () => {
    const host: SourceSnapshotProvider = {
        getSnapshot: () => ({
            fileId: 'host:other',
            revision: 'wrong',
            text: 'y = 2',
            writable: true,
        }),
    };
    const snapshots = createHighlighterSourceSnapshotSession(
        rootSnapshot,
        '/workspace/main.cpd',
        host,
        () => ({ fileId: 'host:library' }),
    );
    const result = adaptHighlighterOutput({
        constructs: [construct({
            range: {
                file: '/resolved/lib.cpd',
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 1,
            },
            origin: 'IncludedFile',
        })],
    }, snapshots);

    assert.equal(result.constructs[0].mappingStatus, 'identityMismatch');
    assert.equal(result.diagnostics[0].code, 'source-identity-mismatch');
});

test('rejects invalid ranges without manufacturing source references', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({
            range: {
                file: '/workspace/main.cpd',
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 99,
            },
        })],
    }, session());

    assert.equal(result.constructs[0].mappingStatus, 'invalidRange');
    assert.equal(result.constructs[0].source, undefined);
    assert.equal(result.constructs[0].editable, false);
    assert.equal(result.diagnostics[0].code, 'source-range-invalid');
});

test('preserves constructs without ranges as explicitly unmapped', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({
            kind: 'HtmlOrMarkdownContent',
            range: null,
            text: null,
            origin: 'Unknown',
        })],
    }, session());

    assert.equal(result.constructs[0].mappingStatus, 'unmapped');
    assert.equal(result.constructs[0].source, undefined);
    assert.equal(result.diagnostics[0].code, 'range-unavailable');
});

test('keeps a valid range mapped but marks mismatched construct text non-editable', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({ text: 'different text' })],
    }, session());

    assert.equal(result.constructs[0].mappingStatus, 'mapped');
    assert.equal(result.constructs[0].contentVerification, 'mismatched');
    assert.equal(result.constructs[0].editable, false);
    assert.equal(result.diagnostics[0].code, 'source-content-mismatch');
});

test('reports exact content matches without applying normalization', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({ text: 'x' })],
    }, session());

    assert.equal(result.constructs[0].contentVerification, 'matched');
});

test('keeps generated constructs read-only even when their source range maps', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({
            kind: 'MacroCall',
            text: '$',
            origin: 'Generated',
        })],
    }, session());

    assert.equal(result.constructs[0].mappingStatus, 'mapped');
    assert.equal(result.constructs[0].editable, false);
    assert.equal(result.constructs[0].contentVerification, 'notApplicable');
});

test('preserves unknown future kinds and origins without inventing semantics', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({
            kind: 'FutureConstructKind',
            origin: 'FutureOrigin',
        })],
    }, session());

    assert.equal(result.constructs[0].kind, 'Unknown');
    assert.equal(result.constructs[0].rawKind, 'FutureConstructKind');
    assert.equal(result.constructs[0].origin, 'Unknown');
    assert.equal(result.constructs[0].rawOrigin, 'FutureOrigin');
    assert.equal(result.constructs[0].spanRole, 'unknown');
});


test('accepts the actual C# System.Text.Json web-default numeric-enum payload fixture', () => {
    const fixtureUrl = new URL(
        '../../../../../Calcpad.Tests/Highlighter/Fixtures/structural-output.web.json',
        import.meta.url,
    );
    const fixture = JSON.parse(readFileSync(fixtureUrl, 'utf8')) as HighlighterStructuralOutput & {
        structuralConstructKindNames: readonly string[];
        sourceOriginNames: readonly string[];
    };
    const payload = fixture;
    const snapshots = createHighlighterSourceSnapshotSession(
        {
            fileId: 'host:fixture',
            revision: 'fixture-r1',
            text: 'x',
            writable: true,
        },
        'fixture://root',
        hostOf([]),
        () => undefined,
    );

    const result = adaptHighlighterOutput(payload, snapshots);

    assert.deepEqual(fixture.structuralConstructKindNames, [
        'Comment', 'HtmlOrMarkdownContent', 'VariableDefinition', 'VariableReassignment',
        'FunctionDefinition', 'FunctionCall', 'MacroDefinition', 'MacroCall',
        'CustomUnitDefinition', 'ControlFlowDirective', 'Command', 'IncludeDirective',
        'DataExchangeDirective', 'InputDirective', 'SettingsDirective', 'MathematicalExpression',
    ]);
    assert.deepEqual(fixture.sourceOriginNames, [
        'Local', 'IncludedFile', 'MacroExpansion', 'Generated', 'Unknown',
    ]);
    assert.deepEqual(result.constructs.map((item) => item.kind), [
        'Comment',
        'HtmlOrMarkdownContent',
        'VariableDefinition',
        'VariableReassignment',
        'FunctionDefinition',
        'FunctionCall',
        'MacroDefinition',
        'MacroCall',
        'CustomUnitDefinition',
        'ControlFlowDirective',
        'Command',
        'IncludeDirective',
        'DataExchangeDirective',
        'InputDirective',
        'SettingsDirective',
        'MathematicalExpression',
    ]);
    assert.deepEqual(result.constructs.map((item) => item.origin), [
        'Local',
        'IncludedFile',
        'MacroExpansion',
        'Generated',
        'Unknown',
        'Local',
        'IncludedFile',
        'MacroExpansion',
        'Generated',
        'Unknown',
        'Local',
        'IncludedFile',
        'MacroExpansion',
        'Generated',
        'Unknown',
        'Local',
    ]);
    assert.equal(result.constructs[0].rawKind, 0);
    assert.equal(result.constructs[0].rawOrigin, 0);
    assert.equal(result.constructs[0].mappingStatus, 'mapped');
    assert.equal(result.constructs[0].source?.fileId, 'host:fixture');
    assert.equal(result.constructs[0].editable, true);
    assert.equal(result.constructs[1].mappingStatus, 'unmapped');
    assert.equal(result.constructs.length, 16);
});

test('preserves unknown numeric enum values from future C# versions', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({
            kind: 65535,
            origin: 65534,
            range: null,
        })],
    }, session());

    assert.equal(result.constructs[0].kind, 'Unknown');
    assert.equal(result.constructs[0].rawKind, 65535);
    assert.equal(result.constructs[0].origin, 'Unknown');
    assert.equal(result.constructs[0].rawOrigin, 65534);
});


test('preserves and diagnoses unknown numeric kind ordinals', () => {
    for (const rawKind of [-1, 1.5, 99]) {
        const result = adaptHighlighterOutput({
            constructs: [construct({ kind: rawKind, range: null, text: null })],
        }, session());

        assert.equal(result.constructs[0].kind, 'Unknown');
        assert.equal(result.constructs[0].kindStatus, 'unknown');
        assert.equal(result.constructs[0].rawKind, rawKind);
        assert.ok(result.diagnostics.some((item) =>
            item.code === 'unknown-kind-ordinal' && item.rawValue === rawKind,
        ));
    }
});

test('preserves and diagnoses unknown string kind and origin names', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({
            kind: 'FutureConstructKind',
            origin: 'FutureOrigin',
            range: null,
            text: null,
        })],
    }, session());

    assert.equal(result.constructs[0].kind, 'Unknown');
    assert.equal(result.constructs[0].kindStatus, 'unknown');
    assert.equal(result.constructs[0].rawKind, 'FutureConstructKind');
    assert.equal(result.constructs[0].origin, 'Unknown');
    assert.equal(result.constructs[0].originStatus, 'unknown');
    assert.equal(result.constructs[0].rawOrigin, 'FutureOrigin');
    assert.ok(result.diagnostics.some((item) =>
        item.code === 'unknown-kind-name' && item.rawValue === 'FutureConstructKind',
    ));
    assert.ok(result.diagnostics.some((item) =>
        item.code === 'unknown-origin-name' && item.rawValue === 'FutureOrigin',
    ));
});

test('preserves and diagnoses unknown numeric origin ordinals', () => {
    for (const rawOrigin of [-1, 2.5, 99]) {
        const result = adaptHighlighterOutput({
            constructs: [construct({ origin: rawOrigin, range: null, text: null })],
        }, session());

        assert.equal(result.constructs[0].origin, 'Unknown');
        assert.equal(result.constructs[0].originStatus, 'unknown');
        assert.equal(result.constructs[0].rawOrigin, rawOrigin);
        assert.ok(result.diagnostics.some((item) =>
            item.code === 'unknown-origin-ordinal' && item.rawValue === rawOrigin,
        ));
    }
});

test('marks recognized values known and emits no unknown-value diagnostics', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct({ kind: 0, origin: 0, range: null, text: null })],
    }, session());

    assert.equal(result.constructs[0].kind, 'Comment');
    assert.equal(result.constructs[0].kindStatus, 'known');
    assert.equal(result.constructs[0].origin, 'Local');
    assert.equal(result.constructs[0].originStatus, 'known');
    assert.equal(result.diagnostics.filter((item) => item.code.startsWith('unknown-')).length, 0);
});

test('rejects inverted and out-of-bounds ranges without clamping', () => {
    for (const invalidRange of [
        {
            file: '/workspace/main.cpd',
            startLine: 0,
            startColumn: 3,
            endLine: 0,
            endColumn: 1,
        },
        {
            file: '/workspace/main.cpd',
            startLine: 8,
            startColumn: 0,
            endLine: 8,
            endColumn: 0,
        },
        {
            file: '/workspace/main.cpd',
            startLine: 0,
            startColumn: 0,
            endLine: 0,
            endColumn: 99,
        },
    ]) {
        const result = adaptHighlighterOutput({
            constructs: [construct({ range: invalidRange })],
        }, session());

        assert.equal(result.constructs[0].mappingStatus, 'invalidRange');
        assert.equal(result.constructs[0].source, undefined);
        assert.equal(result.constructs[0].editable, false);
        assert.ok(result.diagnostics.some((item) => item.code === 'source-range-invalid'));
    }
});

test('does not permit editing generated or macro-expanded constructs', () => {
    for (const origin of ['Generated', 'MacroExpansion']) {
        const result = adaptHighlighterOutput({
            constructs: [construct({ origin, text: 'x' })],
        }, session());

        assert.equal(result.constructs[0].contentVerification, 'notApplicable');
        assert.equal(result.constructs[0].editable, false);
    }
});

test('freezes the adapter result and all exposed collection entries', () => {
    const result = adaptHighlighterOutput({
        constructs: [construct()],
    }, session());

    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.constructs), true);
    assert.equal(Object.isFrozen(result.constructs[0]), true);
    assert.equal(Object.isFrozen(result.diagnostics), true);
    assert.equal(Object.isFrozen(result.sourceManifest), true);
});
