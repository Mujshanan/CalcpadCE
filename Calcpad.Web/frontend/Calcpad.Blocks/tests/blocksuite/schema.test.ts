import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CALCPAD_TEXT_FLAVOUR,
    CALCPAD_WORKSHEET_FLAVOUR,
    createCalcpadBlockSchema,
} from '../../src/blocksuite';

test('registers Calcpad worksheet and text block schemas', () => {
    const schema = createCalcpadBlockSchema();

    assert.ok(schema.get(CALCPAD_WORKSHEET_FLAVOUR));
    assert.ok(schema.get(CALCPAD_TEXT_FLAVOUR));
    assert.deepEqual(schema.versions, {
        [CALCPAD_WORKSHEET_FLAVOUR]: 1,
        [CALCPAD_TEXT_FLAVOUR]: 1,
    });
});

test('allows text blocks only under the worksheet root', () => {
    const schema = createCalcpadBlockSchema();

    assert.equal(schema.safeValidate(CALCPAD_WORKSHEET_FLAVOUR), true);
    assert.equal(
        schema.safeValidate(CALCPAD_TEXT_FLAVOUR, CALCPAD_WORKSHEET_FLAVOUR),
        true,
    );
    assert.equal(schema.safeValidate(CALCPAD_TEXT_FLAVOUR), false);
    assert.equal(
        schema.safeValidate(CALCPAD_WORKSHEET_FLAVOUR, CALCPAD_TEXT_FLAVOUR),
        false,
    );
});

test('does not permit nested text blocks in the initial schema', () => {
    const schema = createCalcpadBlockSchema();

    assert.equal(
        schema.safeValidate(CALCPAD_TEXT_FLAVOUR, CALCPAD_TEXT_FLAVOUR),
        false,
    );
});
