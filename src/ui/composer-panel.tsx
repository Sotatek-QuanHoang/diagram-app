/**
 * The `/diagram` composer panel.
 *
 * Quick access to a diagram without leaving the message box: type `/diagram`,
 * pick a starting point, and the token is swapped for a prompt that is ready to
 * send. The slash command is `insert-only`, so nothing is dispatched until the
 * person actually sends — the panel only edits their draft.
 *
 * Core supplies placement and keyboard arbitration but no chrome, so every
 * visible style here belongs to the app.
 */

import './styles.css';

import { useCallback } from 'react';
import { useComposer, type ComposerContentNode } from '@sota/core/hooks';

/** Matches the slash token anywhere in the draft, with its leading space. */
const TOKEN = /(^|\s)\/diagram\b/i;

interface Starter {
  label: string;
  /** Replaces the token. Trailing space means "keep typing here". */
  prompt: string;
}

/** Complete prompts — one click and the message is ready to send. */
const SYSTEMS: Starter[] = [
  {
    label: 'AWS serverless',
    prompt:
      'Draw an AWS serverless architecture diagram using AWS icons: client, ' +
      'CloudFront, API Gateway, a Lambda handler, DynamoDB, SQS and an async ' +
      'Lambda worker, plus CloudWatch. Group the nodes by layer.',
  },
  {
    label: 'Web app + database',
    prompt:
      'Draw an architecture diagram of a web application: browser, load ' +
      'balancer, application servers, primary database with a read replica, ' +
      'and a cache. Group by tier.',
  },
  {
    label: 'Microservices',
    prompt:
      'Draw an architecture diagram of a microservice system: API gateway, ' +
      'three services each with its own datastore, a message broker between ' +
      'them, and shared observability.',
  },
  {
    label: 'Login flow',
    prompt:
      'Draw a sequence diagram of an OAuth login: user, web app, identity ' +
      'provider, and the app backend, showing the redirect, the code exchange, ' +
      'and the session cookie being set.',
  },
  {
    label: 'CI/CD pipeline',
    prompt:
      'Draw a flowchart of a CI/CD pipeline from commit through build, test, ' +
      'and staging to production, including the rollback path on failure.',
  },
  {
    label: 'Data model',
    prompt:
      'Draw an ER diagram of the data model behind this system, with each ' +
      'entity’s key attributes and the relationships between them.',
  },
];

/** Openers to finish in your own words. */
const KINDS: Starter[] = [
  { label: 'Flowchart', prompt: 'Draw a flowchart of ' },
  { label: 'Sequence', prompt: 'Draw a sequence diagram of ' },
  { label: 'ER diagram', prompt: 'Draw an ER diagram of ' },
];

export function DiagramComposerPanel() {
  const value = useComposer((composer) => composer.value);
  const content = useComposer((composer) => composer.content);
  const applyEdit = useComposer((composer) => composer.applyEdit);
  const focus = useComposer((composer) => composer.focus);

  const choose = useCallback(
    (prompt: string) => {
      // Rebuild from the structured content, not `value`: flattening it would
      // turn any app references already in the draft into plain text.
      const kept: ComposerContentNode[] = [];
      for (const node of content) {
        if (node.kind !== 'text') {
          kept.push(node);
          continue;
        }
        const text = node.text.replace(TOKEN, '$1');
        if (text.trim() !== '') kept.push({ kind: 'text', text });
      }
      // Separate the prompt from whatever survives. A trailing app reference
      // carries no text of its own, so it always needs the space.
      const last = kept[kept.length - 1];
      const needsSpace =
        last !== undefined && (last.kind !== 'text' || !/\s$/.test(last.text));

      applyEdit({
        mode: 'replace',
        content: [...kept, { kind: 'text', text: `${needsSpace ? ' ' : ''}${prompt}` }],
      });
      focus();
    },
    [applyEdit, content, focus],
  );

  // Absent unless the draft is actually asking for a diagram. Core does not
  // count a panel that returns null, so this leaves no empty switcher behind.
  if (!TOKEN.test(value)) return null;

  return (
    <section className="dg-root dg-composer" data-sota-app="my-app" aria-label="Diagram starters">
      <div className="dg-composer-group">
        <span className="dg-composer-heading">A system</span>
        <div className="dg-composer-chips">
          {SYSTEMS.map((starter) => (
            <button
              key={starter.label}
              type="button"
              className="dg-chip"
              onClick={() => choose(starter.prompt)}
            >
              {starter.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dg-composer-group">
        <span className="dg-composer-heading">Or start one</span>
        <div className="dg-composer-chips">
          {KINDS.map((starter) => (
            <button
              key={starter.label}
              type="button"
              className="dg-chip dg-chip-quiet"
              onClick={() => choose(starter.prompt)}
            >
              {starter.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
