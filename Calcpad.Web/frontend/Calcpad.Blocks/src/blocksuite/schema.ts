import { defineBlockSchema, Schema } from '@blocksuite/store';

/**
 * Calcpad-owned BlockSuite schema.
 *
 * This is a runtime rendering model only. It is not the persisted worksheet
 * format; source text and revisions remain owned by the Calcpad host.
 */
export const CALCPAD_WORKSHEET_FLAVOUR = 'calcpad:worksheet' as const;
export const CALCPAD_TEXT_FLAVOUR = 'calcpad:text' as const;

export const CalcpadWorksheetSchema = defineBlockSchema({
    flavour: CALCPAD_WORKSHEET_FLAVOUR,
    props: () => ({
        documentId: '',
        sourceRevision: '',
        projectionId: '',
    }),
    metadata: {
        version: 1,
        role: 'root',
        children: ['calcpad:*'],
    },
});

export const CalcpadTextSchema = defineBlockSchema({
    flavour: CALCPAD_TEXT_FLAVOUR,
    props: (internal) => ({
        text: internal.Text(),
        sourceFileId: '',
        sourceRevision: '',
        sourceStart: 0,
        sourceEnd: 0,
        sourceOrigin: 'Unknown',
        projectionKey: '',
        editable: false,
    }),
    metadata: {
        version: 1,
        role: 'content',
        parent: [CALCPAD_WORKSHEET_FLAVOUR],
        children: [],
    },
});

/** Creates a fresh registry; callers own its lifecycle. */
export function createCalcpadBlockSchema(): Schema {
    return new Schema().register([
        CalcpadWorksheetSchema,
        CalcpadTextSchema,
    ]);
}
