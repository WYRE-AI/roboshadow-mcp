/**
 * HTTP transport fails closed (CWE-306).
 *
 * Startup refuses to listen when CONDUIT_S2S_SECRET is empty or a known
 * placeholder, unless MCP_ALLOW_INSECURE_DEV=1 (empty secret only). That
 * bypass binds 127.0.0.1 only. Gateway-mode /mcp requests without
 * X-RoboShadow-Refresh-Token are 401 and must not use ROBOSHADOW_REFRESH_TOKEN.
 */
import { createHmac } from 'node:crypto';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startHttpTransport } from '../http.js';
import { bearerTokenResponse, jsonResponse } from './test-helpers.js';

const S2S_SECRET = 'test-s2s-secret-do-not-log';
const ENV_REFRESH_TOKEN = 'env-refresh-token-must-not-be-used';
const HEADER_REFRESH_TOKEN = 'header-refresh-token-from-gateway';

const ENV_KEYS = [
  'CONDUIT_S2S_SECRET',
  'MCP_ALLOW_INSECURE_DEV',
  'MCP_HTTP_PORT',
  'MCP_HTTP_HOST',
  'AUTH_MODE',
  'ROBOSHADOW_REFRESH_TOKEN',
  'LOG_LEVEL',
  'MCP_TRANSPORT',
] as const;

const savedEnv = new Map<string, string | undefined>();
const servers: Server[] = [];

function mintS2sHeader(secret: string, unixSeconds = Math.floor(Date.now() / 1000)): string {
  const message = `t=${unixSeconds}`;
  const hex = createHmac('sha256', secret).update(message).digest('hex');
  return `${message},v1=${hex}`;
}

function captureStderr(): { text: () => string; restore: () => void } {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
  });
  return {
    text: () => lines.join('\n'),
    restore: () => spy.mockRestore(),
  };
}

function exitSpy() {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${String(code)}`);
  }) as typeof process.exit);
}

function mcpHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...extra,
  };
}

function sendHttp(options: {
  port: number;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port: options.port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.setTimeout(5000, () => {
      req.destroy(new Error(`timeout ${options.method} ${options.path}`));
    });
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

const listOrganisationsCall = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'roboshadow_list_organisations', arguments: {} },
});

async function listen(): Promise<{ port: number; address: string; server: Server }> {
  const server = await startHttpTransport();
  servers.push(server);
  const bound = server.address() as AddressInfo | null;
  if (!bound || typeof bound === 'string') {
    throw new Error('HTTP server did not bind a TCP port');
  }
  return { port: bound.port, address: bound.address, server };
}

async function closeAll(): Promise<void> {
  while (servers.length > 0) {
    const server = servers.pop();
    if (!server) continue;
    await new Promise<void>((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function assertNoSecrets(text: string, extra: string[] = []): void {
  expect(text).not.toContain(S2S_SECRET);
  expect(text).not.toContain(ENV_REFRESH_TOKEN);
  expect(text).not.toContain(HEADER_REFRESH_TOKEN);
  for (const value of extra) expect(text).not.toContain(value);
}

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  process.env.MCP_HTTP_PORT = '0';
  process.env.MCP_HTTP_HOST = '127.0.0.1';
  process.env.LOG_LEVEL = 'error';
  delete process.env.CONDUIT_S2S_SECRET;
  delete process.env.MCP_ALLOW_INSECURE_DEV;
  delete process.env.AUTH_MODE;
  delete process.env.ROBOSHADOW_REFRESH_TOKEN;
  delete process.env.MCP_TRANSPORT;
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await closeAll();
});

describe('HTTP startup', () => {
  it('refuses to start when CONDUIT_S2S_SECRET is empty', async () => {
    const logs = captureStderr();
    const exit = exitSpy();
    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(exit).toHaveBeenCalledWith(1);
      const text = logs.text();
      expect(text).toContain('Refusing to start HTTP transport');
      expect(text).toContain('CONDUIT_S2S_SECRET is empty');
      expect(text).toContain('CWE-306');
      expect(text).toContain('MCP_ALLOW_INSECURE_DEV=1');
      assertNoSecrets(text);
    } finally {
      exit.mockRestore();
      logs.restore();
    }
  });

  it('treats a whitespace-only secret as empty', async () => {
    process.env.CONDUIT_S2S_SECRET = '   ';
    const logs = captureStderr();
    const exit = exitSpy();
    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(logs.text()).toContain('CONDUIT_S2S_SECRET is empty');
      expect(logs.text()).not.toContain('known placeholder');
    } finally {
      exit.mockRestore();
      logs.restore();
    }
  });

  it('still refuses when MCP_ALLOW_INSECURE_DEV is not exactly 1', async () => {
    process.env.MCP_ALLOW_INSECURE_DEV = 'true';
    const logs = captureStderr();
    const exit = exitSpy();
    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(logs.text()).toContain('Refusing to start HTTP transport');
    } finally {
      exit.mockRestore();
      logs.restore();
    }
  });

  it.each(['replace-with-a-real-secret', 'changeme', 'your-s2s-secret', 'CHANGE-ME'])(
    'refuses the known placeholder %s and does not log it',
    async (placeholder) => {
      process.env.CONDUIT_S2S_SECRET = placeholder;
      const logs = captureStderr();
      const exit = exitSpy();
      try {
        await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
        expect(exit).toHaveBeenCalledWith(1);
        const text = logs.text();
        expect(text).toContain('known placeholder');
        expect(text).toContain('openssl rand -hex 32');
        expect(text).not.toContain(placeholder);
        assertNoSecrets(text);
      } finally {
        exit.mockRestore();
        logs.restore();
      }
    },
  );

  it('refuses a placeholder even when MCP_ALLOW_INSECURE_DEV=1', async () => {
    process.env.CONDUIT_S2S_SECRET = '  Your-S2S-Secret  ';
    process.env.MCP_ALLOW_INSECURE_DEV = '1';
    const logs = captureStderr();
    const exit = exitSpy();
    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(exit).toHaveBeenCalledWith(1);
      const text = logs.text();
      expect(text).toContain('known placeholder');
      expect(text).not.toContain('Your-S2S-Secret');
      expect(text).not.toContain('SECURITY WARNING');
    } finally {
      exit.mockRestore();
      logs.restore();
    }
  });

  it('allows startup with a warning when MCP_ALLOW_INSECURE_DEV=1 and binds 127.0.0.1', async () => {
    process.env.MCP_ALLOW_INSECURE_DEV = '1';
    delete process.env.MCP_HTTP_HOST;
    const logs = captureStderr();
    const exit = exitSpy();
    try {
      const server = await listen();
      expect(exit).not.toHaveBeenCalled();
      expect(server.address).toBe('127.0.0.1');
      const text = logs.text();
      expect(text).toContain('SECURITY WARNING');
      expect(text).toContain('MCP_ALLOW_INSECURE_DEV=1');
      expect(text).toContain('WITHOUT service-to-service authentication');
      expect(text).toContain('127.0.0.1');
      assertNoSecrets(text);
    } finally {
      exit.mockRestore();
      logs.restore();
    }
  });

  it.each(['0.0.0.0', 'localhost', '::1', '10.1.2.3'])(
    'forces 127.0.0.1 when the dev bypass is set and MCP_HTTP_HOST is %s',
    async (host) => {
      process.env.MCP_ALLOW_INSECURE_DEV = '1';
      process.env.MCP_HTTP_HOST = host;
      const logs = captureStderr();
      const exit = exitSpy();
      try {
        const server = await listen();
        expect(exit).not.toHaveBeenCalled();
        expect(server.address).toBe('127.0.0.1');
        const text = logs.text();
        expect(text).toContain(`MCP_HTTP_HOST=${host} is not 127.0.0.1`);
        expect(text).toContain('binds 127.0.0.1 only');
        assertNoSecrets(text);
      } finally {
        exit.mockRestore();
        logs.restore();
      }
    },
  );

  it('honors a non-loopback MCP_HTTP_HOST when CONDUIT_S2S_SECRET is set', async () => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.MCP_HTTP_HOST = '0.0.0.0';
    const logs = captureStderr();
    try {
      const server = await listen();
      expect(server.address).toBe('0.0.0.0');
      expect(logs.text()).not.toContain('is not 127.0.0.1');
      assertNoSecrets(logs.text());
    } finally {
      logs.restore();
    }
  });

  it('binds 127.0.0.1 when MCP_HTTP_HOST is unset and the secret is set', async () => {
    delete process.env.MCP_HTTP_HOST;
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    const server = await listen();
    expect(server.address).toBe('127.0.0.1');
  });

  it('honors localhost when the secret is set', async () => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.MCP_HTTP_HOST = 'localhost';
    const server = await listen();
    expect(['127.0.0.1', '::1']).toContain(server.address);
  });
});

describe('HTTP /mcp authentication', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.AUTH_MODE = 'gateway';
    process.env.ROBOSHADOW_REFRESH_TOKEN = ENV_REFRESH_TOKEN;
    process.env.MCP_HTTP_HOST = '127.0.0.1';
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      const pathname = new URL(url).pathname;
      if (pathname === '/identity/bearertoken') return bearerTokenResponse('access-from-test');
      if (pathname === '/identity/organisation') return jsonResponse([{ id: 'org-1', name: 'Acme' }]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns 401 when the S2S header is missing or invalid and does not use env credentials', async () => {
    const logs = captureStderr();
    const server = await listen();
    try {
      const missing = await sendHttp({
        port: server.port,
        method: 'POST',
        path: '/mcp',
        headers: mcpHeaders(),
        body: listOrganisationsCall,
      });
      const invalid = await sendHttp({
        port: server.port,
        method: 'POST',
        path: '/mcp',
        headers: mcpHeaders({ 'x-gateway-s2s': mintS2sHeader('wrong-secret') }),
        body: listOrganisationsCall,
      });

      expect(missing.status).toBe(401);
      expect(invalid.status).toBe(401);
      const missingBody = missing.body;
      const invalidBody = invalid.body;
      expect(missingBody).toContain('X-Gateway-S2S');
      expect(invalidBody).toContain('X-Gateway-S2S');
      assertNoSecrets(`${missingBody}\n${invalidBody}\n${logs.text()}`);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });

  it('returns 401 in gateway mode without the refresh-token header and does not use env credentials', async () => {
    const server = await listen();
    const response = await sendHttp({
      port: server.port,
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders({ 'x-gateway-s2s': mintS2sHeader(S2S_SECRET) }),
      body: listOrganisationsCall,
    });
    const body = response.body;

    expect(response.status).toBe(401);
    expect(body).toContain('missing required gateway credential header');
    expect(body).toContain('X-RoboShadow-Refresh-Token');
    assertNoSecrets(body);
    expect(fetchMock).not.toHaveBeenCalled();

    const blank = await sendHttp({
      port: server.port,
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders({
        'x-gateway-s2s': mintS2sHeader(S2S_SECRET),
        'x-roboshadow-refresh-token': '   ',
      }),
      body: listOrganisationsCall,
    });
    expect(blank.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a valid S2S header plus the refresh-token header and uses that credential', async () => {
    const logs = captureStderr();
    const server = await listen();
    try {
      const response = await sendHttp({
        port: server.port,
        method: 'POST',
        path: '/mcp',
        headers: mcpHeaders({
          'x-gateway-s2s': mintS2sHeader(S2S_SECRET),
          'x-roboshadow-refresh-token': HEADER_REFRESH_TOKEN,
        }),
        body: listOrganisationsCall,
      });
      const body = response.body;

      expect(response.status).toBe(200);
      const payload = JSON.parse(body) as {
        result?: { content?: Array<{ text?: string }> };
      };
      const text = payload.result?.content?.[0]?.text ?? '';
      expect(JSON.parse(text)).toEqual([{ id: 'org-1', name: 'Acme' }]);
      assertNoSecrets(`${body}\n${logs.text()}`);

      const [exchangeUrl, exchangeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new URL(exchangeUrl).pathname).toBe('/identity/bearertoken');
      expect(JSON.parse(exchangeInit.body as string)).toEqual({ refreshToken: HEADER_REFRESH_TOKEN });
      expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(ENV_REFRESH_TOKEN);
    } finally {
      logs.restore();
    }
  });

  it('still requires the refresh-token header when the insecure-dev bypass skips S2S', async () => {
    delete process.env.CONDUIT_S2S_SECRET;
    process.env.MCP_ALLOW_INSECURE_DEV = '1';
    const logs = captureStderr();
    const server = await listen();
    try {
      const missing = await sendHttp({
        port: server.port,
        method: 'POST',
        path: '/mcp',
        headers: mcpHeaders(),
        body: listOrganisationsCall,
      });
      expect(missing.status).toBe(401);
      expect(missing.body).toContain('X-RoboShadow-Refresh-Token');
      expect(fetchMock).not.toHaveBeenCalled();

      const devRefreshToken = 'header-refresh-token-insecure-dev';
      const accepted = await sendHttp({
        port: server.port,
        method: 'POST',
        path: '/mcp',
        headers: mcpHeaders({ 'x-roboshadow-refresh-token': devRefreshToken }),
        body: listOrganisationsCall,
      });
      expect(accepted.status).toBe(200);
      const [exchangeUrl, exchangeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new URL(exchangeUrl).pathname).toBe('/identity/bearertoken');
      expect(JSON.parse(exchangeInit.body as string)).toEqual({ refreshToken: devRefreshToken });
      assertNoSecrets(logs.text());
    } finally {
      logs.restore();
    }
  });

  it('uses the env refresh token in AUTH_MODE=env after a valid S2S header', async () => {
    process.env.AUTH_MODE = 'env';
    const server = await listen();
    const response = await sendHttp({
      port: server.port,
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders({
        'x-gateway-s2s': mintS2sHeader(S2S_SECRET),
        'x-roboshadow-refresh-token': HEADER_REFRESH_TOKEN,
      }),
      body: listOrganisationsCall,
    });

    expect(response.status).toBe(200);
    const [exchangeUrl, exchangeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(exchangeUrl).pathname).toBe('/identity/bearertoken');
    expect(JSON.parse(exchangeInit.body as string)).toEqual({ refreshToken: ENV_REFRESH_TOKEN });
  });

  it('serves /health without authentication and without reading credentials', async () => {
    delete process.env.ROBOSHADOW_REFRESH_TOKEN;
    process.env.LOG_LEVEL = 'debug';
    const logs = captureStderr();
    const server = await listen();
    try {
      const response = await sendHttp({
        port: server.port,
        method: 'GET',
        path: '/health',
      });
      const body = response.body;
      const parsed = JSON.parse(body) as { status?: string; mode?: string; credentials?: unknown };

      expect(response.status).toBe(200);
      expect(parsed.status).toBe('ok');
      expect(parsed.mode).toBe('gateway');
      expect(parsed.credentials).toBeUndefined();
      assertNoSecrets(body);
      expect(logs.text()).not.toContain('Missing credentials');
      expect(logs.text()).not.toContain(ENV_REFRESH_TOKEN);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });
});
