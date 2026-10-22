import { createServer as createHttpServer, type Server } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { runWithCredentials } from './client.js';
import { logger } from './utils/logger.js';
import { MAX_REQUEST_BODY_BYTES } from './input-limits.js';
import { verifyS2sHeader, S2S_HEADER } from './s2s-verify.js';

/**
 * Public example values. A copied placeholder must not verify as a real
 * secret. Rejected even when MCP_ALLOW_INSECURE_DEV=1 is set, so a pasted
 * example cannot forge X-Gateway-S2S.
 */
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'replace-with-a-real-secret',
  'your-s2s-secret',
  'your-secret',
  'changeme',
  'change-me',
  'placeholder',
  'secret',
  'example',
  'replace-me',
  's2s-secret',
]);

const LOOPBACK_HOST = '127.0.0.1';

const MISSING_S2S_SECRET_ERROR =
  'Refusing to start HTTP transport: CONDUIT_S2S_SECRET is empty. ' +
  'An empty secret would accept unauthenticated /mcp requests (CWE-306). ' +
  'Set CONDUIT_S2S_SECRET to the gateway-provisioned service-to-service secret, ' +
  'or set MCP_ALLOW_INSECURE_DEV=1 to bypass this check for local development only.';

const PLACEHOLDER_S2S_SECRET_ERROR =
  'Refusing to start HTTP transport: CONDUIT_S2S_SECRET is a known placeholder. ' +
  'Generate a secret with `openssl rand -hex 32` and set CONDUIT_S2S_SECRET to that value.';

const INSECURE_DEV_WARNING =
  'SECURITY WARNING: MCP_ALLOW_INSECURE_DEV=1 is set and CONDUIT_S2S_SECRET is empty. ' +
  'The HTTP server is starting WITHOUT service-to-service authentication and listens on 127.0.0.1 only. ' +
  'Do not use MCP_ALLOW_INSECURE_DEV outside local development.';

const S2S_UNAUTHORIZED = {
  error:
    'Missing or invalid X-Gateway-S2S header: this endpoint only accepts requests signed by the gateway.',
};

const GATEWAY_CREDENTIALS_UNAUTHORIZED = {
  error: 'Unauthorized: missing required gateway credential header X-RoboShadow-Refresh-Token',
};

function headerValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isKnownPlaceholderSecret(secret: string): boolean {
  return secret.length > 0 && KNOWN_PLACEHOLDER_SECRETS.has(secret.toLowerCase());
}

/**
 * Fail closed: an empty CONDUIT_S2S_SECRET used to skip X-Gateway-S2S checks.
 * Refuse to listen unless the operator explicitly opts into insecure local dev.
 * A known placeholder always refuses, even with that flag. The secret value
 * is never written to logs. Read at startup, not at module load.
 */
function resolveS2sSecret(): string {
  const secret = (process.env.CONDUIT_S2S_SECRET ?? '').trim();
  if (isKnownPlaceholderSecret(secret)) {
    logger.error(PLACEHOLDER_S2S_SECRET_ERROR);
    process.exit(1);
  }
  if (secret) return secret;
  if (process.env.MCP_ALLOW_INSECURE_DEV === '1') {
    // error level so LOG_LEVEL=warn|error cannot hide the bypass.
    logger.error(INSECURE_DEV_WARNING);
    return '';
  }
  logger.error(MISSING_S2S_SECRET_ERROR);
  process.exit(1);
}

/**
 * No secret (the insecure-dev bypass) always binds 127.0.0.1. A wider
 * MCP_HTTP_HOST, including the image default 0.0.0.0, is ignored. A
 * configured secret honors MCP_HTTP_HOST. When that variable is unset, bind
 * 127.0.0.1.
 */
function resolveListenHost(s2sSecret: string): string {
  const configured = (process.env.MCP_HTTP_HOST ?? '').trim();
  if (!s2sSecret) {
    if (configured && configured !== LOOPBACK_HOST) {
      logger.error(
        `WARNING: MCP_HTTP_HOST=${configured} is not ${LOOPBACK_HOST}. ` +
          'MCP_ALLOW_INSECURE_DEV=1 without CONDUIT_S2S_SECRET binds 127.0.0.1 only.',
      );
    }
    return LOOPBACK_HOST;
  }
  return configured || LOOPBACK_HOST;
}

export async function startHttpTransport(): Promise<Server> {
  const s2sSecret = resolveS2sSecret();
  const port = parseInt(process.env.MCP_HTTP_PORT || '8080', 10);
  const host = resolveListenHost(s2sSecret);
  const isGatewayMode = process.env.AUTH_MODE === 'gateway';

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // /health is container LIVENESS, not credential-readiness. In gateway
    // mode, credentials arrive per-request via X-RoboShadow-Refresh-Token,
    // not at startup. Always 200, no auth, and this handler must not read
    // vendor credentials.
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          transport: 'http',
          mode: isGatewayMode ? 'gateway' : 'standalone',
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', endpoints: ['/mcp', '/health'] }));
      return;
    }

    // Empty s2sSecret is only reachable when MCP_ALLOW_INSECURE_DEV=1; startup
    // refuses otherwise. A configured secret is always enforced, before any
    // credential extraction.
    if (s2sSecret && !verifyS2sHeader(headerValue(req.headers[S2S_HEADER]), s2sSecret)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(S2S_UNAUTHORIZED));
      return;
    }

    // Body cap runs only after S2S passes so unauthenticated callers still get 401.
    const contentLength = Number(headerValue(req.headers['content-length']));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32600, message: `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes` },
          id: null,
        }),
      );
      return;
    }

    const handle = async () => {
      // SECURITY-CRITICAL invariant: this transport MUST stay stateless
      // (sessionIdGenerator: undefined + enableJsonResponse: true).
      // Per-request tenant credentials are carried in an AsyncLocalStorage
      // context opened by runWithCredentials() below. A stateless
      // request->single-response flow keeps the tool call inside that
      // context - switching to a stateful/SSE transport would let a
      // long-lived connection serve later messages under a stale/foreign
      // credential context.
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
        maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
      });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    };

    if (isGatewayMode) {
      // Credentials must arrive on every request. Falling through would
      // resolve ROBOSHADOW_REFRESH_TOKEN from the process environment, which
      // is not request-scoped (CWE-306).
      const refreshToken = headerValue(req.headers['x-roboshadow-refresh-token'])?.trim();
      if (!refreshToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(GATEWAY_CREDENTIALS_UNAUTHORIZED));
        return;
      }
      await runWithCredentials({ refreshToken }, handle);
      return;
    }

    await handle();
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      logger.info(`HTTP streaming server listening on ${host}:${port}`);
      resolve();
    });
  });

  return httpServer;
}

// Vitest imports this module to call startHttpTransport. Skip the CLI
// entrypoint there. `node dist/http.js` still starts HTTP or falls through
// to stdio, matching the previous entry behavior.
if (process.env.VITEST !== 'true') {
  const transport = process.env.MCP_TRANSPORT;
  if (transport === 'http') {
    startHttpTransport().catch((error) => {
      logger.error('Fatal startup error', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
  } else {
    import('./index.js');
  }
}
