import assert from 'node:assert/strict';
import test from 'node:test';
import { useDiagnostics } from '../../src/ui/composables/useDiagnostics';
import { createTestProjection } from '../helpers/projection';

test('aggregates supplied diagnostics by code and reports unspecified severity', () => {
    const projection = createTestProjection();
    const diagnostics = useDiagnostics(projection);
    assert.equal(diagnostics.total.value, projection.diagnostics.length);
    assert.deepEqual(diagnostics.byLevel.value, { unspecified: projection.diagnostics.length });
    assert.equal(Object.values(diagnostics.byCode.value).reduce((sum, count) => sum + count, 0),
        projection.diagnostics.length);
});
