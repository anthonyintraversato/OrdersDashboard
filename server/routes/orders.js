const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// Pacific Time offset helper (handles PST/PDT)
function toPacific(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
}

/**
 * SLA calculation respecting business days in Pacific Time.
 * M-Th orders → must ship next business day
 * Fri-Sun orders → must ship Monday
 * Returns: { status: 'green'|'yellow'|'red', deadline: Date, hoursOpen: number }
 */
function calculateSLA(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  const hoursOpen = (now - created) / (1000 * 60 * 60);

  // Work in Pacific Time for day-of-week checks
  const createdPT = toPacific(created);
  const createdDay = createdPT.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Calculate the SLA deadline in Pacific Time
  const deadline = new Date(createdPT);

  if (createdDay >= 5 || createdDay === 0) {
    // Fri(5), Sat(6), Sun(0) → deadline is Monday
    const daysToMonday = createdDay === 0 ? 1 : (8 - createdDay);
    deadline.setDate(deadline.getDate() + daysToMonday);
  } else {
    // Mon-Thu → deadline is next day
    deadline.setDate(deadline.getDate() + 1);
  }
  // Set deadline to end of business day (5 PM PT)
  deadline.setHours(17, 0, 0, 0);

  const nowPT = toPacific(now);

  let status;
  if (nowPT > deadline) {
    status = 'red'; // Overdue
  } else {
    const hoursUntilDeadline = (deadline - nowPT) / (1000 * 60 * 60);
    if (hoursUntilDeadline <= 4) {
      status = 'yellow';
    } else {
      status = 'green';
    }
  }

  return { status, deadline: deadline.toISOString(), hoursOpen: Math.round(hoursOpen * 10) / 10 };
}

function formatAge(hoursOpen) {
  if (hoursOpen < 1) return '<1h';
  if (hoursOpen < 24) return `${Math.round(hoursOpen)}h`;
  const days = Math.floor(hoursOpen / 24);
  const remainingHours = Math.round(hoursOpen % 24);
  return `${days}d ${remainingHours}h`;
}

// GET /api/orders/unfulfilled
router.get('/unfulfilled', async (req, res) => {
  try {
    const { channel, location, age, search, sort, direction } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = `
      SELECT * FROM orders_snapshot
      WHERE snapshot_date = $1
        AND status IN ('unfulfilled', 'partially_fulfilled')
    `;
    const params = [today];
    let paramIdx = 2;

    // Channel filter (comma-separated)
    if (channel) {
      const channels = channel.split(',');
      const placeholders = channels.map((_, i) => `$${paramIdx + i}`);
      query += ` AND channel IN (${placeholders.join(',')})`;
      params.push(...channels);
      paramIdx += channels.length;
    }

    // Location filter
    if (location) {
      query += ` AND location = $${paramIdx}`;
      params.push(location);
      paramIdx++;
    }

    // Search filter
    if (search) {
      query += ` AND (
        order_number ILIKE $${paramIdx}
        OR customer_name ILIKE $${paramIdx}
        OR line_items::text ILIKE $${paramIdx}
      )`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    // Age filter — "today" means created since midnight Pacific Time
    if (age === 'today') {
      const midnightPT = new Date(toPacific(new Date()));
      midnightPT.setHours(0, 0, 0, 0);
      query += ` AND created_at >= $${paramIdx}`;
      params.push(midnightPT.toISOString());
      paramIdx++;
    } else if (age === '24h') {
      query += ` AND created_at <= NOW() - INTERVAL '24 hours'`;
    } else if (age === '48h') {
      query += ` AND created_at <= NOW() - INTERVAL '48 hours'`;
    }
    // 'overdue' is calculated in-app after SLA check

    // Sorting
    const sortMap = {
      age: 'created_at',
      channel: 'channel',
      order: 'order_number',
      total: 'total_price',
      customer: 'customer_name',
    };
    const sortCol = sortMap[sort] || 'created_at';
    const sortDir = direction === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortCol} ${sortDir}`;

    const result = await pool.query(query, params);

    // Enrich with SLA data
    const orders = result.rows.map(row => {
      const sla = calculateSLA(row.created_at);
      return {
        ...row,
        sla_status: sla.status,
        sla_deadline: sla.deadline,
        hours_open: sla.hoursOpen,
        age_display: formatAge(sla.hoursOpen),
      };
    });

    // Filter overdue if requested (must be done after SLA calculation)
    if (age === 'overdue') {
      return res.json(orders.filter(o => o.sla_status === 'red'));
    }

    res.json(orders);
  } catch (error) {
    console.error('Error fetching unfulfilled orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/summary
router.get('/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT * FROM orders_snapshot
      WHERE snapshot_date = $1
        AND status IN ('unfulfilled', 'partially_fulfilled')
    `, [today]);

    const orders = result.rows;
    const totalUnfulfilled = orders.length;

    // Channel breakdown
    const byChannel = {};
    let overdueCount = 0;
    let totalAge = 0;

    for (const order of orders) {
      const sla = calculateSLA(order.created_at);
      if (sla.status === 'red') overdueCount++;
      totalAge += sla.hoursOpen;

      byChannel[order.channel] = (byChannel[order.channel] || 0) + 1;
    }

    const avgAge = totalUnfulfilled > 0 ? Math.round(totalAge / totalUnfulfilled * 10) / 10 : 0;

    res.json({
      total_unfulfilled: totalUnfulfilled,
      overdue_count: overdueCount,
      avg_age_hours: avgAge,
      avg_age_display: formatAge(avgAge),
      by_channel: byChannel,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;
