require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { config } = require('./config');
const { runMigrations } = require('./db/connection');

const ordersRoutes = require('./routes/orders');
const syncRoutes = require('./routes/sync');
const shopifyRoutes = require('./routes/shopify');

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/orders', ordersRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/shopify', shopifyRoutes);

// Serve frontend in production
const cfg = config();
if (cfg.isProduction) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Run migrations then start server
runMigrations()
  .then(() => {
    app.listen(cfg.port, () => {
      console.log(`Server running on port ${cfg.port}`);
    });
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
