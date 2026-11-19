import { computed, ref, type Ref } from 'vue';
import type { BlocksHighlighterProjection } from '../../integrations/calcpad';
import type { HostCallbacks, SourceNavigationResult } from '../../host';
import { useCollapseState } from './useCollapseState';
import { useConstructFilters } from './useConstructFilters';
import { useDiagnostics } from './useDiagnostics';
import { useSelection } from './useSelection';
import { useSession } from './useSession';
import { useSourceNavigation } from './useSourceNavigation';

export type WorkspaceMode = 'source' | 'split' | 'blocks';

type ProjectionInput =
    | BlocksHighlighterProjection
    | Readonly<Ref<BlocksHighlighterProjection>>;

/**
 * Compose workspace state around a host-owned projection.
 *
 * Pass a Ref/ComputedRef when the host can replace the projection. A plain
 * projection remains supported for static callers and existing integrations.
 */
export function useWorkspace(
    projection: ProjectionInput,
    hostCallbacks: HostCallbacks,
) {
    const mode = ref<WorkspaceMode>('split');
    const sessionState = useSession(projection);
    const filters = useConstructFilters(sessionState.constructs);
    const selection = useSelection(sessionState.constructs);
    const collapse = useCollapseState();
    const diagnostics = useDiagnostics(sessionState.session);
    const navigation = useSourceNavigation(sessionState.session, hostCallbacks);

    const visibleConstructs = computed(() => filters.filteredConstructs.value);
    const selectedConstruct = selection.selectedConstruct;
    const canNavigateSelected = computed(() =>
        selectedConstruct.value?.mapping === 'verified' &&
        selectedConstruct.value.source !== undefined,
    );

    function setMode(next: WorkspaceMode): void {
        mode.value = next;
    }

    function select(projectionIndex: number | null): void {
        selection.select(projectionIndex);
        hostCallbacks.onSelect?.(selection.selectedIndex.value);
    }

    function navigateSelected(): Promise<SourceNavigationResult> {
        const index = selection.selectedIndex.value;
        if (index === null) {
            return Promise.resolve({
                status: 'refused',
                reason: 'noSelection',
            });
        }
        return navigation.navigate(index);
    }

    return {
        mode,
        setMode,
        session: sessionState.session,
        constructs: sessionState.constructs,
        visibleConstructs,
        filters,
        selectedIndex: selection.selectedIndex,
        selectedConstruct,
        selectionIsValid: selection.isValid,
        select,
        collapse,
        diagnostics,
        canNavigateSelected,
        navigateSelected,
    };
}
