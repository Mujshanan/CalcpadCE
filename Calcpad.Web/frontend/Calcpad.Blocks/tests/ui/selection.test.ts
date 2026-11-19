import assert from 'node:assert/strict';
import test from 'node:test';
import { computed, ref } from 'vue';
import { useSelection } from '../../src/ui/composables/useSelection';
import { createTestProjection } from '../helpers/projection';

test('selects only existing projection indexes and retains selection independently of mode', () => {
    const selection = useSelection(computed(() => createTestProjection().constructs));
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

test('controlled selection follows the owner and emits validated selection requests', () => {
    const constructs = computed(() => createTestProjection().constructs);
    const selectedIndex = ref<number | null>(1);
    const requests: Array<number | null> = [];
    const selection = useSelection(constructs, {
        controlled: () => selectedIndex.value,
        onSelect: (index) => requests.push(index),
    });

    assert.equal(selection.selectedIndex.value, 1);
    assert.equal(selection.selectedConstruct.value?.projectionIndex, 1);

    selection.select(0);
    assert.equal(requests.at(-1), 0);
    // Controlled state does not optimistically overwrite the owner's value.
    assert.equal(selection.selectedIndex.value, 1);

    selectedIndex.value = 0;
    assert.equal(selection.selectedIndex.value, 0);
    assert.equal(selection.selectedConstruct.value?.projectionIndex, 0);

    selection.select(42);
    assert.equal(requests.at(-1), null);
    assert.equal(selection.selectedIndex.value, 0);
});
