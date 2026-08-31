import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { coreOrigin, requireSotaInvocation } from './sota-auth.js';
import { registerToolRoutes } from './tool-routes.js';

const appId = 'diagram-app';
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => {
  const startedAt = performance.now();
  const requestId = request.header('x-request-id') ?? randomUUID();
  response.setHeader('x-request-id', requestId);
  response.on('finish', () => log('info', 'http_request', {
    requestId,
    method: request.method,
    path: request.originalUrl,
    status: response.statusCode,
    durationMs: Math.round(performance.now() - startedAt),
  }));
  next();
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', appId });
});

app.get('/api/hello', requireSotaInvocation(appId, 'app:http'), (_request, response) => {
  const claims = response.locals.sota;
  response.json({
    message: 'Frontend and backend are connected.',
    appId,
    context: {
      organizationId: claims.oid,
      workspaceId: claims.wid,
      userId: claims.sub,
    },
  });
});

registerToolRoutes(app, appId);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  log('error', 'request_failed', {
    message: error instanceof Error ? error.message : String(error),
  });
  response.status(500).json({ code: 'APP_ERROR', message: 'Request failed' });
});

/**
 * Local development pins the port so the process and the manifest's
 * `environments.local` overlay cannot drift — `sota dev` tunnels 8787, and a
 * mismatch fails in a confusing way. A hosted environment assigns its own port,
 * so the pin applies only outside production.
 */
const LOCAL_PORT = 8787;
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? LOCAL_PORT);
// Containers reach the process through the published port, so production has to
// bind every interface; locally, loopback keeps it off the network.
const host = production ? '0.0.0.0' : 'localhost';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  log('error', 'server_failed', { appId, message: 'PORT must be an integer from 1 to 65535' });
  process.exitCode = 1;
} else if (!production && port !== LOCAL_PORT) {
  log('error', 'server_failed', {
    appId,
    message:
      `PORT must match the manifest local service port ${LOCAL_PORT}, ` +
      'or set NODE_ENV=production when hosting.',
  });
  process.exitCode = 1;
} else {
  const server = app.listen(port, host);
  server.once('listening', () => {
    // The resolved Core origin is logged because a wrong one fails every
    // invocation with an opaque 401 — the JWKS simply will not match.
    log('info', 'server_started', {
      appId,
      host,
      port,
      production,
      coreOrigin: coreOrigin.origin,
    });
  });
  server.once('error', (error: NodeJS.ErrnoException) => {
    log('error', 'server_failed', {
      appId,
      code: error.code,
      message: error.message,
      url: `http://localhost:${port}`,
    });
    process.exitCode = 1;
  });
}

function log(level: 'info' | 'error', event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...details }));
}
