import type { SourceBufferSnapshot, SourceReference } from '../core/source/contracts';
import type { BoundHighlighterConstruct } from '../integrations/calcpad/highlighter-contract';
import type { CalcpadHighlightToken } from '../integrations/calcpad/highlighter-tokens';

export interface CalcpadBlocksWorkbenchProps {
    documentLabel?: string;
    revision: string;
    sourceText: string;
    sourceFileId?: string;
    currentSourceRevisions?: Readonly<Record<string, string>>;
    sourceBuffers?: readonly SourceBufferSnapshot[];
    constructs: readonly BoundHighlighterConstruct[];
    selectedIndex?: number | null;
}

export type CalcpadBlocksWorkbenchEmits = {
    select: [projectionIndex: number];
    openSource: [reference: SourceReference];
};

export interface CalcpadMonacoEditorProps {
    modelValue: string;
    apiBaseUrl: string;
    apiToken?: string;
    sourceFilePath?: string;
    readOnly?: boolean;
}

export type CalcpadMonacoEditorEmits = {
    'update:modelValue': [value: string];
    highlighted: [tokens: readonly CalcpadHighlightToken[]];
    highlightStatus: [message: string, ok: boolean];
};
