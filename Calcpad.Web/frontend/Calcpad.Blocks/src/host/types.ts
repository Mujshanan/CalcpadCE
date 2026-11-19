import type {
    SourceEditRequest,
    SourceEditResult,
    SourceReference,
} from '../core/source/contracts';

/** Host callbacks are requests; source ownership and navigation remain with the host. */
export interface HostCallbacks {
    /** Return true only when the referenced file still has the captured revision. */
    isSourceCurrent(reference: SourceReference): boolean;
    /** Ask the host to reveal/select the exact validated source reference. */
    onNavigate(reference: SourceReference): void | Promise<void>;
    /** Optional notification; this must not navigate or change source state. */
    onSelect?(projectionIndex: number | null): void;
    /** Reserved for a future editing phase. Phase 1 does not invoke this callback. */
    onEditRequest?(request: SourceEditRequest): void | Promise<SourceEditResult>;
}

export type SourceNavigationResult =
    | { readonly status: 'navigated' }
    | {
          readonly status: 'refused';
          readonly reason: 'noSelection' | 'unverifiedMapping' | 'missingSource' | 'staleSession';
      };
