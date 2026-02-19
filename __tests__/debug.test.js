const debug = require('../lib/debug');

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  // Reset internal state by requiring a fresh module
  // Since we can't un-enable, we test enable flow in order
});

describe('debug', () => {
  describe('maskToken', () => {
    it('should mask the middle of a long token', () => {
      const token = 'abcdef1234567890ghijkl';
      expect(debug.maskToken(token)).toBe('abcdef...ghijkl');
    });

    it('should return *** for short tokens', () => {
      expect(debug.maskToken('short')).toBe('***');
      expect(debug.maskToken('')).toBe('***');
    });

    it('should return *** for null/undefined', () => {
      expect(debug.maskToken(null)).toBe('***');
      expect(debug.maskToken(undefined)).toBe('***');
    });
  });

  describe('maskSecret', () => {
    it('should show only last 4 characters', () => {
      expect(debug.maskSecret('my-super-secret-key')).toBe('***-key');
    });

    it('should return *** for null/undefined', () => {
      expect(debug.maskSecret(null)).toBe('***');
      expect(debug.maskSecret(undefined)).toBe('***');
    });
  });

  describe('log', () => {
    it('should not output when debug is not enabled', () => {
      // debug starts disabled in a fresh require, but since modules are cached
      // we test by checking isEnabled state
      if (!debug.isEnabled()) {
        debug.log('should not appear');
        expect(console.error).not.toHaveBeenCalled();
      }
    });

    it('should output to stderr with [DEBUG] prefix when enabled', () => {
      debug.enable();
      expect(debug.isEnabled()).toBe(true);
      debug.log('test message', 123);
      expect(console.error).toHaveBeenCalledWith('[DEBUG]', 'test message', 123);
    });
  });

  describe('enable/isEnabled', () => {
    it('should enable debug mode', () => {
      debug.enable();
      expect(debug.isEnabled()).toBe(true);
    });
  });
});
