# Calcpad Blocks standalone integration demo

## Start the frontend

```powershell
cd Calcpad.Web\frontend\Calcpad.Blocks
npm install
npm run dev
```

## Start the local Calcpad server

In a second PowerShell terminal, pin the backend to the port shown in the demo's default URL:

```powershell
cd Calcpad.Web\backend
$env:CALCPAD_PORT = "9420"
dotnet run
```

The editor calls `POST http://127.0.0.1:9420/api/calcpad/highlight` with the active source text and `includeText: true`. If the server was started with `CALCPAD_API_TOKEN`, enter the token in the demo.

## Includes

The parametric SVG worksheet includes `svg_drawing.cpd`. To let the backend resolve it, copy/checkout the example fixtures in the repository and enter the absolute path to the root `.cpd` file in the demo's server-side source path field. The included file must be adjacent and accessible to the backend process. The dependency tab edits a browser-side draft; those edits are not uploaded as a server-side include file.

The current `/highlight` response carries token line/column/length/type data, but no included-file identity. Consequently, token-to-Monaco navigation is reliable for tokens in the active source buffer only; included-file attribution remains unresolved.

## Scope

This demo exercises authentic upstream `.cpd` text, in-memory source editing, and the real lexical Highlighter API. It does not calculate worksheets, save edits to fixture files, or fabricate statement/block structures from lexical tokens.

Upstream fixture provenance and the MIT license are in `demo/examples/`.
