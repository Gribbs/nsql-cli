const crypto = require('crypto');
const http = require('http');

const {
  generatePKCE,
  buildAuthorizationUrl,
  getTokenEndpoint,
  startCallbackServer,
  DEFAULT_CALLBACK_PORT,
} = require('../lib/oauth2');

describe('oauth2', () => {
  describe('generatePKCE', () => {
    it('should return codeVerifier and codeChallenge', () => {
      const { codeVerifier, codeChallenge } = generatePKCE();
      expect(codeVerifier).toBeDefined();
      expect(codeChallenge).toBeDefined();
      expect(typeof codeVerifier).toBe('string');
      expect(typeof codeChallenge).toBe('string');
    });

    it('should generate codeVerifier between 43 and 128 chars', () => {
      const { codeVerifier } = generatePKCE();
      expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(codeVerifier.length).toBeLessThanOrEqual(128);
    });

    it('should generate codeChallenge as SHA256 base64url of codeVerifier', () => {
      const { codeVerifier, codeChallenge } = generatePKCE();
      const expected = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      expect(codeChallenge).toBe(expected);
    });

    it('should generate unique values on each call', () => {
      const first = generatePKCE();
      const second = generatePKCE();
      expect(first.codeVerifier).not.toBe(second.codeVerifier);
      expect(first.codeChallenge).not.toBe(second.codeChallenge);
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('should build a valid URL with all parameters', () => {
      const url = buildAuthorizationUrl(
        'TSTDRV1234567',
        'my-client-id',
        'http://localhost:9749/callback',
        'random-state',
        'challenge-value'
      );

      expect(url).toContain('https://tstdrv1234567.app.netsuite.com/app/login/oauth2/authorize.nl');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=my-client-id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=rest_webservices');
      expect(url).toContain('state=random-state');
      expect(url).toContain('code_challenge=challenge-value');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('should normalize account ID with underscores to hyphens', () => {
      const url = buildAuthorizationUrl(
        '1234567_SB1',
        'client-id',
        'http://localhost:9749/callback',
        'state',
        'challenge'
      );
      expect(url).toContain('https://1234567-sb1.app.netsuite.com');
    });

    it('should lowercase the account ID', () => {
      const url = buildAuthorizationUrl(
        'TSTDRV1234567',
        'client-id',
        'http://localhost:9749/callback',
        'state',
        'challenge'
      );
      expect(url).toContain('tstdrv1234567');
    });
  });

  describe('getTokenEndpoint', () => {
    it('should return the correct token endpoint URL', () => {
      const endpoint = getTokenEndpoint('TSTDRV1234567');
      expect(endpoint).toBe(
        'https://tstdrv1234567.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token'
      );
    });

    it('should normalize account ID', () => {
      const endpoint = getTokenEndpoint('1234567_SB1');
      expect(endpoint).toContain('1234567-sb1');
    });
  });

  describe('startCallbackServer', () => {
    let testPort;

    beforeEach(() => {
      testPort = 19000 + Math.floor(Math.random() * 1000);
    });

    it('should resolve with code and state on successful callback', async () => {
      const serverPromise = startCallbackServer(testPort);

      // Give the server a moment to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate callback from NetSuite
      const response = await fetch(
        `http://127.0.0.1:${testPort}/callback?code=test-auth-code&state=test-state`
      );
      expect(response.status).toBe(200);

      const result = await serverPromise;
      expect(result.code).toBe('test-auth-code');
      expect(result.state).toBe('test-state');
    });

    it('should reject when error parameter is present', async () => {
      const serverPromise = startCallbackServer(testPort);
      const rejectExpectation = expect(serverPromise).rejects.toThrow('Authorization denied: access_denied');

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await fetch(
          `http://127.0.0.1:${testPort}/callback?error=access_denied&state=test-state`
        );
      } catch { /* server closes connection */ }

      await rejectExpectation;
    });

    it('should reject when no code is present', async () => {
      const serverPromise = startCallbackServer(testPort);
      const rejectExpectation = expect(serverPromise).rejects.toThrow('No authorization code received');

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await fetch(`http://127.0.0.1:${testPort}/callback?state=test-state`);
      } catch { /* server closes connection */ }

      await rejectExpectation;
    });

    it('should return 404 for non-callback paths', async () => {
      const serverPromise = startCallbackServer(testPort);

      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch(`http://127.0.0.1:${testPort}/other`);
      expect(response.status).toBe(404);

      // Send a valid callback to close the server
      await fetch(
        `http://127.0.0.1:${testPort}/callback?code=cleanup&state=cleanup`
      );
      await serverPromise;
    });
  });

  describe('DEFAULT_CALLBACK_PORT', () => {
    it('should be 9749', () => {
      expect(DEFAULT_CALLBACK_PORT).toBe(9749);
    });
  });
});
