import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { BoundHighlighterConstruct } from '../../integrations/calcpad';

export interface ConstructFilterOptions {
    readonly kinds?: readonly string[];
    readonly origins?: readonly string[];
    readonly mappingStatuses?: readonly string[];
}

export function useConstructFilters(
    constructs: ComputedRef<readonly BoundHighlighterConstruct[]> | Ref<readonly BoundHighlighterConstruct[]>,
    options: ConstructFilterOptions = {},
) {
    const query = ref('');
    const kind = ref<string | null>(null);
    const origin = ref<string | null>(null);
    const mappingStatus = ref<string | null>(null);

    const availableKinds = computed(() => options.kinds ?? [
        ...new Set(constructs.value.map((item) => item.kind)),
    ]);
    const availableOrigins = computed(() => options.origins ?? [
        ...new Set(constructs.value.map((item) => item.origin)),
    ]);
    const availableMappingStatuses = computed(() => options.mappingStatuses ?? [
        ...new Set(constructs.value.map((item) => item.mapping)),
    ]);

    const filteredConstructs = computed(() => {
        const normalizedQuery = query.value.trim().toLocaleLowerCase();
        return constructs.value.filter((item) => {
            if (kind.value !== null && item.kind !== kind.value) return false;
            if (origin.value !== null && item.origin !== origin.value) return false;
            if (mappingStatus.value !== null && item.mapping !== mappingStatus.value) return false;
            if (!normalizedQuery) return true;
            const searchable = [
                item.kind,
                String(item.rawKind),
                item.origin,
                String(item.rawOrigin),
                item.name ?? '',
                item.text ?? '',
                item.mapping,
            ].join(' ').toLocaleLowerCase();
            return searchable.includes(normalizedQuery);
        });
    });

    function clearFilters(): void {
        query.value = '';
        kind.value = null;
        origin.value = null;
        mappingStatus.value = null;
    }

    return {
        query,
        kind,
        origin,
        mappingStatus,
        availableKinds,
        availableOrigins,
        availableMappingStatuses,
        filteredConstructs,
        clearFilters,
    };
}
