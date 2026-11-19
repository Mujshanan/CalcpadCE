# Upstream example fixtures

The `.cpd` files in this directory are copied from the public CalcpadCE repository
(https://github.com/imartincei/CalcpadCE), branch `main`, as retrieved for this
demo on 2026-11-19. They are kept as source fixtures rather than rewritten or
combined into synthetic worksheets.

| Local fixture | Upstream path | Upstream blob |
|---|---|---|
| `3D, Plotting, Drawing/Parametric SVG Generation.cpd` | `Examples/Engineering/3D, Plotting, Drawing/Parametric SVG Generation.cpd` | `f66aea1d2324bc086e086ae76a9230cdc4608ba2` |
| `3D, Plotting, Drawing/svg_drawing.cpd` | `Examples/Engineering/3D, Plotting, Drawing/svg_drawing.cpd` | `19368a0d9ac6cfd0ccbc5f912aea7794af8baafa` |
| `Matrices/Matrix Initialization and Indexing.cpd` | `Examples/Engineering/Matrices/Matrix Initialization and Indexing.cpd` | `ea0f76519a469dcb684104b64a6d6d3344a3ccac` |
| `Matrices/Matrix Math Functions.cpd` | `Examples/Engineering/Matrices/Matrix Math Functions.cpd` | `f4d8453aac73c502d26b98c747956eece347767a` |

The parametric SVG worksheet depends on the adjacent `svg_drawing.cpd` include.
The fixture text is preserved so syntax and source positions correspond to
upstream worksheets. The demo UI edits only its in-memory copy; it does not
write changes back to these fixture files.

Refer to the upstream repository's LICENSE for applicable license terms.
