import { computed, isRef, type Ref } from 'vue';
import type {
    BlocksHighlighterProjection,
    BoundHighlighterConstruct,
    ProjectionDiagnostic,
} from '../../integrations/calcpad';

export type SessionInput =
    | BlocksHighlighterProjection
    | Readonly<Ref<BlocksHighlighterProjection>>;

/** Read the current projection without taking ownership of host/session state. */
export function useSession(source: SessionInput) {
    const session = computed(() => isRef(source) ? source.value : source);
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
