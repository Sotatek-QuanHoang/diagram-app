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
published stencils into `src/ui/cloud-glyphs/<provider>.ts` and drawn inline.
Every shape id in `clouds.ts` was confirmed to render in the editor — a wrong
name produces a silently blank icon.

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

> The glyph modules embed AWS, Azure and Google Cloud architecture icons (via
> draw.io's stencil sets) — ~220 KB across the three, far more than the rest of
> the app. Each provider is a separate chunk behind a dynamic import in
> `cloud-glyphs/index.ts`, fetched only when a scene references it, which keeps
> `app.js` at ~36 KB instead of ~258 KB. A diagram with no cloud icons downloads
> none of it. Drawing stays synchronous: a shape whose chunk has not arrived
> falls back to its service name, and the preview redraws when it lands.
>
> Each provider permits its icons in architecture diagrams; check their icon
> terms before distributing this app outside your organisation.

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
- `clouds.ts` — AWS/Azure/GCP service catalog: verified draw.io icon names, category colours and brand tints
- `enabled-clouds.ts` — which providers this deployment draws (`DIAGRAM_CLOUD_PROVIDERS`)
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

Two things ship independently, and confusing them wastes a release:

- **The app artifact** — manifest, schemas, skill, and the UI bundle. `sota
  deploy` builds one immutable artifact and runs it in Staging; `sota release`
  promotes that exact artifact to Production. Production keeps running the
  artifact it was given until the next `sota release`.
- **The backend** — a plain Node process you host yourself. The artifact records
  only its URL, so a backend-only change needs a restart on the server and
  neither `sota deploy` nor `sota release`.

`service.baseUrl` and `health.url` in the base manifest point at the hosted
backend; the `environments.local` overlay keeps development on
`http://localhost:8787`. If the hosted origin moves, change both base-manifest
URLs together — a placeholder or non-routable host fails `sota validate` with
`NON_ROUTABLE_DEPLOY_ENDPOINT`. That check tests whether a URL is routable *in
principle*; it never dials the host, so a well-formed name that serves nothing
passes validation and fails at runtime with `Hook response body is not valid
JSON` — Core reporting that it got an error page where it expected a tool result.

## Deploying the backend

The service is a single-process, stateless HTTP app: no database, no disk, no
outbound calls except one JWKS fetch per process. **1 vCPU, 512 MB RAM, 10 GB
disk** covers it with room to spare — a typical diagram costs 0.38 ms end to end
and one core sustains ~2,900 req/s. A second core buys nothing, because the
handler is synchronous and the process is not clustered.

Use an always-on plan. Boot to a served `/health` is ~120 ms, but a container
resuming from scale-to-zero takes tens of seconds, against the tool's declared
`timeoutMs: 15000`.

### First time on the server

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx
```

If `apt` fails with `trying to overwrite '/usr/include/node/common.gypi'`, the
distro's Node 12 packages are still installed and own that file. Removing the
runtime alone is not enough:

```bash
sudo apt remove -y libnode-dev libnode72 nodejs-doc npm
sudo apt autoremove -y && sudo apt install -y nodejs
node -v   # must be v20+; the app uses `??` and fails to parse on older Node
```

Then create the directory the deploy writes into — `/opt` belongs to root, and
rsync runs as your login user:

```bash
sudo mkdir -p /opt/diagram-app && sudo chown "$USER:$USER" /opt/diagram-app
```

### Shipping a build

Build locally and ship only what runs, which keeps the TypeScript and Vite
toolchain off the server:

```bash
npm run build
rsync -av --delete -e "ssh -i ~/.ssh/<key>" \
  dist package.json package-lock.json <user>@<host>:/opt/diagram-app/
ssh -i ~/.ssh/<key> <user>@<host> 'cd /opt/diagram-app && npm ci --omit=dev'
```

That is a 12 MB install; the runtime footprint including Node is about 130 MB.

### Environment

```bash
sudo tee /etc/diagram-app.env >/dev/null <<'EOF'
NODE_ENV=production
PORT=8787
SOTA_CORE_ORIGIN=https://api.v4.sotaagents.ai
NODE_OPTIONS=--max-old-space-size=384
EOF
sudo chmod 600 /etc/diagram-app.env
```

`SOTA_CORE_ORIGIN` is not optional. The built-in default is the *staging* Core,
whose signing keys differ, and leaving it unset makes every request fail with a
bare 401 that says nothing about why. `--max-old-space-size` matters because an
uncapped V8 sizes its heap against the host's RAM rather than the container
limit, turning a memory ceiling into a silent OOM kill instead of a GC pause.

### Running it

```ini
# /etc/systemd/system/diagram-app.service
[Unit]
Description=diagram-app backend
After=network-online.target

[Service]
Type=simple
User=<user>
WorkingDirectory=/opt/diagram-app
EnvironmentFile=/etc/diagram-app.env
ExecStart=/usr/bin/node dist/backend/server.js
Restart=always
RestartSec=3
MemoryMax=512M
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now diagram-app
curl -s localhost:8787/health     # {"status":"ok","appId":"diagram-app"}
```

`journalctl -u diagram-app -n 50` explains anything that fails to start. Check
`command -v node` against `ExecStart` first — a wrong path and a missing
`node_modules` are the two usual causes.

### TLS, and closing the open port

Core calls the backend from the public internet over HTTPS, so a private address
cannot serve Staging or Production no matter how healthy the process is. Put a
reverse proxy in front with a certificate from a public CA:

```nginx
server {
  listen 443 ssl;
  server_name <public-hostname>;
  ssl_certificate     /etc/ssl/certs/diagram-app.crt;
  ssl_certificate_key /etc/ssl/private/diagram-app.key;

  client_max_body_size 2m;   # express.json caps tool input at 1m
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;  # the tool's timeoutMs is 15000
  }
}
```

With `NODE_ENV=production` the process binds `0.0.0.0`, not loopback, so 8787 is
reachable on the local network until you close it:

```bash
sudo ufw allow 443/tcp && sudo ufw deny 8787/tcp
```

### Verifying

From outside the network — not from the server, and not over the VPN:

```bash
curl -v https://<public-hostname>/health
```

Only once that returns the health JSON should the manifest point at it. Then
`sota validate && sota deploy`, smoke the Staging card, and `sota release`.

### Later updates

A backend-only change stops at the restart:

```bash
npm run build
rsync -av --delete -e "ssh -i ~/.ssh/<key>" dist <user>@<host>:/opt/diagram-app/
ssh -i ~/.ssh/<key> <user>@<host> \
  'cd /opt/diagram-app && npm ci --omit=dev && sudo systemctl restart diagram-app'
```

A manifest, schema, skill, or UI change also needs `sota deploy` and then
`sota release` — Production stays on its pinned artifact until you promote.
