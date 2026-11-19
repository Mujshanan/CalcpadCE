import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createHighlighterSourceSnapshotSession,
    type HighlighterSourceIdentityResolver,
} from '../src/integrations/calcpad/highlighter-contract';
import type {
    HighlighterFileLocator,
    SourceBufferSnapshot,
    SourceFileId,
    SourceRevision,
    SourceSnapshotProvider,
} from '../src/core/source/contracts';

const revision = (value: string): SourceRevision => value;

function snapshot(
    fileId: SourceFileId,
    text: string,
    revisionValue = 'r1',
    writable = true,
): SourceBufferSnapshot {
    return { fileId, revision: revision(revisionValue), text, writable };
}

function recordingProvider(
    entries: readonly SourceBufferSnapshot[] = [],
): SourceSnapshotProvider & { calls: SourceFileId[] } {
    const snapshots = new Map(entries.map((entry) => [entry.fileId, entry]));
    const calls: SourceFileId[] = [];
    return {
        calls,
        getSnapshot(fileId) {
            calls.push(fileId);
            return snapshots.get(fileId);
        },
    };
}

function resolver(entries: Record<string, SourceFileId>): HighlighterSourceIdentityResolver {
    return (locator) => {
        const fileId = entries[locator];
        return fileId === undefined ? undefined : { fileId };
    };
}

const locator = (value: string): HighlighterFileLocator => value;

test('pins and returns the root snapshot without resolving its identity again', () => {
    const root = snapshot('root', 'root source');
    const provider = recordingProvider([snapshot('root', 'host copy', 'r99')]);
    let resolverCalls = 0;
    const session = createHighlighterSourceSnapshotSession(
        root,
        locator('root.cpd'),
        provider,
        () => { resolverCalls++; return undefined; },
    );

    assert.equal(session.getSnapshotForHighlighterFile('root.cpd')?.text, 'root source');
    assert.equal(session.tryGetSource('root.cpd'), 'root source');
    assert.equal(session.resolveHighlighterFile('root.cpd').status, 'captured');
    assert.deepEqual(provider.calls, []);
    assert.equal(resolverCalls, 0);
});

test('copies and freezes the root snapshot at session creation', () => {
    const root = snapshot('root', 'original');
    const session = createHighlighterSourceSnapshotSession(
        root, 'root.cpd', recordingProvider(), resolver({}),
    );

    (root as { text: string }).text = 'mutated by caller';
    const captured = session.getSnapshotForHighlighterFile('root.cpd');

    assert.equal(captured?.text, 'original');
    assert.ok(Object.isFrozen(captured));
});

test('resolves and captures an included file once per locator', () => {
    const provider = recordingProvider([snapshot('include', 'included source', 'r2')]);
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        provider,
        resolver({ 'include.cpd': 'include' }),
    );

    const first = session.resolveHighlighterFile('include.cpd');
    const second = session.resolveHighlighterFile('include.cpd');

    assert.equal(first.status, 'captured');
    assert.equal(first.snapshot?.text, 'included source');
    assert.equal(first.snapshot, second.snapshot);
    assert.deepEqual(provider.calls, ['include']);
});

test('deduplicates snapshot capture by host file identity across locator aliases', () => {
    const provider = recordingProvider([snapshot('shared', 'shared source', 'r7')]);
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        provider,
        resolver({ 'a.cpd': 'shared', 'b.cpd': 'shared' }),
    );

    const a = session.resolveHighlighterFile('a.cpd');
    const b = session.resolveHighlighterFile('b.cpd');
    const aliases = session.getManifest().filter((entry) => entry.fileId === 'shared');

    assert.equal(a.snapshot, b.snapshot);
    assert.equal(a.snapshot?.revision, 'r7');
    assert.deepEqual(provider.calls, ['shared']);
    assert.deepEqual(
        aliases.map((entry) => entry.highlighterFile).sort(),
        ['a.cpd', 'b.cpd'],
    );
});

test('reuses the pinned root snapshot when another locator resolves to the root identity', () => {
    const provider = recordingProvider([snapshot('root', 'new host value', 'r2')]);
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'pinned root value', 'r1'),
        'root.cpd',
        provider,
        resolver({ 'root-alias.cpd': 'root' }),
    );

    const result = session.resolveHighlighterFile('root-alias.cpd');

    assert.equal(result.status, 'captured');
    assert.equal(result.snapshot?.text, 'pinned root value');
    assert.equal(result.snapshot?.revision, 'r1');
    assert.deepEqual(provider.calls, []);
});

test('returns and caches identityUnavailable when identity resolution fails', () => {
    let calls = 0;
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        recordingProvider(),
        () => { calls++; return undefined; },
    );

    assert.equal(session.resolveHighlighterFile('missing.cpd').status, 'identityUnavailable');
    assert.equal(session.resolveHighlighterFile('missing.cpd').status, 'identityUnavailable');
    assert.equal(calls, 1);
});

test('returns bufferUnavailable when the host has no snapshot', () => {
    const provider = recordingProvider();
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        provider,
        resolver({ 'missing.cpd': 'missing' }),
    );

    const result = session.resolveHighlighterFile('missing.cpd');

    assert.equal(result.status, 'bufferUnavailable');
    assert.equal(result.identity?.fileId, 'missing');
    assert.equal(result.failureReason, undefined);
    assert.deepEqual(provider.calls, ['missing']);
});

test('converts provider exceptions to a cached bufferUnavailable failure', () => {
    const calls: SourceFileId[] = [];
    const provider: SourceSnapshotProvider = {
        getSnapshot(fileId) {
            calls.push(fileId);
            throw new Error('provider failure');
        },
    };
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        provider,
        resolver({ 'a.cpd': 'shared', 'b.cpd': 'shared' }),
    );

    const a = session.resolveHighlighterFile('a.cpd');
    const b = session.resolveHighlighterFile('b.cpd');

    assert.equal(a.status, 'bufferUnavailable');
    assert.equal(a.failureReason, 'snapshot-provider-failed');
    assert.equal(b.status, 'bufferUnavailable');
    assert.equal(b.failureReason, 'snapshot-provider-failed');
    assert.deepEqual(calls, ['shared']);
});

test('returns identityMismatch when the provider returns a different file identity', () => {
    const provider = recordingProvider([snapshot('other', 'wrong source')]);
    // Deliberately return the mismatched snapshot for the requested identity.
    provider.getSnapshot = (fileId) => {
        provider.calls.push(fileId);
        return snapshot('other', 'wrong source');
    };
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        provider,
        resolver({ 'include.cpd': 'include' }),
    );

    assert.equal(session.resolveHighlighterFile('include.cpd').status, 'identityMismatch');
    assert.deepEqual(provider.calls, ['include']);
});

test('does not retry missing or mismatched host buffers during one session', () => {
    let calls = 0;
    const provider: SourceSnapshotProvider = {
        getSnapshot: () => { calls++; return undefined; },
    };
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        provider,
        resolver({ 'include.cpd': 'include' }),
    );

    session.resolveHighlighterFile('include.cpd');
    session.resolveHighlighterFile('include.cpd');
    session.tryGetSource('include.cpd');

    assert.equal(calls, 1);
});

test('returns frozen manifest snapshots with the root entry and resolved failures', () => {
    const provider = recordingProvider([snapshot('ok', 'ok source', 'r3')]);
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source', 'r1'),
        'root.cpd',
        provider,
        resolver({ 'ok.cpd': 'ok', 'missing.cpd': 'missing' }),
    );

    session.resolveHighlighterFile('ok.cpd');
    session.resolveHighlighterFile('missing.cpd');
    const manifest = session.getManifest();
    const byLocator = new Map(manifest.map((entry) => [entry.highlighterFile, entry]));

    assert.ok(Object.isFrozen(manifest));
    assert.ok(manifest.every((entry) => Object.isFrozen(entry)));
    assert.deepEqual(
        {
            status: byLocator.get('root.cpd')?.status,
            fileId: byLocator.get('root.cpd')?.fileId,
            revision: byLocator.get('root.cpd')?.revision,
        },
        { status: 'captured', fileId: 'root', revision: 'r1' },
    );
    assert.equal(byLocator.get('ok.cpd')?.status, 'captured');
    assert.equal(byLocator.get('missing.cpd')?.status, 'bufferUnavailable');
});

test('copies and freezes included snapshots so later host mutation cannot alter the session', () => {
    const included = snapshot('include', 'captured source', 'r4');
    const provider = recordingProvider([included]);
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        provider,
        resolver({ 'include.cpd': 'include' }),
    );

    const captured = session.getSnapshotForHighlighterFile('include.cpd');
    (included as { text: string }).text = 'mutated host object';

    assert.equal(captured?.text, 'captured source');
    assert.ok(Object.isFrozen(captured));
    assert.equal(session.tryGetSource('include.cpd'), 'captured source');
});

test('deduplicates a missing-buffer result across aliases of the same host identity', () => {
    const provider = recordingProvider();
    const session = createHighlighterSourceSnapshotSession(
        snapshot('root', 'root source'),
        'root.cpd',
        provider,
        resolver({ 'a.cpd': 'missing', 'b.cpd': 'missing' }),
    );

    assert.equal(session.resolveHighlighterFile('a.cpd').status, 'bufferUnavailable');
    assert.equal(session.resolveHighlighterFile('b.cpd').status, 'bufferUnavailable');
    assert.deepEqual(provider.calls, ['missing']);
});
