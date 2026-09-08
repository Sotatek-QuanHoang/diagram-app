import './styles.css';

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppContext, useAppFetch, type ToolResultSurfaceProps } from '@sota/platform';
import { Badge, Button, Spinner, Textarea } from '@sota/platform/ui';

import {
  describeShape,
  findDiagram,
  findToken,
  recallDiagram,
  rememberDiagram,
} from './artifact-store.js';
import { DiagramComposerPanel } from './composer-panel.js';
import { loadProvidersForScene, sceneGlyphsReady } from './cloud-glyphs/index.js';
import { sceneToSvg } from './diagram-svg.js';
import { sceneToDrawio } from './drawio.js';
import { EXAMPLES } from './examples.js';
import type { DiagramResult, GenerateInput, Scene, StudioMode } from './types.js';

/**
 * draw.io reads a diagram out of the URL fragment. Fragments are never sent in
 * the HTTP request, so the content is handed to the page in the reader's own
 * browser rather than uploaded to diagrams.net.
 *
 * Browsers do cap URL length; Firefox and Safari are the tight ones, so keep
 * well under them and fall back to the download for anything larger.
 */
const DRAWIO_BASE = 'https://app.diagrams.net/';
const DRAWIO_MAX_URL = 50_000;

const KIND_LABELS: Record<DiagramResult['kind'], string> = {
  flowchart: 'Flowchart',
  sequence: 'Sequence',
  erd: 'ER diagram',
};

/* --------------------------------------------------------- shared pieces */

/**
 * Fetches the glyph chunks one scene needs and reports when they have landed.
 *
 * The initial value is the synchronous answer, so a diagram with no cloud icons
 * — or one whose provider is already in memory from an earlier render — settles
 * without a second pass. Only a genuine first fetch causes the extra render,
 * and until it completes the drawing shows service names rather than nothing.
 */
function useCloudGlyphs(scene: Scene): boolean {
  const [ready, setReady] = useState(() => sceneGlyphsReady(scene));

  useEffect(() => {
    if (sceneGlyphsReady(scene)) {
      setReady(true);
      return;
    }
    setReady(false);
    let live = true;
    void loadProvidersForScene(scene).then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [scene]);

  return ready;
}

/**
 * The preview is drawn from the same resolved geometry that was written into
 * the .drawio file, so it is a faithful thumbnail of the download rather than a
 * second interpretation of the spec.
 */
function DiagramPreview({ result }: { result: DiagramResult }) {
  const glyphsReady = useCloudGlyphs(result.preview);
  const svg = useMemo(
    () =>
      sceneToSvg(result.preview, {
        ariaLabel: `${KIND_LABELS[result.kind] ?? 'Diagram'}${result.title ? `: ${result.title}` : ''}`,
      }),
    // `glyphsReady` is not read by the draw: it flips once the scene's provider
    // chunks resolve, which is the signal to redraw with real icons in place of
    // the service-name fallback.
    [result.preview, result.kind, result.title, glyphsReady],
  );
  return (
    <div className="dg-canvas">
      <div className="dg-canvas-inner" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

function DiagramActions({ result }: { result: DiagramResult }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Built here rather than shipped in the tool result: the file is several
  // times the size of the geometry it comes from. Memoized so Download and
  // Copy hand out exactly the same bytes.
  const xml = useMemo(
    () => sceneToDrawio(result.preview, { pageName: result.title || result.kind }),
    [result.preview, result.title, result.kind],
  );

  const openInDrawio = useMemo(() => {
    const url = `${DRAWIO_BASE}?splash=0&title=${encodeURIComponent(result.fileName)}#R${encodeURIComponent(xml)}`;
    return url.length <= DRAWIO_MAX_URL ? url : undefined;
  }, [xml, result.fileName]);

  const download = useCallback(() => {
    const blob = new Blob([xml], { type: `${result.mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [result.fileName, result.mimeType, xml]);

  const copy = useCallback(() => {
    void navigator.clipboard
      .writeText(xml)
      .then(() => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  }, [xml]);

  return (
    <div className="dg-actions">
      {/* The file name lives in the tooltip; a long slug made the button
          dominate the whole action row. */}
      <Button size="sm" onClick={download} title={result.fileName}>
        Download
      </Button>
      {openInDrawio ? (
        <Button size="sm" variant="outline" asChild>
          <a href={openInDrawio} target="_blank" rel="noopener noreferrer">
            Open in draw.io
          </a>
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? 'Copied' : 'Copy XML'}
      </Button>
      {openInDrawio ? null : (
        <span className="dg-hint">
          Too large to open straight from a link — download it and open the file in draw.io.
        </span>
      )}
    </div>
  );
}

function DiagramMeta({ result }: { result: DiagramResult }) {
  const { kind, stats } = result;
  const counts = !stats
    ? undefined
    : kind === 'flowchart'
      ? `${stats.nodes} nodes · ${stats.edges} edges`
      : kind === 'sequence'
        ? `${stats.nodes} participants · ${stats.edges} messages`
        : `${stats.nodes} entities · ${stats.edges} relationships`;
  return (
    <div className="dg-meta">
      <Badge variant="secondary">{KIND_LABELS[kind] ?? 'Diagram'}</Badge>
      {counts ? <span className="dg-counts">{counts}</span> : null}
    </div>
  );
}

/**
 * Core may hand the app's payload back as `result` (unwrapped) or leave it in
 * `output`. Accept either rather than showing an empty card when the transport
 * shape differs from the one seen in development.
 */
function readResult(
  toolResult: { result?: DiagramResult; output?: unknown },
): DiagramResult | undefined {
  const candidate = toolResult.result ?? (toolResult.output as DiagramResult | undefined);
  if (!candidate || typeof candidate !== 'object') return undefined;
  return typeof candidate.kind === 'string' ? candidate : undefined;
}

/**
 * Keeps a surface alive when part of it throws.
 *
 * A native surface that throws during render is replaced by the host's raw JSON
 * view of the tool result — no title, no download, just the payload. That is
 * strictly worse than a reduced card, so every surface is wrapped and every
 * piece that can throw is isolated behind its own boundary.
 */
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Header, preview, actions and warnings — identical wherever a diagram shows. */
function DiagramBody({ result }: { result: DiagramResult }) {
  const hasPreview = Boolean(result.preview?.shapes?.length);
  return (
    <>
      <header className="dg-header">
        <h3>{result.title || KIND_LABELS[result.kind] || 'Diagram'}</h3>
        <DiagramMeta result={result} />
      </header>
      {hasPreview ? (
        <Boundary fallback={<p className="dg-muted">Preview unavailable.</p>}>
          <DiagramPreview result={result} />
        </Boundary>
      ) : null}
      {!hasPreview && result.summary ? <p className="dg-muted">{result.summary}</p> : null}
      {hasPreview ? (
        <Boundary fallback={null}>
          <DiagramActions result={result} />
        </Boundary>
      ) : null}
      <Warnings warnings={result.warnings ?? []} />
    </>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <details className="dg-warnings">
      <summary>
        {warnings.length} warning{warnings.length === 1 ? '' : 's'}
      </summary>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </details>
  );
}

function ErrorNote({ title, message, details }: { title: string; message: string; details?: string[] }) {
  return (
    <div className="dg-error" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      {details && details.length > 0 ? (
        <ul>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ tool result */

/**
 * The tool-result surface.
 *
 * Wrapped so that a throw anywhere inside still leaves a readable card. The
 * fallback deliberately repeats the download: losing the picture is tolerable,
 * losing the file is not.
 */
export function DiagramToolResult(props: ToolResultSurfaceProps<GenerateInput, DiagramResult>) {
  const result = readResult(props.toolResult);
  return (
    <Boundary fallback={<MinimalCard result={result} />}>
      <ToolResultCard {...props} />
    </Boundary>
  );
}

/** Last resort: title and the file, with no preview to go wrong. */
function MinimalCard({ result }: { result: DiagramResult | undefined }) {
  return (
    <section className="dg-root dg-card" data-sota-app="diagram-app">
      <header className="dg-header">
        <h3>{result?.title || 'Diagram'}</h3>
      </header>
      {result?.summary ? <p className="dg-muted">{result.summary}</p> : null}
      {result?.preview?.shapes?.length ? (
        <Boundary fallback={<p className="dg-muted">This diagram could not be rendered.</p>}>
          <DiagramActions result={result} />
        </Boundary>
      ) : (
        <p className="dg-muted">This diagram could not be rendered.</p>
      )}
    </section>
  );
}

function ToolResultCard({
  toolResult,
}: ToolResultSurfaceProps<GenerateInput, DiagramResult>) {
  const { state } = toolResult;
  // Read and subscribe before any branch: hooks cannot sit behind an early
  // return, and the panel guard must see the pending states too.
  const result = readResult(toolResult);

  if (state === 'input-streaming' || state === 'input-available') {
    // Mounted while the model is still writing its arguments, so every field
    // here may be absent or half-formed.
    const partial = toolResult.input as Partial<GenerateInput> | undefined;
    const kind =
      typeof partial?.spec === 'object' && partial.spec !== null
        ? (partial.spec as { type?: string }).type
        : partial?.mermaid
          ? 'from mermaid'
          : undefined;
    return (
      <section className="dg-root dg-card dg-pending" data-sota-app="diagram-app">
        <Spinner />
        <span>
          {state === 'input-streaming' ? 'Composing diagram' : 'Generating diagram'}
          {partial?.title ? `: ${partial.title}` : kind ? ` (${kind})` : ''}…
        </span>
      </section>
    );
  }

  if (state === 'output-error') {
    return (
      <section className="dg-root dg-card" data-sota-app="diagram-app">
        <ErrorNote
          title="Diagram generation failed"
          message={toolResult.errorText ?? 'The tool returned an error.'}
        />
      </section>
    );
  }

  if (!result) {
    // Older stored results, or a payload the renderer does not understand:
    // degrade rather than throw — the plain tool result is still readable.
    return (
      <section className="dg-root dg-card" data-sota-app="diagram-app">
        <p className="dg-muted">No diagram in this result.</p>
      </section>
    );
  }

  return (
    <section className="dg-root dg-card" data-sota-app="diagram-app">
      <DiagramBody result={result} />
      {/* `useAppContext` is the one host dependency in this surface. Isolated so
          that if it is unavailable on a remount, the card — and its download —
          survive rather than the whole surface throwing. */}
      <Boundary fallback={null}>
        <PanelButton result={result} toolCallId={toolResult.toolCallId} state={state} />
      </Boundary>
    </section>
  );
}

/** Opens the panel automatically, and offers the same as a button. */
function PanelButton({
  result,
  toolCallId,
  state,
}: {
  result: DiagramResult;
  toolCallId: string;
  state: string;
}) {
  const openInPanel = useOpenInPanel(state, toolCallId, result);
  return (
    <div className="dg-actions">
      <Button size="sm" variant="outline" onClick={openInPanel}>
        Open in side panel
      </Button>
    </div>
  );
}

/** Tool calls that already opened the panel, so a remount cannot reopen one. */
const opened = new Set<string>();

/**
 * Opens the side panel when a diagram finishes, and returns a manual opener.
 *
 * This has to be called from the surface that stays mounted across every state:
 * a component rendered only once the result exists can never observe the
 * transition into it, and would either never fire or fire on every scroll-back.
 *
 * The panel opens only when this mount *watched* the state change. History
 * mounts straight into `output-available`, and hijacking the panel for a diagram
 * someone scrolled past would be obnoxious.
 */
function useOpenInPanel(
  state: string,
  toolCallId: string,
  result: DiagramResult | undefined,
): () => void {
  const { ui } = useAppContext();
  const previous = useRef<string | undefined>(undefined);
  const latest = useRef(result);
  latest.current = result;

  const open = useCallback(() => {
    const result = latest.current;
    if (!result) return;
    // Handed over twice: through the context, and through the shared module in
    // case the context does not reach the surface.
    const token = rememberDiagram(result, toolCallId);
    ui.openArtifact(ARTIFACT_KIND, { token, result } as unknown as Record<string, unknown>);
  }, [ui, toolCallId]);

  // Remember on sight. The panel can then be opened from this card at any time,
  // including after the host has navigated away and remounted the bundle.
  useEffect(() => {
    if (result) rememberDiagram(result, toolCallId);
  }, [result, toolCallId]);

  useEffect(() => {
    const watchedItFinish = previous.current !== undefined && previous.current !== state;
    previous.current = state;
    if (state !== 'output-available' || !watchedItFinish || !result) return;
    if (opened.has(toolCallId)) return;
    opened.add(toolCallId);
    open();
  }, [state, toolCallId, result, open]);

  return open;
}

/* --------------------------------------------------------------- artifact */

const ARTIFACT_KIND = 'diagram';

/**
 * The side-panel view.
 *
 * The host's prop shape for an artifact surface is not pinned by the published
 * contract, so the diagram is looked for in three ways before giving up: by the
 * token the opener passed, anywhere inside the props, and finally from the
 * module the opener shares with this surface.
 */
export function DiagramArtifact(props: unknown) {
  return (
    <Boundary fallback={<MinimalCard result={recallDiagram(findToken(props))} />}>
      <ArtifactPanel {...(props as object)} />
    </Boundary>
  );
}

function ArtifactPanel(props: unknown) {
  const result = findDiagram(props) ?? recallDiagram(findToken(props));

  if (!result) {
    return (
      <section className="dg-root dg-panel" data-sota-app="diagram-app">
        <p className="dg-muted">No diagram to show. Generate one, or reopen it from its card.</p>
        <details className="dg-warnings">
          <summary>Surface details</summary>
          <pre>{describeShape(props)}</pre>
        </details>
      </section>
    );
  }

  return (
    <section className="dg-root dg-panel" data-sota-app="diagram-app">
      <DiagramBody result={result} />
    </section>
  );
}

/* ----------------------------------------------------------------- studio */

interface StudioError {
  message: string;
  details?: string[];
}

export function DiagramStudio() {
  const appFetch = useAppFetch();
  const [mode, setMode] = useState<StudioMode>('mermaid');
  const [source, setSource] = useState(EXAMPLES[0].source);
  const [result, setResult] = useState<DiagramResult | undefined>(undefined);
  const [error, setError] = useState<StudioError | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  const generate = useCallback(async () => {
    const ticket = ++request.current;
    setBusy(true);
    setError(undefined);

    let payload: GenerateInput;
    if (mode === 'mermaid') {
      payload = { mermaid: source };
    } else {
      try {
        payload = { spec: JSON.parse(source) as GenerateInput['spec'] };
      } catch (parseError) {
        if (ticket === request.current) {
          setError({ message: `That is not valid JSON: ${String(parseError)}` });
          setBusy(false);
        }
        return;
      }
    }

    try {
      const response = await appFetch('/api/diagrams/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as DiagramResult & StudioError;
      // A stale request must not overwrite a newer result.
      if (ticket !== request.current) return;
      if (!response.ok) {
        setError({ message: body.message ?? `HTTP ${response.status}`, details: body.details });
        return;
      }
      setResult(body);
    } catch (fetchError) {
      if (ticket === request.current) setError({ message: String(fetchError) });
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  }, [appFetch, mode, source]);

  const loadExample = useCallback((index: number) => {
    const example = EXAMPLES[index];
    setMode(example.mode);
    setSource(example.source);
    setError(undefined);
  }, []);

  return (
    <main className="dg-root dg-page" data-sota-app="diagram-app">
      <header className="dg-page-header">
        <h1>Diagram studio</h1>
        <p className="dg-muted">
          Draft a flowchart, sequence diagram, or ER diagram and download it as an editable
          .drawio file. This is the same generator the <code>generate-diagram</code> tool uses.
        </p>
      </header>

      <div className="dg-columns">
        <section className="dg-editor" aria-label="Diagram source">
          <div className="dg-modes" role="tablist" aria-label="Input format">
            {(['mermaid', 'spec'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                className={mode === value ? 'dg-mode dg-mode-on' : 'dg-mode'}
                onClick={() => setMode(value)}
              >
                {value === 'mermaid' ? 'Mermaid' : 'Spec (JSON)'}
              </button>
            ))}
          </div>

          <Textarea
            className="dg-source"
            value={source}
            spellCheck={false}
            aria-label={mode === 'mermaid' ? 'Mermaid source' : 'Diagram spec JSON'}
            onChange={(event) => setSource(event.target.value)}
          />

          <div className="dg-editor-actions">
            <Button onClick={() => void generate()} disabled={busy || source.trim() === ''}>
              {busy ? 'Generating…' : 'Generate'}
            </Button>
            <div className="dg-examples">
              <span className="dg-muted">Examples:</span>
              {EXAMPLES.map((example, index) => (
                <button
                  key={example.label}
                  type="button"
                  className="dg-link"
                  onClick={() => loadExample(index)}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="dg-output" aria-label="Diagram preview" aria-busy={busy}>
          {error ? (
            <ErrorNote title="Could not generate the diagram" message={error.message} details={error.details} />
          ) : null}
          {result ? (
            <>
              <DiagramBody result={result} />
            </>
          ) : error ? null : (
            <p className="dg-muted dg-placeholder">
              Write a diagram on the left, then choose Generate.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export { DiagramComposerPanel };

export const surfaces = {
  DiagramStudio,
  DiagramToolResult,
  DiagramComposerPanel,
  DiagramArtifact,
};
