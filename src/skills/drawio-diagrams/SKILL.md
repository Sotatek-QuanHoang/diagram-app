---
name: drawio-diagrams
description: Use when the user asks for a diagram, chart of a process, flowchart, sequence diagram, ER/data model, or a .drawio / draw.io / diagrams.net file. Explains which input form to send to generate-diagram and how to pick shapes and cardinalities.
---

# Producing draw.io diagrams

`generate-diagram` returns a complete `.drawio` file plus a rendered preview. The
user downloads it from the tool result and opens it in draw.io, diagrams.net, or
the VS Code Draw.io extension, where every shape stays individually editable.

## Choosing the input form

Send **exactly one** of `spec` or `mermaid`.

Send `spec` as a real **object**, not a JSON string. A stringified spec is parsed
as a fallback, but then the schema cannot check it and you lose the precise
field-path errors.

Always pass `title`. Without it the diagram is drawn with no heading, and the
file is named after the diagram type instead of its subject.

- `spec` — author from scratch. Closed schema, precise errors, access to shapes
  and grouping Mermaid cannot express. Prefer this.
- `mermaid` — the user already has Mermaid source, or pasted some. It is
  converted into the same spec. Check `warnings` afterwards.

Never send coordinates. Layout, sizing, routing, and page bounds are computed
for you; a spec that tries to position things is rejected.

For a line break inside a label, use a real newline in the JSON string (`\n`)
or `<br>` in Mermaid.

## Picking a diagram type

- `flowchart` — a process, decision tree, pipeline, or state progression.
- `sequence` — ordered interaction between services or people over time.
- `erd` — data model: tables, attributes, and their multiplicities.

If the user's request spans two of these, produce two diagrams rather than
forcing one.

## Flowcharts

Set `direction` to `TB` for approval and decision flows, `LR` for pipelines.

Shapes: `start` and `end` are the green/red terminators; `process` is an ordinary
step; `decision` is the diamond; `io` is input/output; `database` is a store;
`subprocess` is a call into another flow; `document` and `manual` and `note` are
the remaining stationery.

Label every edge leaving a `decision` — an unlabelled diamond is unreadable.

### AWS diagrams

For anything on AWS, set `icon` on the node instead of leaning on `shape`. It
draws the official AWS service icon in its category colour with the label
underneath — in the inline preview and in the downloaded file alike. That is the
look people expect from an architecture diagram, and far clearer than a grid of
identical boxes.

```json
{ "id": "api", "label": "Orders API", "icon": "api-gateway" }
{ "id": "fn",  "label": "Order handler", "icon": "lambda" }
{ "id": "db",  "label": "Orders table", "icon": "dynamodb" }
```

Keep `label` about the node's *role* in this system ("Order handler"), not the
service name — the icon already says "Lambda". `shape` is ignored when `icon`
is set. The full key list is the `icon` enum in the tool's input schema; it
covers compute, storage, database, networking, security, integration, analytics,
ML, management, developer tools, and client/user figures.

`icon` is only available on the structured `spec`; Mermaid has no syntax for it,
so author AWS diagrams as a spec.

Use `groups` for phases, layers, or owning systems. A group is drawn as a frame
around exactly its members. When two frames would otherwise overlap, each group
is given its own band of the canvas — correct, but wider — so keep membership
meaningful rather than decorative, and prefer a few broad groups over many
narrow ones.

Cycles are fine. Edges that close a loop are detected and routed as return paths
down the side.

## Sequence diagrams

Order `participants` left to right to minimise crossing messages: initiator
first, then the services it calls in the order it calls them. Use
`kind: "actor"` for humans.

Model call and return honestly. A request is `line: "solid"`; its reply is
`line: "dashed"`. Set `activate: true` on the request and `deactivate: true` on
the reply so the activation bar spans the work.

`from` equal to `to` draws a self-call loop.

Block frames (`loop`, `alt`, `opt`, `par`) are not drawn. Mermaid input using
them is flattened — the messages survive in order and a warning says so. If the
branching matters, either say so in the reply or use a flowchart instead.

## ER diagrams

Give every entity its `fields`, each with a `type` and, where it applies, a
`key` of `PK`, `FK`, or `UK`. An ER diagram with no attributes is rarely worth
generating.

Cardinality is read at the end it is attached to. For "a customer places many
orders, each order belongs to one customer":

```json
{ "from": "CUSTOMER", "to": "ORDER", "fromCardinality": "one",
  "toCardinality": "zero-or-many", "label": "places" }
```

Use `zero-or-many` unless the relationship really requires at least one, in
which case use `one-or-many`. Set `identifying: false` for a weak relationship;
it draws dashed.

## After the call

- `summary`, `stats`, and `kind` come back to you. The diagram renders inline
  with its own **Download .drawio** and **Copy XML** buttons.
- The file itself is deliberately not in your result. It is assembled in the
  rendered card. Do not try to save it, write it to storage, or mint a download
  link — the reader already has one, and a second copy only confuses them. Say
  the diagram is ready and point at the buttons on the card.
- Always read `warnings`. They list Mermaid lines that were skipped or
  approximated. Tell the user what was dropped instead of implying a clean
  conversion.
- On a `DIAGRAM_INPUT_ERROR`, the message names the exact field path. Fix that
  field and call again; do not retry the identical input.

## Where requests come from

People often start with the `/diagram` composer command, which drops a
ready-made prompt into their message. Those prompts read like ordinary requests
— treat them as such and pick the diagram type from the wording.

## Limits

200 nodes, 400 edges, 40 participants, 200 messages, 60 entities, 40 attributes
per entity, 20 000 characters of Mermaid. Past those, split the diagram — and
well before them, a diagram nobody can read is not worth generating.
