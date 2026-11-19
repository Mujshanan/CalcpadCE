import assert from 'node:assert/strict';
import test from 'node:test';
import { useCollapseState } from '../../src/ui/composables/useCollapseState';

test('tracks collapse state independently by projection index', () => {
    const state = useCollapseState();
    assert.equal(state.isCollapsed(1), false);
    state.collapse(1);
    state.toggle(2);
    assert.equal(state.isCollapsed(1), true);
    assert.equal(state.isCollapsed(2), true);
    state.expand(1);
    assert.equal(state.isCollapsed(1), false);
    assert.equal(state.isCollapsed(2), true);
});
