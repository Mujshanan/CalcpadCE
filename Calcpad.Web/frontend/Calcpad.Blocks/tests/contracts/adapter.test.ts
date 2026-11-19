import assert from 'node:assert/strict';
import test from 'node:test';
import {
    adaptHighlighterOutput,
    HIGHLIGHTER_CONSTRUCT_KINDS,
    HIGHLIGHTER_CONSTRUCT_KIND_COUNT,
    HIGHLIGHTER_SOURCE_ORIGINS,
    HIGHLIGHTER_SOURCE_ORIGIN_COUNT,
    type HighlighterStructuralOutput,
} from '../../src/integrations/calcpad/highlighter-contract';

const root = {
    fileId: 'root-id',
    revision: 'r1',
    text: 'x = 1',
    writable: true,
} as const;

function output(kind: string | number, origin: string | number): HighlighterStructuralOutput {
    return {
        constructs: [{
            kind,
            origin,
            range: null,
            text: 'x',
        }],
    };
}

test('ordinal tables match the authoritative Highlighter enum declaration order', () => {
    assert.equal(HIGHLIGHTER_CONSTRUCT_KIND_COUNT, 16);
    assert.equal(HIGHLIGHTER_SOURCE_ORIGIN_COUNT, 5);
    assert.deepEqual(HIGHLIGHTER_CONSTRUCT_KINDS, [
        'Comment',
        'HtmlOrMarkdownContent',
        'VariableDefinition',
        'VariableReassignment',
        'FunctionDefinition',
        'FunctionCall',
        'MacroDefinition',
        'MacroCall',
        'CustomUnitDefinition',
        'ControlFlowDirective',
        'Command',
        'IncludeDirective',
        'DataExchangeDirective',
        'InputDirective',
        'SettingsDirective',
        'MathematicalExpression',
    ]);
    assert.deepEqual(HIGHLIGHTER_SOURCE_ORIGINS, [
        'Local',
        'IncludedFile',
        'MacroExpansion',
        'Generated',
        'Unknown',
    ]);
});

test('resolves numeric construct-kind and origin ordinals', () => {
    for (let ordinal = 0; ordinal < HIGHLIGHTER_CONSTRUCT_KIND_COUNT; ordinal++) {
        const item = adaptHighlighterOutput(output(ordinal, 0), { sources: [] }).constructs[0];
        assert.equal(item.kind, HIGHLIGHTER_CONSTRUCT_KINDS[ordinal]);
        assert.equal(item.kindStatus, 'known');
        assert.equal(item.origin, 'Local');
        assert.equal(item.originStatus, 'known');
    }

    for (let ordinal = 0; ordinal < HIGHLIGHTER_SOURCE_ORIGIN_COUNT; ordinal++) {
        const item = adaptHighlighterOutput(output(0, ordinal), { sources: [] }).constructs[0];
        assert.equal(item.origin, HIGHLIGHTER_SOURCE_ORIGINS[ordinal]);
        assert.equal(item.originStatus, 'known');
    }
});

test('continues to resolve enum names for string-enum serializers', () => {
    const item = adaptHighlighterOutput(output('VariableDefinition', 'IncludedFile'), {
        sources: [],
    }).constructs[0];
    assert.equal(item.kind, 'VariableDefinition');
    assert.equal(item.kindStatus, 'known');
    assert.equal(item.origin, 'IncludedFile');
    assert.equal(item.originStatus, 'known');
});

test('preserves and diagnoses unknown kind and origin ordinals', () => {
    const projection = adaptHighlighterOutput(output(99, 8), { sources: [] });
    const item = projection.constructs[0];

    assert.equal(item.kind, 'Unknown');
    assert.equal(item.kindStatus, 'unknown');
    assert.equal(item.rawKind, 99);
    assert.equal(item.origin, 'Unknown');
    assert.equal(item.originStatus, 'unknown');
    assert.equal(item.rawOrigin, 8);
    assert.deepEqual(projection.diagnostics.map((diagnostic) => diagnostic.code), [
        'unknownKindOrdinal',
        'unknownOriginOrdinal',
    ]);
});

test('preserves and diagnoses unknown kind and origin names', () => {
    const projection = adaptHighlighterOutput(output('FutureKind', 'FutureOrigin'), { sources: [] });
    const item = projection.constructs[0];

    assert.equal(item.kind, 'Unknown');
    assert.equal(item.kindStatus, 'unknown');
    assert.equal(item.rawKind, 'FutureKind');
    assert.equal(item.origin, 'Unknown');
    assert.equal(item.originStatus, 'unknown');
    assert.equal(item.rawOrigin, 'FutureOrigin');
    assert.deepEqual(projection.diagnostics.map((diagnostic) => diagnostic.code), [
        'unknownKindName',
        'unknownOriginName',
    ]);
});

test('treats non-integer, negative, and out-of-range numeric values as unknown ordinals', () => {
    for (const ordinal of [-1, 1.5, 16, Number.NaN]) {
        const projection = adaptHighlighterOutput(output(ordinal, 0), { sources: [] });
        assert.equal(projection.constructs[0].kindStatus, 'unknown');
        assert.equal(projection.diagnostics[0].code, 'unknownKindOrdinal');
    }
});

test('does not infer a source mapping when no range is supplied', () => {
    const projection = adaptHighlighterOutput(output(0, 0), { sources: [] });
    assert.equal(projection.constructs[0].mapping, 'unmapped');
    assert.equal(projection.constructs[0].source, undefined);
});
