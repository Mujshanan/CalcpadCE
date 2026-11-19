import {
    canEditSource,
    type SourceOrigin,
    type SourceReference,
    type SourceSnapshotProvider,
    type SourceRange,
} from '../../core/source/contracts';
import { sourceRangeToOffsets } from '../../core/source/range';

/** Names currently defined by Calcpad.Highlighter.StructuralConstructKind. */
export type HighlighterConstructKind =
    | 'Comment'
    | 'HtmlOrMarkdownContent'
    | 'VariableDefinition'
    | 'VariableReassignment'
    | 'FunctionDefinition'
    | 'FunctionCall'
    | 'MacroDefinition'
    | 'MacroCall'
    | 'CustomUnitDefinition'
    | 'ControlFlowDirective'
    | 'Command'
    | 'IncludeDirective'
    | 'DataExchangeDirective'
    | 'InputDirective'
    | 'SettingsDirective'
    | 'MathematicalExpression';

export interface HighlighterStructuralConstruct {
    readonly kind: HighlighterConstructKind;
    readonly range: SourceRange | null;
    readonly text: string | null;
    readonly origin: SourceOrigin;
    readonly name?: string | null;
}

export interface HighlighterStructuralOutput {
    /** Flat source-ordered constructs; no parent/child links are currently supplied. */
    readonly constructs: readonly HighlighterStructuralConstruct[];
}

export type ConstructMappingStatus =
    | 'verified'
    | 'unmapped'
    | 'bufferUnavailable'
    | 'invalidRange';

export interface BoundHighlighterConstruct {
    /** Projection-local identity; do not persist as a document/block ID. */
    readonly projectionIndex: number;
    readonly kind: HighlighterConstructKind;
    readonly text: string | null;
    readonly name?: string | null;
    readonly origin: SourceOrigin;
    readonly mapping: ConstructMappingStatus;
    readonly source?: SourceReference;
    readonly editable: boolean;
}

/** Bind ranges to the exact snapshots consumed by the projection request. */
export function bindHighlighterOutput(
    output: HighlighterStructuralOutput,
    snapshots: SourceSnapshotProvider,
): readonly BoundHighlighterConstruct[] {
    return output.constructs.map<BoundHighlighterConstruct>((construct, projectionIndex) => {
        const range = construct.range;
        if (!range) {
            return {
                projectionIndex, kind: construct.kind, text: construct.text,
                name: construct.name, origin: construct.origin,
                mapping: 'unmapped', editable: false,
            };
        }

        const snapshot = snapshots.getSnapshot(range.file);
        if (!snapshot) {
            return {
                projectionIndex, kind: construct.kind, text: construct.text,
                name: construct.name, origin: construct.origin,
                mapping: 'bufferUnavailable', editable: false,
            };
        }

        if (!sourceRangeToOffsets(snapshot.text, range)) {
            return {
                projectionIndex, kind: construct.kind, text: construct.text,
                name: construct.name, origin: construct.origin,
                mapping: 'invalidRange', editable: false,
            };
        }

        const source: SourceReference = {
            fileId: range.file,
            revision: snapshot.revision,
            range,
            origin: construct.origin,
        };

        return {
            projectionIndex, kind: construct.kind, text: construct.text,
            name: construct.name, origin: construct.origin,
            mapping: 'verified', source,
            editable: canEditSource(construct.origin, snapshot),
        };
    });
}