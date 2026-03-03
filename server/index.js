require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const ordersRoutes = require('./routes/orders');
const syncRoutes = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/orders', ordersRoutes);
app.use('/api/sync', syncRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
