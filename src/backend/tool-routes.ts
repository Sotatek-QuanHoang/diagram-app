import type { Express, Response } from 'express';
import { DiagramInputError } from './diagram/types.js';
import { generateDiagram, type GenerateResult } from './diagram/generate.js';
import { requireSotaInvocation } from './sota-auth.js';

/**
 * The tool and the admin studio share one generator. The only difference is the
 * scope each route demands and the projection applied to the response.
 */
export function registerToolRoutes(app: Express, appId: string): void {
  app.post(
    '/tools/generate-diagram',
    requireSotaInvocation(appId, 'tool:generate-diagram'),
    (request, response) => {
      respond(response, () => projectForModel(generateDiagram(readInput(request.body))));
    },
  );

  // Backs the Diagram studio page; same work, no model projection needed.
  app.post(
    '/api/diagrams/generate',
    requireSotaInvocation(appId, 'app:http'),
    (request, response) => {
      respond(response, () => generateDiagram(readInput(request.body)));
    },
  );
}

/**
 * Core wraps tool arguments in a transport envelope; the studio posts the input
 * directly. Accept either without letting an envelope key leak into the spec.
 */
function readInput(body: unknown): Record<string, unknown> {
  const outer = isRecord(body) ? body : {};
  const inner = isRecord(outer.body) ? outer.body : outer;
  const input = isRecord(inner.input) ? inner.input : inner;
  return input;
}

function respond(response: Response, work: () => unknown): void {
  try {
    response.json(work());
  } catch (error) {
    if (error instanceof DiagramInputError) {
      // The caller can fix this, so say exactly what was wrong.
      response.status(400).json({
        code: 'DIAGRAM_INPUT_ERROR',
        message: error.message,
        details: error.details,
      });
      return;
    }
    throw error;
  }
}

/**
 * Keep the model's context to the conclusion while the renderer keeps the
 * geometry it draws from.
 *
 * `modelOutput` supplies a separate, compact result for the model rather than
 * subtracting keys from the shared one. It matters for more than token cost:
 * when the model can see the diagram's raw content it tries to be helpful and
 * save it somewhere, even though the rendered result already offers a download.
 */
function projectForModel(result: GenerateResult) {
  const { preview: _preview, ...compact } = result;
  return {
    ...result,
    _sota: { modelOutput: compact },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
