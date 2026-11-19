import { computed, type ComputedRef, type Ref } from 'vue';
import type { BlocksHighlighterProjection, ProjectionDiagnostic } from '../../integrations/calcpad';

type SessionSource = BlocksHighlighterProjection | ComputedRef<BlocksHighlighterProjection> | Ref<BlocksHighlighterProjection>;

function readSession(source: SessionSource): BlocksHighlighterProjection {
    return 'value' in source ? source.value : source;
}

export function useDiagnostics(session: SessionSource) {
    const all = computed<readonly ProjectionDiagnostic[]>(() => readSession(session).diagnostics);
    const total = computed(() => all.value.length);
    const byCode = computed(() => {
        const counts: Record<string, number> = {};
        for (const diagnostic of all.value) {
            counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
        }
        return counts;
    });
    // The current adapter contract has no severity/level field. Do not invent one.
    const byLevel = computed(() => ({ unspecified: total.value }));

    return { all, total, byCode, byLevel };
}
