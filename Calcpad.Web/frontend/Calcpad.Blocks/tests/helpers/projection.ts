import {
    adaptHighlighterOutput,
    type BlocksHighlighterProjection,
} from '../../src/integrations/calcpad';
import type { SourceBufferSnapshot } from '../../src/core/source/contracts';

export const testSnapshot: SourceBufferSnapshot = {
    fileId: 'host-main',
    revision: 'rev-1',
    text: 'x = 1\ny = 2',
    writable: true,
};

export function createTestProjection(): BlocksHighlighterProjection {
    return adaptHighlighterOutput({
        constructs: [
            {
                kind: 'VariableDefinition',
                range: { file: '/main.cpd', startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
                text: 'x = 1',
                origin: 'Local',
                name: 'x',
            },
            {
                kind: 'MathematicalExpression',
                range: null,
                text: 'y = 2',
                origin: 'Generated',
                name: 'y',
            },
        ],
    }, {
        sources: [{
            sourceLocator: '/main.cpd',
            fileId: testSnapshot.fileId,
            snapshot: testSnapshot,
        }],
    });
}
