import { computed, ref } from 'vue';
import type { BlocksHighlighterProjection } from '../../integrations/calcpad';
import type { HostCallbacks } from '../../host';
import { useCollapseState } from './useCollapseState';
import { useConstructFilters } from './useConstructFilters';
import { useDiagnostics } from './useDiagnostics';
import { useSelection } from './useSelection';
import { useSession } from './useSession';
import { useSourceNavigation } from './useSourceNavigation';

export type WorkspaceMode = 'source' | 'split' | 'blocks';

export function useWorkspace(
    initialSession: BlocksHighlighterProjection,
    hostCallbacks: HostCallbacks,
) {
    const mode = ref<WorkspaceMode>('split');
    const sessionState = useSession(initialSession);
    const filters = useConstructFilters(sessionState.constructs);
    const selection = useSelection(sessionState.constructs);
    const collapse = useCollapseState();
    const diagnostics = useDiagnostics(sessionState.session);
    const navigation = useSourceNavigation(initialSession, hostCallbacks);

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
    function navigateSelected() {
        const index = selection.selectedIndex.value;
        if (index === null) return Promise.resolve({ status: 'refused', reason: 'noSelection' } as const);
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
