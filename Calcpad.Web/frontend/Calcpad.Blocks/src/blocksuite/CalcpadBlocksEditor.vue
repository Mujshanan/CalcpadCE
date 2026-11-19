<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import {
    createCalcpadBlockDocument,
    type CalcpadBlockDocument,
} from './document';

const props = withDefaults(defineProps<{
    documentId: string;
    sourceFileId: string;
    revision: string;
    sourceText: string;
    documentLabel?: string;
}>(), {
    documentLabel: 'Untitled worksheet',
});

const runtime = shallowRef<CalcpadBlockDocument | null>(null);
const renderedSource = computed(() => runtime.value?.getSourceText() ?? '');

function rebuildProjection(): void {
    runtime.value?.dispose();
    runtime.value = createCalcpadBlockDocument({
        documentId: props.documentId,
        sourceFileId: props.sourceFileId,
        sourceRevision: props.revision,
        sourceText: props.sourceText,
    });
}

watch(
    () => [props.documentId, props.sourceFileId, props.revision, props.sourceText] as const,
    rebuildProjection,
    { immediate: true },
);

onBeforeUnmount(() => {
    runtime.value?.dispose();
    runtime.value = null;
});
</script>

<template>
    <section class="calcpad-block-editor" aria-label="Calcpad BlockSuite editor">
        <header class="calcpad-block-editor__header">
            <div class="calcpad-block-editor__identity">
                <strong>Calcpad Blocks</strong>
                <span>{{ documentLabel }}</span>
            </div>
            <div class="calcpad-block-editor__status">
                <span>BlockSuite projection</span>
                <span>Revision {{ revision }}</span>
            </div>
        </header>

        <div
            v-if="runtime"
            class="calcpad-block-editor__canvas"
            :data-document-id="runtime.documentId"
            :data-blocksuite-root="runtime.rootBlockId"
        >
            <article
                class="calcpad-block-editor__block"
                :data-blocksuite-block="runtime.sourceBlockId"
                data-blocksuite-flavour="calcpad:text"
            >
                <div class="calcpad-block-editor__block-label">
                    <span>Source text</span>
                    <span>Read only · host-owned source</span>
                </div>
                <pre><code>{{ renderedSource }}</code></pre>
            </article>
        </div>

        <footer class="calcpad-block-editor__footer">
            The BlockSuite tree is a temporary visual projection. Editing, saving,
            revisions, and undo/redo remain in the Calcpad host.
        </footer>
    </section>
</template>

<style scoped>
.calcpad-block-editor {
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 240px;
    flex-direction: column;
    overflow: hidden;
    color: var(--calcpad-blocks-text, #24292f);
    background: var(--calcpad-blocks-background, #fff);
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 8px;
    font: 13px/1.5 var(--calcpad-blocks-font, system-ui, sans-serif);
}
.calcpad-block-editor__header,
.calcpad-block-editor__status,
.calcpad-block-editor__block-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.calcpad-block-editor__header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--calcpad-blocks-border, #d8dee4);
}
.calcpad-block-editor__identity {
    display: flex;
    min-width: 0;
    flex-direction: column;
}
.calcpad-block-editor__identity span,
.calcpad-block-editor__status,
.calcpad-block-editor__block-label,
.calcpad-block-editor__footer {
    color: var(--calcpad-blocks-muted, #667085);
    font-size: 11px;
}
.calcpad-block-editor__status { flex-wrap: wrap; justify-content: flex-end; }
.calcpad-block-editor__canvas {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 20px;
    background: var(--calcpad-blocks-panel, #f6f8fa);
}
.calcpad-block-editor__block {
    max-width: 1000px;
    min-height: 120px;
    margin: 0 auto;
    overflow: hidden;
    background: var(--calcpad-blocks-background, #fff);
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 6px;
}
.calcpad-block-editor__block-label {
    padding: 8px 12px;
    background: var(--calcpad-blocks-panel, #f6f8fa);
    border-bottom: 1px solid var(--calcpad-blocks-border, #d8dee4);
    font-weight: 600;
}
.calcpad-block-editor__block pre {
    margin: 0;
    padding: 16px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    tab-size: 4;
    font: 12px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.calcpad-block-editor__footer {
    padding: 9px 12px;
    border-top: 1px solid var(--calcpad-blocks-border, #d8dee4);
}
</style>
