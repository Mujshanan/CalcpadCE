import { isRef, type Ref } from 'vue';
import type { BlocksHighlighterProjection } from '../../integrations/calcpad';
import type { HostCallbacks, SourceNavigationResult } from '../../host';
import type { SourceReference } from '../../core/source/contracts';

type SessionInput =
    | BlocksHighlighterProjection
    | Readonly<Ref<BlocksHighlighterProjection>>;

export function useSourceNavigation(
    session: SessionInput,
    hostCallbacks: HostCallbacks,
) {
    async function navigate(projectionIndex: number): Promise<SourceNavigationResult> {
        // Resolve at invocation time so a replaced projection cannot leave navigation
        // operating against the session that existed when this composable was created.
        const currentSession = isRef(session) ? session.value : session;
        const construct = currentSession.constructs.find(
            (item) => item.projectionIndex === projectionIndex,
        );
        if (!construct) return { status: 'refused', reason: 'noSelection' };
        if (construct.mapping !== 'verified') {
            return { status: 'refused', reason: 'unverifiedMapping' };
        }
        const reference: SourceReference | undefined = construct.source;
        if (!reference) return { status: 'refused', reason: 'missingSource' };
        if (!hostCallbacks.isSourceCurrent(reference)) {
            return { status: 'refused', reason: 'staleSession' };
        }
        await hostCallbacks.onNavigate(reference);
        return { status: 'navigated' };
    }

    return { navigate };
}
