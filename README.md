# Diagram App

Generates **flowcharts**, **sequence diagrams**, and **ER diagrams** as editable
draw.io files (`.drawio` / mxGraphModel XML). Every shape, label, and connector
stays individually editable after the file is opened.

## What it contributes

| Contribution | Kind | Notes |
| --- | --- | --- |
| `generate-diagram` | tool | `POST /tools/generate-diagram`. Takes a structured `spec` **or** `mermaid` source and returns the `.drawio` file plus preview geometry. |
| `drawio-diagrams` | skill | Teaches the agent which input form to send, how to choose shapes and cardinalities, and to report `warnings`. |
| `/diagram` | slash command | `insert-only` — types a starting point into the message box, dispatches nothing on its own. |
| Diagram starters | UI composer-panel | Appears while the draft contains `/diagram`; swaps the token for a ready-to-send prompt. |
| Diagram studio | UI page | `admin.workspace.tab` — paste Mermaid or JSON, preview, download. |
| Diagram panel | UI artifact | Opens in the side panel when a diagram finishes, and from the card's **Open in side panel** button. |
| Diagram result | UI tool-view | Renders the diagram inline under the tool call: **Download .drawio**, **Open in draw.io**, **Copy XML**. |

## How it works

```
spec ─┐
      ├─> DiagramSpec ──> layout ──> Scene ─┬─> mxGraphModel XML   (the .drawio file)
mermaid┘   (normalize/parse)   (geometry)   └─> SVG                (the UI preview)
```

One `Scene` feeds both renderers, so the preview always matches the downloaded
file. The backend resolves every coordinate — callers never send positions.

The `.drawio` file is **not** returned by the tool. It is several times the size
of the geometry it comes from, and shipping it pushed the tool result past the
renderer surface's payload limit. The scene travels instead and the file is
assembled in the browser on demand — which also keeps the file's contents out of
the model's context, so the agent stops trying to save it somewhere itself.

Cloud nodes carry an `icon` key naming a service — `aws-lambda`,
`azure-functions`, `gcp-bigquery` — and both outputs show the real artwork. The
`.drawio` file references draw.io's built-in shapes by name; the preview cannot
reach that shape library, so the same glyphs are extracted from draw.io's
published stencils into `src/ui/cloud-glyphs.ts` and drawn inline. Every shape
id in `clouds.ts` was confirmed to render in the editor — a wrong name produces
a silently blank icon.

AWS sets its glyph on a category-coloured tile; Azure and Google draw the glyph
itself, so those take the brand tint and Google's carry their own colours. That
distinction is why `fill` means the tile for AWS and the glyph for the others.

Regenerate after adding a service to the catalog:

```bash
mkdir -p /tmp/stencils/mscae
base=https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/stencils
curl -o /tmp/stencils/aws4.xml        $base/aws4.xml
curl -o /tmp/stencils/gcp2.xml        $base/gcp2.xml
curl -o /tmp/stencils/mscae/cloud.xml $base/mscae/cloud.xml
node tools/build-cloud-glyphs.mjs /tmp/stencils
```

> `cloud-glyphs.ts` embeds AWS, Azure and Google Cloud architecture icons (via
> draw.io's stencil sets) in the UI bundle, which costs ~206 KB. Each provider
> permits its icons in architecture diagrams; check their icon terms before
> distributing this app outside your organisation.

**Open in draw.io** passes the file through the URL fragment. Fragments are never
sent in the HTTP request, so the diagram is handed to diagrams.net inside the
reader's own browser rather than uploaded. Browsers cap URL length, so the button
hides itself above ~50k characters and the download takes over.

Source map, all under `src/backend/diagram/`:

- `normalize.ts` — validates the structured `spec` at the boundary
- `mermaid.ts` — Mermaid subset → the same spec
- `layout-flowchart.ts` — layered ranking, barycenter ordering, orthogonal routing
- `layout-sequence.ts` — lifelines, messages, activation bars
- `layout-erd.ts` — stack-layout entity tables, crow's-foot relationships
- `aws.ts` — AWS service catalog: verified draw.io icon names and category colours
- `theme.ts` — the one place shape appearance is decided

`src/ui/diagram-svg.ts` (SVG preview) and `src/ui/drawio.ts` (mxGraphModel XML)
both run in the browser and import only *types* from the backend.

## The side panel

A finished diagram opens in the artifact side panel automatically — but only
when the tool-view surface *watched* it finish. Mounting straight into
`output-available`, which is what scrolling back through history does, never
opens the panel; otherwise scrolling past an old diagram would hijack it. Each
tool call opens at most once per session, and the card's **Open in side panel**
button works whenever you want it.

The artifact surface is not covered by the pinned references. The manifest shape
(`surface: artifact`, `slot: artifact.slot.diagram`, `artifactKind`) is correct —
the panel mounts — but the `context` given to `ui.openArtifact` does not reach
the module's props, which arrive empty.

So the diagram is handed over twice. It goes into the `openArtifact` context
*and* into `artifact-store.ts`, keyed by the tool call id. The panel looks for it
by token, then anywhere in its props, then in that store. If the host ever starts
forwarding the context, the props path wins and the store is simply unused.

That store is backed by `sessionStorage`, not just module memory: navigating to
another chat and back remounts the bundle and wipes module state, which used to
leave the panel with nothing to show. Storage access is guarded — private modes
and quota limits throw — and the in-memory map still serves the current page view
if it is unavailable.

### Nothing degrades to raw JSON

A native surface that throws during render is replaced by the host's raw JSON
view of the tool result: no title, no download, just the payload. Both surfaces
are therefore wrapped in an error boundary, and each part that can throw sits
behind its own: the preview, the actions, and `useAppContext` — the surface's one
host dependency, which is isolated so that losing it costs the *Open in side
panel* button and nothing else. The last-resort fallback still offers the
download, because losing the picture is tolerable and losing the file is not.

## Quick access

Typing `/diagram` in the composer reveals a panel of starting points — common
systems (AWS serverless, microservices, login flow, CI/CD, data model) and blank
openers per diagram type. Choosing one removes the slash token and leaves a
prompt in the draft; nothing is sent until the person sends it.

The panel rebuilds the draft from its structured `content`, never from `value`,
so app references already in the message survive the edit intact.

## Local development

```bash
npm run dev       # backend + UI watchers
npm run dev:sota  # in another terminal: attach to your workspace
```

## Checks

```bash
npm run typecheck
npm run build
sota validate
```

## Before deploying

`service.baseUrl` and `health.url` are still the generated `https://diagram-app.invalid`
placeholders, so `sota validate` fails on `NON_ROUTABLE_DEPLOY_ENDPOINT`. Point
them at the real hosted backend before `sota deploy`; the `environments.local`
overlay already covers development.
