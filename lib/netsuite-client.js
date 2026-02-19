/**
 * Lightweight HTTP client for SuiteQL queries using OAuth 2.0 Bearer tokens.
 * Bypasses netsuite-api-client (OAuth 1.0 only) for OAuth 2.0 authenticated profiles.
 */

const debug = require('./debug');

const DEFAULT_LIMIT = 1000;

/**
 * Build the SuiteQL REST API endpoint URL.
 * @param {string} accountId - NetSuite account ID
 * @returns {string}
 */
function getSuiteQLEndpoint(accountId) {
  const normalizedAccount = accountId.toLowerCase().replace(/_/g, '-');
  return `https://${normalizedAccount}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;
}

/**
 * Execute a SuiteQL query using OAuth 2.0 Bearer token authentication.
 * @param {string} accountId - NetSuite account ID
 * @param {string} accessToken - OAuth 2.0 access token
 * @param {string} query - SuiteQL query string
 * @param {number} [limit=1000] - Maximum rows to return
 * @param {number} [offset=0] - Row offset for pagination
 * @returns {Promise<Object>} Query results with items, hasMore, totalResults, etc.
 */
async function executeSuiteQL(accountId, accessToken, query, limit = DEFAULT_LIMIT, offset = 0) {
  const endpoint = getSuiteQLEndpoint(accountId);

  const url = new URL(endpoint);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  debug.log('SuiteQL request:', url.toString());
  debug.log('Authorization: Bearer', debug.maskToken(accessToken));

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'transient',
    },
    body: JSON.stringify({ q: query }),
  });

  debug.log('Response status:', response.status);

  if (!response.ok) {
    const errorBody = await response.text();
    debug.log('Response error body:', errorBody);
    let detail = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed['o:errorDetails']?.[0]?.detail
        || parsed.title
        || parsed.message
        || errorBody;
    } catch { /* use raw text */ }

    const error = new Error(detail);
    error.response = {
      status: response.status,
      data: errorBody,
    };
    throw error;
  }

  const data = await response.json();
  debug.log('Response items:', data.items?.length ?? 0, '| hasMore:', data.hasMore, '| totalResults:', data.totalResults);
  return data;
}

module.exports = { executeSuiteQL, getSuiteQLEndpoint };
