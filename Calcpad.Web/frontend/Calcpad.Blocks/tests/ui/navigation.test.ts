import assert from 'node:assert/strict';
import test from 'node:test';
import { useSourceNavigation } from '../../src/ui/composables/useSourceNavigation';
import { createTestProjection } from '../helpers/projection';

test('navigates only a verified source after checking its revision', async () => {
    const projection = createTestProjection();
    let navigated = 0;
    const navigation = useSourceNavigation(projection, {
        isSourceCurrent: () => true,
        onNavigate: () => { navigated++; },
    });
    assert.deepEqual(await navigation.navigate(0), { status: 'navigated' });
    assert.equal(navigated, 1);
    assert.deepEqual(await navigation.navigate(1), {
        status: 'refused', reason: 'unverifiedMapping',
    });
    assert.deepEqual(await navigation.navigate(99), {
        status: 'refused', reason: 'noSelection',
    });
});

test('refuses stale source references without invoking the host callback', async () => {
    const projection = createTestProjection();
    let navigated = 0;
    const navigation = useSourceNavigation(projection, {
        isSourceCurrent: () => false,
        onNavigate: () => { navigated++; },
    });
    assert.deepEqual(await navigation.navigate(0), {
        status: 'refused', reason: 'staleSession',
    });
    assert.equal(navigated, 0);
});
