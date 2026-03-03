# Order Operations Dashboard — Project Spec

## What This Is

A standalone dashboard for West Coast Deals' inventory/order operations manager. It replaces the need to bounce between Shopify, Fishbowl, and Sellware by surfacing everything he needs in one clean interface. He checks it twice a day: start of shift (what needs to go out, what's broken) and end of shift (what got done, what's still open, daily performance).

**North Star Metric:** Order defect rate <1% across all channels.

**Current State:** ~2-4% on StockX (the only channel being tracked), unknown on all others. No consistent process for catching problems — issues surface through customer complaints, channel warnings, or accidental discovery during pick/pack.

**Order Volume:** 100-200 orders/day across 8+ channels.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Order Operations Dashboard              │
│                  (React + Supabase + Railway)            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌──────────────┐              ┌──────────────┐        │
│   │   Shopify    │              │   Railway     │        │
│   │    API       │              │   Postgres    │        │
│   └──────────────┘              └──────────────┘        │
│         │                             │                  │
│    Unfulfilled Orders           Historical               │
│    Cancelled Orders             Snapshots                │
│    Fulfillment Status           Defect Logs              │
│    Inventory Levels             Daily Metrics            │
│                                                          │
│   ┌──────────────┐                                      │
│   │  Fishbowl   │  ← Phase 4 (future)                  │
│   │    API      │                                       │
│   └──────────────┘                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Data Sources:**

- **Shopify Admin API** — All unfulfilled orders (with channel detection via `source_name`), cancelled orders (for defect auto-detection), fulfillment timestamps (for SLA tracking). This is the sole data source for the initial build since all marketplace orders flow into Shopify.
- **Railway Postgres** — Stores daily snapshots, defect event logs, and historical metrics for trending.
- **Fishbowl API (Phase 4)** — Open sales orders, task error logs. Deferred until the Shopify-only version is proven useful.

---

## Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS
- **Backend:** Node.js / Express
- **Database:** Railway Postgres (or Supabase pooler — match existing tool pattern)
- **Hosting:** Railway (auto-deploy from GitHub)
- **APIs:** Shopify Admin REST API (OAuth client credentials, 24h token refresh), Fishbowl REST API (bearer token)
- **Store:** `nzw1ru-un.myshopify.com`
- **PDX Location ID:** `82814173442`

---

## Channel Detection

Use Shopify `source_name` field for reliable channel identification:

```javascript
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
  '3890849': 'Shopify'
};
```

---

## Feature Phases (Build Order)

### Phase 1: Daily Operations View

**The clean unfulfilled list.** This is what he opens every morning and checks every evening.

**Morning View — "What needs to go out today?"**

Pull all unfulfilled orders from Shopify. Display as a sortable, filterable table:

| Column | Source | Notes |
|--------|--------|-------|
| Order # | Shopify `name` | Clickable link to Shopify admin |
| Channel | `source_name` mapping | Color-coded tag (StockX=green, GOAT=purple, SHEIN=blue, eBay=yellow, etc.) |
| Age | `created_at` → hours/days | Red if past SLA |
| Items | Line items count + first SKU | Expandable to show all items |
| Status | Fulfillment status | Unfulfilled, Partially Fulfilled |
| Location | Assigned fulfillment location | PDX or LA |
| Customer | Customer name | For reference |
| Total | Order total | For reference |

**SLA Rules:**
- Orders placed M-Th → must ship next business day
- Orders placed Fri-Sun → must ship Monday
- **Red flag:** Any order older than 48 hours on a business day
- **Yellow flag:** Any order approaching SLA (same-day orders not yet picked)

**Filters:**
- By channel (dropdown, multi-select)
- By age (All / Today / Overdue / 24h+ / 48h+)
- By location (PDX / LA / All)
- Search by order #, SKU, or customer name

**Summary Cards (top of page):**
- Total unfulfilled orders
- Orders by channel (mini breakdown)
- Overdue orders count (red if > 0)
- Average order age

**Evening View — "What's left?"**

Same table, but filtered to show:
- Orders still unfulfilled after the day's work
- A "Today's Activity" summary: orders fulfilled today vs. orders received today
- Net change (are we keeping up, falling behind, or catching up?)

---

### Phase 2: Order Pipeline Health

**"Are we keeping up?"** — High-level view of order flow and aging trends. The employee's job is to make sure orders are syncing from marketplaces into Shopify and from Shopify into Fishbowl. This tool assumes orders are in Shopify and gives him visibility into what's there.

**Order Flow Summary:**
- Orders received today vs. orders fulfilled today (are we keeping up?)
- Orders received this week vs. fulfilled this week
- Backlog trend: is the unfulfilled count growing or shrinking day over day?

**Aging Distribution:**
- How many orders are <24h, 24-48h, 48h-72h, 72h+
- Visual bar or chart showing the distribution
- Goal: the vast majority should be <24h, nothing should be 72h+

**Channel Health Table:**
| Channel | Open Orders | Avg Age | Oldest Order | Fulfilled Today |
|---------|-------------|---------|--------------|-----------------|

This gives him a quick read on which channels are flowing smoothly and which are backing up. If SHEIN suddenly has 15 orders aging past 48h, he knows to investigate whether those orders made it to Fishbowl or got stuck in Sellware.
|-----|-------------------|-------------------|-------|-----------|

---

### Phase 3: Defect Rate Tracking

**"How are we doing against the <1% goal?"**

**Defect Definition:**
A defect is any order that results in:
- Cancellation (by seller — oversell, out of stock, can't locate)
- Late shipment (past SLA)
- Wrong item shipped

**NOT a defect:**
- Buyer-initiated cancellation
- Buyer-initiated return

**Calculation:**
```
Defect Rate = (Seller Cancellations + Late Shipments + Wrong Items) / Total Orders
```

**Data Collection:**
Since we can't automatically detect all defect types from Shopify alone, use a hybrid approach:

1. **Auto-detected:** Cancelled orders where `cancel_reason` = inventory/other (not customer). Late shipments calculated from `created_at` vs. `fulfilled_at` against SLA rules.
2. **Manual logging:** For wrong-item-shipped and other defects, provide a simple "Log Defect" button on any order in the unfulfilled list. Employee clicks it, selects defect type, adds a note.

**Dashboard Display:**

- **Trailing 7-day defect rate** (big number, color-coded: green <1%, yellow 1-2%, red >2%)
- **Trailing 30-day defect rate**
- **Defect rate by channel** (table showing each channel's rate)
- **Trend chart** (daily defect rate over last 30 days)
- **Defect log** (scrollable list of recent defects with type, channel, order #, date, notes)

**Daily Snapshot:**
At end of each day (or on manual trigger), capture:
- Total orders received
- Total orders fulfilled
- Total defects by type
- Defect rate
- Orders still unfulfilled
- Store in Supabase for historical trending

---

### Phase 4: Fishbowl Error Log Surfacing

**Surface Sellware/Fishbowl task errors in the dashboard.**

**Investigation needed:** Determine if Fishbowl's API exposes task error data. The error log is visible in Fishbowl's Tasks UI. Possible approaches:

1. **Fishbowl API** — Query `POST /api/data-query` against the task/error tables (if they exist in the schema)
2. **Scrape approach** — If API doesn't expose errors, may need to poll Fishbowl's task status endpoint
3. **Manual fallback** — If neither works, provide a section where the employee can manually log import failures they see in Fishbowl's UI

**Display:**
- List of recent import errors with timestamp, order #, and error message
- Common error patterns highlighted (e.g., "address issue" errors grouped)
- Quick link to the order in Shopify admin for investigation

---

## Database Schema

### Tables

**`orders_snapshot`** — Point-in-time capture of unfulfilled orders
```sql
CREATE TABLE orders_snapshot (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_price DECIMAL(10,2),
  line_items_count INTEGER,
  location VARCHAR(50),
  customer_name VARCHAR(255),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(shopify_order_id, snapshot_date)
);
```

**`defect_events`** — Individual defect occurrences
```sql
CREATE TABLE defect_events (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT,
  order_number VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  defect_type VARCHAR(50) NOT NULL, -- 'cancellation', 'late_shipment', 'wrong_item', 'other'
  reason TEXT,
  detected_method VARCHAR(50) NOT NULL, -- 'auto' or 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
```

**`daily_metrics`** — End-of-day summary
```sql
CREATE TABLE daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  total_orders_received INTEGER,
  total_orders_fulfilled INTEGER,
  total_defects INTEGER,
  defect_rate DECIMAL(5,4),
  orders_remaining_unfulfilled INTEGER,
  defects_by_channel JSONB, -- {"StockX": 2, "GOAT": 0, ...}
  defects_by_type JSONB, -- {"cancellation": 1, "late_shipment": 1, ...}
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`sync_log`** — Track sync operations
```sql
CREATE TABLE sync_log (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- 'shopify_orders', 'fishbowl_orders', 'mismatch_check'
  status VARCHAR(20) NOT NULL, -- 'success', 'error', 'partial'
  records_processed INTEGER,
  errors JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

---

## API Endpoints

### Sync Operations
- `POST /api/sync/shopify-orders` — Pull unfulfilled orders from Shopify
- `POST /api/sync/daily-snapshot` — Capture end-of-day metrics

### Data Endpoints
- `GET /api/orders/unfulfilled` — Current unfulfilled orders with filters
- `GET /api/orders/summary` — Summary cards data
- `GET /api/pipeline/health` — Channel health table, aging distribution, flow summary
- `GET /api/defects` — Defect log with filters
- `GET /api/defects/rate` — Current defect rates (7d, 30d, by channel)
- `GET /api/metrics/daily` — Historical daily metrics for charts
- `POST /api/defects/log` — Manually log a defect event

### Settings
- `GET /api/settings` — Current config (SLA rules, sync frequency)
- `PUT /api/settings` — Update config

---

## Shopify API Calls

### Pull Unfulfilled Orders
```
GET /admin/api/2024-10/orders.json?status=open&fulfillment_status=unfulfilled&limit=250
```
Paginate using `Link` header. Also pull `fulfillment_status=partial`.

Key fields to extract:
- `id`, `name` (order #), `created_at`, `financial_status`
- `source_name` (for channel detection)
- `line_items` (SKU, quantity, title)
- `customer.first_name`, `customer.last_name`
- `total_price`
- `fulfillment_status`
- `cancel_reason` (if cancelled — for defect auto-detection)
- `note_attributes` (may contain marketplace-specific data)

### Pull Cancelled Orders (for defect detection)
```
GET /admin/api/2024-10/orders.json?status=cancelled&created_at_min={7_days_ago}&limit=250
```
Filter for `cancel_reason` != `customer` to identify seller-caused cancellations.

### Pull Recently Fulfilled (for SLA calculation)
```
GET /admin/api/2024-10/orders.json?status=any&fulfillment_status=fulfilled&updated_at_min={today}&limit=250
```
Compare `created_at` to fulfillment timestamp against SLA rules.

---

## Fishbowl Integration (Phase 4 — Future)

The Fishbowl API connection is deferred. The core tool runs entirely on Shopify data. Fishbowl task error surfacing and cross-referencing can be added later if the employee needs it after using the Shopify-only version.

Fishbowl credentials for when Phase 4 is needed:
- API: `http://74.114.160.242:9090`
- IMPORTANT: Only 4 concurrent user slots. Use short-lived sessions — login, fetch, logout immediately.

---

## UI Layout

### Navigation
Simple top bar with three views:
1. **Orders** (default) — The daily operations view
2. **Pipeline** — Mismatch detection and inventory drift
3. **Metrics** — Defect rate tracking and trends

### Design
- Follow the wabi-sabi aesthetic established in other Sato Solutions tools
- Warm earth palette: `#1a1917`, `#2a2825`, `#c4a77d`, `#a9a4a0`, `#f5f3ef`
- Clean typography, generous whitespace
- Channel tags with distinct muted colors
- Red/yellow/green severity indicators (muted, not neon)
- Mobile-friendly — he may check this on his phone

---

## Employee Workflow

### Start of Shift (8-9 AM)
1. Opens dashboard → Orders view
2. Sees summary cards: total unfulfilled, overdue count, channel breakdown
3. Checks for red flags (overdue orders, pipeline mismatches on Pipeline tab)
4. Sorts by age (oldest first) to prioritize
5. Starts picking/packing from this list

### During Shift
- Dashboard is not real-time — he works from the morning snapshot
- If he encounters an issue (can't find item, wrong item, etc.), he logs it via the "Log Defect" button
- Re-syncs if needed (manual sync button)

### End of Shift (4-5 PM)
1. Re-syncs dashboard
2. Checks what's still unfulfilled → flags anything concerning
3. Reviews Pipeline tab for any new mismatches
4. Captures daily snapshot (button or automatic)
5. Checks Metrics tab to see today's defect rate

---

## Escalation Framework (Built Into UI)

Display as a persistent reference panel (collapsible sidebar or footer):

| Severity | Criteria | Action |
|----------|----------|--------|
| 🟢 Green | Normal operations, all orders flowing | Handle and log |
| 🟡 Yellow | 3+ orders aging past SLA, recurring sync issue | Handle, flag Anthony at end of day |
| 🟠 Amber | Oversell requiring cancellation, channel sync appears broken | Flag Anthony immediately |
| 🔴 Red | Bulk inventory discrepancy, potential platform suspension risk | Stop and call Anthony |

---

## Build Plan

### Sprint 1: Foundation + Daily Operations View
- Project scaffolding (React + Vite + Tailwind + Express + Railway Postgres)
- Shopify OAuth (client credentials with 24h refresh — reuse pattern from Inventory Health)
- Unfulfilled orders sync endpoint
- Orders table with filters, sorting, search
- Summary cards
- SLA color coding
- Deploy to Railway

### Sprint 2: Pipeline Health
- Order flow summary (received vs fulfilled, daily/weekly)
- Aging distribution chart
- Channel health table
- Backlog trend tracking (daily snapshots)

### Sprint 3: Defect Tracking
- Auto-detection logic (cancelled orders, late shipments)
- Manual defect logging UI
- Defect rate calculations (7d, 30d, by channel)
- Daily metrics snapshot
- Metrics view with trend chart

### Sprint 4: Polish
- Mobile responsiveness
- Onboarding: walk the employee through the tool
- Refine SLA rules based on real usage
- Add Fishbowl integration if needed (Phase 4 scope)

---

## Credentials

### Shopify (reuse existing app or create new one)
- Store: `nzw1ru-un.myshopify.com`
- PDX Location ID: `82814173442`
- LA Location ID: `88329879810`
- API scopes needed: `read_orders`, `read_products`, `read_inventory`, `read_fulfillments`, `read_locations`

### Railway Postgres
- Provision new database in Railway dashboard
- Store connection string in env vars

---

## What This Does NOT Do

- Does not diagnose WHY orders aren't syncing from marketplaces → Shopify (that's the employee's job to investigate)
- Does not cross-reference Fishbowl and Shopify orders (deferred to Phase 4 if needed)
- Does not auto-fix stuck orders — surfaces what's in the system for manual resolution
- Does not replace Fishbowl for pick/pack — it's the monitoring/accountability layer
- Does not handle pricing, markdown, or inventory health — those are separate tools
- Does not require the employee to understand Shopify admin, Sellware, or complex Fishbowl queries

---

## Success Criteria

1. Employee can see all unfulfilled orders across all channels in one view within 30 seconds
2. Overdue orders are immediately visible with clear severity indicators
3. Order defect rate is tracked daily with a clear trend toward <1%
4. Employee escalates issues using the severity framework without needing to ask Anthony what to do
5. Anthony checks the Metrics tab weekly instead of managing orders daily

---

## Required Output Format (for Claude Code)

**Files Changed:**
- List each file modified or created

**Summary of Changes:**
- Brief description of what was built

**Harsh Cursor Review Prompt:**
Check these files and logic:
- [ ] Shopify token refresh: Does it handle 24h expiry with auto-refresh before every API call?
- [ ] Channel detection: Is `source_name` the primary method? Does fallback logic exist?
- [ ] Order age calculation: Does it respect business days (M-F) for SLA?
- [ ] Defect rate: Is it defects/total orders (not defects/fulfilled)?
- [ ] Pagination: Does Shopify order sync handle cursor-based pagination for 200+ orders?
- [ ] Database: Are daily_metrics snapshots idempotent (UPSERT on date)?
- [ ] Error handling: What happens if Shopify API is down? Does the dashboard show cached data gracefully?
- [ ] SLA logic: Weekend orders (Fri-Sun) should show Monday as the SLA deadline, not Saturday/Sunday
- [ ] Cancelled order detection: Does it distinguish buyer cancellations from seller cancellations?
