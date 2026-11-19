import assert from 'node:assert/strict';
import test from 'node:test';
import { shallowRef } from 'vue';
import { useSession } from '../../src/ui/composables/useSession';
import { createTestProjection } from '../helpers/projection';

test('exposes constructs, diagnostics, manifest, and projection-index lookup', () => {
    const projection = createTestProjection();
    const session = useSession(projection);
    assert.equal(session.session.value, projection);
    assert.equal(session.constructs.value.length, 2);
    assert.equal(session.getConstruct(0), projection.constructs[0]);
    assert.equal(session.getConstruct(99), undefined);
    assert.deepEqual(session.getDiagnosticList(), projection.diagnostics);
    assert.equal(session.revisionManifest.value[0].revision, 'rev-1');
});

test('tracks host replacement of a reactive projection', () => {
    const first = createTestProjection();
    const second = createTestProjection();
    const projection = shallowRef(first);
    const session = useSession(projection);

    assert.equal(session.session.value, first);
    const replacement = {
        ...second,
        constructs: second.constructs.map((construct) => ({ ...construct, name: 'replacement' })),
    };
    projection.value = replacement;

    assert.equal(session.session.value, replacement);
    assert.equal(session.getConstruct(0)?.name, 'replacement');
});
