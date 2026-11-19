import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { useSelection } from '../../src/ui/composables/useSelection';
import { createTestProjection } from '../helpers/projection';

test('selects only existing projection indexes and retains selection independently of mode', () => {
    const selection = useSelection(ref(createTestProjection().constructs));
    selection.select(1);
    assert.equal(selection.selectedIndex.value, 1);
    assert.equal(selection.selectedConstruct.value?.projectionIndex, 1);
    assert.equal(selection.isValid.value, true);
    // Display mode is intentionally not an input to this composable.
    selection.select(0);
    assert.equal(selection.selectedIndex.value, 0);
    selection.select(42);
    assert.equal(selection.selectedIndex.value, null);
    assert.equal(selection.isValid.value, false);
});
