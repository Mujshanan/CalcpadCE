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

// Representative, editable-in-source CalcpadCE worksheet text based on the
// official Getting Started, Programming, Includes, and Matrix examples.
// The current sandbox still supplies mock Highlighter output; it does not run
// the CalcpadCE parser or calculation engine.
const rootText = `'CalcpadCE Blocks demo — language feature tour
"Simply Supported Beam — Worksheet Examples
#include beam-library.cpd

'Beam inputs and reusable macros:
span = 6 m
w = 12 kN/m
Vmax = beamShear$(w; span)
Mmax = beamMoment$(w; span)

"User-defined function
f(x) = x^2 - 3*x + 4
f(0.75)
f(1.25)

"Matrix and vector examples
A = [1; 2; 3|4; 5; 6]
B = [6; 5|4; 3|2; 1]
C = A*B

"Matrix initialization and indexing
v = [1; 2; 4]
D = [v|2*v + 1|3*v + 2]
D.(2; 2)

"Conditional execution
#if Mmax > 0
status = "Positive bending moment"
#else
status = "Check load direction"
#end if

"Loop example
#for i = 1 : 3
    w_i = w*i
#loop
`;

const includedText = `'Shared beam formulas — included by worksheet.cpd
#def beamMoment$(w$; L$)
    w$*L$^2/8
#end def

#def beamShear$(w$; L$)
    w$*L$/2
#end def
`;

const rootSnapshot: SourceBufferSnapshot = Object.freeze({
    fileId: 'demo:worksheet',
    revision: 'demo-r2',
    text: rootText,
    writable: true,
});

const includedSnapshot: SourceBufferSnapshot = Object.freeze({
    fileId: 'demo:beam-library',
    revision: 'beam-library-r1',
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
    const lineText = text.split('\\n')[line] ?? '';
    return {
        file,
        startLine: line,
        startColumn: 0,
        endLine: line,
        endColumn: lineText.length,
    };
}

function rootConstruct(line: number, kind: number, extra: Record<string, unknown> = {}) {
    const text = rootText.split('\\n')[line] ?? '';
    return {
        kind,
        range: sourceRange('worksheet.calcpad', rootText, line),
        text,
        origin: 0,
        ...extra,
    };
}

function includedConstruct(line: number, kind: number, extra: Record<string, unknown> = {}) {
    const text = includedText.split('\\n')[line] ?? '';
    return {
        kind,
        range: sourceRange('/includes/beam-library.cpd', includedText, line),
        text,
        origin: 1,
        ...extra,
    };
}

const highlighterOutput: HighlighterStructuralOutput = {
    constructs: [
        rootConstruct(0, 0),
        rootConstruct(1, 0),
        rootConstruct(2, 11, { name: 'beam-library.cpd' }),
        rootConstruct(4, 0),
        rootConstruct(5, 2, { name: 'span' }),
        rootConstruct(6, 2, { name: 'w' }),
        rootConstruct(7, 5, { name: 'beamShear$' }),
        rootConstruct(8, 5, { name: 'beamMoment$' }),
        rootConstruct(10, 0),
        rootConstruct(11, 15),
        rootConstruct(12, 5, { name: 'f' }),
        rootConstruct(13, 5, { name: 'f' }),
        rootConstruct(15, 0),
        rootConstruct(16, 2, { name: 'A' }),
        rootConstruct(17, 2, { name: 'B' }),
        rootConstruct(18, 2, { name: 'C' }),
        rootConstruct(20, 0),
        rootConstruct(21, 2, { name: 'v' }),
        rootConstruct(22, 2, { name: 'D' }),
        rootConstruct(23, 15),
        rootConstruct(25, 0),
        rootConstruct(26, 15),
        rootConstruct(27, 2, { name: 'status' }),
        rootConstruct(28, 15),
        rootConstruct(29, 2, { name: 'status' }),
        rootConstruct(30, 15),
        rootConstruct(32, 0),
        rootConstruct(33, 15),
        rootConstruct(34, 2, { name: 'w_i' }),
        rootConstruct(35, 15),
        includedConstruct(0, 0),
        includedConstruct(1, 4, { name: 'beamMoment$' }),
        includedConstruct(2, 15),
        includedConstruct(3, 15),
        includedConstruct(4, 4, { name: 'beamShear$' }),
        includedConstruct(5, 15),
        includedConstruct(6, 15),
        {
            kind: 10,
            range: null,
            text: 'Generated preview output (no source range)',
            origin: 3,
        },
    ],
};

const sourceSession = createHighlighterSourceSnapshotSession(
    rootSnapshot,
    'worksheet.calcpad',
    snapshotProvider,
    (locator) => {
        if (locator === '/includes/beam-library.cpd') {
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
        : 'beam-library.cpd';
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
                <p class="eyebrow">CALCPADCE · BLOCKS UI SANDBOX</p>
                <h1>Source-backed worksheet workbench</h1>
                <p class="intro">
                    A feature-tour worksheet with definitions, includes, functions,
                    matrices, conditionals, loops, and engineering calculations.
                </p>
            </div>
            <div class="demo-status">
                <span class="status-dot"></span>
                Mock host · no calculation backend
            </div>
        </header>

        <section class="demo-meta" aria-label="Demo information">
            <div><span>Root source</span><strong>worksheet.calcpad</strong></div>
            <div><span>Root revision</span><strong>{{ rootSnapshot.revision }}</strong></div>
            <div><span>Included source</span><strong>beam-library.cpd</strong></div>
            <div><span>Projection</span><strong>v{{ projection.contractVersion }}</strong></div>
        </section>

        <CalcpadBlocksWorkbench
            document-label="CalcpadCE feature tour · beam and matrix examples"
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
            The worksheet text and included library use CalcpadCE syntax. The current
            sandbox still uses representative mock Highlighter output, so it does not
            execute the calculations or refresh the projection after source edits.
        </p>
    </main>
</template>
