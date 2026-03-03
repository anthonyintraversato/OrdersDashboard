# OrdersDashboard

## Required Environment Variables

Set these in the Railway dashboard as **runtime** variables (not build-time):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Railway Postgres connection string |
| `SHOPIFY_STORE` | Store domain (nzw1ru-un.myshopify.com) |
| `SHOPIFY_CLIENT_ID` | Shopify app client ID |
| `SHOPIFY_CLIENT_SECRET` | Shopify app client secret |
| `SHOPIFY_PDX_LOCATION_ID` | PDX location (82814173442) |
| `SHOPIFY_LA_LOCATION_ID` | LA location (88329879810) |
| `NODE_ENV` | Set to `production` |
| `PORT` | Set to `8080` |

**Important:** These must NOT be set as build-time secrets. The build step only runs `vite build` for the frontend and needs zero secrets.
