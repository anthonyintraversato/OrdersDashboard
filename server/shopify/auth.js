const db = require('../db/connection');

let cachedToken = null;

/**
 * Get the stored Shopify access token from the database.
 *
 * Uses the permanent token from the OAuth authorization code flow,
 * stored in the shopify_config table. This token never expires.
 * No client credentials grant — authorization code flow only.
 */
async function getAccessToken() {
  if (cachedToken) {
    return cachedToken;
  }

  const result = await db.query(
    `SELECT value FROM shopify_config WHERE key = 'access_token' LIMIT 1`
  );

  if (!result.rows.length || !result.rows[0].value) {
    throw new Error(
      'No Shopify access token found in database. Complete the OAuth flow first.'
    );
  }

  cachedToken = result.rows[0].value;
  console.log('Using stored permanent access token');
  return cachedToken;
}

module.exports = { getAccessToken };
