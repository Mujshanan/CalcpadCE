import assert from 'node:assert/strict';
import test from 'node:test';
import { useConstructFilters } from '../../src/ui/composables/useConstructFilters';
import { createTestProjection } from '../helpers/projection';

test('combines kind, origin, mapping, and query filters conjunctively', () => {
    const filters = useConstructFilters({ value: createTestProjection().constructs } as never);
    assert.equal(filters.filteredConstructs.value.length, 2);
    filters.kind.value = 'VariableDefinition';
    filters.origin.value = 'Local';
    filters.mappingStatus.value = 'verified';
    filters.query.value = 'x';
    assert.equal(filters.filteredConstructs.value.length, 1);
    assert.equal(filters.filteredConstructs.value[0].projectionIndex, 0);
    filters.query.value = 'does-not-exist';
    assert.equal(filters.filteredConstructs.value.length, 0);
});

test('empty filters preserve adapter order and clearFilters resets all inputs', () => {
    const filters = useConstructFilters({ value: createTestProjection().constructs } as never);
    assert.deepEqual(filters.filteredConstructs.value.map((item) => item.projectionIndex), [0, 1]);
    filters.query.value = 'x';
    filters.kind.value = 'VariableDefinition';
    filters.clearFilters();
    assert.equal(filters.filteredConstructs.value.length, 2);
    assert.equal(filters.kind.value, null);
});
