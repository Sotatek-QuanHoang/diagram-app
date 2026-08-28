import './styles.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppFetch, type ToolResultSurfaceProps } from '@sota/platform';
import { Badge, Button, Spinner, Textarea } from '@sota/platform/ui';

import { DiagramComposerPanel } from './composer-panel.js';
import { sceneToSvg } from './diagram-svg.js';
import { sceneToDrawio } from './drawio.js';
import { EXAMPLES } from './examples.js';
import type { DiagramResult, GenerateInput, StudioMode } from './types.js';

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
 * The preview is drawn from the same resolved geometry that was written into
 * the .drawio file, so it is a faithful thumbnail of the download rather than a
 * second interpretation of the spec.
 */
function DiagramPreview({ result }: { result: DiagramResult }) {
  const svg = useMemo(
    () =>
      sceneToSvg(result.preview, {
        ariaLabel: `${KIND_LABELS[result.kind] ?? 'Diagram'}${result.title ? `: ${result.title}` : ''}`,
      }),
    [result.preview, result.kind, result.title],
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

export function DiagramToolResult({
  toolResult,
}: ToolResultSurfaceProps<GenerateInput, DiagramResult>) {
  const { state } = toolResult;

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

  const result = readResult(toolResult);
  if (!result) {
    // Older stored results, or a payload the renderer does not understand:
    // degrade rather than throw — the plain tool result is still readable.
    return (
      <section className="dg-root dg-card" data-sota-app="diagram-app">
        <p className="dg-muted">No diagram in this result.</p>
      </section>
    );
  }

  // The preview and the file are shown independently: if one of them did not
  // survive the round trip, the other is still worth having.
  const hasPreview = Boolean(result.preview?.shapes?.length);

  return (
    <section className="dg-root dg-card" data-sota-app="diagram-app">
      <header className="dg-header">
        <h3>{result.title || KIND_LABELS[result.kind] || 'Diagram'}</h3>
        <DiagramMeta result={result} />
      </header>
      {hasPreview ? <DiagramPreview result={result} /> : null}
      {!hasPreview && result.summary ? <p className="dg-muted">{result.summary}</p> : null}
      {hasPreview ? <DiagramActions result={result} /> : null}
      <Warnings warnings={result.warnings ?? []} />
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
              <header className="dg-header">
                <h3>{result.title || KIND_LABELS[result.kind] || 'Diagram'}</h3>
                <DiagramMeta result={result} />
              </header>
              <DiagramPreview result={result} />
              <DiagramActions result={result} />
              <Warnings warnings={result.warnings ?? []} />
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

export const surfaces = { DiagramStudio, DiagramToolResult, DiagramComposerPanel };
