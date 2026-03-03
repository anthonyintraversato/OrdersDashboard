const https = require('https');
const { config } = require('../config');
const db = require('../db/connection');

let cachedToken = null;

/**
 * Get a valid Shopify access token.
 *
 * 1. Return cached token if we already fetched it this process
 * 2. Check shopify_config table for a stored permanent token (from OAuth authorization code flow)
 * 3. Fall back to client credentials grant if no stored token exists
 */
async function getAccessToken() {
  if (cachedToken) {
    return cachedToken;
  }

  // Check database for stored permanent token
  try {
    const result = await db.query(
      `SELECT value FROM shopify_config WHERE key = 'access_token' LIMIT 1`
    );
    if (result.rows.length > 0 && result.rows[0].value) {
      cachedToken = result.rows[0].value;
      console.log('Using stored permanent access token');
      return cachedToken;
    }
  } catch (err) {
    // Table may not exist yet on first boot — fall through to client credentials
    console.warn('Could not read stored token:', err.message);
  }

  // Fallback: client credentials grant
  console.log('No stored token found, trying client credentials grant');
  const response = await requestToken();
  cachedToken = response.access_token;
  return cachedToken;
}

function requestToken() {
  const cfg = config();

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      client_id: cfg.shopifyClientId,
      client_secret: cfg.shopifyClientSecret,
      grant_type: 'client_credentials',
    });

    const options = {
      hostname: cfg.shopifyStore,
      path: '/admin/oauth/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Token request failed: ${res.statusCode} ${data}`));
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { getAccessToken };
