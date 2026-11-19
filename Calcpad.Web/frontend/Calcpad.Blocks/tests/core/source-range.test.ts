import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceRangeToOffsets } from '../../src/core/source/range';

test('maps zero-based UTF-16 coordinates across CRLF', () => {
    assert.deepEqual(
        sourceRangeToOffsets('first\r\nsecond', {
            startLine: 0, startColumn: 1, endLine: 1, endColumn: 3,
        }),
        { start: 1, end: 10 },
    );
});

test('preserves UTF-16 columns for supplementary Unicode characters', () => {
    assert.deepEqual(
        sourceRangeToOffsets('A😀B', {
            startLine: 0, startColumn: 1, endLine: 0, endColumn: 3,
        }),
        { start: 1, end: 3 },
    );
});

test('accepts an empty final line after a line ending', () => {
    assert.deepEqual(
        sourceRangeToOffsets('line\n', {
            startLine: 1, startColumn: 0, endLine: 1, endColumn: 0,
        }),
        { start: 5, end: 5 },
    );
});

test('rejects columns outside the source line', () => {
    assert.equal(
        sourceRangeToOffsets('short', {
            startLine: 0, startColumn: 0, endLine: 0, endColumn: 6,
        }),
        null,
    );
});

test('rejects reversed or out-of-range coordinates', () => {
    assert.equal(
        sourceRangeToOffsets('one\ntwo', {
            startLine: 1, startColumn: 2, endLine: 0, endColumn: 1,
        }),
        null,
    );
    assert.equal(
        sourceRangeToOffsets('one', {
            startLine: 2, startColumn: 0, endLine: 2, endColumn: 0,
        }),
        null,
    );
});