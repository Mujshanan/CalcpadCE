<script setup lang="ts">
import { computed } from 'vue';
import type { BoundHighlighterConstruct } from '../integrations/calcpad/highlighter-contract';
import type { SourceReference } from '../core/source/contracts';

const props = withDefaults(
    defineProps<{
        documentLabel?: string;
        revision: string;
        sourceText: string;
        constructs: readonly BoundHighlighterConstruct[];
        selectedIndex?: number | null;
    }>(),
    { documentLabel: 'Untitled worksheet', selectedIndex: null },
);

const emit = defineEmits<{
    select: [projectionIndex: number];
    openSource: [reference: SourceReference];
}>();

const selectedConstruct = computed(() =>
    props.selectedIndex === null
        ? undefined
        : props.constructs.find((item) => item.projectionIndex === props.selectedIndex),
);

function displayLocation(item: BoundHighlighterConstruct): string {
    const range = item.source?.range;
    return range
        ? range.file + ' · ' + (range.startLine + 1) + ':' + (range.startColumn + 1)
        : item.mapping;
}

function displayKind(kind: string): string {
    return kind.replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (character) => character.toUpperCase());
}

function openSource(item: BoundHighlighterConstruct): void {
    if (item.source) emit('openSource', item.source);
}
</script>

<template>
    <section class="calcpad-blocks" aria-label="Calcpad Blocks workbench">
        <header class="calcpad-blocks__header">
            <div class="calcpad-blocks__heading">
                <strong>Calcpad Blocks</strong>
                <span>{{ documentLabel }}</span>
            </div>
            <span class="calcpad-blocks__revision">Revision {{ revision }}</span>
        </header>

        <div class="calcpad-blocks__workspace">
            <section class="calcpad-blocks__source" aria-label="Original source">
                <div class="calcpad-blocks__section-title">
                    <span>Original source</span><span>Read only</span>
                </div>
                <pre><code>{{ sourceText }}</code></pre>
            </section>

            <aside class="calcpad-blocks__constructs" aria-label="Recognized constructs">
                <div class="calcpad-blocks__section-title">
                    <span>Highlighter constructs</span><span>{{ constructs.length }}</span>
                </div>
                <p v-if="constructs.length === 0" class="calcpad-blocks__empty">
                    No structural constructs were returned for this snapshot.
                </p>
                <button
                    v-for="item in constructs"
                    :key="item.projectionIndex"
                    class="calcpad-blocks__construct"
                    :class="{
                        'is-selected': selectedIndex === item.projectionIndex,
                        'is-unmapped': item.mapping !== 'verified',
                    }"
                    type="button"
                    @click="$emit('select', item.projectionIndex)"
                    @dblclick.stop="openSource(item)"
                >
                    <span class="calcpad-blocks__construct-kind">{{ displayKind(item.kind) }}</span>
                    <span v-if="item.name" class="calcpad-blocks__construct-name">{{ item.name }}</span>
                    <code v-if="item.text" class="calcpad-blocks__construct-text">{{ item.text }}</code>
                    <span class="calcpad-blocks__construct-location">{{ displayLocation(item) }}</span>
                    <span class="calcpad-blocks__construct-status">
                        {{ item.editable ? 'Editable source' : 'Read only' }}
                    </span>
                </button>
            </aside>
        </div>

        <footer class="calcpad-blocks__footer">
            <span>
                Inspection view of the current flat Highlighter output. It does not infer
                nesting or split source into semantic block boundaries.
            </span>
            <span v-if="selectedConstruct">Selected: {{ displayKind(selectedConstruct.kind) }}</span>
        </footer>
    </section>
</template>

<style scoped>
.calcpad-blocks {
    display: flex;
    min-width: 0;
    min-height: 320px;
    height: 100%;
    flex-direction: column;
    overflow: hidden;
    color: var(--calcpad-blocks-text, #24292f);
    background: var(--calcpad-blocks-background, #fff);
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 8px;
    font: 13px/1.45 var(--calcpad-blocks-font, system-ui, sans-serif);
}
.calcpad-blocks__header,
.calcpad-blocks__footer,
.calcpad-blocks__section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.calcpad-blocks__header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--calcpad-blocks-border, #d8dee4);
}
.calcpad-blocks__heading { display: flex; min-width: 0; flex-direction: column; }
.calcpad-blocks__heading span,
.calcpad-blocks__revision,
.calcpad-blocks__section-title,
.calcpad-blocks__construct-location,
.calcpad-blocks__construct-status,
.calcpad-blocks__footer {
    color: var(--calcpad-blocks-muted, #667085);
    font-size: 11px;
}
.calcpad-blocks__workspace {
    display: grid;
    flex: 1;
    min-height: 0;
    grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.9fr);
}
.calcpad-blocks__source,
.calcpad-blocks__constructs {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: auto;
}
.calcpad-blocks__source { border-right: 1px solid var(--calcpad-blocks-border, #d8dee4); }
.calcpad-blocks__section-title {
    position: sticky;
    z-index: 1;
    top: 0;
    padding: 9px 12px;
    background: var(--calcpad-blocks-panel, #f6f8fa);
    border-bottom: 1px solid var(--calcpad-blocks-border, #d8dee4);
    font-weight: 600;
}
.calcpad-blocks__source pre {
    margin: 0;
    padding: 14px;
    overflow: auto;
    white-space: pre;
    tab-size: 4;
    font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.calcpad-blocks__constructs { gap: 6px; padding-bottom: 10px; }
.calcpad-blocks__construct {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    margin: 0 8px;
    padding: 9px 10px;
    color: inherit;
    text-align: left;
    background: transparent;
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 6px;
    cursor: pointer;
}
.calcpad-blocks__construct:hover { background: var(--calcpad-blocks-hover, #f6f8fa); }
.calcpad-blocks__construct.is-selected {
    background: var(--calcpad-blocks-selected, #eef5ff);
    border-color: var(--calcpad-blocks-accent, #3977c3);
}
.calcpad-blocks__construct.is-unmapped { border-style: dashed; }
.calcpad-blocks__construct-kind { font-weight: 650; }
.calcpad-blocks__construct-name { color: var(--calcpad-blocks-accent, #245ea8); }
.calcpad-blocks__construct-text {
    max-width: 100%;
    overflow-wrap: anywhere;
    color: var(--calcpad-blocks-code, #9a4d00);
}
.calcpad-blocks__construct-location { max-width: 100%; overflow-wrap: anywhere; }
.calcpad-blocks__empty { margin: 12px; color: var(--calcpad-blocks-muted, #667085); }
.calcpad-blocks__footer {
    justify-content: space-between;
    gap: 16px;
    padding: 8px 12px;
    border-top: 1px solid var(--calcpad-blocks-border, #d8dee4);
}
@media (max-width: 760px) {
    .calcpad-blocks__workspace {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(160px, 1fr) minmax(180px, 0.8fr);
    }
    .calcpad-blocks__source {
        border-right: 0;
        border-bottom: 1px solid var(--calcpad-blocks-border, #d8dee4);
    }
}
</style>