import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isCalcpadTokenInModel,
    mapCalcpadTokenType,
} from '../../src/integrations/calcpad/highlighter-tokens';

test('maps the current Calcpad lexical token vocabulary to Monaco semantic types', () => {
    assert.equal(mapCalcpadTokenType('Variable'), 'variable');
    assert.equal(mapCalcpadTokenType('Macro'), 'macro');
    assert.equal(mapCalcpadTokenType('ControlBlockKeyword'), 'keyword');
    assert.equal(mapCalcpadTokenType('Units'), 'unit');
});

test('keeps unknown future token types unmapped instead of guessing', () => {
    assert.equal(mapCalcpadTokenType('FutureConstruct'), undefined);
});

test('validates zero-based token ranges against source line lengths', () => {
    const lengths = [8, 3];
    const lineLength = (line: number) => lengths[line] ?? -1;

    assert.equal(isCalcpadTokenInModel(
        { line: 0, column: 2, length: 4, type: 'Variable', typeId: 5 },
        lengths.length,
        lineLength,
    ), true);
    assert.equal(isCalcpadTokenInModel(
        { line: 1, column: 2, length: 2, type: 'Variable', typeId: 5 },
        lengths.length,
        lineLength,
    ), false);
    assert.equal(isCalcpadTokenInModel(
        { line: 2, column: 0, length: 1, type: 'Variable', typeId: 5 },
        lengths.length,
        lineLength,
    ), false);
});
