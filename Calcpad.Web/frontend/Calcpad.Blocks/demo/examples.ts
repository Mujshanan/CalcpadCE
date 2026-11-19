import parametricSvg from './examples/3D, Plotting, Drawing/Parametric SVG Generation.cpd?raw';
import svgDrawing from './examples/3D, Plotting, Drawing/svg_drawing.cpd?raw';
import matrixIndexing from './examples/Matrices/Matrix Initialization and Indexing.cpd?raw';
import matrixMath from './examples/Matrices/Matrix Math Functions.cpd?raw';

export interface DemoExample {
    readonly id: string;
    readonly title: string;
    readonly category: string;
    readonly upstreamPath: string;
    readonly content: string;
    readonly dependency?: {
        readonly title: string;
        readonly upstreamPath: string;
        readonly content: string;
    };
}

export const demoExamples: readonly DemoExample[] = Object.freeze([
    {
        id: 'parametric-svg',
        title: 'Parametric SVG Generation',
        category: '3D, Plotting, Drawing',
        upstreamPath: 'Examples/Engineering/3D, Plotting, Drawing/Parametric SVG Generation.cpd',
        content: parametricSvg,
        dependency: {
            title: 'svg_drawing.cpd',
            upstreamPath: 'Examples/Engineering/3D, Plotting, Drawing/svg_drawing.cpd',
            content: svgDrawing,
        },
    },
    {
        id: 'matrix-indexing',
        title: 'Matrix Initialization and Indexing',
        category: 'Matrices',
        upstreamPath: 'Examples/Engineering/Matrices/Matrix Initialization and Indexing.cpd',
        content: matrixIndexing,
    },
    {
        id: 'matrix-functions',
        title: 'Matrix Math Functions',
        category: 'Matrices',
        upstreamPath: 'Examples/Engineering/Matrices/Matrix Math Functions.cpd',
        content: matrixMath,
    },
]);
