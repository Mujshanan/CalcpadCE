/**
 * Replaceable boundary between Calcpad's document projection and BlockSuite.
 * No BlockSuite classes or package types cross this contract.
 */
export interface BlockSuiteDocumentInput {
    readonly documentId: string;
    readonly sourceFileId: string;
    readonly sourceRevision: string;
    readonly sourceText: string;
    readonly projectionId?: string;
}

export interface BlockSuiteDocumentHandle {
    /** Runtime-generated ID. Never use it as a persistent Calcpad identity. */
    readonly rootBlockId: string;
    /** Runtime-generated ID. Never use it as a persistent Calcpad identity. */
    readonly sourceBlockId: string;
    readonly isReadOnly: boolean;
    readonly blockCount: number;
    getSourceText(): string;
    /** Adapter-native, disposable projection snapshot; not a worksheet save format. */
    createSnapshot(): unknown;
    dispose(): void;
}

export interface BlockSuiteDocumentAdapter {
    createDocument(input: BlockSuiteDocumentInput): BlockSuiteDocumentHandle;
}
