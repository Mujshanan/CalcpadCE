import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { BoundHighlighterConstruct } from '../../integrations/calcpad';

export interface UseSelectionOptions {
    /**
     * When supplied, selection is controlled by the caller. The accessor must
     * read the current host/prop value so changes remain reactive.
     */
    readonly controlled?: () => number | null | undefined;
    /** Notifies the owner that a validated selection was requested. */
    readonly onSelect?: (projectionIndex: number | null) => void;
}

export function useSelection(
    constructs: ComputedRef<readonly BoundHighlighterConstruct[]> | Ref<readonly BoundHighlighterConstruct[]>,
    options: UseSelectionOptions = {},
) {
    const internal = ref<number | null>(null);

    // Read the controlled value directly rather than mirroring it with a
    // watcher. The owner remains authoritative, including when it rejects a
    // requested selection or updates the prop asynchronously.
    const selectedIndex = computed<number | null>(() =>
        options.controlled ? options.controlled() ?? null : internal.value,
    );

    const selectedConstruct = computed(() => selectedIndex.value === null
        ? undefined
        : constructs.value.find((item) => item.projectionIndex === selectedIndex.value));

    const isValid = computed(() => selectedConstruct.value !== undefined);

    function select(projectionIndex: number | null): void {
        const accepted = projectionIndex === null
            ? null
            : constructs.value.some((item) => item.projectionIndex === projectionIndex)
                ? projectionIndex
                : null;

        if (!options.controlled) {
            internal.value = accepted;
        }
        options.onSelect?.(accepted);
    }

    return { selectedIndex, selectedConstruct, isValid, select };
}
