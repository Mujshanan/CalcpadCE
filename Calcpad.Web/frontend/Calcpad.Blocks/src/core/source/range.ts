import type { SourceRange } from './contracts';

export interface SourceOffsets {
    readonly start: number;
    readonly end: number;
}

interface LineBounds {
    readonly start: number;
    readonly end: number;
}

/**
 * Convert Highlighter's zero-based UTF-16 coordinates to JavaScript offsets.
 * CRLF is one line break and line columns exclude line-ending characters.
 * Invalid or out-of-buffer coordinates return null; they are never guessed.
 */
export function sourceRangeToOffsets(
    source: string,
    range: Pick<SourceRange, 'startLine' | 'startColumn' | 'endLine' | 'endColumn'>,
): SourceOffsets | null {
    const lines = getLineBounds(source);
    const start = lineColumnToOffset(lines, range.startLine, range.startColumn);
    const end = lineColumnToOffset(lines, range.endLine, range.endColumn);
    if (start === null || end === null || end < start) return null;
    return { start, end };
}

function getLineBounds(source: string): LineBounds[] {
    const lines: LineBounds[] = [];
    let lineStart = 0;
    for (let index = 0; index < source.length; index++) {
        const character = source[index];
        if (character !== '\r' && character !== '\n') continue;
        lines.push({ start: lineStart, end: index });
        if (character === '\r' && source[index + 1] === '\n') index++;
        lineStart = index + 1;
    }
    lines.push({ start: lineStart, end: source.length });
    return lines;
}

function lineColumnToOffset(
    lines: readonly LineBounds[],
    line: number,
    column: number,
): number | null {
    if (
        !Number.isInteger(line) || !Number.isInteger(column) ||
        line < 0 || column < 0 || line >= lines.length
    ) return null;

    const bounds = lines[line];
    if (column > bounds.end - bounds.start) return null;
    return bounds.start + column;
}