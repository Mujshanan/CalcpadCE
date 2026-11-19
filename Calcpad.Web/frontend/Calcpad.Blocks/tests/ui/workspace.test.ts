import assert from 'node:assert/strict';
import test from 'node:test';
import { shallowRef } from 'vue';
import { useWorkspace } from '../../src/ui/composables/useWorkspace';
import { createTestProjection } from '../helpers/projection';

test('composes filters, selection, collapse, diagnostics, and navigation', async () => {
    const projection = createTestProjection();
    let selected: number | null = null;
    let navigated = 0;
    const workspace = useWorkspace(projection, {
        isSourceCurrent: () => true,
        onNavigate: () => { navigated++; },
        onSelect: (index) => { selected = index; },
    });

    workspace.select(0);
    workspace.setMode('blocks');
    assert.equal(workspace.mode.value, 'blocks');
    assert.equal(workspace.selectedIndex.value, 0);
    assert.equal(selected, 0);
    assert.equal(workspace.visibleConstructs.value.length, 2);
    assert.equal(workspace.canNavigateSelected.value, true);
    assert.deepEqual(await workspace.navigateSelected(), { status: 'navigated' });
    assert.equal(navigated, 1);
    workspace.collapse.collapse(0);
    assert.equal(workspace.collapse.isCollapsed(0), true);
});

test('reacts to host projection replacement without losing workspace state', () => {
    const first = createTestProjection();
    const replacement = createTestProjection();
    const projection = shallowRef(first);
    const workspace = useWorkspace(projection, {
        isSourceCurrent: () => true,
        onNavigate: () => undefined,
    });

    workspace.select(0);
    workspace.filters.query.value = 'updated';
    workspace.collapse.collapse(0);
    workspace.setMode('blocks');

    projection.value = {
        ...replacement,
        constructs: replacement.constructs.map((construct) => ({
            ...construct,
            name: 'updated',
        })),
    };

    assert.equal(workspace.session.value, projection.value);
    assert.equal(workspace.constructs.value[0].name, 'updated');
    assert.equal(workspace.visibleConstructs.value.length, 1);
    assert.equal(workspace.selectedIndex.value, 0);
    assert.equal(workspace.selectedConstruct.value?.name, 'updated');
    assert.equal(workspace.collapse.isCollapsed(0), true);
    assert.equal(workspace.mode.value, 'blocks');
});
