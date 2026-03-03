# Order Operations Dashboard — CLAUDE.md

## What This Is
Order operations dashboard for West Coast Deals. Gives the warehouse manager a clean view of all unfulfilled orders across 8+ sales channels, tracks order defect rate toward a <1% goal, and replaces the need to bounce between Shopify, Fishbowl, and Sellware.

Read `docs/PROJECT_SPEC.md` for the full spec. That's the source of truth for what we're building and why.

## Tech Stack
- Frontend: React (Vite) + Tailwind CSS
- Backend: Node.js / Express
- Database: Railway Postgres
- Hosting: Railway (auto-deploy from GitHub)
- Data Source: Shopify Admin REST API (OAuth client credentials, 24h token refresh)

## Architecture Principles
- **Shopify is the only external API for now.** Fishbowl integration is Phase 4. Don't build for it prematurely.
- **Daily snapshots, not real-time.** This tool is checked twice a day (morning + end of shift), not monitored live. Design data freshness around manual sync triggers, not websockets or polling.
- **Simple tables over complex visualizations.** The user is a warehouse manager, not a data analyst. If a sorted table with color-coded rows solves it, don't build a chart.
- **Idempotent syncs.** Every sync operation should be safe to run multiple times. UPSERT on unique keys. Never duplicate order records.

## Shopify API
- Store: `nzw1ru-un.myshopify.com`
- Auth: Client credentials grant — tokens expire every 24 hours, refresh before every batch of API calls
- PDX Location: `82814173442` | LA Location: `88329879810`
- Channel detection uses `source_name` field (see PROJECT_SPEC.md for mapping)
- Pagination: cursor-based via `Link` header — always paginate, never assume <250 orders
- Rate limit: 40 req/sec bucket — check `X-Shopify-Shop-Api-Call-Limit` header

## Key Domain Rules
- **SLA:** Orders M-Th ship next business day. Fri-Sun orders ship Monday. Anything past that is overdue.
- **Defect = seller-caused problem.** Cancellations where `cancel_reason` is NOT `customer`, late shipments past SLA, wrong items. Buyer cancellations and buyer returns are NOT defects.
- **Defect rate = defects / total orders.** Not defects / fulfilled orders.
- **Channel tags:** StockX=green, GOAT=purple, SHEIN=blue, eBay=yellow, TikTok=teal, KicksCrew=orange, Amazon=amber, Shopify=gray, Whatnot=pink

## File Structure
```
├── CLAUDE.md
├── docs/
│   └── PROJECT_SPEC.md          # Full spec — read this first
├── server/
│   ├── index.js                 # Express server + static file serving
│   ├── shopify/
│   │   ├── auth.js              # Token management (24h refresh)
│   │   └── sync.js              # Order sync logic
│   ├── routes/
│   │   ├── orders.js            # Unfulfilled orders + summary
│   │   ├── defects.js           # Defect logging + rate calculation
│   │   ├── metrics.js           # Daily snapshots + historical data
│   │   └── sync.js              # Sync trigger endpoints
│   └── db/
│       ├── connection.js        # Postgres connection
│       └── migrations/          # Schema migrations
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Orders.jsx       # Daily operations view
│   │   │   ├── Pipeline.jsx     # Order flow health
│   │   │   └── Metrics.jsx      # Defect rate tracking
│   │   ├── components/
│   │   └── lib/
│   │       └── api.js           # Frontend API client
│   └── index.html
├── package.json
└── nixpacks.toml                # Railway deployment config
```

## Design Rules
- Warm earth palette: `#1a1917`, `#2a2825`, `#c4a77d`, `#a9a4a0`, `#f5f3ef`
- No neon colors. Muted greens for good, muted reds for bad.
- No Inter, Roboto, or generic SaaS fonts.
- Generous whitespace, 8px spacing scale.
- Mobile-friendly — he checks this on his phone sometimes.

## Build Order
1. **Sprint 1:** Shopify connection + unfulfilled orders table + summary cards + SLA flags + deploy
2. **Sprint 2:** Pipeline health view (aging distribution, channel health, flow trends)
3. **Sprint 3:** Defect tracking (auto-detection + manual logging + rate calculation + trend chart)
4. **Sprint 4:** Polish, mobile, Fishbowl integration if needed

**Do not skip ahead.** Each sprint should be fully working and deployed before starting the next one. The employee starts using Sprint 1 immediately.

## Common Mistakes to Avoid
- Don't sync `On Hand` inventory — always use `Available` (On Hand - Committed)
- Don't assume all orders have a `source_name` — fallback to parsing `note_attributes` or defaulting to 'Shopify'
- Don't store Shopify access tokens in the frontend — server-side only
- Don't build webhook handlers yet — manual sync is fine for twice-a-day usage
- Don't over-engineer the defect logging — a simple form with type dropdown and notes field is enough
- Weekend SLA calculation: Friday 5pm to Monday 9am is NOT overdue

## When Making Changes
- Ask: does this make the tool simpler for the warehouse manager, or more complex?
- Ask: will this decision create tech debt that blocks Phase 4 (Fishbowl), or is it compatible?
- Ask: is this solving a real problem the spec describes, or am I gold-plating?
- If unsure, go with the simpler option. We can always add complexity later.
- Update this file after every bug fix or architectural decision so the next session starts informed.
