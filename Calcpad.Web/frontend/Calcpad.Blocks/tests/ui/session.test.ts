import assert from 'node:assert/strict';
import test from 'node:test';
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
