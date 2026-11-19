<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { CalcpadBlocksWorkbenchEmits, CalcpadBlocksWorkbenchProps } from './types';

const props = withDefaults(
    defineProps<CalcpadBlocksWorkbenchProps>(),
    { documentLabel: 'Untitled worksheet', selectedIndex: null },
);

const emit = defineEmits<CalcpadBlocksWorkbenchEmits>();

const searchQuery = ref('');
const kindFilter = ref('');
const originFilter = ref('');
const mappingFilter = ref('');

const selectedConstruct = computed(() =>
    props.selectedIndex === null
        ? undefined
        : props.constructs.find((item) => item.projectionIndex === props.selectedIndex),
);

const kindOptions = computed(() =>
    [...new Set(props.constructs.map((item) => item.kind))].sort(),
);
const originOptions = computed(() =>
    [...new Set(props.constructs.map((item) => item.origin))].sort(),
);
const mappingOptions = computed(() =>
    [...new Set(props.constructs.map((item) => item.mappingStatus))].sort(),
);
const visibleCount = ref(200);
const sourcePane = ref<HTMLElement | null>(null);
const sourceScrollTop = ref(0);
const sourceViewportHeight = ref(480);
const sourceLineHeight = 19.2;
const sourceOverscan = 30;

const filteredConstructs = computed(() => {
    const query = searchQuery.value.trim().toLocaleLowerCase();
    return props.constructs.filter((item) => {
        if (kindFilter.value && item.kind !== kindFilter.value) return false;
        if (originFilter.value && item.origin !== originFilter.value) return false;
        if (mappingFilter.value && item.mappingStatus !== mappingFilter.value) return false;
        if (!query) return true;

        return [
            displayKind(item.kind),
            item.name ?? '',
            item.text ?? '',
            displayLocation(item),
            item.mappingStatus,
            item.origin,
            String(item.rawKind),
            String(item.rawOrigin),
        ].some((value) => value.toLocaleLowerCase().includes(query));
    });
});

const hasActiveFilters = computed(() =>
    Boolean(searchQuery.value || kindFilter.value || originFilter.value || mappingFilter.value),
);

const visibleConstructs = computed(() => filteredConstructs.value.slice(0, visibleCount.value));
const hasMoreConstructs = computed(() => visibleCount.value < filteredConstructs.value.length);

watch(filteredConstructs, () => {
    visibleCount.value = 200;
});

const selectedSource = computed(() => {
    const reference = selectedConstruct.value?.source;
    if (!reference) {
        return {
            fileId: props.sourceFileId,
            revision: props.revision,
            text: props.sourceText,
            available: true,
        };
    }

    if (props.sourceFileId && reference.fileId === props.sourceFileId) {
        return {
            fileId: props.sourceFileId,
            revision: props.revision,
            text: props.sourceText,
            available: true,
        };
    }

    const buffer = props.sourceBuffers?.find((item) => item.fileId === reference.fileId);
    if (buffer) {
        return {
            fileId: buffer.fileId,
            revision: buffer.revision,
            text: buffer.text,
            available: true,
        };
    }

    return {
        fileId: reference.fileId,
        revision: undefined,
        text: '',
        available: false,
    };
});

const sourceLines = computed(() => selectedSource.value.text.split(/\r\n|\r|\n/));

const sourceWindowStart = computed(() =>
    Math.max(0, Math.floor(sourceScrollTop.value / sourceLineHeight) - sourceOverscan),
);
const sourceWindowEnd = computed(() =>
    Math.min(
        sourceLines.value.length,
        Math.ceil((sourceScrollTop.value + sourceViewportHeight.value) / sourceLineHeight)
            + sourceOverscan,
    ),
);
const visibleSourceLineIndexes = computed(() =>
    Array.from(
        { length: Math.max(0, sourceWindowEnd.value - sourceWindowStart.value) },
        (_, index) => sourceWindowStart.value + index,
    ),
);
const renderedSourceLines = computed(() =>
    visibleSourceLineIndexes.value.map((lineIndex) => ({
        lineIndex,
        ...lineSegments(lineIndex),
    })),
);

function updateSourceViewport(): void {
    const pane = sourcePane.value;
    if (!pane) return;
    sourceScrollTop.value = pane.scrollTop;
    sourceViewportHeight.value = pane.clientHeight || 480;
}


function freshnessOf(item: BoundHighlighterConstruct): 'current' | 'stale' | 'unknown' {
    if (!item.source) return 'unknown';
    const knownRevision = props.currentSourceRevisions?.[item.source.fileId]
        ?? (item.source.fileId === props.sourceFileId
            ? props.revision
            : props.sourceBuffers?.find((buffer) => buffer.fileId === item.source?.fileId)?.revision);
    if (knownRevision === undefined) return 'unknown';
    return knownRevision === item.source.revision ? 'current' : 'stale';
}

function lineSegments(lineIndex: number): { before: string; selected: string; after: string } {
    const line = sourceLines.value[lineIndex] ?? '';
    const reference = selectedConstruct.value?.source;
    if (!reference || selectedSource.value.fileId !== reference.fileId) {
        return { before: line, selected: '', after: '' };
    }

    const range = reference.range;
    if (lineIndex < range.startLine || lineIndex > range.endLine) {
        return { before: line, selected: '', after: '' };
    }

    const start = lineIndex === range.startLine ? range.startColumn : 0;
    const end = lineIndex === range.endLine ? range.endColumn : line.length;
    const safeStart = Math.max(0, Math.min(start, line.length));
    const safeEnd = Math.max(safeStart, Math.min(end, line.length));
    return {
        before: line.slice(0, safeStart),
        selected: line.slice(safeStart, safeEnd),
        after: line.slice(safeEnd),
    };
}

watch(selectedConstruct, async (item) => {
    const reference = item?.source;
    if (!reference || selectedSource.value.fileId !== reference.fileId) return;
    await nextTick();
    const pane = sourcePane.value;
    if (!pane) return;
    pane.scrollTop = Math.max(
        0,
        reference.range.startLine * sourceLineHeight - pane.clientHeight / 2,
    );
    updateSourceViewport();
});

function selectConstruct(item: BoundHighlighterConstruct): void {
    emit('select', item.projectionIndex);
    if (item.source) emit('openSource', item.source);
}

function showMoreConstructs(): void {
    visibleCount.value = Math.min(visibleCount.value + 200, filteredConstructs.value.length);
}



function clearFilters(): void {
    searchQuery.value = '';
    kindFilter.value = '';
    originFilter.value = '';
    mappingFilter.value = '';
}

function displayLocation(item: BoundHighlighterConstruct): string {
    const range = item.source?.range;
    return range
        ? range.file + ' · ' + (range.startLine + 1) + ':' + (range.startColumn + 1)
        : item.sourceLocator ?? item.mappingStatus;
}

function displayRange(reference: SourceReference | undefined): string {
    if (!reference) return 'No verified source range';
    const range = reference.range;
    return `${range.startLine + 1}:${range.startColumn + 1}–${range.endLine + 1}:${range.endColumn + 1}`;
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
                    <span>Source preview</span>
                    <span v-if="selectedSource.available">
                        {{ selectedSource.fileId ?? documentLabel }} · {{ selectedSource.text.length.toLocaleString() }} characters
                    </span>
                    <span v-else>Source buffer not supplied by host</span>
                </div>
                <p v-if="!selectedSource.available" class="calcpad-blocks__empty">
                    This construct belongs to another source file. Supply that file in
                    <code>sourceBuffers</code> to preview and highlight its range.
                </p>
                <pre
                    v-else
                    ref="sourcePane"
                    tabindex="0"
                    aria-label="Read-only source preview"
                    @scroll="updateSourceViewport"
                ><code><span
                    class="calcpad-blocks__source-spacer"
                    :style="{ height: `${sourceWindowStart * sourceLineHeight}px` }"
                ></span><span
                    v-for="line in renderedSourceLines"
                    :key="line.lineIndex"
                    :data-source-line="line.lineIndex"
                    class="calcpad-blocks__source-line"
                ><span>{{ line.before }}</span><mark v-if="line.selected">{{ line.selected }}</mark><span>{{ line.after }}</span></span><span
                    class="calcpad-blocks__source-spacer"
                    :style="{ height: `${Math.max(0, sourceLines.length - sourceWindowEnd) * sourceLineHeight}px` }"
                ></span></code></pre>
            </section>

            <aside class="calcpad-blocks__constructs" aria-label="Recognized constructs">
                <div class="calcpad-blocks__section-title">
                    <span>Highlighter constructs</span>
                    <span>{{ filteredConstructs.length }} / {{ constructs.length }}</span>
                </div>

                <label class="calcpad-blocks__search">
                    <span class="calcpad-blocks__visually-hidden">Search constructs</span>
                    <input
                        v-model="searchQuery"
                        type="search"
                        placeholder="Search kind, name, source…"
                        autocomplete="off"
                    />
                </label>

                <div class="calcpad-blocks__filters" role="group" aria-label="Construct filters">
                    <label>
                        <span>Kind</span>
                        <select v-model="kindFilter">
                            <option value="">All kinds</option>
                            <option v-for="kind in kindOptions" :key="kind" :value="kind">
                                {{ displayKind(kind) }}
                            </option>
                        </select>
                    </label>
                    <label>
                        <span>Origin</span>
                        <select v-model="originFilter">
                            <option value="">All origins</option>
                            <option v-for="origin in originOptions" :key="origin" :value="origin">
                                {{ origin }}
                            </option>
                        </select>
                    </label>
                    <label>
                        <span>Source mapping</span>
                        <select v-model="mappingFilter">
                            <option value="">All mapping states</option>
                            <option v-for="mapping in mappingOptions" :key="mapping" :value="mapping">
                                {{ mapping }}
                            </option>
                        </select>
                    </label>
                    <button
                        v-if="hasActiveFilters"
                        type="button"
                        class="calcpad-blocks__reset"
                        @click="clearFilters"
                    >Clear filters</button>
                </div>

                <p v-if="constructs.length === 0" class="calcpad-blocks__empty">
                    No structural constructs were returned for this snapshot.
                </p>
                <p v-else-if="filteredConstructs.length === 0" class="calcpad-blocks__empty">
                    No constructs match the current search and filters.
                </p>

                <article
                    v-for="item in visibleConstructs"
                    :key="item.projectionIndex"
                    class="calcpad-blocks__construct"
                    :class="{
                        'is-selected': selectedIndex === item.projectionIndex,
                        'is-unmapped': item.mappingStatus !== 'mapped',
                    }"
                >
                    <button
                        type="button"
                        class="calcpad-blocks__construct-select"
                        :aria-pressed="selectedIndex === item.projectionIndex"
                        @click="selectConstruct(item)"
                    >
                        <span class="calcpad-blocks__construct-heading">
                            <span class="calcpad-blocks__construct-kind">{{ displayKind(item.kind) }}</span>
                            <span v-if="item.kind === 'Unknown'" class="calcpad-blocks__construct-name">
                                Raw: {{ item.rawKind }}
                            </span>
                            <span v-if="item.name" class="calcpad-blocks__construct-name">{{ item.name }}</span>
                        </span>
                        <code v-if="item.text" class="calcpad-blocks__construct-text">{{ item.text }}</code>
                        <span class="calcpad-blocks__construct-location">{{ displayLocation(item) }}</span>
                        <span class="calcpad-blocks__construct-status">
                            {{ item.mappingStatus === 'mapped' ? 'Source mapped' : item.mappingStatus }}
                            · {{ freshnessOf(item) }} revision
                            · {{ item.contentVerification }}
                            · {{ item.editable ? 'Editable source' : 'Read only' }}
                        </span>
                    </button>
                    <button
                        v-if="item.source"
                        type="button"
                        class="calcpad-blocks__open-source"
                        @click="openSource(item)"
                    >Open source ↗</button>
                </article>

                <button
                    v-if="hasMoreConstructs"
                    type="button"
                    class="calcpad-blocks__load-more"
                    @click="showMoreConstructs"
                >Show 200 more ({{ filteredConstructs.length - visibleConstructs.length }} remaining)</button>

                <section
                    v-if="selectedConstruct"
                    class="calcpad-blocks__inspector"
                    aria-label="Selected construct details"
                >
                    <div class="calcpad-blocks__section-title">
                        <span>Selected construct</span>
                        <span>#{{ selectedConstruct.projectionIndex }}</span>
                    </div>
                    <dl>
                        <div><dt>Kind</dt><dd>{{ displayKind(selectedConstruct.kind) }}</dd></div>
                        <div><dt>Raw kind</dt><dd>{{ selectedConstruct.rawKind }}</dd></div>
                        <div><dt>Origin</dt><dd>{{ selectedConstruct.origin }}</dd></div>
                        <div><dt>Raw origin</dt><dd>{{ selectedConstruct.rawOrigin }}</dd></div>
                        <div><dt>Mapping</dt><dd>{{ selectedConstruct.mappingStatus }}</dd></div>
                        <div><dt>Freshness</dt><dd>{{ freshnessOf(selectedConstruct) }}</dd></div>
                        <div><dt>Content verification</dt><dd>{{ selectedConstruct.contentVerification }}</dd></div>
                        <div><dt>Source range</dt><dd>{{ displayRange(selectedConstruct.source) }}</dd></div>
                        <div><dt>Highlighter locator</dt><dd>{{ selectedConstruct.sourceLocator ?? 'Unavailable' }}</dd></div>
                        <div><dt>Span role</dt><dd>{{ selectedConstruct.spanRole }}</dd></div>
                        <div><dt>Source access</dt><dd>{{ selectedConstruct.editable ? 'Editable' : 'Read only' }}</dd></div>
                    </dl>
                    <button
                        v-if="selectedConstruct.source"
                        type="button"
                        class="calcpad-blocks__open-source"
                        @click="openSource(selectedConstruct)"
                    >Open selected source ↗</button>
                </section>
            </aside>
        </div>

        <footer class="calcpad-blocks__footer">
            <span>
                Read-only inspection of the current flat Highlighter output. No semantic
                boundaries or nesting are inferred.
            </span>
            <span v-if="selectedConstruct">
                Selected: {{ displayKind(selectedConstruct.kind) }} · {{ selectedConstruct.origin }}
            </span>
            <span v-else>No construct selected</span>
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
    grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.9fr);
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
    outline-offset: -2px;
    white-space: pre;
    tab-size: 4;
    font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.calcpad-blocks__search {
    position: sticky;
    z-index: 1;
    top: 36px;
    display: flex;
    align-items: center;
    margin: 8px 8px 2px;
    padding: 4px 8px;
    background: var(--calcpad-blocks-background, #fff);
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 6px;
}
.calcpad-blocks__source pre:focus-visible {
    outline: 2px solid var(--calcpad-blocks-accent, #3977c3);
}
.calcpad-blocks__source-line {
    display: block;
    height: 19.2px;
    line-height: 19.2px;
}
.calcpad-blocks__source-spacer { display: block; width: 1px; }
.calcpad-blocks__source-line mark {
    color: inherit;
    background: var(--calcpad-blocks-selected, #dceaff);
    outline: 1px solid var(--calcpad-blocks-accent, #3977c3);
}
.calcpad-blocks__search input {
    width: 100%;
    min-width: 0;
    padding: 4px 0;
    color: inherit;
    background: transparent;
    border: 0;
    outline: 0;
    font: inherit;
}
.calcpad-blocks__filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    margin: 6px 8px 4px;
}
.calcpad-blocks__filters label {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
    color: var(--calcpad-blocks-muted, #667085);
    font-size: 10px;
}
.calcpad-blocks__filters select {
    width: 100%;
    min-width: 0;
    padding: 5px 6px;
    color: inherit;
    background: var(--calcpad-blocks-background, #fff);
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 5px;
    font: inherit;
}
.calcpad-blocks__reset {
    justify-self: start;
    padding: 3px 0;
    color: var(--calcpad-blocks-accent, #245ea8);
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    font-size: 11px;
}
.calcpad-blocks__constructs { gap: 6px; padding-bottom: 10px; }
.calcpad-blocks__load-more {
    align-self: center;
    margin: 8px;
    padding: 6px 10px;
    color: var(--calcpad-blocks-accent, #245ea8);
    background: transparent;
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 5px;
    cursor: pointer;
    font: inherit;
}
.calcpad-blocks__load-more:focus-visible {
    outline: 2px solid var(--calcpad-blocks-accent, #3977c3);
    outline-offset: 2px;
}
.calcpad-blocks__construct {
    content-visibility: auto;
    contain-intrinsic-size: auto 92px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
    margin: 0 8px;
    padding: 8px;
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 6px;
}
.calcpad-blocks__construct:hover { background: var(--calcpad-blocks-hover, #f6f8fa); }
.calcpad-blocks__construct.is-selected {
    background: var(--calcpad-blocks-selected, #eef5ff);
    border-color: var(--calcpad-blocks-accent, #3977c3);
}
.calcpad-blocks__construct.is-unmapped { border-style: dashed; }
.calcpad-blocks__construct-select {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    padding: 0;
    color: inherit;
    text-align: left;
    background: transparent;
    border: 0;
    cursor: pointer;
}
.calcpad-blocks__construct-select:focus-visible,
.calcpad-blocks__open-source:focus-visible,
.calcpad-blocks__search:focus-within,
.calcpad-blocks__filters select:focus-visible,
.calcpad-blocks__reset:focus-visible {
    outline: 2px solid var(--calcpad-blocks-accent, #3977c3);
    outline-offset: 2px;
}
.calcpad-blocks__construct-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
}
.calcpad-blocks__construct-kind { font-weight: 650; }
.calcpad-blocks__construct-name { color: var(--calcpad-blocks-accent, #245ea8); }
.calcpad-blocks__construct-text {
    max-width: 100%;
    overflow-wrap: anywhere;
    color: var(--calcpad-blocks-code, #9a4d00);
}
.calcpad-blocks__construct-location { max-width: 100%; overflow-wrap: anywhere; }
.calcpad-blocks__open-source {
    align-self: flex-start;
    padding: 3px 0;
    color: var(--calcpad-blocks-accent, #245ea8);
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    font-size: 11px;
}
.calcpad-blocks__inspector {
    margin: 8px;
    border: 1px solid var(--calcpad-blocks-border, #d8dee4);
    border-radius: 6px;
    overflow: hidden;
}
.calcpad-blocks__inspector dl {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 4px 10px 8px;
}
.calcpad-blocks__inspector dl > div {
    display: grid;
    grid-template-columns: minmax(88px, 0.7fr) minmax(0, 1.3fr);
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var(--calcpad-blocks-border, #edf0f2);
}
.calcpad-blocks__inspector dt {
    color: var(--calcpad-blocks-muted, #667085);
    font-size: 11px;
}
.calcpad-blocks__inspector dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 11px;
}
.calcpad-blocks__inspector > .calcpad-blocks__open-source { margin: 0 10px 8px; }
.calcpad-blocks__empty { margin: 12px; color: var(--calcpad-blocks-muted, #667085); }
.calcpad-blocks__footer {
    justify-content: space-between;
    gap: 16px;
    padding: 8px 12px;
    border-top: 1px solid var(--calcpad-blocks-border, #d8dee4);
}
.calcpad-blocks__visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
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
    .calcpad-blocks__footer { align-items: flex-start; flex-direction: column; gap: 4px; }
}
</style>
