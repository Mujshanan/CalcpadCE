<script setup lang="ts">
import { computed, ref } from 'vue';
import CalcpadMonacoEditor from '../src/ui/CalcpadMonacoEditor.vue';
import { demoExamples, type DemoExample } from './examples';

interface HighlightToken {
    readonly line: number;
    readonly column: number;
    readonly length: number;
    readonly type: string;
    readonly typeId: number;
    readonly text?: string;
}

interface MonacoEditorHandle {
    revealRange(line: number, column: number, length: number): void;
    refreshHighlight(): void;
}

const selectedExampleId = ref(demoExamples[0].id);
const selectedExample = computed<DemoExample>(() =>
    demoExamples.find((example) => example.id === selectedExampleId.value) ?? demoExamples[0],
);
const activeFile = ref<'root' | 'dependency'>('root');
const rootDraft = ref(selectedExample.value.content);
const dependencyDraft = ref(selectedExample.value.dependency?.content ?? '');
const sourceText = ref(rootDraft.value);
const apiBaseUrl = ref('http://127.0.0.1:9420');
const apiToken = ref('');
const serverSourceFilePath = ref('');
const tokens = ref<readonly HighlightToken[]>([]);
const selectedTokenIndex = ref<number | null>(null);
const highlightStatus = ref('Waiting for the local Calcpad server.');
const highlightOk = ref(false);
const editorRef = ref<MonacoEditorHandle | null>(null);

const hasDependency = computed(() => Boolean(selectedExample.value.dependency));
const sourceFileTitle = computed(() =>
    activeFile.value === 'root'
        ? selectedExample.value.title + '.cpd'
        : selectedExample.value.dependency?.title ?? 'Included source',
);
const activeServerPath = computed(() =>
    activeFile.value === 'root' ? serverSourceFilePath.value : '',
);
const canNavigateTokens = computed(() =>
    !(activeFile.value === 'root' && hasDependency.value && Boolean(serverSourceFilePath.value.trim())),
);
const sourceLines = computed(() => sourceText.value.split(/\r?\n/));

function onExampleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    selectExample(target.value);
}

function selectExample(id: string): void {
    const example = demoExamples.find((item) => item.id === id);
    if (!example) return;
    selectedExampleId.value = id;
    activeFile.value = 'root';
    rootDraft.value = example.content;
    dependencyDraft.value = example.dependency?.content ?? '';
    sourceText.value = rootDraft.value;
    tokens.value = [];
    selectedTokenIndex.value = null;
    highlightStatus.value = 'Example loaded. Waiting for Highlighter.';
    highlightOk.value = false;
    serverSourceFilePath.value = '';
}

function selectFile(file: 'root' | 'dependency'): void {
    if (file === 'dependency' && !hasDependency.value) return;
    if (activeFile.value === 'root') rootDraft.value = sourceText.value;
    else dependencyDraft.value = sourceText.value;
    activeFile.value = file;
    sourceText.value = file === 'root' ? rootDraft.value : dependencyDraft.value;
    tokens.value = [];
    selectedTokenIndex.value = null;
    highlightStatus.value = 'Source tab changed. Waiting for Highlighter.';
    highlightOk.value = false;
}

function updateSource(value: string): void {
    sourceText.value = value;
    if (activeFile.value === 'root') rootDraft.value = value;
    else dependencyDraft.value = value;
}

function tokenText(token: HighlightToken): string {
    if (token.text !== undefined) return token.text;
    return sourceLines.value[token.line]?.slice(token.column, token.column + token.length) ?? '';
}

function tokenLocation(token: HighlightToken): string {
    return `${token.line + 1}:${token.column + 1}`;
}

function selectToken(index: number): void {
    selectedTokenIndex.value = index;
}

function openToken(index: number): void {
    const token = tokens.value[index];
    if (!token || !canNavigateTokens.value) return;
    selectedTokenIndex.value = index;
    editorRef.value?.revealRange(token.line, token.column, token.length);
}

function onHighlighted(value: readonly HighlightToken[]): void {
    tokens.value = value;
    if (selectedTokenIndex.value !== null && selectedTokenIndex.value >= value.length) {
        selectedTokenIndex.value = null;
    }
}

function onHighlightStatus(message: string, ok: boolean): void {
    highlightStatus.value = message;
    highlightOk.value = ok;
}
</script>

<template>
    <main class="demo-shell demo-shell--source">
        <header class="demo-header">
            <div>
                <p class="eyebrow">CALCPADCE · BLOCKS INTEGRATION SANDBOX</p>
                <h1>Source-first worksheet workbench</h1>
                <p class="intro">
                    Genuine upstream worksheets, editable Monaco source, and live lexical
                    highlighting from the CalcpadCE server. Source remains authoritative.
                </p>
            </div>
            <div class="demo-status" :class="{ 'is-connected': highlightOk }">
                <span class="status-dot"></span>
                {{ highlightOk ? 'Real Highlighter connected' : 'Highlighter not connected' }}
            </div>
        </header>

        <section class="catalogue-panel" aria-label="Upstream example catalogue">
            <div class="catalogue-heading">
                <div>
                    <p class="eyebrow">UPSTREAM EXAMPLES</p>
                    <h2>Worksheet catalogue</h2>
                </div>
                <label class="example-picker">
                    <span>Open example</span>
                    <select :value="selectedExampleId" @change="onExampleChange">
                        <optgroup label="3D, Plotting, Drawing">
                            <option value="parametric-svg">Parametric SVG Generation</option>
                        </optgroup>
                        <optgroup label="Structural · Steel">
                            <option value="steel-i-section">I-Section Properties · Eurocode</option>
                        </optgroup>
                        <optgroup label="Matrices">
                            <option value="matrix-indexing">Matrix Initialization and Indexing</option>
                            <option value="matrix-functions">Matrix Math Functions</option>
                        </optgroup>
                    </select>
                </label>
            </div>
            <div class="example-provenance">
                <span>{{ selectedExample.category }}</span>
                <span>Source: {{ selectedExample.upstreamPath }}</span>
                <a
                    :href="'https://github.com/imartincei/CalcpadCE/blob/main/' + encodeURI(selectedExample.upstreamPath).replaceAll('%2F', '/')"
                    target="_blank"
                    rel="noreferrer"
                >View upstream file ↗</a>
            </div>
        </section>

        <section class="connection-panel" aria-label="Calcpad server connection">
            <label>
                <span>Calcpad server base URL</span>
                <input v-model="apiBaseUrl" type="url" placeholder="http://127.0.0.1:9420" />
            </label>
            <label>
                <span>API token (if enabled)</span>
                <input v-model="apiToken" type="password" autocomplete="off" placeholder="Optional X-Calcpad-Token" />
            </label>
            <label class="source-path-field">
                <span>Server-side root source path (optional; enables #include resolution)</span>
                <input
                    v-model="serverSourceFilePath"
                    type="text"
                    :disabled="activeFile !== 'root'"
                    placeholder="Absolute path visible to the Calcpad server"
                />
            </label>
        </section>

        <section class="workspace-panel" aria-label="Editable source and real Highlighter output">
            <div class="workspace-heading">
                <div class="source-tabs">
                    <button
                        type="button"
                        :class="{ active: activeFile === 'root' }"
                        @click="selectFile('root')"
                    >{{ selectedExample.title }}.cpd</button>
                    <button
                        v-if="hasDependency"
                        type="button"
                        :class="{ active: activeFile === 'dependency' }"
                        @click="selectFile('dependency')"
                    >{{ selectedExample.dependency?.title }}</button>
                </div>
                <span class="source-authority">Editable source · in-memory draft</span>
            </div>

            <div class="workspace-grid">
                <section class="editor-column">
                    <div class="pane-heading">
                        <strong>{{ sourceFileTitle }}</strong>
                        <span>{{ sourceText.length.toLocaleString() }} characters</span>
                    </div>
                    <CalcpadMonacoEditor
                        ref="editorRef"
                        :model-value="sourceText"
                        :api-base-url="apiBaseUrl"
                        :api-token="apiToken"
                        :source-file-path="activeServerPath"
                        @update:model-value="updateSource"
                        @highlighted="onHighlighted"
                        @highlight-status="onHighlightStatus"
                    />
                    <p v-if="activeFile === 'root' && selectedExample.dependency && !serverSourceFilePath" class="include-note">
                        This worksheet includes <code>svg_drawing.cpd</code>. To resolve that include
                        on the server, set a root source path whose directory also contains the
                        dependency. The browser fixture tab alone is not a server-side file.
                    </p>
                </section>

                <aside class="tokens-column">
                    <div class="pane-heading">
                        <strong>Real Highlighter tokens</strong>
                        <span>{{ tokens.length.toLocaleString() }} tokens</span>
                    </div>
                    <div class="highlight-status" :class="{ success: highlightOk }" role="status">
                        {{ highlightStatus }}
                    </div>
                    <button type="button" class="retry-highlight" @click="editorRef?.refreshHighlight()">
                        Retry Highlighter
                    </button>
                    <p v-if="tokens.length === 0" class="token-empty">
                        Connect the local Calcpad server to populate this list from
                        <code>POST /api/calcpad/highlight</code>.
                    </p>
                    <div v-else class="token-list">
                        <button
                            v-for="(token, index) in tokens"
                            :key="index"
                            type="button"
                            class="token-row"
                            :class="{ selected: selectedTokenIndex === index }"
                            @click="selectToken(index)"
                            @dblclick="openToken(index)"
                        >
                            <span class="token-type">{{ token.type }}</span>
                            <code class="token-text">{{ tokenText(token) }}</code>
                            <span class="token-location">{{ tokenLocation(token) }}</span>
                        </button>
                    </div>
                    <p class="token-hint" v-if="canNavigateTokens">
                        Single-click selects a token; double-click reveals its exact source range in Monaco.
                    </p>
                    <p class="token-hint" v-else>
                        Navigation is disabled for this include-expanded result: the current API token
                        payload does not identify which source file each token belongs to.
                    </p>
                </aside>
            </div>
        </section>

        <footer class="integration-note">
            <strong>Scope boundary:</strong> <code>/highlight</code> returns lexical tokens, not
            worksheet statement/block structures. This view does not invent block boundaries from
            tokens. Structural projection and BlockNote-style visual blocks remain a separate
            integration milestone until CalcpadCE exposes a genuine structural result.
        </footer>
    </main>
</template>
