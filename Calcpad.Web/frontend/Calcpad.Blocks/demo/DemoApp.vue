<script setup lang="ts">
import { computed, ref } from 'vue';
import CalcpadBlocksWorkbench from '../src/ui/CalcpadBlocksWorkbench.vue';
import {
    adaptHighlighterOutput,
    createHighlighterSourceSnapshotSession,
    type HighlighterStructuralOutput,
} from '../src/integrations/calcpad/highlighter-contract';
import type {
    SourceBufferSnapshot,
    SourceFileId,
    SourceReference,
    SourceSnapshotProvider,
} from '../src/core/source/contracts';

const rootText = `# Example: simply supported beam
span = 6 m
load = 12 kN/m
support = "pinned"
#include "beam-data.calcpad"
#def totalLoad(w, L)
    w * L
totalLoad(load, span)
# Notes
The included data file is shown as a separate source mapping.
`;

const includedText = `beamWidth = 250 mm
beamDepth = 500 mm
`;

const rootSnapshot: SourceBufferSnapshot = Object.freeze({
    fileId: 'demo:worksheet',
    revision: 'demo-r1',
    text: rootText,
    writable: true,
});

const includedSnapshot: SourceBufferSnapshot = Object.freeze({
    fileId: 'demo:beam-data',
    revision: 'beam-data-r3',
    text: includedText,
    writable: true,
});

const sourceSnapshots = new Map<SourceFileId, SourceBufferSnapshot>([
    [rootSnapshot.fileId, rootSnapshot],
    [includedSnapshot.fileId, includedSnapshot],
]);

const snapshotProvider: SourceSnapshotProvider = {
    getSnapshot(fileId) {
        return sourceSnapshots.get(fileId);
    },
};

function sourceRange(file: string, text: string, line: number) {
    const lineText = text.split('\n')[line] ?? '';
    return {
        file,
        startLine: line,
        startColumn: 0,
        endLine: line,
        endColumn: lineText.length,
    };
}

const highlighterOutput: HighlighterStructuralOutput = {
    constructs: [
        { kind: 0, range: sourceRange('worksheet.calcpad', rootText, 0), text: '# Example: simply supported beam', origin: 0 },
        { kind: 2, range: sourceRange('worksheet.calcpad', rootText, 1), text: 'span = 6 m', name: 'span', origin: 0 },
        { kind: 2, range: sourceRange('worksheet.calcpad', rootText, 2), text: 'load = 12 kN/m', name: 'load', origin: 0 },
        { kind: 2, range: sourceRange('worksheet.calcpad', rootText, 3), text: 'support = "pinned"', name: 'support', origin: 0 },
        { kind: 11, range: sourceRange('worksheet.calcpad', rootText, 4), text: '#include "beam-data.calcpad"', name: 'beam-data.calcpad', origin: 0 },
        { kind: 4, range: sourceRange('worksheet.calcpad', rootText, 5), text: '#def totalLoad(w, L)', name: 'totalLoad', origin: 0 },
        { kind: 15, range: sourceRange('worksheet.calcpad', rootText, 6), text: '    w * L', origin: 0 },
        { kind: 5, range: sourceRange('worksheet.calcpad', rootText, 7), text: 'totalLoad(load, span)', name: 'totalLoad', origin: 0 },
        { kind: 2, range: sourceRange('/includes/beam-data.calcpad', includedText, 0), text: 'beamWidth = 250 mm', name: 'beamWidth', origin: 1 },
        { kind: 2, range: sourceRange('/includes/beam-data.calcpad', includedText, 1), text: 'beamDepth = 500 mm', name: 'beamDepth', origin: 1 },
        { kind: 0, range: sourceRange('worksheet.calcpad', rootText, 8), text: '# Notes', origin: 0 },
        { kind: 1, range: sourceRange('worksheet.calcpad', rootText, 9), text: 'The included data file is shown as a separate source mapping.', origin: 0 },
        { kind: 10, range: null, text: 'Generated preview output (no source range)', origin: 3 },
    ],
};

const sourceSession = createHighlighterSourceSnapshotSession(
    rootSnapshot,
    'worksheet.calcpad',
    snapshotProvider,
    (locator) => {
        if (locator === '/includes/beam-data.calcpad') {
            return { fileId: includedSnapshot.fileId, locator };
        }
        return undefined;
    },
);

const projection = adaptHighlighterOutput(highlighterOutput, sourceSession);
const selectedIndex = ref<number | null>(0);
const lastHostAction = ref('No host action yet');
const selectedConstruct = computed(() =>
    projection.constructs.find((item) => item.projectionIndex === selectedIndex.value),
);

function onSelect(projectionIndex: number): void {
    selectedIndex.value = projectionIndex;
    lastHostAction.value = `Host received select(${projectionIndex}).`;
}

function onOpenSource(reference: SourceReference): void {
    const fileLabel = reference.fileId === rootSnapshot.fileId
        ? 'worksheet.calcpad'
        : 'beam-data.calcpad';
    const { startLine, startColumn, endLine, endColumn } = reference.range;
    lastHostAction.value =
        `Host received reveal/select request for ${fileLabel}, ` +
        `revision ${reference.revision}, ${startLine + 1}:${startColumn + 1}–${endLine + 1}:${endColumn + 1}.`;
    const matching = projection.constructs.find((item) =>
        item.source?.fileId === reference.fileId &&
        item.source?.range.startLine === startLine &&
        item.source?.range.startColumn === startColumn,
    );
    if (matching) selectedIndex.value = matching.projectionIndex;
}
</script>

<template>
    <main class="demo-shell">
        <header class="demo-header">
            <div>
                <p class="eyebrow">CALCPAD · UI SANDBOX</p>
                <h1>Source-backed worksheet workbench</h1>
                <p class="intro">
                    A local mock host for exploring the current read-only Blocks UI and
                    versioned Highlighter adapter.
                </p>
            </div>
            <div class="demo-status">
                <span class="status-dot"></span>
                Mock host · no backend required
            </div>
        </header>

        <section class="demo-meta" aria-label="Demo information">
            <div><span>Root source</span><strong>worksheet.calcpad</strong></div>
            <div><span>Root revision</span><strong>{{ rootSnapshot.revision }}</strong></div>
            <div><span>Included source</span><strong>beam-data.calcpad</strong></div>
            <div><span>Projection</span><strong>v{{ projection.contractVersion }}</strong></div>
        </section>

        <CalcpadBlocksWorkbench
            document-label="Demo worksheet · simply supported beam"
            :revision="rootSnapshot.revision"
            :source-text="rootSnapshot.text"
            :constructs="projection.constructs"
            :selected-index="selectedIndex"
            @select="onSelect"
            @open-source="onOpenSource"
        />

        <section class="host-panel" aria-label="Mock host event log">
            <div>
                <p class="eyebrow">HOST INTEGRATION PREVIEW</p>
                <h2>Last host callback</h2>
                <p>{{ lastHostAction }}</p>
            </div>
            <div class="host-selection">
                <span>Selected item</span>
                <strong>{{ selectedConstruct?.name || selectedConstruct?.kind || 'None' }}</strong>
                <span>{{ selectedConstruct?.mappingStatus || 'No selection' }}</span>
            </div>
        </section>

        <p class="demo-note">
            This is test data, not live Calcpad parser output. Source is intentionally
            read-only; the demo does not save files or change the worksheet.
        </p>
    </main>
</template>
