/** The lexical token shape returned by POST /api/calcpad/highlight. */
export interface CalcpadHighlightToken {
    readonly line: number;
    readonly column: number;
    readonly length: number;
    readonly type: string;
    readonly typeId: number;
    readonly text?: string;
}

export interface CalcpadHighlightResponse {
    readonly tokens: readonly CalcpadHighlightToken[];
}

/** Semantic token names consumed by Monaco's semantic token provider. */
export const CALCPAD_SEMANTIC_TOKEN_TYPES = [
    'number', 'operator', 'variable', 'parameter', 'function', 'macro',
    'unit', 'property', 'keyword', 'string', 'comment', 'tag',
] as const;

export type CalcpadSemanticTokenType = typeof CALCPAD_SEMANTIC_TOKEN_TYPES[number];

const tokenTypeMap: Readonly<Record<string, CalcpadSemanticTokenType>> = Object.freeze({
    Const: 'number',
    Operator: 'operator',
    Bracket: 'operator',
    LineContinuation: 'operator',
    Variable: 'variable',
    LocalVariable: 'parameter',
    Function: 'function',
    Macro: 'macro',
    MacroParameter: 'parameter',
    Units: 'unit',
    Setting: 'property',
    Keyword: 'keyword',
    ControlBlockKeyword: 'keyword',
    EndKeyword: 'keyword',
    Command: 'function',
    Include: 'string',
    FilePath: 'string',
    DataExchangeKeyword: 'keyword',
    Comment: 'comment',
    HtmlComment: 'comment',
    Tag: 'tag',
    HtmlContent: 'string',
    JavaScript: 'string',
    Css: 'string',
    Svg: 'string',
    Input: 'number',
    Format: 'unit',
    SettingsJson: 'string',
});

/** Return undefined for token types added by a newer server until explicitly mapped. */
export function mapCalcpadTokenType(type: string): CalcpadSemanticTokenType | undefined {
    return tokenTypeMap[type];
}

/**
 * Validate a token against a Monaco model without altering the server's
 * coordinates. Calcpad's API and Monaco both use zero-based UTF-16 columns.
 */
export function isCalcpadTokenInModel(
    token: CalcpadHighlightToken,
    lineCount: number,
    lineLength: (zeroBasedLine: number) => number,
): boolean {
    if (!Number.isInteger(token.line) || !Number.isInteger(token.column) ||
        !Number.isInteger(token.length) || token.line < 0 || token.column < 0 ||
        token.length <= 0 || token.line >= lineCount) {
        return false;
    }
    return token.column + token.length <= lineLength(token.line);
}
