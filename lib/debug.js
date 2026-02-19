let _enabled = false;

function enable() {
  _enabled = true;
}

function isEnabled() {
  return _enabled;
}

function log(...args) {
  if (_enabled) {
    console.error('[DEBUG]', ...args);
  }
}

function maskToken(token) {
  if (!token || token.length < 12) return '***';
  return token.slice(0, 6) + '...' + token.slice(-6);
}

function maskSecret(secret) {
  if (!secret) return '***';
  return '***' + secret.slice(-4);
}

module.exports = { enable, isEnabled, log, maskToken, maskSecret };
