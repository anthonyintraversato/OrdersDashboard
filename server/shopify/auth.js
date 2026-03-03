const https = require('https');

let cachedToken = null;
let tokenExpiresAt = 0;
let refreshPromise = null;

const STORE = process.env.SHOPIFY_STORE;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

function requestToken() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    });

    const options = {
      hostname: STORE,
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

/**
 * Get a valid access token. Caches the token and refreshes ~1 hour before expiry.
 * Uses a mutex (refreshPromise) to prevent race conditions when multiple
 * syncs trigger simultaneously — only one token request fires, others await it.
 */
async function getAccessToken() {
  const now = Date.now();
  // Refresh 1 hour before expiry to avoid edge cases
  const bufferMs = 60 * 60 * 1000;

  if (cachedToken && now < tokenExpiresAt - bufferMs) {
    return cachedToken;
  }

  // If a refresh is already in flight, wait for it (prevents race condition)
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await requestToken();
      cachedToken = response.access_token;
      // Shopify client credentials tokens expire in 24h (86400 seconds)
      const expiresIn = response.expires_in || 86400;
      tokenExpiresAt = Date.now() + expiresIn * 1000;
      return cachedToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

module.exports = { getAccessToken };
