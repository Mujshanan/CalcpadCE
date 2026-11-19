import type { BlocksHighlighterProjection } from '../../integrations/calcpad';
import type { HostCallbacks, SourceNavigationResult } from '../../host';
import type { SourceReference } from '../../core/source/contracts';

export function useSourceNavigation(
    session: BlocksHighlighterProjection,
    hostCallbacks: HostCallbacks,
) {
    async function navigate(projectionIndex: number): Promise<SourceNavigationResult> {
        const construct = session.constructs.find((item) => item.projectionIndex === projectionIndex);
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
