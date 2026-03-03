const express = require('express');
const https = require('https');
const { config } = require('../config');
const db = require('../db/connection');

const router = express.Router();

const SCOPES = 'read_orders,read_products,read_inventory,read_fulfillments,read_locations';

// GET /api/shopify/auth — redirect to Shopify OAuth authorization page
router.get('/auth', (req, res) => {
  const cfg = config();
  const redirectUri = `https://${req.get('host')}/api/shopify/callback`;

  const authUrl =
    `https://${cfg.shopifyStore}/admin/oauth/authorize` +
    `?client_id=${cfg.shopifyClientId}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log('[OAuth] Starting auth flow');
  console.log('[OAuth] Redirect URI:', redirectUri);
  console.log('[OAuth] Auth URL:', authUrl);

  res.redirect(authUrl);
});

// GET /api/shopify/callback — handle Shopify redirect, exchange code for permanent token
router.get('/callback', async (req, res) => {
  console.log('[OAuth Callback] Full query params:', JSON.stringify(req.query));

  const { code, shop, hmac } = req.query;
  console.log('[OAuth Callback] code:', code);
  console.log('[OAuth Callback] shop:', shop);

  if (!code) {
    console.error('[OAuth Callback] No code parameter received');
    return res.status(400).send('Missing authorization code. Did Shopify redirect correctly?');
  }

  const cfg = config();

  console.log('[OAuth Callback] ENV CHECK — shopifyStore:', cfg.shopifyStore);
  console.log('[OAuth Callback] ENV CHECK — shopifyClientId:', cfg.shopifyClientId ? '(set)' : 'UNDEFINED');
  console.log('[OAuth Callback] ENV CHECK — shopifyClientSecret:', cfg.shopifyClientSecret ? '(set)' : 'UNDEFINED');

  if (!cfg.shopifyClientId || !cfg.shopifyClientSecret) {
    const msg = 'Missing Shopify credentials. Check that SHOPIFY_CLIENT_ID (or SHOPIFY_API_KEY) and SHOPIFY_CLIENT_SECRET (or SHOPIFY_API_SECRET) are set in Railway.';
    console.error('[OAuth Callback]', msg);
    return res.status(500).send(msg);
  }

  try {
    // Exchange the authorization code for a permanent access token
    const tokenData = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        client_id: cfg.shopifyClientId,
        client_secret: cfg.shopifyClientSecret,
        code: code,
      });

      console.log('[OAuth Callback] Exchanging code for token...');
      console.log('[OAuth Callback] POST to:', `${cfg.shopifyStore}/admin/oauth/access_token`);

      const options = {
        hostname: cfg.shopifyStore,
        path: '/admin/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          console.log('[OAuth Callback] Token response status:', response.statusCode);
          console.log('[OAuth Callback] Token response body:', data);

          if (response.statusCode !== 200) {
            return reject(new Error(`Token exchange failed: ${response.statusCode} ${data}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse token response: ${data}`));
          }
        });
      });

      request.on('error', (err) => {
        console.error('[OAuth Callback] Request error:', err);
        reject(err);
      });

      request.write(postData);
      request.end();
    });

    console.log('[OAuth Callback] Token exchange successful');
    console.log('[OAuth Callback] access_token present:', !!tokenData.access_token);
    console.log('[OAuth Callback] scope:', tokenData.scope);

    if (!tokenData.access_token) {
      console.error('[OAuth Callback] No access_token in response:', JSON.stringify(tokenData));
      return res.status(500).send('Token exchange succeeded but no access_token in response.');
    }

    // Store the permanent token in shopify_config
    const upsertResult = await db.query(
      `INSERT INTO shopify_config (key, value, updated_at)
       VALUES ('access_token', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [tokenData.access_token]
    );
    console.log('[OAuth Callback] Token saved to database, rowCount:', upsertResult.rowCount);

    // Also store the scope for reference
    await db.query(
      `INSERT INTO shopify_config (key, value, updated_at)
       VALUES ('scope', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [tokenData.scope || SCOPES]
    );

    res.send('Shopify connected successfully. You can close this tab and use the dashboard.');
  } catch (error) {
    console.error('[OAuth Callback] ERROR:', error);
    res.status(500).send(`OAuth failed: ${error.message}`);
  }
});

// GET /api/shopify/status — check if a token is stored
router.get('/status', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT key, updated_at FROM shopify_config WHERE key = 'access_token' LIMIT 1`
    );
    if (result.rows.length > 0) {
      res.json({ connected: true, updated_at: result.rows[0].updated_at });
    } else {
      res.json({ connected: false });
    }
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

module.exports = router;
