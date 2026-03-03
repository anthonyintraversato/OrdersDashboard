const express = require('express');
const router = express.Router();
const { syncShopifyOrders } = require('../shopify/sync');

let isSyncing = false;

// POST /api/sync/shopify-orders
router.post('/shopify-orders', async (req, res) => {
  if (isSyncing) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }

  isSyncing = true;
  try {
    const result = await syncShopifyOrders();
    res.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    isSyncing = false;
  }
});

module.exports = router;
