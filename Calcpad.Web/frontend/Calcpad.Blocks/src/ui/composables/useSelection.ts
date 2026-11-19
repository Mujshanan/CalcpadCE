import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { BoundHighlighterConstruct } from '../../integrations/calcpad';

export function useSelection(
    constructs: ComputedRef<readonly BoundHighlighterConstruct[]> | Ref<readonly BoundHighlighterConstruct[]>,
) {
    const selectedIndex = ref<number | null>(null);
    const selectedConstruct = computed(() => selectedIndex.value === null
        ? undefined
        : constructs.value.find((item) => item.projectionIndex === selectedIndex.value));
    const isValid = computed(() => selectedConstruct.value !== undefined);

    function select(projectionIndex: number | null): void {
        if (projectionIndex === null) {
            selectedIndex.value = null;
            return;
        }
        selectedIndex.value = constructs.value.some((item) => item.projectionIndex === projectionIndex)
            ? projectionIndex
            : null;
    }

    return { selectedIndex, selectedConstruct, isValid, select };
}
