/// <reference types="vite/client" />

declare module '*.cpd?raw' {
    const content: string;
    export default content;
}
