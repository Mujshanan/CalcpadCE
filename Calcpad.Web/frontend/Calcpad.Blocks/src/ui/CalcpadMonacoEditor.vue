<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import * as monaco from 'monaco-editor';
import {
    CALCPAD_SEMANTIC_TOKEN_TYPES,
    isCalcpadTokenInModel,
    mapCalcpadTokenType,
    type CalcpadHighlightResponse,
    type CalcpadHighlightToken,
} from '../integrations/calcpad/highlighter-tokens';

type HighlightToken = CalcpadHighlightToken;

const props = withDefaults(defineProps<{
    modelValue: string;
    apiBaseUrl: string;
    apiToken?: string;
    sourceFilePath?: string;
    readOnly?: boolean;
}>(), { apiToken: '', sourceFilePath: '', readOnly: false });

const emit = defineEmits<{
    'update:modelValue': [value: string];
    highlighted: [tokens: readonly HighlightToken[]];
    highlightStatus: [message: string, ok: boolean];
}>();

const host = ref<HTMLDivElement>();
let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let semanticProvider: { dispose(): void } | undefined;
let languageRegistration: { dispose(): void } | undefined;
let contentSubscription: { dispose(): void } | undefined;
let requestSequence = 0;

const legend = { tokenTypes: [...CALCPAD_SEMANTIC_TOKEN_TYPES], tokenModifiers: [] };

function installWorker(): void {
    const scope = globalThis as typeof globalThis & {
        MonacoEnvironment?: { getWorker: (_moduleId: string, _label: string) => Worker };
    };
    scope.MonacoEnvironment = {
        getWorker: () => new EditorWorker(),
    };
}

async function fetchTokens(content: string): Promise<readonly HighlightToken[]> {
    const base = props.apiBaseUrl.trim().replace(/\/$/, '');
    if (!base) throw new Error('Enter the Calcpad server base URL.');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (props.apiToken.trim()) headers['X-Calcpad-Token'] = props.apiToken.trim();

    const body: Record<string, string | boolean> = {
        content,
        includeText: true,
    };
    if (props.sourceFilePath.trim()) body.sourceFilePath = props.sourceFilePath.trim();

    const response = await fetch(`${base}/api/calcpad/highlight`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`Highlighter returned HTTP ${response.status} ${response.statusText}`);
    }
    const result = await response.json() as CalcpadHighlightResponse;
    if (!Array.isArray(result.tokens)) throw new Error('Highlighter response did not contain a tokens array.');
    return result.tokens;
}

function revealRange(line: number, column: number, length: number): void {
    if (!editor) return;
    const start = { lineNumber: line + 1, column: column + 1 };
    const end = { lineNumber: line + 1, column: column + Math.max(length, 1) + 1 };
    editor.setSelection(new monaco.Selection(
        start.lineNumber, start.column, end.lineNumber, end.column,
    ));
    editor.revealPositionInCenter(start);
    editor.focus();
}

defineExpose({ revealRange });

onMounted(() => {
    if (!host.value) return;
    installWorker();

    languageRegistration = monaco.languages.register({ id: 'calcpad' });
    monaco.editor.defineTheme('calcpad-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {},
        semanticTokenColors: {
            number: '#098658',
            operator: '#5b6573',
            variable: '#245ea8',
            parameter: '#7a4e9b',
            function: '#795e26',
            macro: '#9a4d00',
            unit: '#267f99',
            property: '#795e26',
            keyword: '#af00db',
            string: '#a31515',
            comment: '#008000',
            tag: '#800000',
        },
    });

    editor = monaco.editor.create(host.value, {
        value: props.modelValue,
        language: 'calcpad',
        theme: 'calcpad-light',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbers: 'on',
        tabSize: 4,
        insertSpaces: true,
        readOnly: props.readOnly,
        wordWrap: 'off',
        semanticHighlighting: { enabled: true },
        padding: { top: 10, bottom: 10 },
    });

    semanticProvider = monaco.languages.registerDocumentSemanticTokensProvider('calcpad', {
        getLegend: () => legend,
        provideDocumentSemanticTokens: async (model, _lastResultId, cancellationToken) => {
            const requestId = ++requestSequence;
            const content = model.getValue();
            try {
                const tokens = await fetchTokens(content);
                if (requestId !== requestSequence || cancellationToken.isCancellationRequested) {
                    return { data: new Uint32Array(0) };
                }
                emit('highlighted', tokens);
                emit('highlightStatus', `Highlighter: ${tokens.length.toLocaleString()} tokens · live source snapshot`, true);

                const sorted = [...tokens].sort((a, b) =>
                    a.line !== b.line ? a.line - b.line : a.column - b.column,
                );
                const data: number[] = [];
                let previousLine = 0;
                let previousColumn = 0;

                for (const token of sorted) {
                    const tokenType = mapCalcpadTokenType(token.type);
                    const tokenTypeIndex = tokenType
                        ? CALCPAD_SEMANTIC_TOKEN_TYPES.indexOf(tokenType)
                        : -1;
                    const validRange = isCalcpadTokenInModel(
                        token,
                        model.getLineCount(),
                        (line) => model.getLineMaxColumn(line + 1) - 1,
                    );
                    if (tokenTypeIndex < 0 || !validRange) continue;

                    const deltaLine = token.line - previousLine;
                    const deltaColumn = deltaLine === 0
                        ? token.column - previousColumn
                        : token.column;
                    data.push(deltaLine, deltaColumn, token.length, tokenTypeIndex, 0);
                    previousLine = token.line;
                    previousColumn = token.column;
                }

                return { data: new Uint32Array(data) };
            } catch (error) {
                if (requestId === requestSequence && !cancellationToken.isCancellationRequested) {
                    emit('highlighted', []);
                    emit('highlightStatus', error instanceof Error ? error.message : String(error), false);
                }
                return { data: new Uint32Array(0) };
            }
        },
        releaseDocumentSemanticTokens: () => undefined,
    });

    contentSubscription = editor.onDidChangeModelContent(() => {
        const value = editor?.getValue() ?? '';
        emit('update:modelValue', value);
    });
});

watch(() => props.modelValue, (value) => {
    if (!editor || editor.getValue() === value) return;
    editor.setValue(value);
});
watch(() => props.readOnly, (value) => editor?.updateOptions({ readOnly: value }));
watch(
    () => [props.apiBaseUrl, props.apiToken, props.sourceFilePath] as const,
    () => {
        const model = editor?.getModel();
        if (!model) return;
        monaco.editor.setModelLanguage(model, 'plaintext');
        monaco.editor.setModelLanguage(model, 'calcpad');
    },
);

onBeforeUnmount(() => {
    requestSequence++;
    contentSubscription?.dispose();
    semanticProvider?.dispose();
    languageRegistration?.dispose();
    editor?.dispose();
});
</script>

<template>
    <div ref="host" class="calcpad-monaco-editor" aria-label="Editable Calcpad source editor"></div>
</template>

<style scoped>
.calcpad-monaco-editor {
    width: 100%;
    height: 100%;
    min-height: 320px;
    overflow: hidden;
    border: 1px solid #d7dde5;
    border-radius: 7px;
}
</style>
