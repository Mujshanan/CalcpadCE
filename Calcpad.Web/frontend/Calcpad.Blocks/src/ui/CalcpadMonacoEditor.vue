<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import * as monaco from 'monaco-editor';

interface HighlightToken {
    readonly line: number;
    readonly column: number;
    readonly length: number;
    readonly type: string;
    readonly typeId: number;
    readonly text?: string;
}

interface HighlightResponse {
    readonly tokens: readonly HighlightToken[];
}

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
let semanticProvider: monaco.IDisposable | undefined;
let languageRegistration: monaco.IDisposable | undefined;
let contentSubscription: monaco.IDisposable | undefined;
let requestSequence = 0;

const tokenTypes = [
    'number', 'operator', 'variable', 'parameter', 'function', 'macro',
    'unit', 'property', 'keyword', 'string', 'comment', 'tag',
] as const;

const tokenTypeMap: Record<string, typeof tokenTypes[number]> = {
    Const: 'number',
    Operator: 'operator',
    Bracket: 'operator',
    LineContinuation: 'operator',
    Variable: 'variable',
    LocalVariable: 'parameter',
    Function: 'function',
    Macro: 'macro',
    MacroParameter: 'parameter',
    Units: 'unit',
    Setting: 'property',
    Keyword: 'keyword',
    ControlBlockKeyword: 'keyword',
    EndKeyword: 'keyword',
    Command: 'function',
    Include: 'string',
    FilePath: 'string',
    DataExchangeKeyword: 'keyword',
    Comment: 'comment',
    HtmlComment: 'comment',
    Tag: 'tag',
    HtmlContent: 'string',
    JavaScript: 'string',
    Css: 'string',
    Svg: 'string',
    Input: 'number',
    Format: 'unit',
    SettingsJson: 'string',
};

const legend = new monaco.languages.SemanticTokensLegend([...tokenTypes], []);

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
    const result = await response.json() as HighlightResponse;
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
    editor = monaco.editor.create(host.value, {
        value: props.modelValue,
        language: 'calcpad',
        theme: 'vs',
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
        provideDocumentSemanticTokens: async (model) => {
            const requestId = ++requestSequence;
            const content = model.getValue();
            try {
                const tokens = await fetchTokens(content);
                if (requestId === requestSequence) {
                    emit('highlighted', tokens);
                    emit('highlightStatus', `Highlighter: ${tokens.length.toLocaleString()} tokens · live source snapshot`, true);
                }
                const builder = new monaco.languages.SemanticTokensBuilder(legend);
                for (const token of tokens) {
                    const tokenType = tokenTypeMap[token.type];
                    if (!tokenType || token.length <= 0 || token.line < 0 || token.column < 0) continue;
                    builder.push(token.line, token.column, token.length, tokenType, []);
                }
                return builder.build();
            } catch (error) {
                if (requestId === requestSequence) {
                    emit('highlighted', []);
                    emit('highlightStatus', error instanceof Error ? error.message : String(error), false);
                }
                return null;
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
