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
    const root = schema.get(CALCPAD_WORKSHEET_FLAVOUR);
    const text = schema.get(CALCPAD_TEXT_FLAVOUR);

    assert.ok(root);
    assert.ok(text);
    assert.doesNotThrow(() => schema.validateSchema(text, root));
    assert.throws(() => schema.validateSchema(root, text));
});

test('does not permit nested text blocks in the initial schema', () => {
    const schema = createCalcpadBlockSchema();
    const text = schema.get(CALCPAD_TEXT_FLAVOUR);

    assert.ok(text);
    assert.throws(() => schema.validateSchema(text, text));
});
