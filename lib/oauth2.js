const crypto = require('crypto');
const http = require('http');
const { URL, URLSearchParams } = require('url');
const debug = require('./debug');

const DEFAULT_CALLBACK_PORT = 9749;
const CALLBACK_PATH = '/callback';
const SCOPE = 'rest_webservices';
const CALLBACK_TIMEOUT_MS = 120_000;

/**
 * Generate PKCE code_verifier and code_challenge for OAuth 2.0.
 * @returns {{ codeVerifier: string, codeChallenge: string }}
 */
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32)
    .toString('base64url')
    .slice(0, 64);

  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * Build the NetSuite OAuth 2.0 authorization URL.
 * @param {string} accountId - NetSuite account ID (e.g. TSTDRV1234567 or 1234567_SB1)
 * @param {string} clientId
 * @param {string} redirectUri
 * @param {string} state
 * @param {string} codeChallenge
 * @returns {string}
 */
function buildAuthorizationUrl(accountId, clientId, redirectUri, state, codeChallenge) {
  const normalizedAccount = accountId.toLowerCase().replace(/_/g, '-');
  const baseUrl = `https://${normalizedAccount}.app.netsuite.com/app/login/oauth2/authorize.nl`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Build the token endpoint URL for a given account.
 * @param {string} accountId
 * @returns {string}
 */
function getTokenEndpoint(accountId) {
  const normalizedAccount = accountId.toLowerCase().replace(/_/g, '-');
  return `https://${normalizedAccount}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;
}

/**
 * Start a temporary HTTP server on localhost to receive the OAuth callback.
 * Resolves with { code, state } when the callback arrives.
 * @param {number} port
 * @returns {Promise<{ code: string, state: string, server: http.Server }>}
 */
function startCallbackServer(port = DEFAULT_CALLBACK_PORT) {
  return new Promise((resolve, reject) => {
    let timeoutId;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);

      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      clearTimeout(timeoutId);

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(buildErrorPage(error));
        server.close();
        reject(new Error(`Authorization denied: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(buildErrorPage('No authorization code received'));
        server.close();
        reject(new Error('No authorization code received in callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(buildSuccessPage());

      server.close();
      resolve({ code, state });
    });

    server.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to start callback server on port ${port}: ${err.message}`));
    });

    server.listen(port, '127.0.0.1', () => {
      timeoutId = setTimeout(() => {
        if (server.listening) {
          server.close();
          reject(new Error('Authentication timed out. No callback received within 2 minutes.'));
        }
      }, CALLBACK_TIMEOUT_MS);
    });
  });
}

/**
 * Exchange an authorization code for access and refresh tokens.
 * @param {string} accountId
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} code
 * @param {string} redirectUri
 * @param {string} codeVerifier
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number, tokenType: string }>}
 */
async function exchangeCodeForTokens(accountId, clientId, clientSecret, code, redirectUri, codeVerifier) {
  const tokenEndpoint = getTokenEndpoint(accountId);
  debug.log('Token exchange endpoint:', tokenEndpoint);
  debug.log('Grant type: authorization_code');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  debug.log('Token exchange response status:', response.status);

  if (!response.ok) {
    const errorBody = await response.text();
    debug.log('Token exchange error body:', errorBody);
    let detail = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed.error_description || parsed.error || errorBody;
    } catch { /* use raw text */ }
    throw new Error(`Token exchange failed (${response.status}): ${detail}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Refresh an expired access token using a refresh token.
 * @param {string} accountId
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} refreshToken
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number, tokenType: string }>}
 */
async function refreshAccessToken(accountId, clientId, clientSecret, refreshToken) {
  const tokenEndpoint = getTokenEndpoint(accountId);
  debug.log('Token refresh endpoint:', tokenEndpoint);
  debug.log('Grant type: refresh_token');
  debug.log('Refresh token:', debug.maskToken(refreshToken));

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  debug.log('Token refresh response status:', response.status);

  if (!response.ok) {
    const errorBody = await response.text();
    debug.log('Token refresh error body:', errorBody);
    let detail = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed.error_description || parsed.error || errorBody;
    } catch { /* use raw text */ }
    throw new Error(`Token refresh failed (${response.status}): ${detail}`);
  }

  const data = await response.json();

  debug.log('Refresh response contains new refresh_token:', !!data.refresh_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Run the full OAuth 2.0 browser login flow.
 * @param {Object} profile - OAuth2 profile with accountId, clientId, clientSecret
 * @param {number} port - Local callback port
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number, tokenExpiry: number }>}
 */
async function login(profile, port = DEFAULT_CALLBACK_PORT) {
  const { accountId, clientId, clientSecret } = profile;
  const redirectUri = `http://localhost:${port}${CALLBACK_PATH}`;

  debug.log('Starting OAuth 2.0 login flow');
  debug.log('Account:', accountId);
  debug.log('Client ID:', debug.maskToken(clientId));
  debug.log('Redirect URI:', redirectUri);

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');
  debug.log('PKCE code_challenge:', codeChallenge);
  debug.log('State:', state);

  const authUrl = buildAuthorizationUrl(accountId, clientId, redirectUri, state, codeChallenge);

  const callbackPromise = startCallbackServer(port);

  console.log('\nOpening browser for NetSuite authentication...');
  console.log('If the browser does not open automatically, visit this URL:');
  console.log(`\n  ${authUrl}\n`);

  // Dynamic import for ESM-only `open` package
  const open = (await import('open')).default;
  await open(authUrl);

  console.log('Waiting for authentication...');

  const { code, state: returnedState } = await callbackPromise;
  debug.log('Callback received. Code:', debug.maskToken(code));
  debug.log('Returned state:', returnedState);

  if (returnedState !== state) {
    throw new Error('State mismatch: possible CSRF attack. Please try again.');
  }

  console.log('Authorization received. Exchanging code for tokens...');

  const tokens = await exchangeCodeForTokens(accountId, clientId, clientSecret, code, redirectUri, codeVerifier);
  const tokenExpiry = Date.now() + (tokens.expiresIn * 1000);

  debug.log('Token exchange successful');
  debug.log('Access token:', debug.maskToken(tokens.accessToken));
  debug.log('Refresh token:', debug.maskToken(tokens.refreshToken));
  debug.log('Expires in:', tokens.expiresIn, 'seconds');

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    tokenExpiry,
  };
}

function buildSuccessPage() {
  return `<!DOCTYPE html>
<html><head><title>nsql-cli</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0fdf4;}
.card{text-align:center;padding:2rem 3rem;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);}
h1{color:#16a34a;margin-bottom:.5rem;}p{color:#555;}</style></head>
<body><div class="card"><h1>Authenticated</h1><p>You can close this window and return to the terminal.</p></div></body></html>`;
}

function buildErrorPage(error) {
  return `<!DOCTYPE html>
<html><head><title>nsql-cli</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fef2f2;}
.card{text-align:center;padding:2rem 3rem;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);}
h1{color:#dc2626;margin-bottom:.5rem;}p{color:#555;}</style></head>
<body><div class="card"><h1>Authentication Failed</h1><p>${error}</p><p>Please close this window and try again.</p></div></body></html>`;
}

module.exports = {
  generatePKCE,
  buildAuthorizationUrl,
  getTokenEndpoint,
  startCallbackServer,
  exchangeCodeForTokens,
  refreshAccessToken,
  login,
  DEFAULT_CALLBACK_PORT,
};
