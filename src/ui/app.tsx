import './styles.css';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppFetch, type ToolResultSurfaceProps } from '@sota/platform';

export function AdminScreen() {
  const appFetch = useAppFetch();
  const [message, setMessage] = useState('Connecting to backend…');
  useEffect(() => {
    appFetch('/api/hello')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((result) => setMessage(String(result.message)))
      .catch((error) => setMessage(`Backend error: ${String(error)}`));
  }, [appFetch]);
  return (
    <main className="starter-root starter-page" data-sota-app="my-app">
      <p className="starter-eyebrow">SotaAgent app</p>
      <h1>Admin screen</h1>
      <p className="starter-status">{message}</p>
      <p>Edit <code>src/ui/app.tsx</code>; Vite rebuilds into <code>dist/ui</code>.</p>
    </main>
  );
}

export function ExampleToolResult({
  toolResult,
}: ToolResultSurfaceProps<{ message?: string }, unknown>) {
  const beforeOutput =
    toolResult.state === 'input-streaming' ||
    toolResult.state === 'input-available';
  const value = beforeOutput
    ? toolResult.input
    : toolResult.result ?? toolResult.output ?? toolResult.errorText;
  return (
    <section className="starter-root starter-result" data-sota-app="my-app">
      <strong>
        {toolResult.toolName}{' '}
        {toolResult.state === 'input-streaming'
          ? 'input is streaming'
          : toolResult.state === 'input-available'
            ? 'is running'
            : 'result'}
      </strong>
      <pre>{pretty(value)}</pre>
    </section>
  );
}

function pretty(value: unknown): ReactNode {
  if (value === undefined) return 'Waiting for the model…';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); }
  catch { return String(value); }
}

export const surfaces = { AdminScreen, ExampleToolResult };
