export {
    BLOCKS_HIGHLIGHTER_CONTRACT_ID,
    BLOCKS_HIGHLIGHTER_CONTRACT_VERSION,
    HIGHLIGHTER_CONSTRUCT_KINDS,
    HIGHLIGHTER_CONSTRUCT_KIND_COUNT,
    HIGHLIGHTER_SOURCE_ORIGINS,
    HIGHLIGHTER_SOURCE_ORIGIN_COUNT,
    adaptHighlighterOutput,
    bindHighlighterOutput,
} from './highlighter-contract';

export type {
    HighlighterConstructKind,
    HighlighterEnumValue,
    HighlighterOrigin,
    HighlighterStructuralConstruct,
    HighlighterStructuralOutput,
    HighlighterSourceBinding,
    HighlighterProjectionContext,
    ProjectionSourceManifestEntry,
    BoundHighlighterConstruct,
    BlocksHighlighterCapabilities,
    ProjectionDiagnostic,
    BlocksHighlighterProjection,
    ConstructMappingStatus,
    ConstructSpanRole,
    EnumValueStatus,
} from './highlighter-contract';
