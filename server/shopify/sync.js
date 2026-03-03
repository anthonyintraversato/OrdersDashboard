const https = require('https');
const { getAccessToken } = require('./auth');
const pool = require('../db/connection');

const STORE = process.env.SHOPIFY_STORE;
const PDX_LOCATION_ID = process.env.SHOPIFY_PDX_LOCATION_ID;
const LA_LOCATION_ID = process.env.SHOPIFY_LA_LOCATION_ID;

const SOURCE_NAME_CHANNELS = {
  '291806642177': 'GOAT',
  '298311450625': 'KicksCrew',
  '137182019585': 'StockX',
  'SHEIN': 'SHEIN',
  'amazon': 'Amazon',
  'ebay': 'eBay',
  'tiktok': 'TikTok',
  'web': 'Shopify',
  'whatnot': 'Whatnot',
  '3890849': 'Shopify',
};

function detectChannel(order) {
  const sourceName = order.source_name || '';

  // Direct match
  if (SOURCE_NAME_CHANNELS[sourceName]) {
    return SOURCE_NAME_CHANNELS[sourceName];
  }

  // Case-insensitive match
  const lower = sourceName.toLowerCase();
  for (const [key, channel] of Object.entries(SOURCE_NAME_CHANNELS)) {
    if (key.toLowerCase() === lower) {
      return channel;
    }
  }

  // Fallback: check note_attributes for marketplace info
  if (order.note_attributes && Array.isArray(order.note_attributes)) {
    for (const attr of order.note_attributes) {
      const name = (attr.name || '').toLowerCase();
      const value = (attr.value || '').toLowerCase();
      if (name.includes('channel') || name.includes('marketplace') || name.includes('source')) {
        for (const channel of Object.values(SOURCE_NAME_CHANNELS)) {
          if (value.includes(channel.toLowerCase())) {
            return channel;
          }
        }
      }
    }
  }

  return 'Shopify';
}

function detectLocation(order) {
  // Check fulfillment orders or line items for location
  if (order.fulfillments && order.fulfillments.length > 0) {
    const locId = String(order.fulfillments[0].location_id);
    if (locId === PDX_LOCATION_ID) return 'PDX';
    if (locId === LA_LOCATION_ID) return 'LA';
  }
  // Default to PDX if we can't determine
  return 'PDX';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shopifyGet(path, token, retries = 2) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: STORE,
      path,
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', async () => {
        // Handle rate limiting (429) with retry
        if (res.statusCode === 429 && retries > 0) {
          const retryAfter = parseFloat(res.headers['retry-after']) || 2;
          console.log(`Rate limited, retrying after ${retryAfter}s...`);
          await sleep(retryAfter * 1000);
          try {
            resolve(await shopifyGet(path, token, retries - 1));
          } catch (e) {
            reject(e);
          }
          return;
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Shopify API ${res.statusCode}: ${data}`));
        }

        // Check rate limit proximity — throttle if approaching limit
        const callLimit = res.headers['x-shopify-shop-api-call-limit'];
        if (callLimit) {
          const [used, max] = callLimit.split('/').map(Number);
          if (used >= max - 4) {
            await sleep(1000); // Back off when near limit
          }
        }

        try {
          const linkHeader = res.headers['link'] || '';
          resolve({ body: JSON.parse(data), linkHeader });
        } catch (e) {
          reject(new Error(`Failed to parse Shopify response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) {
      // Extract just the path from the full URL
      const url = new URL(match[1]);
      return url.pathname + url.search;
    }
  }
  return null;
}

async function fetchAllOrders(basePath, token) {
  const allOrders = [];
  let path = basePath;

  while (path) {
    const { body, linkHeader } = await shopifyGet(path, token);
    const orders = body.orders || [];
    allOrders.push(...orders);
    path = getNextPageUrl(linkHeader);
  }

  return allOrders;
}

async function syncShopifyOrders() {
  const token = await getAccessToken();
  const today = new Date().toISOString().split('T')[0];

  // Create sync log entry
  const logResult = await pool.query(
    `INSERT INTO sync_log (sync_type, status, started_at) VALUES ('shopify_orders', 'in_progress', NOW()) RETURNING id`
  );
  const syncLogId = logResult.rows[0].id;

  try {
    // Fetch unfulfilled orders
    const unfulfilled = await fetchAllOrders(
      '/admin/api/2024-10/orders.json?status=open&fulfillment_status=unfulfilled&limit=250',
      token
    );

    // Fetch partially fulfilled orders
    const partial = await fetchAllOrders(
      '/admin/api/2024-10/orders.json?status=open&fulfillment_status=partial&limit=250',
      token
    );

    // Fetch cancelled orders from last 7 days (for defect detection)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cancelled = await fetchAllOrders(
      `/admin/api/2024-10/orders.json?status=cancelled&created_at_min=${sevenDaysAgo.toISOString()}&limit=250`,
      token
    );

    const allOrders = [
      ...unfulfilled.map(o => ({ ...o, _status: 'unfulfilled' })),
      ...partial.map(o => ({ ...o, _status: 'partially_fulfilled' })),
      ...cancelled.map(o => ({ ...o, _status: 'cancelled' })),
    ];

    let processed = 0;

    for (const order of allOrders) {
      const channel = detectChannel(order);
      const location = detectLocation(order);
      const customerName = order.customer
        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
        : 'Unknown';

      const lineItems = (order.line_items || []).map(item => ({
        sku: item.sku,
        title: item.title,
        quantity: item.quantity,
        variant_title: item.variant_title,
      }));

      await pool.query(
        `INSERT INTO orders_snapshot
          (shopify_order_id, order_number, channel, created_at, status, total_price,
           line_items, line_items_count, location, customer_name, cancel_reason, source_name, snapshot_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (shopify_order_id, snapshot_date)
         DO UPDATE SET
           order_number = EXCLUDED.order_number,
           channel = EXCLUDED.channel,
           status = EXCLUDED.status,
           total_price = EXCLUDED.total_price,
           line_items = EXCLUDED.line_items,
           line_items_count = EXCLUDED.line_items_count,
           location = EXCLUDED.location,
           customer_name = EXCLUDED.customer_name,
           cancel_reason = EXCLUDED.cancel_reason,
           source_name = EXCLUDED.source_name`,
        [
          order.id,
          order.name,
          channel,
          order.created_at,
          order._status,
          parseFloat(order.total_price) || 0,
          JSON.stringify(lineItems),
          order.line_items ? order.line_items.length : 0,
          location,
          customerName,
          order.cancel_reason || null,
          order.source_name || null,
          today,
        ]
      );
      processed++;
    }

    // Update sync log
    await pool.query(
      `UPDATE sync_log SET status = 'success', records_processed = $1, completed_at = NOW() WHERE id = $2`,
      [processed, syncLogId]
    );

    return { success: true, processed, unfulfilled: unfulfilled.length, partial: partial.length, cancelled: cancelled.length };
  } catch (error) {
    await pool.query(
      `UPDATE sync_log SET status = 'error', errors = $1, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify({ message: error.message }), syncLogId]
    );
    throw error;
  }
}

module.exports = { syncShopifyOrders };
