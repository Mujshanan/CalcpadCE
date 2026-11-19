import { computed, readonly, shallowRef } from 'vue';
import type {
    BlocksHighlighterProjection,
    BoundHighlighterConstruct,
    ProjectionDiagnostic,
} from '../../integrations/calcpad';
 
/** Read-only access to one immutable adapter projection. */
export function useSession(initialSession: BlocksHighlighterProjection) {
    const sessionState = shallowRef(initialSession);
    const session = readonly(sessionState);
    const constructs = computed(() => session.value.constructs);
    const diagnostics = computed(() => session.value.diagnostics);
    const revisionManifest = computed(() => session.value.sourceManifest);

    function getConstruct(projectionIndex: number): BoundHighlighterConstruct | undefined {
        return constructs.value.find((item) => item.projectionIndex === projectionIndex);
    }

    function getDiagnosticList(): readonly ProjectionDiagnostic[] {
        return diagnostics.value;
    }

    return {
        session,
        constructs,
        diagnostics,
        revisionManifest,
        getConstruct,
        getDiagnosticList,
    };
}
