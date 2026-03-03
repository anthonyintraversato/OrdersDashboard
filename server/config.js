/**
 * Centralized runtime config.
 */
function config() {
  const env = process.env;
  return {
    databaseUrl:         env.DATABASE_URL,
    shopifyStore:        env.SHOPIFY_STORE,
    shopifyClientId:     env.SHOPIFY_CLIENT_ID,
    shopifyClientSecret: env.SHOPIFY_CLIENT_SECRET,
    shopifyPdxLocationId:env.SHOPIFY_PDX_LOCATION_ID,
    shopifyLaLocationId: env.SHOPIFY_LA_LOCATION_ID,
    nodeEnv:             env.NODE_ENV,
    port:                env.PORT || '8080',
    isProduction:        env.NODE_ENV === 'production',
  };
}

module.exports = { config };
